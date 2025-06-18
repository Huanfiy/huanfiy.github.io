# Jekyll 博客管理 Makefile
# 使用方法: make [命令]

# 默认目标
.DEFAULT_GOAL := help

# 变量定义
BUNDLE := bundle
JEKYLL := $(BUNDLE) exec jekyll
PORT := 4000

# 显示帮助信息
help: ## 显示帮助信息
	@echo "Jekyll 博客管理命令:"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  ✨ \033[36m%-15s\033[0m %s\n", $$1, $$2}'

# 安装依赖
install: ## 安装 Jekyll 和插件依赖
	@echo "📦 安装依赖..."
	$(BUNDLE) install

# 更新依赖
update: ## 更新依赖到最新版本
	@echo "🔄 更新依赖..."
	$(BUNDLE) update

# 本地开发服务器
serve: ## 启动本地开发服务器
	@echo "🚀 启动开发服务器 (http://localhost:$(PORT))"
	$(JEKYLL) serve --host 0.0.0.0 --port $(PORT) --livereload

# 构建网站
build: ## 构建生产版本网站
	@echo "🔨 构建网站..."
	JEKYLL_ENV=production $(JEKYLL) build

# 清理构建文件
clean: ## 清理构建文件和缓存
	@echo "🧹 清理构建文件..."
	$(JEKYLL) clean
	rm -rf _site .sass-cache .jekyll-cache

# 新建文章
post: ## 创建新文章 (使用: make post TITLE="文章标题")
	@if [ -z "$(TITLE)" ]; then \
		echo "❌ 请提供文章标题: make post TITLE=\"我的新文章\""; \
		exit 1; \
	fi
	@DATE=$$(date +%Y-%m-%d); \
	FILENAME="posts/$$DATE-$$(echo '$(TITLE)' | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | sed 's/^-\|-$$//g').md"; \
	echo "📝 创建新文章: $$FILENAME"; \
	mkdir -p posts; \
	cat > "$$FILENAME" << 'EOF' ;\
---\
title: "$(TITLE)"\
date: $$DATE\
categories: []\
tags: []\
description: ""\
author: "Huanfiy"\
---\
\
# $(TITLE)\
\
在这里编写你的文章内容...\
EOF
	@echo "✅ 文章创建完成!"

# 部署到生产环境
deploy: build ## 部署到生产服务器
	@echo "🚀 部署到生产环境..."
	./deploy.sh production

# 部署到测试环境
deploy-staging: build ## 部署到测试环境
	@echo "🧪 部署到测试环境..."
	./deploy.sh staging

# 检查网站
check: build ## 检查构建的网站
	@echo "🔍 检查网站..."
	$(BUNDLE) exec htmlproofer _site --check-html --check-favicon --disable-external || true

# 开发模式（草稿模式）
dev: ## 开发模式（包含草稿文章）
	@echo "🛠️ 启动开发模式..."
	$(JEKYLL) serve --host 0.0.0.0 --port $(PORT) --livereload --drafts --future

# 快速重启
restart: clean serve ## 清理后重新启动服务器

# 查看网站信息
info: ## 显示网站信息
	@echo "📊 网站信息:"
	@echo "  Jekyll 版本: $$($(JEKYLL) --version)"
	@echo "  Ruby 版本: $$(ruby --version)"
	@echo "  Bundle 版本: $$($(BUNDLE) --version)"
	@if [ -f "_config.yml" ]; then \
		echo "  网站标题: $$(grep '^title:' _config.yml | cut -d' ' -f2-)"; \
		echo "  网站URL: $$(grep '^url:' _config.yml | cut -d' ' -f2-)"; \
	fi

.PHONY: help install update serve build clean post deploy deploy-staging check dev restart info 