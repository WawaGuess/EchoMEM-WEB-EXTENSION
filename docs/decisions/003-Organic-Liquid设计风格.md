# ADR-003: Organic Liquid 设计风格

## 状态
Accepted / Implemented

## 背景

EchoMem 作为注入到第三方网站（HIGO Office、DeepSeek）的浏览器扩展，需要与宿主页面和谐共存，同时保持自身品牌辨识度。过于硬朗的 Material Design 或过于扁平的 iOS 风格都难以在两个差异较大的平台上都自然融入。

## 决策

采用 **Organic Liquid（有机液态）** 设计风格作为 EchoMem 面板的统一视觉语言：

- **背景**：暖色渐变 `#f5f0eb → #ede7e0`，与 HIGO 页面自然融合
- **卡片**：毛玻璃效果 `backdrop-filter: blur(12px)`，半透明白色背景
- **图标**：水滴形圆角容器（`border-radius: 50% 50% 50% 50% / 60% 60% 40% 40%`），大地色系渐变背景
- **hover**：卡片上浮 `translateY(-2px)` + 柔和阴影，图标容器放大旋转
- **字体**：`Roboto, "Noto Sans SC", sans-serif`（与 HIGO 保持一致）
- **圆角**：大圆角 `20px`

## 备选方案

| 方案 | 拒绝原因 |
|------|---------|
| Material Design | 与 HIGO 已有的 MUI 风格冲突，显得突兀 |
| 纯扁平 iOS 风格 | 在深色背景的 DeepSeek 上对比度过低 |
| 完全透明跟随宿主 | 失去品牌辨识度，功能入口不易发现 |

## 影响

1. `src/panels/echomem/` — 功能导航首页采用 Organic Liquid 风格
2. 所有面板标题栏统一使用圆角 + 阴影样式
3. 功能图标使用水滴形容器 + 大地色系渐变
4. 配色方案通过 `panelStyles` 配置映射到各功能模块

## 配色方案

| 功能 | 图标容器渐变 | 强调色 accent |
|------|-------------|--------------|
| 资源管理 | `#8ab0c8 → #6a90a8` | `#5a7e95` |
| 输入关联 | `#8ac89a → #6aa87a` | `#5a906a` |
| 认知反馈 | `#b0a0c8 → #9080a8` | `#807098` |
| Skill 管理 | `#d8b87a → #b8985a` | `#a8884a` |
| 效能概览 | `#d89888 → #b87868` | `#a86858` |
| 后端配置 | `#c8a8d0 → #a888b0` | `#9878a0` |

## 相关代码

- `src/panels/echomem/index.js` — 功能导航首页样式
- `src/core/panel-host.js` — 面板容器样式
- `docs/flows/panel-system/生命周期.md`
