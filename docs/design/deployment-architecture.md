# 发布产物与外部部署边界

> 对应实现：[run.sh](../../run.sh)、[.gitattributes](../../.gitattributes)

## 1. 架构原则

本仓库只管理纯静态站点源文件、文章索引与发布产物规则，不提供应用后端。Web Server、DNS、TLS、缓存、认证、CDN、主机目录、SSH 凭据等实例配置必须留在仓库外，由私有基础设施仓库、托管平台或运行环境管理；禁止把秘密写入前端、Git 或静态产物。

终端、Robot 与已移出的 Server 研究计划见[工作室能力边界](workbench.md#终端与-robot-的能力边界)，不属于部署服务。

## 2. 覆盖范围与非覆盖范围

### 2.1 仓库覆盖范围

文章索引生成、基于 Git 提交的产物打包与校验、版本标记、可选 rsync 传输，以及通用线上冒烟验证。

### 2.2 仓库不覆盖范围

平台专属工作流与实例配置、自动扩缩容、原子发布及自动回滚均由外部环境负责。使用 GitHub Pages、Cloudflare Pages 等平台时，可采用平台原生静态发布流程；站点运行本身不依赖 rsync 或特定 Web Server。

## 3. 数据流

```text
Git 提交 → git archive → 临时产物（可选重建索引、写版本标记、校验）
        → rsync 传输 → 线上版本与核心资源冒烟验证
```

部署链路不读取仓库内的服务器配置，也不推断目标主机、账号、目录或域名。

## 4. 发布产物

### 4.1 产物来源

`./run.sh deploy [git-ref]` 将引用解析为完整 Git SHA，再通过 `git archive` 打包。产物只来自目标提交，不包含工作区修改、未跟踪文件或 `.git/`；部署前仍要求工作区干净，避免把本地状态误认为已发布版本。

### 4.2 导出边界

开发、文档、测试、运维与敏感文件不得进入产物。精确的 `export-ignore` 清单以 [.gitattributes](../../.gitattributes) 为准，产物检查由 `run.sh` 的 `validate_artifact` 维护，不在文档复制第二份路径表。对 `server/` 等路径的防误发规则不表示当前存在后端实现。

### 4.3 版本标记

`deploy-version.json` 由 `run.sh` 的 `write_deploy_marker` 在临时产物内生成，记录 `schema`、完整提交 SHA（`commit`）、请求引用（`ref`）和 UTC 生成时间（`generated_at`）。它用于核对线上版本，不是业务配置，也不写回工作区。

## 5. 外部配置接口

| 变量 | 必填 | 作用 |
|---|---|---|
| `DEPLOY_TARGET` | 是 | rsync 目标；支持远程地址或本地目录 |
| `PUBLIC_BASE_URL` | 是 | 部署后的公开 HTTP(S) 地址，用于冒烟验证 |
| `DEPLOY_REQUIRED_REF` | 否 | 设置后要求目标提交位于该 Git 引用历史中 |

```bash
DEPLOY_TARGET='user@example.com:/srv/www/blog/' \
PUBLIC_BASE_URL='https://blog.example.com' \
DEPLOY_REQUIRED_REF='origin/main' \
./run.sh deploy HEAD
```

示例仅说明变量格式，真实服务器账号、SSH 主机和部署目录不得作为配置写入受跟踪文件；站点 Canonical URL、Sitemap 等公开内容不受此限制。脚本不自动执行 `git fetch`，使用 `DEPLOY_REQUIRED_REF` 前应先更新对应引用。

## 6. 文章索引模式

常规部署使用目标提交中已有的 `posts/posts.json`，不会自动重新生成。文章发布前的生成、审查与提交步骤见[博客发布流程](blog-auto-publish.md#6-新文章发布流程)。

```bash
./run.sh deploy --gen <git-ref>
```

`--gen` 仅在临时产物内重建索引，不修改工作区，也不替代发布前审查并提交索引。

## 7. 通用部署行为

rsync 在传输完成后更新临时文件、删除目标端多余文件并统一权限，具体参数以 `run.sh` 的 `do_deploy` 为准。**这不是原子发布**；零混合版本窗口或秒级回退应由仓库外的 Release 目录、软链接或平台能力实现。

## 8. Smoke Test 边界

脚本核对线上版本标记中的 `commit` 与目标 SHA，并检查核心页面（含工作室）、共享资源和动态数据可访问。完整检查清单以 `run.sh` 的 `smoke_test` 为准。

该检查不能替代外部环境对缓存、MIME、TLS / 重定向、压缩、CDN、认证与代理策略的验收；站点不得依赖某一种 Web Server 的私有行为。

## 9. 回退

沿用 §5 的外部配置，重新部署上一稳定提交：

```bash
./run.sh deploy <previous-stable-sha>
```

该方式重新传输文件，不等于原子回滚或自动回滚。采用平台原生发布时，使用平台自身的版本回退能力。

## 10. 验收清单

- [ ] 实例配置与秘密未进入仓库或发布产物，部署目标由运行环境注入；
- [ ] 工作区干净，目标提交满足部署引用约束，产物校验通过；
- [ ] 线上版本标记与目标 SHA 一致，核心页面及静态资源可访问；
- [ ] 平台专属服务器策略与回退能力在仓库外验证。
