# 博客文章索引与发布流程

> 对应实现：`run.sh`、`blog.html`、`js/blog-covers.js`、`posts/*.md`、`posts/posts.json`

## 1. 目标与边界

博客采用 Markdown 源文件、受版本控制的文章索引和浏览器端渲染。新增文章不需要修改 `blog.html`，但常规发布仍需显式生成索引、审查差异、提交、推送并执行部署。

该流程覆盖：

- 从 `posts/*.md` 提取列表元数据；
- 生成按日期倒序排列的 `posts/posts.json`；
- 在浏览器中渲染文章列表、筛选、搜索与详情。

发布产物与部署边界统一见 [deployment-architecture.md](deployment-architecture.md)。

该流程不覆盖：

- 远程 CI 自动发布；
- 完整 YAML 语法与 Front Matter Schema 校验；
- 草稿文件的访问控制；
- Markdown 内容审核、图片压缩与链接有效性检查。

`publish: false` 只会将文章排除在索引之外。Markdown 文件仍会随 Git 产物部署，已知文件路径的访问者仍可直接请求该文件，因此该字段不能用于保存私密内容。

## 2. 数据流

```text
posts/*.md ── ./run.sh gen ──→ posts/posts.json
     └────────── 同次提交并发布 ──────────┘

浏览器打开 blog.html
   ├─ fetch posts/posts.json → 列表、标签筛选、搜索
   └─ 打开 #post=<path>      → fetch Markdown → Marked.js 渲染详情
```

`posts/posts.json` 是生成文件，同时也是常规部署所使用的受跟踪文件。`./run.sh deploy` 默认不会重新生成该文件。

## 3. 文章源文件

文章位于 `posts/`，扩展名为 `.md`。文件头使用受限的类 YAML Front Matter：

```markdown
---
title: Cortex-M Fault 排查实战
date: 2026-02-15
tag: 嵌入式
summary: 从故障寄存器到异常现场，建立可复用的定位闭环。
publish: true
ai_summary: 提取文章的关键判断、排查步骤与适用边界。
---

# Cortex-M Fault 排查实战

正文内容。
```

解析器按行读取 `key: value`，并非完整 YAML 解析器。字段值应保持单行、顶格、无引号；不支持缩进对象、数组、折叠文本或多行字符串。

### 3.1 字段契约

| 字段 | 索引生成 | 详情渲染 | 当前行为 |
|---|---|---|---|
| `title` | 写入 JSON | 设置浏览器页面标题 | 缺省时页面标题回退到正文 H1；不会自动生成正文 H1。索引脚本不校验非空 |
| `date` | 写入 JSON 并倒序排序 | 显示于文章信息 | 建议固定为 `YYYY-MM-DD`；脚本按字符串排序，不校验日期合法性 |
| `tag` | 写入 JSON | 显示于文章信息 | 用于标签筛选和默认主题封面选择 |
| `summary` | 写入 JSON | 不直接使用 | 列表摘要；为空时从正文首个有效文本行截取前 100 个字符 |
| `cover` | 写入 JSON | 不直接使用 | 相对站点根目录的封面路径；为空时按标签选择本地 SVG，未知标签使用通用笔记封面 |
| `coverFit` | 非空时写入 JSON | 不直接使用 | `picture/blog/` 下的主题插画始终完整显示；其他自定义图片在值为 `contain` 时完整显示，缺省时裁切填充 |
| `publish` | 控制是否进入 JSON | 不使用 | 默认 `true`；`false`、`0`、`no`（不区分大小写）会排除该文章 |
| `ai_summary` | 忽略 | 存在时显示 | 由详情页直接解析并渲染 AI 摘要卡片 |

正文应保留一个一级标题。主题封面的复用规则、标签别名和自定义图片行为见 [blog-covers.md](blog-covers.md)。

### 3.2 摘要回退

`summary` 为空时，`run.sh` 选择第二个 `---` 之后的首个有效文本行：

- 跳过空行、Markdown 标题、`---` 和 `===`；
- 移除部分常见 Markdown 符号；
- 截取前 100 个字符。

该回退只适合普通段落。正文以列表、引用、HTML 或复杂 Markdown 开头时，应显式填写 `summary`。

## 4. 索引生成

在仓库根目录执行：

```bash
./run.sh gen
```

脚本扫描 `posts/*.md`，通过 `awk` 提取字段，按 `date` 字符串倒序排列，然后覆盖 `posts/posts.json`。输出结构如下：

```json
[
  {
    "file": "posts/example.md",
    "title": "文章标题",
    "date": "2026-02-15",
    "tag": "嵌入式",
    "summary": "文章摘要",
    "cover": "picture/example.webp",
    "coverFit": "contain"
  }
]
```

`coverFit` 为空时不会写入该键。`publish` 与 `ai_summary` 不进入索引。

生成后至少执行以下检查：

```bash
python3 -m json.tool posts/posts.json >/dev/null
git diff -- posts/posts.json
```

脚本当前不校验必填字段、重复文件、重复日期或资源路径。生成成功只表示输出流程完成，不代表文章数据完整。

## 5. 浏览器端渲染

`blog.html` 不内嵌文章卡片。页面加载后执行以下流程：

1. 请求 `posts/posts.json`，生成文章卡片；
2. 按索引中的 `tag` 去重生成筛选按钮；
3. 在标题、标签和摘要中执行客户端搜索；
4. 通过 `js/blog-covers.js` 选择封面，行为见 [blog-covers.md](blog-covers.md)；
5. 点击卡片后写入 `#post=<Markdown 路径>`；
6. 请求 Markdown 文件并渲染正文，按字段契约更新页面标题与文章信息；
7. 估算字数和阅读时长，存在 `ai_summary` 时显示 AI 摘要。

解析器加载失败不影响文章列表，详情页提供错误提示与重试机会。依赖加载与降级约定见 [设计系统 §7](design-system.md#7-外部依赖与降级行为)，字数估算以 `blog.html` 的 `countWords` / `buildArticleHead` 为准。

### 5.1 评论状态

评论使用 giscus，配置位于 `blog.html` 的 `GISCUS_CONFIG`；`categoryId` 为空时评论区不渲染，启用步骤见 [启用 giscus 文章评论](../todo/enable-giscus-comments.md)。填写有效分类 ID 后，评论主题会跟随站点明暗主题切换；脚本加载失败不影响正文。

## 6. 新文章发布流程

1. 在 `posts/` 创建命名稳定的 `.md` 文件，填写 Front Matter 与正文标题；
2. 执行 `./run.sh gen`；
3. 审查 Markdown 文件与 `posts/posts.json` 的差异；
4. 执行 `./run.sh test 8080`，通过 `http://127.0.0.1:8080/blog.html` 验证列表、筛选、封面和详情；
5. 同时提交 Markdown 源文件、引用的本地资源与 `posts/posts.json`；
6. 按项目维护策略将提交推送至选定远程分支；
7. 在工作区无修改和未跟踪文件的前提下，由运行环境注入部署目标并执行 `./run.sh deploy <git-ref>`。

不能直接通过 `file://` 打开 `blog.html` 完成验证，因为文章索引与 Markdown 依赖浏览器 `fetch()`。

## 7. 部署行为

部署说明已归并至 [deployment-architecture.md](deployment-architecture.md)，本节保留为引用入口。

## 8. 验收清单

- [ ] Front Matter 使用单行、顶格字段；
- [ ] `date` 使用 `YYYY-MM-DD`；
- [ ] `./run.sh gen` 成功，`posts/posts.json` 为有效 JSON；
- [ ] 新文章在列表中的顺序、标签、摘要和封面正确；
- [ ] `#post=` 直链、浏览器后退与正文渲染正常；
- [ ] AI 摘要仅在配置 `ai_summary` 时出现；
- [ ] Markdown、封面资源与生成索引已纳入同一发布提交；
- [ ] 目标提交符合项目维护策略，部署目标由运行环境注入，部署前工作区保持干净。
