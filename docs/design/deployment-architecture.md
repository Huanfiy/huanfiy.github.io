# 网站部署与缓存架构

> 落档日期：2026-07-10
>
> 部署基础设施提交：`b87164c`
>
> 当前状态：缓存迁移阶段一已完成，阶段二待执行

## 1. 目标

建立可追踪、可验证、可回退的静态网站发布链路，解决以下问题：

- 生产环境不再直接同步本地工作区，避免未提交文件进入线上目录；
- 线上版本与 Git 提交建立一一对应关系；
- CSS、JavaScript 与页面内容更新后，浏览器能够及时获得新版本；
- 发布前后具备结构化校验，失败时返回非零状态；
- 缓存、服务器配置和部署约束纳入仓库管理。

## 2. 覆盖范围与边界

### 2.1 覆盖范围

- 发布入口：`run.sh deploy [--gen] [git-ref]`；
- 发布边界：`.gitattributes` 中的 `export-ignore`；
- 服务器配置：`deploy/nginx/huanfly.conf`；
- 生产目录：`user@example.com:/srv/www/blog/`；
- 线上版本标记：`/deploy-version.json`；
- HTTP 缓存：HTML、JSON、XML、Markdown、Web App Manifest、第一方 CSS 与 JavaScript；
- 部署后 Smoke Test：核心页面、共享资源、动态数据、缓存响应头和 Manifest MIME。

### 2.2 不覆盖范围

- Nginx release 目录与原子软链接切换；
- 自动回滚和最近版本保留策略；
- CDN 缓存清理；
- Service Worker 资源缓存；
- CSS、JavaScript 和图片的文件名内容指纹；
- GitHub Actions 等远程持续部署平台。

当前阶段使用 `rsync --delay-updates --delete-delay` 缩短混合版本窗口，但不具备原子发布语义。部署失败后需使用上一稳定 Git SHA 执行显式回退。

## 3. 总体架构

```text
本地验证
   ↓
提交并推送 origin/main
   ↓
./run.sh deploy [git-ref]
   ↓
校验工作区、依赖和远端提交可达性
   ↓
git archive <commit> → 临时 artifact
   ↓
可选：仅在 artifact 内生成 posts/posts.json
   ↓
写入 deploy-version.json
   ↓
JSON / JavaScript / 发布边界校验
   ↓
rsync --delay-updates --delete-delay
   ↓
线上版本、页面、资源、缓存与 MIME 验证
```

生产环境只接收 Git 提交生成的 artifact，不读取工作区中的未提交内容。

## 4. 发布产物设计

### 4.1 产物来源

`run.sh deploy` 将目标引用解析为完整 Git SHA，并确认该提交可从 `origin/main` 到达。产物通过以下方式生成：

```bash
git archive --format=tar <commit-sha>
```

该方式只包含目标提交中的跟踪文件。工作区修改、未跟踪文件和 `.git/` 不会进入 artifact。

### 4.2 发布边界

`.gitattributes` 使用 `export-ignore` 排除以下开发与运维文件：

- `.gitattributes`、`.gitignore`；
- 任意层级的 `.cursor/`、根目录 `.claude/`、`CLAUDE.md`；
- 任意层级的 `README.md`、`*.log`、`.DS_Store` 和 `*.test.js`；
- `run.sh`；
- `deploy/`。

新增仅供开发或运维使用的路径时，必须同步更新 `export-ignore` 并验证 archive 内容。

### 4.3 文章索引生成

默认部署使用提交中已有的 `posts/posts.json`。传入 `--gen` 时，文章索引只在临时 artifact 中重新生成，不修改仓库工作区：

```bash
./run.sh deploy --gen HEAD
```

该模式适用于验证历史提交中的 Markdown 内容，不替代提交前执行 `./run.sh gen` 并审查生成差异的常规流程。

### 4.4 版本标记

每次部署在 artifact 根目录生成 `deploy-version.json`：

```json
{
  "schema": 1,
  "commit": "完整 Git SHA",
  "ref": "请求部署的引用",
  "generated_at": "UTC 时间"
}
```

Smoke Test 通过该文件确认线上版本与目标提交一致。该文件不作为业务配置使用。

## 5. HTTP 缓存策略

### 5.1 当前策略

| 资源类型 | Cache-Control | 校验机制 | 目的 |
|---|---|---|---|
| HTML | `no-cache` | ETag / Last-Modified | 页面每次复用前确认版本 |
| JSON / XML / Markdown | `no-cache` | ETag / Last-Modified | 动态列表、文章与 Sitemap 及时更新 |
| Web App Manifest | `no-cache` | ETag / Last-Modified | 安装元数据及时更新 |
| 第一方 CSS / JavaScript | `no-cache` | ETag / Last-Modified | 避免页面结构、脚本与样式版本错配 |
| 图片 / 字体 | `max-age=2592000` | 到期后重验证 | 保留 30 天静态资源缓存 |

`no-cache` 允许浏览器保存响应，但复用前必须发起条件请求。文件未变化时，Nginx 返回 `304 Not Modified`，不重复传输响应体。

### 5.2 Manifest MIME

`manifest.webmanifest` 使用以下响应类型：

```text
Content-Type: application/manifest+json
```

该规则通过 Nginx 精确路径配置，不覆盖系统 MIME 映射表。

### 5.3 查询参数迁移

在 Nginx 切换前，CSS 与 JavaScript 使用以下临时缓存破坏参数：

```text
style.css?v=523b76e
script.js?v=421a243
```

Nginx `no-cache` 已于 `2026-07-10 17:18:28 CST` 生效。旧响应头中的 `max-age=86400` 仍可能保存在客户端，因此查询参数至少保留至：

```text
2026-07-11 17:18:28 CST
```

阶段二执行条件：

- [ ] 当前时间不早于 `2026-07-11 17:18:28 CST`；
- [ ] 线上 CSS 与 JavaScript 继续返回 `Cache-Control: no-cache`；
- [ ] ETag 条件请求返回 `304`；
- [ ] 删除全部共享 CSS 与 JavaScript 查询参数；
- [ ] 本地桌面和 390 px 手机视口验证通过；
- [ ] 提交、推送并部署明确 Git SHA；
- [ ] 线上页面实际加载普通资源 URL，功能和样式正常。

## 6. Nginx 配置管理

仓库配置源为：

```text
deploy/nginx/huanfly.conf
```

线上生效路径为：

```text
/etc/nginx/sites-enabled/my_web
```

配置变更按以下顺序执行：

1. 将当前线上配置备份到 `/etc/nginx/backups/`；
2. 上传仓库候选配置；
3. 执行 `sudo nginx -t`；
4. 语法验证通过后执行 `sudo systemctl reload nginx`；
5. 验证缓存头、MIME、条件请求和域名重定向；
6. 失败时恢复备份并重新执行 `nginx -t`。

2026-07-10 的切换备份为：

```text
/etc/nginx/backups/my_web.20260710-171828.conf
```

## 7. 部署前置条件

执行生产部署前必须满足：

- 工作区无已修改、已暂存或未跟踪文件；
- `git-ref` 能解析为 Git 提交；
- 目标提交已推送并可从 `origin/main` 到达；
- 本机存在 Git、tar、rsync、SSH、curl 和 Python 3；
- SSH 能够访问 `user@example.com`；
- Nginx 缓存与 MIME 配置已生效。

未满足任一条件时，部署命令返回非零状态。

## 8. 校验与验收

### 8.1 Artifact 校验

- 必需页面、共享 CSS、共享 JavaScript、文章索引和 Manifest 存在；
- `activity.json`、`posts/posts.json`、`manifest.webmanifest` 和版本标记为有效 JSON；
- Node.js 可用时执行共享 JavaScript 语法检查；
- artifact 不包含 `.git/`、`run.sh` 和 `deploy/`。
- artifact 目录统一为 `0755`，文件统一为 `0644`，确保 Nginx 工作进程具备读取权限。

### 8.2 线上 Smoke Test

- `/deploy-version.json` 的 `commit` 等于目标 Git SHA；
- 首页、博客页、工具页和关于页返回成功状态；
- CSS、JavaScript、动态数据和 Manifest 可访问；
- CSS 返回 `Cache-Control: no-cache` 和 ETag；
- Manifest 返回 `application/manifest+json`。

### 8.3 人工界面验证

涉及样式、交互或响应式布局时，自动 Smoke Test 不能替代浏览器验证。至少覆盖：

- 390 px 手机视口；
- 1280 px 桌面视口；
- 浅色与暗色主题；
- 受影响页面的主要交互路径。

## 9. 回退方式

当前阶段使用显式 Git SHA 回退：

```bash
./run.sh deploy <previous-stable-sha>
```

目标 SHA 必须位于 `origin/main` 历史中。该命令重新生成 artifact、部署并执行 Smoke Test。

此方式需要重新传输文件，不属于原子回滚。出现以下任一条件时，应升级为 `releases/<SHA>` 与 `current` 软链接：

- 发布切换期间不允许出现混合版本；
- 要求在秒级恢复上一版本；
- 部署频率明显提高；
- 引入 CDN、Service Worker 或长期不可变资源缓存。

## 10. 后续演进

当资源数量、访问流量或性能预算需要长期缓存时，采用真正的文件名内容指纹：

```text
style.<content-hash>.css
script.<content-hash>.js
```

指纹资源使用 `Cache-Control: public, max-age=31536000, immutable`，HTML 与资源映射清单继续使用 `no-cache`。旧指纹文件必须保留至所有旧 HTML 缓存失效，避免产生资源 `404`。

当前阶段不引入该机制，避免为约 63 KB 的共享 CSS 与 JavaScript 增加构建复杂度。

## 11. 运维检查清单

### 发布

- [ ] 本地验证通过；
- [ ] 变更已提交并推送；
- [ ] 执行 `./run.sh deploy [git-ref]`；
- [ ] 输出的目标 SHA 与预期一致；
- [ ] Artifact 校验通过；
- [ ] 线上 Smoke Test 通过；
- [ ] 受影响页面完成浏览器人工验证。

### Nginx 变更

- [ ] 仓库配置已更新；
- [ ] 线上旧配置已备份；
- [ ] `nginx -t` 通过；
- [ ] reload 后响应头符合预期；
- [ ] ETag 条件请求返回 `304`；
- [ ] `www.huanfly.com` 重定向至 `https://huanfly.com/`。
