# 设计架构文档：手绘绘本 × 罗小黑森林

## 1. 概述

本站视觉体系定位为「手绘绘本 × 罗小黑森林」：暖米色纸张底面承载手绘笔触组件，
以森林绿 / 灵气青双主色构建罗小黑（罗小黑战记）意象；深色模式整体切换为「夜之森林」场景。

### 1.1 覆盖范围

- 主站页面：`index.html`、`blog.html`、`tool.html`、`about.html`；
- 独立场景的风格定位：`studio.html`（Three.js 工作室，见 §1.3）；
- 延伸页面：`tools/downloads.html`、`tools/visualizations.html`；
- 共享资源：`css/style.css`、`js/script.js`、`js/interests.js`；
- 部分复用共享样式的工具页：`tools/keyboard.html`、`tools/buy.html`。

### 1.2 不覆盖范围

- `tools/visualizations/foc.html` 使用独立页面样式，不受共享组件规范约束；
- `tools/keyboard.html`、`tools/buy.html` 的页面专属布局与交互样式；
- `posts/*.md` 的内容写作规范与文章发布流程。发布流程见 [blog-auto-publish.md](blog-auto-publish.md)。

### 1.3 风格延展：嵌入式极客工作室

Three.js 工作室是 Huanfly 个人设计风格在三维空间中的延展。

核心是**温暖自然的手绘插画风，融合克制的极客科技感**。以午后阳光、木质家具和绿意营造轻松惬意的氛围，通过可操作的电子设备与 3D 交互带来探索乐趣。

局部描边、纸张与布料纹理、便签式面板延续本站的手绘语言；科技感主要由仪器操作及其反馈表达，环境动效保持舒缓，让技术与生活气息自然相融。

窗外与建筑属于连续空间：同层庭院、侧向石径和低缓田野由实体墙自然遮挡，远景按世界方位绘制。精细绿意集中在窗边，其他方位与地表外缘柔和融入纸面底色，保留室内主体与留白；不把环境扩展理解为铺满整个画面的高饱和乡村背景。日夜的土地、植被与天空需共同变色，避免亮边；云鸟独立运动，静态画布不做周期性全幅重绘。

工作室采用独立样式与 Three.js 场景渲染。本节记录其风格定位；下文的共享 Token、组件、动效及主题规则适用于主站共享设计体系。

## 2. 文件结构与职责

视觉入口为 [css/style.css](../../css/style.css)（共享 Token 与组件）、[js/script.js](../../js/script.js)（共享交互）、[js/hero-scene.js](../../js/hero-scene.js)（首页景观）及 [css/oc.css](../../css/oc.css)（幻羽）。完整模块索引见 [AGENTS.md](../../AGENTS.md#项目索引)，本节只记录页面交互约定。

页面结构模式：单页内「列表视图 ↔ 详情视图」通过 `display` 切换（博客文章、ICO 工具、兴趣详情均采用此模式）。
博客与 ICO 工具由 `#post=` / `#ico` hash 驱动：入口卡片是真实 `<a href="#…">`，浏览器后退可回到列表，「返回」按钮在由本页进入时调用 `history.back()`、直链进入时用 `replaceState` 清 hash，不额外堆叠历史记录。
入口卡片、工具卡片与博客卡片一律是 `<a>`；页内动作卡片（兴趣、上传区）用 `role="button" tabindex="0"`，Enter / 空格由 `js/script.js` 统一转为点击。

## 3. 设计 Token

共享 Token 的精确值只维护在 `css/style.css` 的 `:root`、主题与时段覆盖中；下文记录选择语义与视觉约束，不复制参数表。共享组件优先引用语义变量，代码块、遮罩、反白文字和粒子等仍保留少量固定色值。

### 3.1 色彩

森林绿 `#5da844` 为主色，灵气青 `#4fc4cf` 为强调色；浅色保持暖纸感，深色使用夜森林配色。

| Token 组 | 语义 / 使用原则 |
|---|---|
| `--bg-color` / `--card-bg` / `--footer-bg` | 页面、面板与草地页脚底色，层次连续而非互相割裂 |
| `--ink` / `--dark-text` / `--light-text` / `--line*` | 墨线、主次正文与描边，随主题共同调整 |
| `--primary-color` / `--accent-color` / `--warm` / `--rose` / `--violet` | 主色、强调色与卡片色调扩展 |
| `--sky-*` / `--sun*` / `--ray` / `--moon*` | 天空与日月光照；太阳、月亮按昼夜切换 |
| `--cloud*` / `--bird` | 云、描边与飞鸟，避免抢过正文 |
| `--mount-*` / `--mist` / `--forest` / `--hill-*` | 远山、雾气、树冠带与分层山丘 |
| `--tree*` / `--trunk` / `--grass*` | 树木与近景植被，深色模式仍保留层次 |

晨昏变体只在浅色主题下由 `js/hero-scene.js` 写入 `.hero[data-daypart="dawn" | "dusk"]`，覆盖天空、太阳、远山、雾气与树冠带的值（定义在 `style.css` 的 Hero 段落）；深色主题固定为 `night`，直接使用深色 Token。

派生透明色统一使用 `color-mix(in srgb, …)`，不引入新 hex。

### 3.2 手绘圆角（wobble radius）

不规则圆角是手绘感的核心：`--wobble-btn` 用于按钮、chip、搜索框与 Toast；`--wobble-card` 用于卡片，偶数卡片以 `--wobble-card-alt` 打破规律；`--wobble-sm` 用于缩略图、代码块与小组件。头像与图标使用近圆的不规则轮廓，具体曲线以组件样式为准。

### 3.3 阴影

卡片通过 `--shadow-sm` / `--shadow-md` / `--shadow-hover` 的错位阴影与柔光表达纸片层次；实心按钮使用 `--shadow-ink` / `--shadow-ink-hover` 的贴纸式硬阴影。沿用这些语义 Token，不逐组件另调一套数值。

### 3.4 字体

正文优先霞鹜文楷屏幕版，保持宽松行距与手写感；字体经 jsDelivr 分包加载，失败时回退系统字体而不破坏布局（见 §7）。代码使用等宽字体，完整字体栈与排版参数见 `style.css`。

### 3.5 布局

- 容器、Header、景观高度与响应式断点以共享样式为准；卡片栅格自动适应宽度，窄屏导航折叠、博客卡片纵排。
- Hero 图层与 SVG 的 viewBox 等比：宽屏不裁切，窄屏以 `xMidYMax slice` 保留中心。首页介绍居中，幻羽位于右下方草地，不占正文栅格、不随页面悬浮；底部为森林与角色预留空间，淡色远山允许被正文覆盖。
- 首页自我介绍沿用共享 Hero 的圆形胶带头像、标题、简介与入口按钮排版；OC 专属样式不覆盖这一内容区。

## 4. 视觉签名元素

| 元素 | 实现 | 位置 |
|---|---|---|
| 纸纹噪点 | `body::after` 全屏覆盖 SVG `feTurbulence`（alpha ≤ 0.05）data URI | 全站 |
| 波浪线下划线 | 内联 SVG data URI，用于 `.section-title::after`、导航激活态、Markdown `hr` | 全站 |
| 马克笔高亮 | `.marker`：青→绿 45% 透明渐变，`background-size: 100% 42%` 压在文字下沿 | Hero、关于页标题 |
| 胶带贴纸 | 半透明色块 + 旋转（`::before/::after`） | 博客缩略图 |
| 森林景观 | 天空 + 三层内联 SVG 景观 + 右下角小尺寸幻羽，见 §4.1 | `index.html` |
| 草地页脚 | `footer::before` 波浪草丛 SVG data URI，颜色与 `--footer-bg` 同值衔接；`footer::after` 统一引用 `picture/oc/sleep.webp` 作为睡姿小羽装饰，主页面与工具子页共用，浅 / 深主题保持同一插画与尺寸；页脚装饰本身不依赖角色交互脚本 | 全站 |
| 卡片光斑 | `.card::after` 跟随指针的色调径向光，`--mx/--my` 由 `js/script.js` 写入；悬停时卡片按 `--rx/--ry` 作 ≤ 3.5° 的纸片倾斜（宽幅博客卡片只有光斑） | 全站卡片 |

### 4.1 首页 Hero 景观

Hero 是一幅随时段变化的手绘绘本插画，森林元素内联在 `index.html`，景观颜色只引用 §3.1 的 Token，脚本失效时仍是完整的静态画面：

| 层 | 内容 | 实现 |
|---|---|---|
| 天空 `.hero-sky` | 三段渐变；太阳沿本地时间弧线移动并散出光束，夜晚换成月牙、星星与星芒；云缓慢漂移，白天飞鸟掠过 | CSS + 内联 SVG |
| 远景 `.hero-far` | 两层远山与山脚雾气，高度按 viewBox 比例与其他层保持等比 | 内联 SVG |
| 中景 `.hero-mid` | 圆形树冠组成的森林带、后山与树木 | 内联 SVG |
| 近景 `.hero-near` | 山丘、树木、草丛与花朵，底边用纸面波浪接回页面底色 | 内联 SVG |
| 粒子 `.hero-particles` | 白天落叶 / 花瓣随指针起风，夜晚为草间萤火；窄屏减少数量，Hero 不可见或标签页隐藏时停止 | `js/hero-scene.js` Canvas |

树、草、花、云、鸟由 `.hero-defs` 的 `<g id>` 配合 `<use>` 复用；静态景观保留在 HTML，不在运行时重新生成。

**视差**：精细指针设备平滑移动各层；滚动时远层下沉、近景保持底边，图层预放大以遮住位移露边。振幅、密度与速度以 `js/hero-scene.js` 和 `style.css` 为准。

**幻羽**：以原生按钮承载自托管 WebP 插画，安放在首页森林右下角；不保留常驻动作按钮、角色铭牌与装饰面板。银紫短发、猫耳、蝴蝶结、毛绒披风与云朵猫挂包沿用用户 OC 设定；局部淡紫 Token 定义在 `css/oc.css`，森林仍用共享主题。连续点击角色（含触屏、Enter / 空格）轮换摸头、抱抱、甜奶、梦境与阅读互动，发现收藏；按需解码完成后才换图，快速操作以最后一次为准。静置 45 s 打盹，重新点击从摸头唤醒。

**临时气泡**：有离线短句时贴近角色弹出，根据文本长度在 5–16 s 后收起；空文本、离开视口、页面隐藏或销毁均清除，不占布局空间。鼠标悬停阅读或焦点位于气泡内时暂缓收起；气泡放在角色左侧的草地留白内，窄屏相应收窄，长文本可滚动，不遮挡首页主按钮。

**星屿手记**：入口收在临时气泡内，点击打开首页原生 `<dialog>`，包含角色设定、六件收藏和六种姿态画廊；支持 Escape、关闭后焦点回到角色、方向键切换标签。收藏只保存已知 ID 到 `huanyu.keepsakes.v1`，存储不可用时退化到当前会话。页面隐藏或角色离开视口会停止计时、语音与角色动画；减少动态偏好下仍可切换姿态与阅读文本。

**模块边界**：`oc-world.js` 保存内容；`oc-character.js` 管交互与生命周期；`oc-voice.js` 只管可替换适配器。`window.HuanYu` 暴露 `interact / say / getState / setVoiceProvider / destroy`，组件发出 `oc:state / oc:speech / oc:collect` 事件。旧 `HeroScene.poke / say` 转发给幻羽，不再维护另一套角色状态。

**预留语音**：默认无 provider、无音频或麦克风请求。接入 `setVoiceProvider({ speak, listen?, stop?, dispose? })` 后才在手记内显示声音开关，访客还需主动开启；`speak({ text, character, signal })` 在播放完成时 resolve，`listen({ signal })` 返回一次转写。适配器必须响应 AbortSignal、释放播放与录音资源；切换动作、隐藏页面、换 provider 和销毁均取消旧请求，20 s 超时回到文字交互。识别结果仅映射已知本地动作，不执行任意文本。浏览器接入不得嵌入私有密钥。

**时段**：深色主题固定 `night`；浅色主题按本地时间 5–7 时 `dawn`、17–19:30 `dusk`、其余 `day`，每分钟复查一次，主题切换时立即重算。`window.HeroScene.setDaypart()` 可强制时段供诊断。

## 5. 组件规范

- **按钮**：`.btn`（实心绿 + 2 px 墨线 + 硬阴影，hover 上移并微旋 −0.5°）、`.btn-outline`（纸底），激活态下沉；
- **卡片家族**：`.card` 基类 + 场景类 `.entry-card` / `.tool-card` / `.blog-card` / `.interest-card`；
  色调由修饰类 `.tone-green/teal/amber/rose/violet` 注入 `--tone` / `--tone-soft` 两个变量，
  图标、链接、时间线节点自动取用——新增色调只需加一行修饰类；
- **博客列表**：纵向单列（`content-visibility: auto` 保留渲染优化），缩略图左置、微倾斜 ±1.2°、带胶带；
- **筛选 chips**：`.filter-chip`，由 `posts.json` 的 `tag` 字段去重动态生成，与搜索框联动过滤；
- **Markdown 阅读**（`.markdown-body`）：纸面卡片，`h1/h2` 虚线分隔，无序列表项前缀 `✦`，
  代码块深墨绿底（`#253029`，深色模式 `#101711`），引用块绿色系提示条；
- **文章信息**：`.article-meta` 展示日期、标签、字数与预计阅读时长；存在 `ai_summary` 时渲染 `.ai-summary`；
- **文章评论**：`.article-comments` 预留 giscus 容器。`blog.html` 中 `GISCUS_CONFIG.categoryId` 为空时不加载评论脚本；
- **时间线**：`.timeline` 虚线枝干 + wobble 圆点节点，节点颜色取 `--tone`；
- **Toast / Lightbox**：保持 `js/interests.js` 原有 API（`showToast` / `openLightbox`），仅重绘外观。

## 6. 动效体系

### 6.1 CSS 动画（style.css 内定义）

环境动效保持缓慢舒缓，点击反馈短暂明确。关键帧与 hover 的时长、振幅以 `style.css` 为准，幻羽动效位于 `oc.css`；不在文档维护第二份调参表。

| 动画 | 对象 |
|---|---|
| `cloud-drift` / `birds-fly` / `bird-flap` | Hero 云、飞鸟群与翅膀 |
| `rays-breathe` / `twinkle` / `grass-sway` | 光束、星星与草丛 |
| `gentle-bob` | 首页手绘头像 |
| `oc-breathe` / `oc-spark` | 幻羽轻浮与互动星光 |
| hover 位移、微旋与纸片倾斜 | 卡片、按钮与图标 |

### 6.2 Canvas 层

| 层 | class | 行为 |
|---|---|---|
| 漂浮萤火 | `.spirit-layer` | `js/script.js`；缓慢上浮、摇曳与闪烁，深浅主题调整可见度，标签页隐藏时暂停 |
| 点击迸发 | `.burst-layer` | `js/script.js`；绿 / 青 / 琥珀粒子轻微上浮，连续点击设冷却保护 |
| Hero 粒子 | `.hero-particles` | 由 `js/hero-scene.js` 管理，见 §4.1 |

粒子数量与物理参数以各自脚本为准，层级关系见 §6.5。

### 6.3 降级策略

- `prefers-reduced-motion: reduce`：萤火层与 Hero 粒子不创建，视差不启用，云与飞鸟停在固定位置；点击迸发退化为单个扩散圆环（`.reduced-motion-click`）；
  CSS 关键帧动画与 hover 位移全部关闭；幻羽仍可点击，只切换姿态和文字不做位移；主题切换与跨页导航不使用 View Transition；
- 入场动画自托管：首屏 `.rise-in` 为纯 CSS 关键帧，首帧即播放；视口外元素 `[data-reveal]` 由
  `js/script.js` 的 IntersectionObserver 触发，且仅在 `html.js`（head 内联脚本标记 JS 可用）时才隐藏，
  脚本失效时内容直接可见；
- 卡片光斑与倾斜只在 `(hover: hover) and (pointer: fine)` 设备上由脚本写入变量，触屏设备保持原有 hover 表现。

### 6.4 View Transitions（渐进增强）

- 跨页导航：共享样式为同源主页面提供交叉淡化；不支持的浏览器与 `studio.html`（不加载 `style.css`）无过渡。
- 主题切换：`js/script.js` 通过 `document.startViewTransition` 让新主题以切换按钮为圆心扩散；`.theme-switching` 期间关闭颜色过渡，避免快照出现半程颜色。不支持时直接切换。

### 6.5 z-index 秩序

`5` 萤火 → `99` 移动端菜单 → `100` Header → `9950` 点击迸发 → `9960` 纸纹 → `9990` Toast → `9999` Lightbox。Hero 内部：`0` 天空 → `1` 景观与粒子 → `2` 正文 → `3` 幻羽与临时气泡；手记使用浏览器 dialog 顶层。

## 7. 外部依赖与降级行为

| 依赖 | 版本 | 源 | 失败行为 |
|---|---|---|---|
| LXGW WenKai Screen | 1.7.0 | jsDelivr（非阻塞加载，两个直链 CSS） | 落到 PingFang SC / 微软雅黑，布局不变 |
| Font Awesome | 6.4.0 | cdnjs | 图标缺失，文字信息完整 |
| Marked.js | 4.0.12 | 打开文章时按需异步加载，jsDelivr → unpkg → cdnjs 三级回退；列表页不加载 | 三源均失败时文章页给出显式错误提示，下次打开文章会重试 |
| busuanzi | 2.3 | `busuanzi.ibruce.info` | 页脚访问统计保持隐藏，不影响导航与正文 |
| giscus | 未固定版本 | `giscus.app/client.js` | `categoryId` 为空或脚本失败时不显示评论区，不影响文章阅读 |

Marked.js 与 giscus 仅由 `blog.html` 使用；giscus 当前因 `categoryId` 为空而处于停用状态。busuanzi 由 `js/script.js` 延迟加载。
各页 `<head>` 对 `cdn.jsdelivr.net` 与 `cdnjs.cloudflare.com` 做 `preconnect`；全站不再引用 Google Fonts（国内网络会阻塞渲染）。

## 8. 兼容性边界

### 8.1 `tools/` 页面契约

`tools/downloads.html` 与 `tools/visualizations.html` 直接复用共享 Token、Header、Footer、卡片、按钮、主题切换和响应式规则；改动共享组件时必须同步验证这两个页面。

`tools/keyboard.html` 与 `tools/buy.html` 通过 `../css/style.css` 复用部分基础能力，同时保留大量页内样式：

- `tools/keyboard.html` 依赖 `--border-color`、`--radius-lg`、`--radius-md`，并复用 Header、Footer、`.container`、`.btn`、`.btn-outline`、主题切换和移动端菜单；
- `tools/buy.html` 依赖主题色、文本色、背景色、`--border-color`、`--radius-lg`、`--radius-md`，并复用 Header、Footer、`.container`、主题切换和移动端菜单；其复制提示使用页面专属类 `.copy-toast`，不得改回 `.toast`（与共享 Toast 组件冲突会导致不可见）；
- `.tool-icon` 作为 `.card-icon` 的遗留类别名继续保留；仓库内 HTML 当前未引用，删除前须全仓检索确认。

`tools/visualizations/foc.html` 不加载 `css/style.css`，其独立样式不应反向写入共享样式表。

### 8.2 浏览器特性要求

依赖 `color-mix()`（Chrome 111 / Safari 16.2 / Firefox 113 及以上）、`backdrop-filter`、
`transform-box: fill-box`、`content-visibility`、`conic-gradient` 与 `mask-image`（Hero 光束、月牙）。
低于该基线的浏览器表现为派生色缺失，主体内容与布局仍可用；未做针对性兼容处理。
View Transitions（跨页 Chrome 126+ / Safari 18.2+，同页 Chrome 111+ / Safari 18+）为纯增强，缺失时无过渡。

### 8.3 主题切换机制

主题状态存储于 `localStorage.theme`，各页面 `<head>` 内联脚本在首帧前写入
`<html data-theme>`，避免闪白；无存储值时跟随 `prefers-color-scheme`。页内切换的过渡见 §6.4；
首页 Hero 通过 `MutationObserver` 监听 `data-theme` 同步日夜时段。

## 9. 维护指引

- **新增卡片色调**：在 style.css 追加 `.tone-x { --tone: …; --tone-soft: …; }` 并补深色值，组件自动适配；
- **新增文章**：在 `posts/` 创建 Markdown 文件，执行 `./run.sh gen` 并同时审查、提交 `posts/posts.json`；不得只手工编辑索引。完整流程见 [blog-auto-publish.md](blog-auto-publish.md)；
- **调整 Hero 景观**：编辑 `index.html` 内联 SVG，颜色继续引用 §3.1 的场景 Token；三层景观共用 `1920 × 300` 坐标系（远景 `1920 × 520`），新增树 / 草 / 花复用 `.hero-defs` 并把落点放在山丘轮廓上；有 `transform` 属性又做 CSS 动画时外包 `<g>`，避免覆盖属性位移；
- **调整幻羽**：世界观与动作内容在 `oc-world.js`，交互在 `oc-character.js`，语音契约在 `oc-voice.js`；资产保持完整角色、透明边缘和一致身份。运行 `node --test tests/oc.test.js`；启动 `./run.sh test 8081` 后，以现有 Puppeteer 运行 `OC_TEST_URL=http://localhost:8081 PUPPETEER_MODULE=/abs/path/puppeteer-core node tests/oc-browser.cjs`。
- **改动共享类名前**：先按 §8.1 检查 `tools/` 引用（`rg -n 'var\\(--|class=' tools -g '*.html'`）。
