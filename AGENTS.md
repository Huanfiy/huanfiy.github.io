# 项目指南（AI 助手）

huanfly.com 的开源纯静态个人网站：原生 HTML5 + CSS3 + JavaScript，前端库经 CDN 加载，没有前端框架、构建步骤、包管理器和应用后端，站点按原样直接托管。页面包括首页、博客、工具箱、关于页与 Three.js 工作室（`studio.html`）；`run.sh` 是本地预览、文章索引生成与部署的唯一入口。

## 项目索引

| 路径 | 职责 / 何时查看 |
| --- | --- |
| [README.md](README.md) | 对外说明：功能清单、设计风格、技术栈、目录结构与使用方式 |
| [index.html](index.html)、[about.html](about.html) | 首页（内联 SVG 手绘森林景观 Hero、按时段问候、入口卡片、活动时间线）与关于页（时间线、兴趣卡片） |
| [js/hero-scene.js](js/hero-scene.js) | 首页专用：时段天空与太阳位置、指针 / 滚动视差、落叶 / 萤火粒子；`window.HeroScene` 暴露 `setDaypart`，`poke / say` 转发给幻羽 |
| [js/oc-character.js](js/oc-character.js)、[js/oc-world.js](js/oc-world.js)、[js/oc-voice.js](js/oc-voice.js)、[css/oc.css](css/oc.css)、[picture/oc/](picture/oc/) | 首页独立 OC 幻羽：姿态 / 离线语料 / 六件收藏、手记与生命周期；`window.HuanYu` 动作接口和默认关闭的语音 provider，契约见设计系统 §4.1 |
| [blog.html](blog.html) | 博客：文章列表与 Markdown 详情同页切换；文章头渲染日期 / 标签 / 字数 / 阅读时长与 front matter 的 AI 摘要；giscus 评论在 `GISCUS_CONFIG.categoryId` 填入前保持关闭 |
| [tool.html](tool.html)、[tools/](tools/) | 工具箱（内嵌图片转 ICO）与独立工具页：键位练习、链接转换器、下载中心、技术可视化 |
| [studio.html](studio.html)、[css/studio.css](css/studio.css)、[css/studio-apps.css](css/studio-apps.css) | 全视口 Three.js 嵌入式工作室；`studio.css` 管房间控件，`studio-apps.css` 管屏内终端 / 相册 / Robot 静态占位的样式 |
| [js/studio.js](js/studio.js) | 设备状态、按需标签、八站导览、镜头预设、日夜灯光、窗与微风状态、键盘控制 |
| [js/studio-room.js](js/studio-room.js) | 有界房间、靠墙承重的 L 形工作台、落地打印机与设备模型；拥有布局 / 配色、共享时钟、窗风平滑，以及由允许镜头目标与轨道距离推导的背景半径与远裁剪面；固定网格与描边合批 |
| [js/studio-instruments.js](js/studio-instruments.js)、[js/studio-instrument-art.js](js/studio-instrument-art.js) | 示波器与直流稳压电源的局部模型、共享面板布局与 Canvas 图集 / 读数；房间负责摆放、状态快照、共享时钟和资源清理 |
| [js/studio-arm.js](js/studio-arm.js)、[js/studio-arm-motion.js](js/studio-arm-motion.js) | 桌面机械臂的分关节合批模型、柔性线束与夹爪；共享工位 / 工具尺寸的纯运动学采样，暂停保留取放状态 |
| [js/studio-art.js](js/studio-art.js)、[js/studio-figures.js](js/studio-figures.js) | Canvas 生成的纸张 / 木纹 / 布料 / 光斑纹理；架上三个程序化动漫手办 |
| [js/studio-window.js](js/studio-window.js)、[js/studio-landscape.js](js/studio-landscape.js)、[js/studio-landscape-art.js](js/studio-landscape-art.js) | 窗户只负责外开窗扇、玻璃与点击区；景观负责近乎同层的庭院、墙脚石、连续粗粒远地表、闭合的世界固定天空、实例化果园 / 花草与独立云鸟网格；景观画布只在主题或质量档位变化时确定性重绘 |
| [js/studio-spirit.js](js/studio-spirit.js)、[js/studio-spirit-speech.js](js/studio-spirit-speech.js)、[js/studio-spirit-bubble.js](js/studio-spirit-bubble.js) | 桌上小精灵的造型与动画、内置语料与可替换的 `say(context)` provider（带超时回退）、UI 层投影气泡；三者相互独立 |
| [js/studio-monitor.js](js/studio-monitor.js)、[js/studio-apps.js](js/studio-apps.js)、[js/studio-guest.js](js/studio-guest.js) | 在 CSS3D 平面上挂载 HTML huanfly-os，WebGL 画布留深度测试的透明孔洞；桌面 / 终端 UI（xterm.js）/ 相册（读 `interests/*/index.json`）；纯浏览器模拟命令 |
| [css/style.css](css/style.css)、[js/script.js](js/script.js) | 全站共享样式表（CSS 自定义属性主题、Hero 景观样式、View Transition 声明）；通用脚本（移动导航、主题切换的圆形揭示过渡、卡片光斑与倾斜、吸顶导航滚动态、问候、活动时间线、不蒜子统计、IntersectionObserver 滚动入场、萤火虫与点击灵气） |
| [posts/](posts/)、[activity.json](activity.json) | Markdown 文章，客户端 Marked.js 解析，front matter 支持 `title/date/tag/summary/cover/coverFit/publish/ai_summary`（`ai_summary` 仅 blog.html 读取，`run.sh gen` 忽略）；站点 / 工具事件（类型 `post`/`tool`/`site`）与 `posts/posts.json` 合并为首页时间线 |
| [interests/](interests/) | 关于页兴趣素材与相册数据；进入前读各子目录 `README.md` 的素材与数据文件约定 |
| [run.sh](run.sh) | `test` 本地服务器、`gen` 文章索引、`deploy` 经校验的 Git 产物部署 |
| [tests/](tests/) | Node 契约测试、浏览器契约页与可选 Chromium 回归；随 `.gitattributes` 排除，不进入部署产物 |
| [docs/design/workbench.md](docs/design/workbench.md) | 工作室 21 项要素约束、镜头预设构图、显示器直接交互、终端与 Robot 能力边界；改工作室前必读 |
| [docs/design/](docs/design/) | 拍板设计：设计系统、博客发布流程、主题封面、发布产物与部署边界 |
| [docs/todo/](docs/todo/) | 已评审但暂缓的待办，一项一文件（当前：启用 giscus 评论、工作室真机验收） |
| [manifest.webmanifest](manifest.webmanifest)、[robots.txt](robots.txt)、[sitemap.xml](sitemap.xml) | PWA 与 SEO；四个主页面带 OG meta 与 canonical URL |

## 必须遵守

- 不引入前端框架、构建步骤、包管理器或应用后端；站点按原样托管，不新增资源编译环节。
- 终端永远是浏览器内的访客模拟：不得添加 shell、PTY、终端 socket 或命令执行端点。Robot 只保留 `studio.html` 内的「研究中」静态占位，没有专用脚本、API 请求、聊天或配置存储。
- 通用 Server / Robot 后端研究计划已移出工作区，git 历史 `2d9c4e7` 可查；没有新请求不得重建后端，恢复研究前先重新盘点代码。
- 部署只走 `run.sh deploy`：须使用干净工作区和明确的目标提交；部署配置由环境注入，生产配置与凭据不得入库。操作前读 [发布产物与外部部署边界](docs/design/deployment-architecture.md)。
- 修改工作室前必读 [工作室要素约束](docs/design/workbench.md)：空间、拾取、显示器交互、渲染预算、资源清理与失败降级约束统一维护于该文档。
- 视觉沿用手绘绘本与夜森林，详见 [设计系统](docs/design/design-system.md)。改首页景观或幻羽前读其 §4.1；景观颜色只引用 `style.css` 场景 Token，不改中心自我介绍布局。改共享样式前核对 §8.1 的工具页兼容契约，保留旧别名 `--border-color`、`--radius-lg/md`；处置遗留 `.tool-icon` 前须全仓检索。
- CDN 依赖固定版本：Three.js 0.170.0 + addons（仅工作室，ES module import map）、Marked.js 4.0.12（仅 blog.html，打开文章时才异步加载，三源回退）、Font Awesome 6.4.0、LXGW WenKai Screen 字体（jsDelivr，`media="print"` 非阻塞切换）、不蒜子、giscus（可选）、xterm.js 5.3.0 + xterm-addon-fit 0.8.0（终端应用打开时才懒加载）。入场动画自托管：`.rise-in` 在首帧播放，`[data-reveal]` 由 IntersectionObserver 添加 `.revealed`，仅在头部内联脚本设置的 `html.js` 下隐藏。
- 页面采用同页视图切换（博客列表 ↔ 正文、工具网格 ↔ 工具界面），不新增路由或多页跳转。
- 页脚不蒜子 UV/PV 在数值加载前隐藏（`#site-stats` + `.visible`）；localhost 上的计数是共享测试数字，真实计数从生产域名开始。
- 文档的记录与清理遵循 [docs-rules.md](docs-rules.md)：新增文档前过其记录门槛，改动代码后按其清理准则核查失实文档。

## 开发与验证

```bash
./run.sh test              # 本地 Python HTTP 服务器，默认 8080
./run.sh test 3000         # 指定端口
./run.sh gen               # 重新生成 posts/posts.json
node --test tests/studio-guest.test.js tests/studio-arm.test.js
DEPLOY_TARGET=... PUBLIC_BASE_URL=... ./run.sh deploy        # 部署 HEAD
DEPLOY_TARGET=... PUBLIC_BASE_URL=... ./run.sh deploy <ref>  # 部署指定提交，含回滚目标
```

- 改动工作室后：启动本地服务器并打开 `tests/studio-outdoor.html` 运行浏览器契约测试（复用同一 pinned Three.js CDN，无需包管理器）；有 Puppeteer 环境时运行 `PUPPETEER_MODULE=/abs/path/puppeteer-core node tests/studio-apps-browser.cjs`。软件渲染与移动视口模拟不等于真机性能验收，待验收项见 [工作室真机验收](docs/todo/studio-real-device-acceptance.md)。
- 改动示波器或电源后：浏览器页 `tests/studio-instruments.html`（实体叠放、接口凹槽、波形 / 暂停、静态纹理、拾取与清理）；也由 `tests/studio-apps-browser.cjs` 一并回归。
- 改动机械臂后：`node --test tests/studio-arm.test.js`，浏览器页 `tests/studio-arm.html`（真实房间中的取放矩阵、夹爪间隙、暂停 / 继续、线束缓冲与拾取）；也由 `tests/studio-apps-browser.cjs` 一并回归。
- 改动博客封面或文章索引后：`node --test tests/blog-covers.test.js`，浏览器页 `tests/blog-covers.html`。
- 改动首页 OC 后：`node --test tests/oc.test.js`；启动本地预览后用现有 Puppeteer 运行 `OC_TEST_URL=http://localhost:8081 PUPPETEER_MODULE=/abs/path/puppeteer-core node tests/oc-browser.cjs`。
- 改动键位练习算法后：`node tools/keyboard-algo.test.js`。

## 提交约定

格式 `<emoji> <type>(<scope>): <subject>`，单行，scope 可省，subject 语言跟随请求语言。type 与 emoji 一一对应：`✨ feat`、`🐞 fix`、`⚡️ perf`、`🎨 refactor`、`🔧 chore`、`📝 docs`。破坏性变更写 `feat!:` 并在正文加 `BREAKING CHANGE:`。一笔一主题，每笔提交可独立部署。

## 按需阅读

- 调整配色、组件或整体视觉：读 [设计系统](docs/design/design-system.md)；改首页 Hero 景观、幻羽或时段天空读其 §4.1 与 §9。
- 新增或修改文章、front matter、索引生成：读 [博客文章索引与发布流程](docs/design/blog-auto-publish.md)；涉及封面读 [博客主题 SVG 封面](docs/design/blog-covers.md)。
- 修改 `run.sh deploy` 或 `.gitattributes` 导出边界：读 [发布产物与外部部署边界](docs/design/deployment-architecture.md)。
- 修改显示器、相册或终端交互：读 [工作室要素约束](docs/design/workbench.md)「显示屏的直接交互」，回归跑 `tests/studio-apps-browser.cjs`。
- 修改窗景、庭院、镜头范围或户外动效：读 [工作室要素约束](docs/design/workbench.md)「窗外景观与动效」，回归跑 `tests/studio-outdoor.html`。
- 启用评论区：读 [docs/todo/enable-giscus-comments.md](docs/todo/enable-giscus-comments.md)。
