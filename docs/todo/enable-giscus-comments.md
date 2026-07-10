# 启用 giscus 文章评论

- 状态：待处理
- 创建日期：2026-07-10
- 目标仓库：`Huanfiy/huanfiy.github.io`
- 配置位置：`blog.html` 中的 `GISCUS_CONFIG`

## 目标

启用基于 GitHub Discussions 的文章评论区。启用后，每篇 Markdown 文章按文件名映射到独立 Discussion，并跟随站点在浅色与暗色主题之间切换。

## 当前状态

- giscus 加载、文章映射和主题同步代码已写入 `blog.html`。
- `repo` 已配置为 `Huanfiy/huanfiy.github.io`。
- `repoId` 已配置为 `R_kgDOM3iQ0Q`。
- `category` 已配置为 `Announcements`。
- `categoryId` 当前为空，因此评论区不会渲染。
- GitHub 仓库尚未启用 Discussions。

## 前置条件

- 仓库必须保持公开，访客才能读取评论内容。
- 执行配置的 GitHub 账号需要具备仓库管理权限。
- giscus App 需要获得 `Huanfiy/huanfiy.github.io` 仓库的访问权限。

## 操作步骤

- [ ] 打开仓库的 `Settings` 页面，在 `General > Features` 中启用 `Discussions`。
- [ ] 安装 [giscus App](https://github.com/apps/giscus)，并授权访问 `Huanfiy/huanfiy.github.io` 仓库。
- [ ] 打开 [giscus 配置页](https://giscus.app/zh-CN)，填写仓库名称并选择 `Announcements` 分类。
- [ ] 从生成的配置中复制 `data-category-id`。
- [ ] 将 `data-category-id` 的值填入 `blog.html`：

```javascript
const GISCUS_CONFIG = {
    repo: 'Huanfiy/huanfiy.github.io',
    repoId: 'R_kgDOM3iQ0Q',
    category: 'Announcements',
    categoryId: '填写 data-category-id'
};
```

- [ ] 如果 giscus 配置页返回的分类名称不是 `Announcements`，同时更新 `category` 和 `categoryId`，确保两者对应同一分类。

`categoryId` 是 GitHub Discussion 分类标识，不属于访问密钥，可以提交到公开仓库。

## 验收标准

- [ ] 打开任意博客文章后，正文下方能够显示 giscus 评论框。
- [ ] 使用 GitHub 账号发布一条测试评论后，仓库对应分类中生成 Discussion。
- [ ] 刷新页面后，已发布评论仍显示在同一篇文章下。
- [ ] 打开另一篇文章时，不会复用前一篇文章的评论线程。
- [ ] 切换站点浅色与暗色主题后，giscus 评论框配色同步变化。
- [ ] 浏览器控制台没有 giscus 权限、仓库或分类配置错误。

## 范围边界

本待办仅覆盖 giscus 启用和功能验证，不包含历史评论迁移、评论内容审核规则、通知策略及 GitHub Discussions 分类治理。
