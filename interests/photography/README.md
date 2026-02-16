# 摄影

本目录用于存放摄影作品图片，在 about 页点击「摄影」卡片后自动展示。

## 使用说明

1. 将摄影图片放入本目录（支持 jpg、png 等常见格式）
2. 编辑同目录下的 `index.json`，按以下格式追加条目：

```json
{"src": "interests/photography/你的图片名.jpg", "caption": "可选描述"}
```

示例：

```json
[
  {"src": "interests/photography/落日.jpg", "caption": "海边落日"},
  {"src": "interests/photography/街景.png", "caption": "城市街景"}
]
```

图片将在网页中以网格形式展示，点击可放大查看。
