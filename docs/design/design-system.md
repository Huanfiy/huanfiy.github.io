# 设计架构文档：手绘绘本 × 罗小黑森林

> 落档日期：2026-07-03 · 对应提交范围：2026-07-02 全站视觉重构
> 配套可视化：[design-system.html](design-system.html)（单文件，双击即开，断网可用）

## 1. 概述

本站视觉体系定位为「手绘绘本 × 罗小黑森林」：暖米色纸张底面承载手绘笔触组件，
以森林绿 / 灵气青双主色构建罗小黑（罗小黑战记）意象；深色模式整体切换为「夜之森林」场景。

### 1.1 覆盖范围

- 主站 4 个页面：`index.html`、`blog.html`、`tool.html`、`about.html`；
- 共享资源：`css/style.css`、`js/script.js`、`js/interests.js`。

### 1.2 不覆盖范围

- `tools/` 下 3 个独立应用（`keyboard.html`、`esp32_pinmapper.html`、`buy.html`）自带完整样式，
  不参与本设计体系，仅通过兼容别名消费 `css/style.css` 的少量变量与类（见 §8.1）；
- `posts/*.md` 文章内容本身的写作规范。

## 2. 文件结构与职责

| 文件 | 职责 |
|---|---|
| `css/style.css` | 设计 Token 唯一定义处 + 全部组件样式 + 深色模式覆盖 + 响应式 |
| `js/script.js` | 灵气动效（点击迸发 + 漂浮萤火）、主题切换、移动端菜单、平滑滚动 |
| `js/interests.js` | 关于页兴趣详情视图（摄影 / 科技制作 / 阅读）渲染，Toast 与 Lightbox |
| `index.html` | Hero 场景（山丘 + 小黑 SVG 内联于此文件）+ 板块入口卡片 |
| `blog.html` | 文章列表 / 详情双视图、标签筛选、搜索、`#post=` hash 路由、Markdown 渲染 |
| `tool.html` | 工具卡片列表 + 页内 ICO 转换器（含拖拽上传） |
| `about.html` | 简介、时间线、兴趣卡片与详情视图容器 |

页面结构模式：单页内「列表视图 ↔ 详情视图」通过 `display` 切换（博客文章、ICO 工具、兴趣详情均采用此模式）。

## 3. 设计 Token

全部 Token 定义于 `css/style.css` 的 `:root`，深色模式在 `[data-theme="dark"]` 中整组覆盖。
组件一律引用变量，禁止散写 hex。

### 3.1 色彩

| Token | 浅色（纸面） | 深色（夜之森林） | 语义 |
|---|---|---|---|
| `--bg-color` | `#f7f3e8` | `#141c16` | 页面底色 |
| `--card-bg` | `#fffdf5` | `#1d2a20` | 卡片 / 面板 |
| `--ink` / `--dark-text` | `#2f3630` | `#dfe9dc` / `#e4ecdf` | 墨线 / 正文 |
| `--light-text` | `#6d7a6e` | `#9cab99` | 次要文字 |
| `--line` / `--line-soft` | 墨色 55% / 16% 透明度 | 淡墨 45% / 14% 透明度 | 强 / 弱描边 |
| `--primary-color` | `#5da844`（hover `#4c9636`） | `#7cc95f` | 森林绿主色 |
| `--accent-color` | `#4fc4cf` | `#6fd8e2` | 灵气青强调色 |
| `--warm` / `--rose` / `--violet` | `#f2b950` / `#e8836f` / `#9b7ede` | `#f2c46e` / `#ee9a88` / `#b39aec` | 卡片色调扩展 |
| `--hill-back/mid/front` | `#cfe6b8` / `#a8d38a` / `#7cba5e` | `#223528` / `#2a4430` / `#34573b` | Hero 三层山丘 |
| `--tree` / `--cat-ink` | `#58924a` / `#23281f` | `#26402c` / `#10140e` | 树 / 小黑 |
| `--footer-bg` | `#edf3df` | `#101711` | 草地页脚 |

派生透明色统一使用 `color-mix(in srgb, …)`，不引入新 hex。

### 3.2 手绘圆角（wobble radius）

不规则圆角是手绘感的核心手段，四档变量按尺寸选用：

| Token | 值 | 用途 |
|---|---|---|
| `--wobble-btn` | `255px 18px 225px 18px / 18px 225px 18px 255px` | 按钮、chip、搜索框、Toast |
| `--wobble-card` | `24px 18px 26px 16px / 18px 26px 16px 28px` | 卡片默认 |
| `--wobble-card-alt` | `18px 26px 16px 28px / 26px 18px 28px 16px` | 偶数卡片（`:nth-child(even)`），打破规律感 |
| `--wobble-sm` | `12px 16px 13px 17px / 16px 12px 17px 13px` | 缩略图、代码块、小组件 |

头像 / 图标类圆形元素使用 `46% 54% 52% 48% / 54% 46% 54% 46%` 的近圆 wobble。

### 3.3 阴影

| Token | 构成 | 用途 |
|---|---|---|
| `--shadow-sm` | `3px 4px 0` 墨色 7% | 卡片静置（纸片错位感） |
| `--shadow-md` | 错位 `5px 7px 0` + 漂浮 `0 14px 30px` 绿色 10% | 面板、hover 前置 |
| `--shadow-hover` | 错位 `7px 9px 0` + 漂浮 `0 20px 40px` | 卡片 hover |
| `--shadow-ink` / `--shadow-ink-hover` | `3px 3px 0` / `5px 6px 0` 墨色 28% / 30% | 实心按钮「贴纸」硬阴影 |

### 3.4 字体

- 字体栈：`'LXGW WenKai Screen', 'LXGW WenKai', 'PingFang SC', 'Microsoft YaHei', sans-serif`；
- 霞鹜文楷屏幕版经 jsDelivr 按 unicode-range 分包加载（见 §7），加载失败自动落到系统字体，布局不破坏；
- 正文 `line-height: 1.8`、`letter-spacing: 0.01em`；代码使用 `JetBrains Mono / Fira Code / Consolas` 栈。

### 3.5 布局

- 容器宽 `--container-width: 1100px`；Header 高 `--header-height: 68px`；
- Hero 山丘高度 `--hills-h: clamp(130px, 18vw, 210px)`，SVG 与小黑定位共用该变量；
- 栅格 `.grid-3`：`repeat(auto-fit, minmax(280px, 1fr))`，间距 28 px；
- 响应式断点：768 px（导航折叠、博客卡片纵排、山丘缩放）。

## 4. 视觉签名元素

| 元素 | 实现 | 位置 |
|---|---|---|
| 纸纹噪点 | `body::after` 全屏覆盖 SVG `feTurbulence`（alpha ≤ 0.05）data URI | 全站 |
| 波浪线下划线 | 内联 SVG data URI，用于 `.section-title::after`、导航激活态、Markdown `hr` | 全站 |
| 马克笔高亮 | `.marker`：青→绿 45% 透明渐变，`background-size: 100% 42%` 压在文字下沿 | Hero、关于页标题 |
| 胶带贴纸 | 半透明色块 + 旋转（`::before/::after`） | Hero 头像、博客缩略图 |
| 山丘场景 | 三层 `path` + 树剪影，`fill` 绑定 CSS 变量随主题切换 | `index.html` 内联 SVG |
| 小黑 | 纯 SVG：眨眼（`cat-blink` 5 s）、摇尾（`tail-swish` 3.6 s）、抖耳（`ear-twitch` 7 s），深色模式加青色 drop-shadow | `index.html` 内联 SVG |
| 草地页脚 | `footer::before` 波浪草丛 SVG data URI，颜色与 `--footer-bg` 同值衔接 | 全站 |

## 5. 组件规范

- **按钮**：`.btn`（实心绿 + 2 px 墨线 + 硬阴影，hover 上移并微旋 −0.5°）、`.btn-outline`（纸底），激活态下沉；
- **卡片家族**：`.card` 基类 + 场景类 `.entry-card` / `.tool-card` / `.blog-card` / `.interest-card`；
  色调由修饰类 `.tone-green/teal/amber/rose/violet` 注入 `--tone` / `--tone-soft` 两个变量，
  图标、链接、时间线节点自动取用——新增色调只需加一行修饰类；
- **博客列表**：纵向单列（`content-visibility: auto` 保留渲染优化），缩略图左置、微倾斜 ±1.2°、带胶带；
- **筛选 chips**：`.filter-chip`，由 `posts.json` 的 `tag` 字段去重动态生成，与搜索框联动过滤；
- **Markdown 阅读**（`.markdown-body`）：纸面卡片，`h1/h2` 虚线分隔，无序列表项前缀 `✦`，
  代码块深墨绿底（`#253029`，深色模式 `#101711`），引用块绿色系提示条；
- **时间线**：`.timeline` 虚线枝干 + wobble 圆点节点，节点颜色取 `--tone`；
- **Toast / Lightbox**：保持 `js/interests.js` 原有 API（`showToast` / `openLightbox`），仅重绘外观。

## 6. 动效体系

### 6.1 CSS 动画（style.css 内定义）

| 动画 | 时长 | 对象 |
|---|---|---|
| `blob-float` | 14 s 往返 | Hero 三个模糊色斑 |
| `gentle-bob` | 5 s | Hero 头像悬浮 |
| `tail-swish` / `cat-blink` / `ear-twitch` | 3.6 s / 5 s / 7 s | 小黑 |
| hover 位移 + 微旋 | 0.25–0.35 s | 卡片、按钮、图标 |

### 6.2 Canvas 双层（js/script.js）

| 层 | class | z-index | 行为 |
|---|---|---|---|
| 漂浮萤火 | `.spirit-layer` | 5 | 10 个（<768 px）/ 20 个灵气点缓慢上浮 + 摇曳 + 闪烁；深色模式基础透明度 0.55，浅色 0.32；标签页隐藏时暂停 |
| 点击迸发 | `.burst-layer` | 9950 | 每次点击 18 + 8 粒子（冷却 90 ms），负重力 −0.012 轻微上浮，绿 / 青 / 琥珀配色 |

### 6.3 降级策略

- `prefers-reduced-motion: reduce`：萤火层不创建；点击迸发退化为单个扩散圆环（`.reduced-motion-click`）；
  CSS 关键帧动画与 hover 位移全部关闭；
- AOS 滚动入场仅作增强，脚本加载失败不影响内容可见性。

### 6.4 z-index 秩序

`5` 萤火 → `99` 移动端菜单 → `100` Header → `9950` 点击迸发 → `9960` 纸纹 → `9990` Toast → `9999` Lightbox。

## 7. 外部依赖与降级行为

| 依赖 | 版本 | 源 | 失败行为 |
|---|---|---|---|
| LXGW WenKai Screen | 1.7.0 | jsDelivr | 落到 PingFang SC / 微软雅黑，布局不变 |
| Font Awesome | 6.4.0 | cdnjs | 图标缺失，文字信息完整 |
| AOS | 2.3.1 | unpkg | 无滚动入场动画，内容直接可见 |
| Marked.js | 4.0.12 | jsDelivr → unpkg → cdnjs 三级回退 | 三源均失败时文章页给出显式错误提示 |

Marked.js 仅 `blog.html` 加载；其余页面无 Markdown 依赖。

## 8. 兼容性边界

### 8.1 tools/ 独立应用契约

`tools/keyboard.html` 与 `tools/buy.html` 通过 `../css/style.css` 消费以下遗留接口，
**删除任一项将直接破坏这两个页面**：

- 变量别名：`--border-color`（→ `--line-soft`）、`--radius-lg: 20px`、`--radius-md: 12px`；
- 类别名：`.tool-icon`（与 `.card-icon` 同规则）；
- 结构类：`header` / `.nav-links` / `.theme-toggle` / `.card` / `.btn` / `.btn-outline` 的类名与语义。

### 8.2 浏览器特性要求

依赖 `color-mix()`（Chrome 111 / Safari 16.2 / Firefox 113 及以上）、`backdrop-filter`、
`transform-box: fill-box`、`content-visibility`。低于该基线的浏览器表现为派生色缺失，
主体内容与布局仍可用；未做针对性兼容处理。

### 8.3 主题切换机制

主题状态存储于 `localStorage.theme`，各页面 `<head>` 内联脚本在首帧前写入
`<html data-theme>`，避免闪白；无存储值时跟随 `prefers-color-scheme`。

## 9. 维护指引

- **新增卡片色调**：在 style.css 追加 `.tone-x { --tone: …; --tone-soft: …; }` 并补深色值，组件自动适配；
- **新增文章**：仅编辑 `posts/posts.json`（`tag` 会自动进入筛选 chips），无封面时按 `TAG_GRADIENTS` 生成粉彩渐变图；
- **调整山丘 / 小黑**：直接编辑 `index.html` 内联 SVG，颜色务必继续引用 `var(--hill-*)` / `var(--cat-ink)` 以保持主题联动；
- **改动共享类名前**：先按 §8.1 检查 `tools/` 引用（`grep -o 'var(--[a-z-]*)' tools/*.html`）。
