# 启用 giscus 文章评论

- 状态：待处理
- 创建日期：2026-07-10
- 目标仓库：`Huanfiy/huanfiy.github.io`
- 配置位置：[blog.html](../../blog.html) 中的 `GISCUS_CONFIG`

## 目标

启用基于 GitHub Discussions 的文章评论区。启用后，每篇 Markdown 文章按文件名映射到独立 Discussion，并跟随站点在浅色与暗色主题之间切换。

## 当前状态

- giscus 加载、文章映射和主题同步已实现，`categoryId` 仍为空，评论区未启用；其他字段以源码配置为准。
- GitHub Discussions 与 giscus App 授权状态须在执行时核验，不能从本地配置推断。

## 前置条件

- 仓库必须保持公开，访客才能读取评论内容。
- 执行配置的 GitHub 账号需要具备仓库管理权限。
- giscus App 需要获得 `Huanfiy/huanfiy.github.io` 仓库的访问权限。

## 操作步骤

- [ ] 在仓库设置中检查 `Discussions`，未启用时开启。
- [ ] 检查 [giscus App](https://github.com/apps/giscus) 是否已安装并获准访问目标仓库，缺失时补齐。
- [ ] 在 [giscus 配置页](https://giscus.app/zh-CN) 选择目标仓库与评论分类。
- [ ] 将生成的 `data-category-id` 填入 `GISCUS_CONFIG.categoryId`；核对仓库及分类的名称与 ID，必要时同步更新对应字段。

`categoryId` 是 GitHub Discussion 分类标识，不属于访问密钥，可以提交到公开仓库。

## 验收标准

- [ ] 打开任意博客文章后，正文下方能够显示 giscus 评论框。
- [ ] 使用 GitHub 账号发布一条测试评论后，仓库对应分类中生成 Discussion。
- [ ] 刷新页面后，已发布评论仍显示在同一篇文章下。
- [ ] 打开另一篇文章时，不会复用前一篇文章的评论线程。
- [ ] 切换站点浅色与暗色主题后，giscus 评论框配色同步变化。
- [ ] 浏览器控制台没有 giscus 权限、仓库或分类配置错误。

## 范围边界

本待办仅覆盖 giscus 启用和功能验证，不包含历史评论迁移、评论内容审核规则、通知策略及 GitHub Discussions 分类治理。完成验收后删除本文件，并更新引用它的文档。
