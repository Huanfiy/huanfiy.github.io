#!/bin/bash

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

# 构建排除参数字符串
EXCLUDE_PARAMS=""
for item in "${EXCLUDE_LIST[@]}"; do
    EXCLUDE_PARAMS="${EXCLUDE_PARAMS} --exclude=${item}"
done

# 确保脚本使用当前目录作为源
SOURCE_DIR="./"

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
rsync -avz --delete ${EXCLUDE_PARAMS} -e ssh "${SOURCE_DIR}" "${SERVER_USER}@${SERVER_HOST}:${REMOTE_DIR}"

if [ $? -eq 0 ]; then
    echo "✅ 部署成功!"
else
    echo "❌ 部署失败，请检查网络或 SSH 配置。"
fi
