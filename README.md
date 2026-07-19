# Personal Web

开源的纯静态个人网站，包含博客、在线工具箱和个人展示页面。无需前端构建即可部署到静态托管平台；线上实例为 [huanfly.com](https://huanfly.com)。

## 功能

- **博客系统** — Markdown 驱动，客户端渲染，文章存放于 `posts/` 目录
- **工具箱** — 图片转 ICO、键位练习、链接转换器
- **个人展示** — 首页、关于页面，响应式布局

## 设计风格

采用罗小黑战记主题，以森林绿（`#6ab04c`）为主色调，搭配灵质蓝（`#7ed6df`）强调色，整体风格清新治愈。大圆角卡片、柔和阴影、玻璃拟态导航栏，配合自托管的滚动入场动画（CSS 关键帧 + IntersectionObserver），营造轻松自然的浏览体验。

## 技术栈

- HTML5 + CSS3 + 原生 JavaScript，无框架
- [Marked.js](https://github.com/markedjs/marked) — Markdown 解析
- [Font Awesome](https://fontawesome.com/) — 图标

## 项目结构

```
├── index.html            # 首页
├── blog.html             # 博客
├── tool.html             # 工具箱（含图片转 ICO）
├── about.html            # 关于
├── css/style.css         # 全局样式
├── js/script.js          # 通用脚本
├── posts/                # Markdown 博客文章
├── tools/                # 独立工具页面
│   ├── keyboard.html
│   └── buy.html
├── picture/              # 图片资源
└── run.sh                # 部署与测试脚本
```

## 使用

**本地预览：**

```bash
./run.sh test          # 启动本地服务器，默认端口 8080
./run.sh test 3000     # 指定端口
```

**生成文章索引：**

```bash
./run.sh gen
```

**可选 rsync 部署：**

```bash
DEPLOY_TARGET='user@example.com:/srv/www/blog/' \
PUBLIC_BASE_URL='https://blog.example.com' \
./run.sh deploy HEAD
```

部署目标必须通过环境变量注入。仓库不管理 Nginx、TLS、DNS、服务器账号、生产目录或其他托管平台配置。GitHub Pages、Cloudflare Pages、Netlify、Vercel 等平台可直接使用各自的发布工作流，无需调用 `./run.sh deploy`。详细边界见 [发布产物与外部部署边界](docs/design/deployment-architecture.md)。
