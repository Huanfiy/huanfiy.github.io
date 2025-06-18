#!/bin/bash

# Jekyll 云服务器部署脚本
# 使用方法: ./deploy.sh [production|staging]

set -e # 遇到错误立即退出

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 配置变量 (请根据你的服务器配置修改)
PROD_SERVER="your-server.com"
STAGING_SERVER="staging.your-server.com"
REMOTE_USER="www-data"
REMOTE_PATH="/var/www/html"

# 获取部署环境
ENVIRONMENT=${1:-production}

if [ "$ENVIRONMENT" = "production" ]; then
    SERVER=$PROD_SERVER
    echo -e "${GREEN}🚀 部署到生产环境: $SERVER${NC}"
elif [ "$ENVIRONMENT" = "staging" ]; then
    SERVER=$STAGING_SERVER
    echo -e "${YELLOW}🧪 部署到测试环境: $SERVER${NC}"
else
    echo -e "${RED}❌ 无效的环境参数，请使用 production 或 staging${NC}"
    exit 1
fi

echo -e "${YELLOW}📦 开始构建 Jekyll 站点...${NC}"

# 清理旧的构建文件
rm -rf _site

# 安装依赖
echo -e "${YELLOW}📋 检查依赖...${NC}"
if [ ! -f "Gemfile.lock" ]; then
    bundle install
else
    bundle update
fi

# 构建站点
echo -e "${YELLOW}🔨 构建站点...${NC}"
JEKYLL_ENV=$ENVIRONMENT bundle exec jekyll build

# 检查构建是否成功
if [ ! -d "_site" ]; then
    echo -e "${RED}❌ 构建失败，_site 目录不存在${NC}"
    exit 1
fi

echo -e "${GREEN}✅ 构建完成${NC}"

# 可选：HTML 验证
echo -e "${YELLOW}🔍 验证 HTML...${NC}"
# bundle exec htmlproofer _site --check-html --check-favicon --check-opengraph || true

# 部署到服务器
echo -e "${YELLOW}🚀 部署到服务器 $SERVER...${NC}"

# 使用 rsync 同步文件
rsync -avz --delete \
    --exclude='.git' \
    --exclude='node_modules' \
    --exclude='.DS_Store' \
    _site/ \
    "$REMOTE_USER@$SERVER:$REMOTE_PATH/"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}🎉 部署成功！${NC}"
    echo -e "${GREEN}网站地址: https://$SERVER${NC}"
else
    echo -e "${RED}❌ 部署失败${NC}"
    exit 1
fi

# 清理构建文件（可选）
# rm -rf _site

echo -e "${GREEN}✨ 部署完成！${NC}"
