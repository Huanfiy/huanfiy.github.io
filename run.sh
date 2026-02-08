#!/bin/bash

# 始终以脚本所在目录作为工作目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}" || exit 1

# 服务器配置
SERVER_USER="ubuntu"
SERVER_HOST="huanfly.com"
REMOTE_DIR="/home/ubuntu/workspace/web/"

# 定义排除列表 (在括号内添加或删除)
EXCLUDE_LIST=(
    ".git"           # Git 版本控制目录
    ".gitignore"     # Git 忽略文件
    ".cursor"        # Cursor IDE 配置目录
    "run.sh"         # 本部署脚本
    "README.md"      # 项目说明文档
    "*.log"          # 日志文件
    ".DS_Store"      # macOS 系统文件
    # "posts/drafts" # 示例：排除特定子目录
)

# ==========================================
# 下面通常不需要修改
# ==========================================

print_help() {
    cat <<'EOF'
用法: ./run.sh <command>

可用命令:
  deploy        部署到远程服务器
  gen           扫描 posts/*.md 生成文章清单 posts/posts.json
  test [port]   启动本地测试服务器 (默认端口: 8080)
  help          显示帮助信息
EOF
}

do_gen() {
    local posts_dir="posts"
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
    for md_file in "${posts_dir}"/*.md; do
        [ -f "${md_file}" ] || continue
        found=1

        awk '
        BEGIN { in_fm=0; fm_count=0; title=""; date=""; tag=""; summary=""; cover=""; body="" }

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
            if (summary == "" && body != "") summary = substr(body, 1, 100)
            # 转义 JSON 特殊字符
            gsub(/\\/, "\\\\", title);   gsub(/"/, "\\\"", title)
            gsub(/\\/, "\\\\", summary); gsub(/"/, "\\\"", summary)
            gsub(/\\/, "\\\\", tag);     gsub(/"/, "\\\"", tag)
            gsub(/\\/, "\\\\", cover);   gsub(/"/, "\\\"", cover)
            printf "%s\t%s\t%s\t%s\t%s\t%s\n", date, title, tag, summary, cover, FILENAME
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
        printf "    \"file\": \"%s\",\n", $6
        printf "    \"title\": \"%s\",\n", $2
        printf "    \"date\": \"%s\",\n", $1
        printf "    \"tag\": \"%s\",\n", $3
        printf "    \"summary\": \"%s\",\n", $4
        printf "    \"cover\": \"%s\"\n", $5
        printf "  }"
    }
    END { print "\n]" }
    ' > "${output}"

    rm -f "${tmp_file}"
    local count
    count=$(grep -c '"file"' "${output}" 2>/dev/null || echo 0)
    echo "✅ 已生成 ${output}（共 ${count} 篇文章）"
}

do_deploy() {
    # 部署前自动生成文章清单
    do_gen

    # 构建排除参数字符串
    local exclude_params=""
    local item=""
    for item in "${EXCLUDE_LIST[@]}"; do
        exclude_params="${exclude_params} --exclude=${item}"
    done

    # 确保脚本使用当前目录作为源
    local source_dir="./"

    echo "========================================"
    echo "正在部署到 ${SERVER_HOST}..."
    echo "源目录: $(pwd)"
    echo "目标: ${REMOTE_DIR}"
    echo "排除项: ${EXCLUDE_LIST[*]}"
    echo "========================================"

    # 执行 rsync
    # -a: 归档模式 (递归 + 保留属性)
    # -v: 详细输出
    # -z: 压缩传输
    # --delete: 删除目标端多余的文件 (与源保持一致)
    # -e ssh: 使用 SSH 通道
    rsync -avz --delete ${exclude_params} -e ssh "${source_dir}" "${SERVER_USER}@${SERVER_HOST}:${REMOTE_DIR}"

    if [ $? -eq 0 ]; then
        echo "✅ 部署成功!"
    else
        echo "❌ 部署失败，请检查网络或 SSH 配置。"
    fi
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
