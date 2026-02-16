# 阅读

本目录用于管理推荐书籍、书评及优质图书平台链接，在 about 页点击「阅读」卡片后自动展示。

## 使用说明

编辑同目录下的 `books.json`，维护以下两个部分：

### 推荐书籍（books）

每本书包含：标题、作者、封面、简短书评。

```json
{
  "title": "书名",
  "author": "作者",
  "cover": "封面图片路径或 URL",
  "review": "简短书评，几百字内即可"
}
```

### 优质图书平台（platforms）

每个平台包含：名称、链接、简要说明。

```json
{
  "name": "平台名称",
  "url": "https://...",
  "desc": "简要说明"
}
```

### 完整示例

```json
{
  "books": [
    {
      "title": "代码整洁之道",
      "author": "Robert C. Martin",
      "cover": "interests/reading/clean_code.jpg",
      "review": "面向对象与函数式平衡的经典，值得反复翻看。"
    }
  ],
  "platforms": [
    {"name": "豆瓣读书", "url": "https://book.douban.com", "desc": "书评与榜单"},
    {"name": "微信读书", "url": "https://weread.qq.com", "desc": "电子书阅读"}
  ]
}
```
