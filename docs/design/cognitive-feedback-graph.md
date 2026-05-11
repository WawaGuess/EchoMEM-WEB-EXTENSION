# 认知反馈图谱功能设计文档

## 功能概述

认知反馈（Cognitive Feedback）是 EchoMem 扩展的五大核心功能之一。点击 EchoMem 面板中的"认知反馈"入口后，会在页面中央打开一个浮动窗口，使用 ECharts 力导向图渲染一张知识图谱，以可视化方式呈现会话中的知识结构。

当前版本使用假数据（JavaScript 异步编程知识点）验证视觉效果和交互体验。

## 交互流程

```
用户点击 EchoMem launcher
    │
    ▼
打开 EchoMem 主面板（右侧 sidebar 或 overlay）
    │
    ▼
点击"认知反馈"菜单项
    │
    ▼
打开居中浮动窗口（认知图谱）
    │
    ├─ 节点可拖拽、图谱可缩放
    ├─ 点击节点高亮相邻元素
    └─ 悬停显示节点/边的详细信息
    │
    ▼
点击关闭/返回/遮罩层
    │
    ▼
关闭认知图谱浮层，回到 EchoMem 主面板
```

## 技术实现

### 1. 浮层系统

新增 `openCenterOverlay()` 函数，与现有的 `openCustomPanel()` 并存：

- `openCustomPanel()`：负责正常的 sidebar / 右侧 overlay 逻辑
- `openCenterOverlay()`：打开居中、大尺寸的浮动窗口，用于认知反馈图谱

**浮层样式**：
- 宽度：`85vw`（最大 `1000px`）
- 高度：`80vh`（最大 `700px`）
- 位置：屏幕中央（`translate(-50%, -50%)`）
- 圆角：`16px`
- 阴影：`0 8px 32px rgba(0, 0, 0, 0.2)`
- 遮罩层：`rgba(0, 0, 0, 0.5)`

**关闭行为**：
- 点击关闭按钮：关闭浮层
- 点击返回按钮：关闭浮层 + 回到 EchoMem 主面板
- 点击遮罩层：关闭浮层
- 关闭浮层时不影响右侧 sidebar（HIGO）或恢复右侧 overlay（DeepSeek）

### 2. 平台适配

| 平台 | EchoMem 主面板 | 认知图谱浮层 | 关闭后的行为 |
|------|---------------|-------------|-------------|
| HIGO Office | sidebar（右侧抽屉） | 居中 overlay | 关闭浮层，sidebar 保持 EchoMem 主面板 |
| DeepSeek | 右侧 overlay | 居中 overlay | 关闭浮层，恢复右侧 EchoMem overlay |

**实现要点**：
- `openCenterOverlay()` 打开时，如果已存在 EchoMem overlay（DeepSeek 场景），将其 `display: none` 隐藏并保存引用到 `_previousOverlay`
- `closeOverlayPanel()` 关闭时，如果有 `_previousOverlay`，恢复其显示并重新设为 `currentOverlayPanel`

### 3. 图谱渲染

**库选择**：ECharts 5.x（按需加载，打包进扩展）

**按需加载的组件**：
- `echarts/core`：核心
- `echarts/charts/GraphChart`：力导向图
- `echarts/renderers/CanvasRenderer`：Canvas 渲染器
- `echarts/components/TooltipComponent`：提示框
- `echarts/components/LegendComponent`：图例

**数据格式**（ECharts graph series）：
```javascript
{
  nodes: [
    { id: 'js', name: 'JavaScript', symbolSize: 70, category: 0, value: 100 },
    // ...
  ],
  links: [
    { source: 'js', target: 'async', name: '包含' },
    // ...
  ],
  categories: [
    { name: '核心概念', itemStyle: { color: '#667eea' } },
    // ...
  ]
}
```

**交互配置**：
- `roam: true`：启用缩放/平移
- `draggable: true`：节点可拖拽
- `emphasis.focus: 'adjacency'`：点击节点高亮相邻元素
- `force`：力导向布局参数（repulsion, edgeLength, gravity）

### 4. 假数据

场景：用户正在学习"JavaScript 异步编程"

- **16 个节点**：4 个核心概念、4 个关键知识点、7 个细节/方法、1 个问题/注意
- **14 条边**：层级关系、方法关系、状态关系、应用场景等
- **4 种分类颜色**：紫色（核心）、粉色（关键）、蓝色（细节）、红色（问题）

## 修改的文件

| 文件 | 修改内容 |
|------|----------|
| `src/core/panel-host.js` | 新增 `openCenterOverlay()`、`closeOverlayPanel()`；修改 `restoreOriginalPanel()` 支持恢复之前的 overlay；修改 `bindPanelEvents()` 支持 `closeMode` 参数 |
| `src/core/router.js` | 认知反馈入口调用 `openCenterOverlay()`；返回按钮先关闭浮层再打开主面板；`openEchoMemHomePanel()` 重置事件绑定标记 |
| `src/panels/feedback/index.js` | 重写：移除静态统计，改为渲染 ECharts 力导向图；假数据；`loadECharts()` 改为同步返回已打包的 ECharts |
| `src/panels/index.js` | 导出 `getGraphOverlayContent` |
| `package.json` | 新增依赖 `echarts` |
| `dist/content.js` | 构建产物（1.4MB，包含 ECharts） |

## 遇到的问题与解决方案

### 问题 1：DeepSeek 浮层闪一下就消失
**原因**：`openCenterOverlay` 调用 `restoreOriginalPanel()`，DeepSeek 的 platform config 是 overlay 类型，导致刚创建的浮层被立即关闭。

**解决**：`openCenterOverlay` 不再调用 `restoreOriginalPanel()`，改为直接清理已存在的 overlay DOM 和遮罩层。

### 问题 2：关闭认知图谱后右侧 sidebar 也关闭
**原因**：`restoreOriginalPanel()` 总是恢复 sidebar 内容，导致 EchoMem 主面板被关闭。

**解决**：新增 `closeOverlayPanel()` 只关闭浮层不恢复 sidebar；`bindPanelEvents` 增加 `closeMode` 参数，认知图谱使用 `'overlay-only'` 模式。

### 问题 3：DeepSeek 关闭后右侧 overlay 消失且页面卡死
**原因**：`closeOverlayPanel()` 的 `setTimeout` 回调依赖 `currentOverlayPanel` 变量，但该变量在回调执行前已被改回 `previousOverlay`。

**解决**：在 `setTimeout` 前保存浮层引用 `const overlayToClose = currentOverlayPanel`，回调中直接使用该引用移除 DOM。

### 问题 4：返回后按钮无法点击
**原因**：`bindPanelNavigation` 使用 `dataset.clawEventsBound` 防止重复绑定，返回后新面板的事件没有绑定。

**解决**：`openEchoMemHomePanel()` 中在 `bindPanelNavigation()` 前删除 `clawEventsBound` 标记。

### 问题 5：ECharts 加载失败（CSP 限制）
**原因**：HIGO/DeepSeek 页面的 CSP 禁止加载外部 CDN 脚本。

**解决**：将 ECharts 作为 npm 依赖打包进扩展内部，通过 `import * as echarts from 'echarts/core'` 按需引入，避免 CSP 限制。

## 后续优化方向

1. **减小打包体积**：当前 1.4MB，可考虑替换为更轻量的图谱库（如 vis-network、Cytoscape.js）或自研 Canvas 渲染
2. **真实数据**：从对话内容中提取知识点和关系，替代假数据
3. **持久化**：保存用户的历史知识图谱，支持跨会话查看
4. **导出功能**：支持将图谱导出为图片或 JSON

## 相关文档

- 方案提案：`docs/proposals/2026-05-11-cognitive-feedback-graph-overlay.md`
