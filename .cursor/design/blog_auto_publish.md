# 博客自动化发文系统

## 设计目标

实现"只写一个 .md 文件就能自动在博客页面展示"的工作流，消除手动编辑 HTML 的步骤。

## 架构

```
写 .md 文件 → run.sh gen → 生成 posts.json → blog.html JS 读取 → 动态渲染卡片
                  ↑
            deploy 时自动触发
```

## 核心机制

### 1. Markdown Front Matter

每篇文章在 `.md` 文件头部使用 YAML Front Matter 声明元数据：

```markdown
---
title: 文章标题
date: 2024-05-10
tag: Git
summary: 一句话摘要（可选，不填则自动截取正文前 100 字）
cover: images/blog/xxx.jpg（可选，不填则使用默认配图）
---
```

字段说明：
- `title` — 文章标题，必填
- `date` — 发布日期，必填，格式 YYYY-MM-DD
- `tag` — 分类标签，必填
- `summary` — 摘要，可选，省略时脚本自动截取正文首段前 100 字
- `cover` — 配图路径，可选，省略时由前端按 tag 生成 SVG 渐变默认图

### 2. 文章清单生成（run.sh gen）

`run.sh` 的 `gen` 子命令扫描 `posts/*.md`，用 awk 解析 Front Matter，输出 `posts/posts.json`：

- 按 `date` 倒序排列（新文章在前）
- `deploy` 子命令自动先调用 `gen`
- 纯 shell + awk，无额外依赖

JSON 结构：

```json
[
  {
    "file": "posts/xxx.md",
    "title": "文章标题",
    "date": "2024-05-15",
    "tag": "Linux",
    "summary": "摘要文本",
    "cover": ""
  }
]
```

### 3. 前端动态渲染（blog.html）

- 页面加载时 `fetch('posts/posts.json')` 获取清单
- JS 遍历数组，生成与原有样式一致的 `<article>` 卡片
- `loadMarkdown()` 渲染前通过 `stripFrontMatter()` 剥离 YAML 头

### 4. 默认配图策略

优先级：`cover` 字段 > 按 tag 匹配渐变色 > 项目主题色兜底

内置 tag 渐变映射表（`TAG_GRADIENTS`）：

| tag   | 渐变色                  |
| ----- | ----------------------- |
| Git   | #667eea → #764ba2       |
| Linux | #11998e → #38ef7d       |
| 随笔  | #ee9ca7 → #ffdde1       |
| 前端  | #f7971e → #ffd200       |
| 后端  | #4facfe → #00f2fe       |
| 其他  | #6ab04c → #7ed6df（主题色） |

使用内联 SVG 生成，零外部依赖，标签名称居中显示于渐变背景上。

## 添加新文章流程

1. 在 `posts/` 下创建 `.md` 文件，写好 Front Matter
2. 运行 `./run.sh gen`（或直接 `./run.sh deploy` 会自动触发）
3. 博客页面自动展示新文章

## 涉及文件

| 文件 | 角色 |
| --- | --- |
| `posts/*.md` | 文章源文件（含 Front Matter） |
| `posts/posts.json` | 自动生成的文章清单 |
| `run.sh` | gen 子命令（生成清单）、deploy 集成 |
| `blog.html` | 动态渲染卡片 + Front Matter 剥离 |
