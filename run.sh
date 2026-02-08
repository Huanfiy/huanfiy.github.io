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
  test [port]   启动本地测试服务器 (默认端口: 8080)
  help          显示帮助信息
EOF
}

do_deploy() {
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
