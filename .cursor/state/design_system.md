# 项目设计系统规范 (Design System Status)

> 最后更新时间: 2026-01-04
> 风格主题: 罗小黑战记 (Luo Xiaohei Theme) - 清新、治愈、圆润

## 1. 核心配色 (Color Palette)

基于 CSS 变量 (`:root`) 实现的动态配色系统。

| 变量名 | 颜色值 | 说明 | 视觉意象 |
| :--- | :--- | :--- | :--- |
| `--bg-color` | `#f7fcf9` | 页面背景 | 灵质空间的柔和氛围，极淡的青白色 |
| `--card-bg` | `#ffffff` | 卡片背景 | 纯净白色，承载内容 |
| `--primary-color` | `#6ab04c` | 主色调 | 森林绿，代表自然、生命力 |
| `--primary-hover` | `#58a03c` | 主色(深) | 悬停交互态 |
| `--accent-color` | `#7ed6df` | 强调色 | 灵质蓝，用于图标背景、高亮装饰 |
| `--dark-text` | `#2d3436` | 主要文本 | 小黑的黑色，高对比度 |
| `--light-text` | `#636e72` | 次要文本 | 灰色，用于说明文字 |

## 2. 视觉风格 (Visual Style)

### 圆角系统 (Border Radius)
整体采用大圆角设计，传达亲和力和动漫感。
- **大圆角 (`--radius-lg`)**: `20px` - 用于卡片、模态框、Header 底部。
- **中圆角 (`--radius-md`)**: `12px` - 用于内部元素、图片。
- **全圆角**: `50px` - 用于按钮 (`.btn`)、标签。

### 阴影系统 (Shadows)
摒弃扁平化，使用多层柔和阴影模拟漂浮感。
- **基础阴影**: `0 4px 6px rgba(106, 176, 76, 0.05)` - 静态元素。
- **悬浮阴影**: `0 12px 24px rgba(106, 176, 76, 0.15)` - 交互反馈 (`:hover`)。

### 装饰元素
- **Hero 背景**: 使用 `::before` / `::after` 伪元素创建模糊的圆形光斑（主色与强调色），增加空间层次感。
- **图标容器**: 使用浅色背景 (`#e3f9e5`, `#e0f7fa`) 搭配深色图标，保持清爽。

## 3. UI 组件库 (Components)

### 按钮 (.btn)
- 胶囊形状，主色背景。
- 悬停时上浮 2px 并增加阴影。
- 支持 `.btn-outline` 描边风格。

### 卡片 (.card)
- 白色背景，大圆角。
- 默认带有微弱边框 `border: 1px solid rgba(0,0,0,0.02)`。
- **交互**: 悬停时整体上浮 (`translateY(-5px)`)，边框变为强调色 (`--accent-color`)，图标旋转。

### 导航栏 (Header)
- 玻璃拟态效果: `backdrop-filter: blur(10px)` + 半透明白色背景。
- 底部带有活动指示器（下划线动画）。

## 4. 布局与响应式 (Layout)

- **容器**: `--container-width: 1100px`。
- **网格**: 使用 CSS Grid (`grid-template-columns: repeat(auto-fit, minmax(300px, 1fr))`) 实现自动响应式卡片布局。
- **移动端适配**:
    - 导航栏自动折叠为汉堡菜单。
    - 字体大小自动调整。
    - 触摸交互优化。

## 5. 技术栈 (Tech Stack)

- **核心**: 原生 HTML5 + CSS3 (CSS Variables)。
- **动画**: AOS.js (滚动视差动画) + CSS Transitions。
- **图标**: Font Awesome 6。
- **字体**: Nunito / PingFang SC / Microsoft YaHei。
- **依赖移除**: 已彻底移除 Tailwind CSS，全站样式由 `css/style.css` 独立接管。

