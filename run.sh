#!/bin/bash

set -Eeuo pipefail

# 始终以脚本所在目录作为工作目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}" || exit 1

# 服务器配置
SERVER_USER="ubuntu"
SERVER_HOST="huanfly.com"
REMOTE_DIR="/srv/www/blog/"
PUBLIC_BASE_URL="https://${SERVER_HOST}"
DEPLOY_ARTIFACT_DIR=""

cleanup() {
    if [ -n "${DEPLOY_ARTIFACT_DIR}" ]; then
        rm -rf "${DEPLOY_ARTIFACT_DIR}"
    fi
}

trap cleanup EXIT

# ==========================================
# 下面通常不需要修改
# ==========================================

print_help() {
    cat <<'EOF'
用法: ./run.sh <command>

可用命令:
  deploy [--gen] [git-ref]
                 从已推送的 Git 提交生成临时产物并部署（默认 git-ref: HEAD）
                 --gen 仅在临时产物中重新生成 posts/posts.json
  gen           扫描 posts/*.md 生成文章清单 posts/posts.json
  test [port]   启动本地测试服务器 (默认端口: 8080)
  help          显示帮助信息
EOF
}

do_gen() {
    local root_dir="${1:-${SCRIPT_DIR}}"
    root_dir="$(cd "${root_dir}" && pwd)"

    local posts_dir="${root_dir}/posts"
    local output="${posts_dir}/posts.json"
    local tmp_file
    tmp_file=$(mktemp)

    # 检查 posts 目录是否存在
    if [ ! -d "${posts_dir}" ]; then
        echo "❌ ${posts_dir} 目录不存在"
        exit 1
    fi

    # 扫描每个 .md 文件，解析 Front Matter 输出为 TAB 分隔的中间格式
    local found=0
    local md_file=""
    local public_file=""
    for md_file in "${posts_dir}"/*.md; do
        [ -f "${md_file}" ] || continue
        found=1
        public_file="posts/$(basename "${md_file}")"

        awk -v public_file="${public_file}" '
        BEGIN { in_fm=0; fm_count=0; title=""; date=""; tag=""; summary=""; cover=""; coverFit=""; publish="true"; body="" }

        /^---[[:space:]]*$/ {
            fm_count++
            if (fm_count == 1) in_fm = 1
            if (fm_count == 2) in_fm = 0
            next
        }

        in_fm {
            if (/^title:/) { sub(/^title:[[:space:]]*/, ""); title = $0 }
            else if (/^date:/) { sub(/^date:[[:space:]]*/, ""); date = $0 }
            else if (/^tag:/) { sub(/^tag:[[:space:]]*/, ""); tag = $0 }
            else if (/^summary:/) { sub(/^summary:[[:space:]]*/, ""); summary = $0 }
            else if (/^cover:/) { sub(/^cover:[[:space:]]*/, ""); cover = $0 }
            else if (/^coverFit:/) { sub(/^coverFit:[[:space:]]*/, ""); coverFit = $0 }
            else if (/^publish:/) { sub(/^publish:[[:space:]]*/, ""); publish = $0 }
            next
        }

        # 提取正文首段作为备用摘要（跳过标题和空行）
        fm_count >= 2 && body == "" {
            if (/^#/ || /^[[:space:]]*$/ || /^---/ || /^===/) next
            line = $0
            gsub(/[*_`\[\]()]/, "", line)
            gsub(/^[[:space:]]+/, "", line)
            gsub(/[[:space:]]+$/, "", line)
            if (line != "") body = line
        }

        END {
            p = tolower(publish)
            if (p == "false" || p == "0" || p == "no") exit
            if (summary == "" && body != "") summary = substr(body, 1, 100)
            # 转义 JSON 特殊字符
            gsub(/\\/, "\\\\", title);   gsub(/"/, "\\\"", title)
            gsub(/\\/, "\\\\", summary); gsub(/"/, "\\\"", summary)
            gsub(/\\/, "\\\\", tag);     gsub(/"/, "\\\"", tag)
            gsub(/\\/, "\\\\", cover);   gsub(/"/, "\\\"", cover)
            gsub(/\\/, "\\\\", coverFit); gsub(/"/, "\\\"", coverFit)
            printf "%s\t%s\t%s\t%s\t%s\t%s\t%s\n", date, title, tag, summary, cover, coverFit, public_file
        }
        ' "${md_file}" >> "${tmp_file}"
    done

    if [ "${found}" -eq 0 ]; then
        echo "[]" > "${output}"
        echo "⚠️  未找到任何 .md 文件，已生成空清单"
        rm -f "${tmp_file}"
        return
    fi

    # 按日期倒序排列，格式化为 JSON
    sort -t$'\t' -k1 -r "${tmp_file}" | awk -F'\t' '
    BEGIN { print "["; first = 1 }
    {
        if (!first) print ","
        first = 0
        print "  {"
        printf "    \"file\": \"%s\",\n", $7
        printf "    \"title\": \"%s\",\n", $2
        printf "    \"date\": \"%s\",\n", $1
        printf "    \"tag\": \"%s\",\n", $3
        printf "    \"summary\": \"%s\",\n", $4
        if ($6 != "") {
            printf "    \"cover\": \"%s\",\n", $5
            printf "    \"coverFit\": \"%s\"\n", $6
        } else {
            printf "    \"cover\": \"%s\"\n", $5
        }
        printf "  }"
    }
    END { print "\n]" }
    ' > "${output}"

    rm -f "${tmp_file}"
    local count
    count=$(grep -c '"file"' "${output}" 2>/dev/null || true)
    echo "✅ 已生成 ${output}（共 ${count} 篇文章）"
}

require_command() {
    local command_name="$1"
    if ! command -v "${command_name}" >/dev/null 2>&1; then
        echo "❌ 缺少部署依赖: ${command_name}"
        return 1
    fi
}

write_deploy_marker() {
    local artifact_dir="$1"
    local commit_sha="$2"
    local requested_ref="$3"
    local generated_at
    generated_at=$(date -u '+%Y-%m-%dT%H:%M:%SZ')

    python3 - "${artifact_dir}/deploy-version.json" "${commit_sha}" "${requested_ref}" "${generated_at}" <<'PY'
import json
import sys

output, commit, requested_ref, generated_at = sys.argv[1:]
with open(output, "w", encoding="utf-8") as fp:
    json.dump(
        {
            "schema": 1,
            "commit": commit,
            "ref": requested_ref,
            "generated_at": generated_at,
        },
        fp,
        ensure_ascii=False,
        indent=2,
    )
    fp.write("\n")
PY
}

validate_artifact() {
    local artifact_dir="$1"
    local required_file=""
    local json_file=""

    for required_file in \
        index.html \
        css/style.css \
        js/script.js \
        posts/posts.json \
        manifest.webmanifest \
        deploy-version.json; do
        if [ ! -f "${artifact_dir}/${required_file}" ]; then
            echo "❌ 发布产物缺少文件: ${required_file}"
            return 1
        fi
    done

    for json_file in \
        activity.json \
        posts/posts.json \
        manifest.webmanifest \
        deploy-version.json; do
        python3 -m json.tool "${artifact_dir}/${json_file}" >/dev/null
    done

    if command -v node >/dev/null 2>&1; then
        node --check "${artifact_dir}/js/script.js"
    fi

    if [ -e "${artifact_dir}/.git" ] || [ -e "${artifact_dir}/run.sh" ] || [ -e "${artifact_dir}/deploy" ]; then
        echo "❌ 发布产物包含仅供开发或运维使用的文件"
        return 1
    fi

    if find "${artifact_dir}" \( -name '.cursor' -o -name 'README.md' -o -name '*.test.js' \) -print -quit | grep -q .; then
        echo "❌ 发布产物包含嵌套开发文件"
        return 1
    fi

    echo "✅ 发布产物校验通过"
}

smoke_test() {
    local expected_sha="$1"
    local marker=""
    local remote_sha=""
    local headers=""
    local route=""
    local curl_args=(
        --retry 3
        --retry-all-errors
        --connect-timeout 10
        --max-time 30
        --location
        --fail
        --silent
        --show-error
    )

    marker=$(curl "${curl_args[@]}" "${PUBLIC_BASE_URL}/deploy-version.json?verify=${expected_sha}")
    remote_sha=$(printf '%s' "${marker}" | python3 -c 'import json, sys; print(json.load(sys.stdin)["commit"])')
    if [ "${remote_sha}" != "${expected_sha}" ]; then
        echo "❌ 线上版本不匹配: expected=${expected_sha}, actual=${remote_sha}"
        return 1
    fi

    for route in \
        / \
        /blog.html \
        /tool.html \
        /about.html \
        /css/style.css \
        /js/script.js \
        /activity.json \
        /manifest.webmanifest; do
        curl "${curl_args[@]}" --output /dev/null "${PUBLIC_BASE_URL}${route}?verify=${expected_sha}"
    done

    headers=$(curl "${curl_args[@]}" --head "${PUBLIC_BASE_URL}/css/style.css?verify=${expected_sha}")
    if ! printf '%s\n' "${headers}" | grep -qi '^Cache-Control:.*no-cache'; then
        echo "❌ 线上 CSS 未启用 no-cache 重验证"
        return 1
    fi
    if ! printf '%s\n' "${headers}" | grep -qi '^ETag:'; then
        echo "❌ 线上 CSS 缺少 ETag"
        return 1
    fi

    headers=$(curl "${curl_args[@]}" --head "${PUBLIC_BASE_URL}/manifest.webmanifest?verify=${expected_sha}")
    if ! printf '%s\n' "${headers}" | grep -qi '^Content-Type: application/manifest+json'; then
        echo "❌ manifest.webmanifest 的 MIME 类型不正确"
        return 1
    fi

    echo "✅ 线上冒烟验证通过: ${expected_sha}"
}

do_deploy() {
    local run_gen=0
    local requested_ref="HEAD"
    local ref_was_set=0
    local arg=""
    for arg in "$@"; do
        case "${arg}" in
            --gen)
                run_gen=1
                ;;
            --no-gen)
                run_gen=0
                ;;
            -h|--help)
                echo "用法: ./run.sh deploy [--gen] [git-ref]"
                echo "  --gen     仅在临时发布产物中重新生成 posts/posts.json"
                echo "  git-ref   已推送到 origin/main 的提交或引用，默认 HEAD"
                return 0
                ;;
            -* )
                echo "❌ deploy 不支持参数: ${arg}"
                echo "用法: ./run.sh deploy [--gen] [git-ref]"
                return 1
                ;;
            *)
                if [ "${ref_was_set}" -eq 1 ]; then
                    echo "❌ deploy 只能指定一个 git-ref"
                    return 1
                fi
                requested_ref="${arg}"
                ref_was_set=1
                ;;
        esac
    done

    require_command git
    require_command tar
    require_command rsync
    require_command ssh
    require_command curl
    require_command python3

    local worktree_status
    worktree_status=$(git status --porcelain --untracked-files=normal)
    if [ -n "${worktree_status}" ]; then
        echo "❌ 工作区存在未提交改动，拒绝生产部署:"
        printf '%s\n' "${worktree_status}"
        return 1
    fi

    git fetch --quiet origin main

    local commit_sha
    local short_sha
    commit_sha=$(git rev-parse --verify "${requested_ref}^{commit}")
    short_sha=$(git rev-parse --short=12 "${commit_sha}")

    if ! git merge-base --is-ancestor "${commit_sha}" origin/main; then
        echo "❌ 目标提交尚未推送到 origin/main: ${commit_sha}"
        return 1
    fi

    local artifact_dir
    artifact_dir=$(mktemp -d)
    DEPLOY_ARTIFACT_DIR="${artifact_dir}"
    chmod 0755 "${artifact_dir}"

    git archive --format=tar "${commit_sha}" | tar -xf - -C "${artifact_dir}"

    if [ "${run_gen}" -eq 1 ]; then
        echo "ℹ️  在临时发布产物中重新生成 posts/posts.json"
        do_gen "${artifact_dir}"
    fi

    write_deploy_marker "${artifact_dir}" "${commit_sha}" "${requested_ref}"
    validate_artifact "${artifact_dir}"

    echo "========================================"
    echo "正在部署 Git 产物到 ${SERVER_HOST}..."
    echo "提交: ${commit_sha} (${short_sha})"
    echo "引用: ${requested_ref}"
    echo "目标: ${REMOTE_DIR}"
    echo "========================================"

    rsync \
        -avz \
        --delay-updates \
        --delete-delay \
        --chmod=D755,F644 \
        -e ssh \
        "${artifact_dir}/" \
        "${SERVER_USER}@${SERVER_HOST}:${REMOTE_DIR}"

    smoke_test "${commit_sha}"
    echo "✅ 部署成功: ${commit_sha}"
}

do_test() {
    local port="${1:-8080}"

    if ! command -v python3 >/dev/null 2>&1; then
        echo "❌ 未找到 python3，请先安装 Python3。"
        exit 1
    fi

    if ! [[ "${port}" =~ ^[0-9]+$ ]]; then
        echo "❌ 端口必须是数字，例如: ./run.sh test 8080"
        exit 1
    fi

    if (( port < 1 || port > 65535 )); then
        echo "❌ 端口范围应为 1-65535: ${port}"
        exit 1
    fi

    echo "========================================"
    echo "启动本地测试服务器..."
    echo "目录: $(pwd)"
    echo "访问: http://localhost:${port}"
    echo "停止: Ctrl+C"
    echo "========================================"

    python3 -m http.server "${port}" --bind 127.0.0.1
}

command="${1:-}"
if [ $# -gt 0 ]; then
    shift
fi

case "${command}" in
    deploy)
        do_deploy "$@"
        ;;
    gen)
        do_gen "$@"
        ;;
    test)
        do_test "$@"
        ;;
    help|-h|--help|"")
        print_help
        ;;
    *)
        echo "❌ 未知命令: ${command}"
        echo
        print_help
        exit 1
        ;;
esac
