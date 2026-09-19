# Personal Web

开源的纯静态个人网站，包含博客、在线工具箱、个人展示和 Three.js 工作室。无需前端构建、包管理器或应用后端，可直接部署到静态托管平台。线上实例为 [huanfly.com](https://huanfly.com)。

## 功能

- **博客** — Markdown 文章、标签筛选、搜索、主题封面与可选评论。写作和发布见[博客发布流程](docs/design/blog-auto-publish.md)。
- **工具箱** — 图片转 ICO、键位练习、链接转换器、下载中心和技术可视化。
- **工作室** — 可环视的手绘 3D 房间，支持设备模拟、昼夜切换、开窗与导览；显示器内可操作访客终端和相册。终端始终是浏览器内模拟，Robot 仅为「研究中」占位，能力边界见[工作室约束](docs/design/workbench.md#终端与-robot-的能力边界)。
- **个人展示** — 首页、关于页，以及摄影、科技制作和阅读内容。
- **幻羽 OC** — 首页小羽的点击互动、临时气泡、星屿手记与本地收藏；共享草地页脚使用睡姿小羽。

## 设计风格

罗小黑风格的手绘绘本：暖纸底、森林绿与灵气青，深色模式切换为夜森林。首页景观随时段变化，工作室延续温暖、克制的科技感；交互尊重减少动态偏好。视觉规则见[设计系统](docs/design/design-system.md)，房间构图与设备约束见[工作室要素约束](docs/design/workbench.md)。

## 技术栈

原生 HTML5、CSS3、JavaScript；Markdown 使用 Marked.js，图标使用 Font Awesome，工作室使用 Three.js。前端依赖经 CDN 加载，站点源文件按原样托管。

## 项目结构

| 路径 | 内容 |
| --- | --- |
| `index.html`、`blog.html`、`tool.html`、`about.html` | 主站页面 |
| `studio.html` | Three.js 工作室入口 |
| `css/`、`js/` | 共享样式、页面逻辑与场景模块 |
| `posts/`、`activity.json` | 博客文章、文章索引与站点动态 |
| `tools/` | 独立工具页 |
| `picture/`、`interests/` | 站点图片、角色资产与兴趣素材 |
| `tests/` | 契约测试与浏览器回归，不随站点部署 |
| `docs/` | 拍板设计与待办 |
| `run.sh` | 本地预览、索引生成和部署入口 |

具体模块位置与修改入口见 [AGENTS.md](AGENTS.md#项目索引)；添加兴趣素材前阅读相应子目录的 `README.md`。

## 使用

```bash
./run.sh test          # 本地预览，默认端口 8080
./run.sh test 3000     # 指定预览端口
./run.sh gen           # 生成文章索引；发布前需审查并提交
node --test tests/*.test.js
```

按改动范围运行相应浏览器回归，命令及环境要求见 [开发与验证](AGENTS.md#开发与验证)。浏览器视口模拟不能替代[工作室真机验收](docs/todo/studio-real-device-acceptance.md)。

**部署：**提交并推送后，在干净工作区中执行：

```bash
DEPLOY_TARGET='user@example.com:/srv/www/blog/' \
PUBLIC_BASE_URL='https://blog.example.com' \
./run.sh deploy HEAD
```

配置接口、产物边界、验证与回退统一见[部署文档](docs/design/deployment-architecture.md)。生产配置与凭据留在仓库之外；使用托管平台原生发布流程时，按该文档的外部平台边界处理。
