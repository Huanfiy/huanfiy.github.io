# 科技制作

本目录用于存放科技制作项目的图片或视频，在 about 页点击「科技制作」卡片后自动展示。

## 使用说明

1. 将项目图片或视频放入本目录（图片支持 jpg、png；视频支持 mp4、webm）
2. 编辑同目录下的 `index.json`，按以下格式追加条目：

**图片：**

```json
{"type": "image", "src": "interests/tech/项目图.jpg", "caption": "项目描述"}
```

**视频：**

```json
{"type": "video", "src": "interests/tech/演示.mp4", "caption": "演示说明"}
```

示例：

```json
[
  {"type": "image", "src": "interests/tech/飞控板.jpg", "caption": "多旋翼飞控板"},
  {"type": "video", "src": "interests/tech/自平衡演示.mp4", "caption": "自平衡小摩托演示"}
]
```

图片支持点击放大，视频在页面内直接播放。
