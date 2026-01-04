# 项目代码结构与状态 (Codebase Structure)

> 最后更新时间: 2026-01-04
> 描述: 个人网站重构版代码结构

## 1. 目录结构

```text
/
├── index.html          # [首页] 个人展示、核心导航入口
├── blog.html           # [博客] 文章列表、Markdown 渲染页
├── tool.html           # [工具] 在线工具箱 (图片转ICO, 链接转换等)
├── about.html          # [关于] 个人介绍、经历、技能
├── css/
│   └── style.css       # [核心样式] 包含全站变量、组件、响应式规则
├── js/
│   └── script.js       # [交互脚本] 移动端菜单、平滑滚动等通用逻辑
├── posts/              # [内容] Markdown 格式的博客文章
│   ├── git_use.md
│   └── tmux_look.md
├── picture/            # [资源] 图片资源
└── README.md           # 项目说明
```

## 2. 核心功能模块

### 2.1 博客系统
- **实现方式**: 静态 HTML + 客户端 JavaScript。
- **依赖**: `marked.js` (CDN)。
- **机制**: 
    - `blog.html` 默认显示文章卡片列表。
    - 点击卡片触发 `loadMarkdown(file)`，通过 `fetch` 获取 `posts/` 目录下对应的 `.md` 文件。
    - 使用 `marked.parse()` 渲染为 HTML 并插入 DOM。
    - 支持单页内切换视图，无需跳转。

### 2.2 工具箱
- **图片转 ICO**:
    - 纯前端实现 (Canvas API)。
    - 支持拖拽上传、预览、调整大小 (64x64)、生成下载。
    - 代码内嵌于 `tool.html` 及 `js/script.js`。
- **外部工具链接**:
    - 提供入口跳转至旧版或独立的工具页 (如 `esp32_pinmapper.html`)。

### 2.3 样式架构
- **CSS 变量**: 详见 `design_system.md`。
- **Reset**: 自定义 Reset，无第三方 CSS 框架依赖。
- **动画**: 集成 `AOS.js` 实现滚动时的元素淡入/上浮效果。

## 3. 开发规范
- **HTML**: 语义化标签 (`header`, `main`, `article`, `footer`)。
- **CSS**: 
    - 类名命名遵循 BEM 变体 (如 `.card`, `.card-content` -> `.blog-title`)。
    - 移动优先或桌面优先混合，主要断点为 `768px`。
- **JS**: Vanilla JS (原生 JavaScript)，无 jQuery 依赖。

