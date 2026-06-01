# 统一 HIGO / DeepSeek 面板为 overlay 模式

## 背景

当前 EchoMem 在两个支持平台上使用两种不同的右侧面板实现：

| 平台 | 模式 | 实现方式 |
|------|------|----------|
| HIGO | `sidebar` | 查找 `.MuiDrawer-anchorRight .MuiDrawer-paper`，替换 `innerHTML`；关闭时恢复原始内容 |
| DeepSeek | `overlay` | 创建 `position: fixed` 浮层，从右侧滑入，带遮罩层；关闭时移除 DOM |

这导致 `src/core/panel-host.js` 中存在大量 `if (type === 'sidebar') else if (type === 'overlay')` 分支，`src/entry/content.js` 中需要额外在 DOM 变化时同步保存 sidebar 原始内容。两种模式增加了维护成本，也增加了新平台接入时的理解成本。

## 目标

将 HIGO 从 `sidebar` 模式迁移为 `overlay` 模式，使两个平台共用同一套面板实现。统一后：

- 删除 `sidebar` 专属代码路径（保存/恢复原始 sidebar 内容、分支判断）
- 两个平台的面板行为完全一致：滑入、遮罩、点击关闭
- 面板宽度统一为 320px，与 HIGO 原生 Drawer 宽度 `DRAWER_WIDTH = 320` 保持一致

## 方案设计

### 1. 平台配置调整

HIGO `panelHost` 改为 overlay，并增加 `overlayConfig`：

```json
"panelHost": {
  "type": "overlay",
  "overlayConfig": {
    "position": "right",
    "width": "320px",
    "backdrop": true
  }
}
```

DeepSeek 的 `overlayConfig.width` 同步改为 `"320px"`，实现视觉完全一致。

### 2. 入口脚本清理

`src/entry/content.js` 中删除 `syncOriginalSidebarContent()` 函数：

- 该函数仅在 `panelConfig.type === 'sidebar'` 时执行，用于在 DOM 变化时提前保存 sidebar 原始内容
- 统一为 overlay 后不再需要
- 同时删除 `getPanelConfig` 和 `setOriginalPanelContent` 的 import

### 3. 面板宿主简化

`src/core/panel-host.js` 中移除所有 sidebar 分支和死代码：

| 删除/简化项 | 说明 |
|------------|------|
| `originalPanelContent` 变量 | sidebar 模式用于恢复原始内容 |
| `saveOriginalPanel()` | 保存 sidebar 内容，无调用方 |
| `getOriginalPanelContent()` / `setOriginalPanelContent()` | 读写保存的内容，无外部调用 |
| `getPanelContainer()` | 移除 sidebar 分支，直接返回 `currentOverlayPanel` |
| `openCustomPanel()` | 移除 `panelConfig.type === 'sidebar'` 分支（`container.innerHTML = panelHtml`），只保留 overlay 分支 |
| `restoreOriginalPanel()` | 移除 sidebar 内容恢复逻辑，只保留 `closeOverlayPanel()` + 遮罩层防御清理 |

**关键行为验证**：

- `getPanelBodyElement()` → `getPanelContainer()` → `currentOverlayPanel` → `querySelector('.claw-custom-panel-body')`，router.js 中所有面板初始化逻辑不受影响
- `openCenterOverlay()` 的 `_previousOverlay` 机制在 `closeOverlayPanel()` 中仍然有效：认知反馈图谱浮层关闭后，正确恢复之前的 EchoMem 面板

### 4. 其他文件微调

- `src/panels/feedback/index.js`：更新 "用于 sidebar 占位" 注释
- `docs/design/echomem-launcher-sidebar.md`：第 9 节兼容策略重写
- `CLAUDE.md`：更新面板模式描述

## 影响范围

| 文件 | 变更性质 |
|------|----------|
| `src/config/platforms.json` | HIGO 配置修改 + DeepSeek 宽度统一 |
| `src/entry/content.js` | 删除 `syncOriginalSidebarContent` 及依赖 import |
| `src/core/panel-host.js` | 删除 sidebar 分支，简化约 30–40 行 |
| `src/core/router.js` | 无需修改 |
| `src/panels/feedback/index.js` | 注释更新 |
| `docs/design/echomem-launcher-sidebar.md` | 文档更新 |
| `CLAUDE.md` | 文档更新 |

## 风险与应对

1. **HIGO 视觉重叠**：HIGO 原生右侧 Drawer 宽 320px，overlay 同样宽 320px、固定右侧。overlay `z-index: 9999` 会覆盖在 Drawer 上方，关闭后 Drawer 重新可见。视觉上 overlay 恰好替代了原 sidebar 的占位空间，体验接近当前 sidebar 模式。

2. **320px 内容适配**：原 overlay 为 400px，统一为 320px 后面板内容区域变窄。EchoMem 功能导航首页的卡片（图标 42px + 间距 14px + 文字区 + 箭头 16px）在 320px 容器下预估可用宽度约 240px，需验证文字换行和布局是否正常。

3. **遮罩层交互差异**：sidebar 模式无遮罩，点击页面其他区域不关闭面板；overlay 模式有遮罩，点击遮罩即可关闭。这是行为变化，需确认用户接受。

## 验收标准

1. HIGO 页面点击 EchoMem 按钮，右侧滑出 320px 宽 overlay 面板
2. DeepSeek 页面点击 EchoMem 按钮，右侧滑出 320px 宽 overlay 面板（宽度与 HIGO 一致）
3. 两个平台的功能导航首页、各功能详情页、返回、关闭行为完全一致
4. 认知反馈的居中图谱浮层打开/关闭后，能正确恢复之前的 EchoMem 面板
5. 页面 DOM 多次变化后不会注入多个 EchoMem 按钮
6. `src/core/panel-host.js` 中不再出现 `sidebar` 关键字分支
