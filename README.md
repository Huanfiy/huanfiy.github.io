# Personal Web

个人网站，包含博客、在线工具箱和个人展示页面。纯静态实现，无需构建，使用 rsync 部署到 [huanfly.com](https://huanfly.com)。

## 功能

- **博客系统** — Markdown 驱动，客户端渲染，文章存放于 `posts/` 目录
- **工具箱** — 图片转 ICO、ESP32-S3 引脚映射器、键位练习、链接转换器
- **个人展示** — 首页、关于页面，响应式布局

## 设计风格

采用罗小黑战记主题，以森林绿（`#6ab04c`）为主色调，搭配灵质蓝（`#7ed6df`）强调色，整体风格清新治愈。大圆角卡片、柔和阴影、玻璃拟态导航栏，配合 AOS 滚动动画，营造轻松自然的浏览体验。

## 技术栈

- HTML5 + CSS3 + 原生 JavaScript，无框架
- [Marked.js](https://github.com/markedjs/marked) — Markdown 解析
- [AOS.js](https://github.com/michalsnik/aos) — 滚动动画
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
│   ├── esp32_pinmapper.html
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

**部署到服务器：**

```bash
./run.sh deploy        # rsync 同步到远程服务器
```
