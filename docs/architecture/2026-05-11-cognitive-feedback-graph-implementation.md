# 认知反馈图谱功能实现总结

## 状态

已上线 / 2026-05-11

## 功能概述

认知反馈（Cognitive Feedback）是 EchoMem 扩展的五大核心功能之一。点击 EchoMem 面板中的"认知反馈"入口后，会在页面中央打开一个浮动窗口，使用 ECharts 力导向图渲染一张知识图谱，以可视化方式呈现会话中的知识结构。

当前版本使用假数据（JavaScript 异步编程知识点）验证视觉效果和交互体验。

## 架构总览

```
用户点击"认知反馈"
    │
    ▼
┌─────────────────────────────────────────────┐
│  router.js: navigateToEchoMemPanel('feedback')│
│  - 识别 feedback 面板 ID                      │
│  - 调用 openCenterOverlay() 而非 openCustomPanel()│
└──────────────┬──────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────┐
│  panel-host.js: openCenterOverlay()           │
│  - 保存/隐藏已有的 EchoMem overlay（DeepSeek）│
│  - 创建居中浮动窗口（85vw × 80vh）            │
│  - 绑定关闭/返回事件（overlay-only 模式）     │
└──────────────┬──────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────┐
│  feedback/index.js: getGraphOverlayContent()  │
│  - 生成图表容器 DOM                           │
│  - setTimeout 后调用 renderGraph()            │
└──────────────┬──────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────┐
│  feedback/index.js: renderGraph()             │
│  - 获取已打包的 ECharts 实例                  │
│  - echarts.init(container)                    │
│  - setOption({ series: [{ type: 'graph' }] })│
│  - 绑定 resize 监听                           │
└─────────────────────────────────────────────┘
```

## 核心模块详解

### 1. 居中浮层系统 (`src/core/panel-host.js`)

#### 1.1 打开居中浮层 (`openCenterOverlay`)

**职责**：创建独立于 platform config 的居中浮动窗口。

**关键逻辑**：

```javascript
export function openCenterOverlay(title, contentHtml, options = {}) {
  // 1. 保存当前可能存在的 EchoMem overlay（DeepSeek 场景）
  const existingOverlay = currentOverlayPanel;
  if (existingOverlay) {
    existingOverlay.style.display = 'none';
    currentOverlayPanel = null;
  }

  // 2. 创建新的居中 overlay
  createOverlayPanel(panelHtml, {
    position: 'center',
    width: '85vw',
    backdrop: true
  });

  // 3. 调整样式
  currentOverlayPanel.style.maxWidth = '1000px';
  currentOverlayPanel.style.height = '80vh';
  currentOverlayPanel.style.maxHeight = '700px';
  currentOverlayPanel.style.borderRadius = '16px';

  // 4. 标记前序 overlay，用于关闭时恢复
  currentOverlayPanel._previousOverlay = existingOverlay;

  // 5. 绑定事件（overlay-only 模式：只关浮层，恢复前序面板）
  bindPanelEvents(currentOverlayPanel, showBack, onBack, 'overlay-only');
}
```

**平台适配**：

| 平台 | 打开前状态 | 处理逻辑 |
|------|-----------|----------|
| HIGO Office | `currentOverlayPanel = null`（无已打开面板） | 直接创建居中浮层 |
| DeepSeek | `currentOverlayPanel = EchoMem overlay` | 隐藏 EchoMem overlay，保存到 `_previousOverlay` |

#### 1.2 关闭浮层 (`closeOverlayPanel`)

**职责**：关闭当前浮层，如有前序 overlay 则恢复。

```javascript
export function closeOverlayPanel() {
  const overlayToClose = currentOverlayPanel;
  const previousOverlay = overlayToClose?._previousOverlay;

  // 1. 先恢复前序 overlay（如果有）
  if (previousOverlay) {
    previousOverlay.style.display = '';
    currentOverlayPanel = previousOverlay;
    isCustomPanelOpen = true;
    setPanelOpen(true);
  } else {
    currentOverlayPanel = null;
    isCustomPanelOpen = false;
    setPanelOpen(false);
  }

  // 2. 关闭当前浮层（动画 + 移除）
  if (overlayToClose) {
    overlayToClose.style.transform = 'translate(-50%, -50%) scale(0.9)';
    overlayToClose.style.opacity = '0';
    setTimeout(() => overlayToClose.remove(), 300);
  }

  // 3. 移除遮罩层
  document.querySelectorAll('.claw-overlay-backdrop').forEach(b => {
    b.style.opacity = '0';
    setTimeout(() => b.remove(), 300);
  });
}
```

**关键设计**：先恢复状态变量，再执行 DOM 动画。`overlayToClose` 引用在 `setTimeout` 前保存，避免闭包问题。

#### 1.3 事件绑定 (`bindPanelEvents`)

**职责**：绑定面板头部按钮事件，支持两种关闭模式。

```javascript
function bindPanelEvents(container, showBack, onBack, closeMode = 'restore') {
  // 关闭按钮
  closeBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (closeMode === 'overlay-only') {
      closeOverlayPanel();  // 只关浮层
    } else {
      restoreOriginalPanel();  // 关浮层 + 清理状态
    }
  });
}
```

| closeMode | 用途 | 行为 |
|-----------|------|------|
| `'restore'` | 正常 EchoMem 面板 | 关闭浮层 + 清理状态 |
| `'overlay-only'` | 认知图谱浮层 | 只关闭浮层，恢复前序面板（如有） |

### 2. 路由适配 (`src/core/router.js`)

**职责**：识别 feedback 面板，调用 `openCenterOverlay` 而非 `openCustomPanel`。

```javascript
export async function navigateToEchoMemPanel(panelIdOrTitle) {
  const panel = getPanelDefinition(panelIdOrTitle);

  if (panel.id === 'feedback') {
    // 认知反馈：打开居中浮层
    openCenterOverlay('认知图谱', getGraphOverlayContent(), {
      showBack: true,
      onBack: () => {
        closeOverlayPanel();
        openEchoMemHomePanel();
      }
    });
  } else {
    // 其他面板：正常打开 overlay
    openCustomPanel(panel.title, getPanelContent(panel.id), {
      showBack: true,
      onBack: openEchoMemHomePanel
    });
  }
}
```

**返回按钮处理**：
- 先调用 `closeOverlayPanel()` 关闭认知图谱
- 再调用 `openEchoMemHomePanel()` 重新打开 EchoMem 主面板
- `openEchoMemHomePanel()` 中重置 `clawEventsBound` 标记，确保事件重新绑定

### 3. 图谱渲染 (`src/panels/feedback/index.js`)

#### 3.1 ECharts 打包策略

**问题**：页面 CSP 禁止加载外部 CDN 脚本。

**解决**：将 ECharts 作为 npm 依赖打包进扩展，按需引入组件。

```javascript
import * as echarts from 'echarts/core';
import { GraphChart } from 'echarts/charts';
import { CanvasRenderer } from 'echarts/renderers';
import { TooltipComponent, LegendComponent } from 'echarts/components';

// 注册需要的组件
echarts.use([GraphChart, CanvasRenderer, TooltipComponent, LegendComponent]);
```

**体积**：完整版 2.9MB → 按需加载后 1.4MB。

#### 3.2 渲染流程

```javascript
async function renderGraph(container) {
  const echarts = await loadECharts();  // Promise.resolve(echarts)
  const chart = echarts.init(container);

  const option = {
    tooltip: { trigger: 'item', formatter: ... },
    legend: { data: categories.map(c => c.name), bottom: 10 },
    series: [{
      type: 'graph',
      layout: 'force',
      data: mockGraphData.nodes,
      links: mockGraphData.links,
      categories: mockGraphData.categories,
      roam: true,        // 缩放/平移
      draggable: true,   // 节点拖拽
      force: {
        repulsion: 300,
        edgeLength: [80, 150],
        gravity: 0.1
      },
      emphasis: {
        focus: 'adjacency'  // 点击高亮相邻
      }
    }]
  };

  chart.setOption(option);

  // 响应式
  const resizeHandler = () => chart.resize();
  window.addEventListener('resize', resizeHandler);
  container._echartsResizeHandler = resizeHandler;
  container._echartsInstance = chart;
}
```

#### 3.3 容器生命周期

```javascript
export function getGraphOverlayContent() {
  const containerId = 'echomem-graph-container-' + Date.now();

  // DOM 插入后再初始化图表（确保容器有尺寸）
  setTimeout(() => {
    const container = document.getElementById(containerId);
    if (container) renderGraph(container);
  }, 100);

  return `<div id="${containerId}" style="width: 100%; height: 100%;"></div>`;
}
```

### 4. 数据格式

**假数据**：JavaScript 异步编程知识点图谱

```javascript
const mockGraphData = {
  nodes: [
    { id: 'js', name: 'JavaScript', symbolSize: 70, category: 0, value: 100 },
    { id: 'async', name: '异步编程', symbolSize: 60, category: 0, value: 90 },
    { id: 'promise', name: 'Promise', symbolSize: 50, category: 1, value: 80 },
    // ... 共 16 个节点
  ],
  links: [
    { source: 'js', target: 'async', name: '包含' },
    { source: 'async', target: 'promise', name: '核心方案' },
    // ... 共 14 条边
  ],
  categories: [
    { name: '核心概念', itemStyle: { color: '#667eea' } },
    { name: '关键知识点', itemStyle: { color: '#f093fb' } },
    { name: '细节/方法', itemStyle: { color: '#4facfe' } },
    { name: '问题/注意', itemStyle: { color: '#fa709a' } }
  ]
};
```

## 数据流详解

### 完整调用链

```
用户点击"认知反馈"
    │
    ▼
router.js: navigateToEchoMemPanel('feedback')
    │
    ├── getPanelDefinition('feedback') -> { id: 'feedback', title: '认知反馈' }
    │
    ├── panel.id === 'feedback' ✓
    │
    ├── getGraphOverlayContent()
    │   └── 生成容器 DOM + setTimeout(renderGraph, 100)
    │
    ▼
openCenterOverlay('认知图谱', html, { showBack: true, onBack: ... })
    │
    ├── 保存/隐藏已有 overlay（DeepSeek）
    │
    ├── createOverlayPanel(panelHtml, { position: 'center', ... })
    │   ├── 创建遮罩层（backdrop）
    │   ├── 创建浮层 DOM（position: fixed, transform 动画）
    │   └── currentOverlayPanel = 新浮层
    │
    ├── 调整样式（maxWidth, height, borderRadius）
    ├── _previousOverlay = 已隐藏的 EchoMem overlay
    └── bindPanelEvents(..., 'overlay-only')
    │
    ▼
setTimeout(100ms) -> renderGraph(container)
    │
    ├── echarts.init(container)
    ├── setOption({ series: [{ type: 'graph', layout: 'force' }] })
    └── window.addEventListener('resize', resizeHandler)
```

### 关闭调用链

```
用户点击关闭按钮
    │
    ▼
closeOverlayPanel()
    │
    ├── overlayToClose = currentOverlayPanel（认知图谱）
    ├── previousOverlay = overlayToClose._previousOverlay
    │
    ├── 恢复前序 overlay（如果有）
    │   ├── previousOverlay.style.display = ''
    │   └── currentOverlayPanel = previousOverlay
    │
    ├── 关闭认知图谱（动画 + 300ms 后 remove）
    └── 移除遮罩层
```

## 设计决策记录

### 1. 为什么新增 `openCenterOverlay` 而不是扩展 `openCustomPanel`？

**背景**：`openCustomPanel` 依赖 platform config 决定 overlay 配置。

**问题**：认知图谱需要强制居中显示，不依赖 platform 配置。

**决策**：新增独立函数 `openCenterOverlay`，直接调用底层 `createOverlayPanel`，强制 `position: 'center'`。

### 2. 为什么使用 `_previousOverlay` 保存前序 overlay？

**背景**：DeepSeek 的 EchoMem 主面板本身就是 overlay。

**问题**：打开认知图谱时如果删除已有 overlay，关闭后无法恢复主面板。

**决策**：`openCenterOverlay` 将已有 overlay `display: none` 隐藏，保存引用到 `_previousOverlay`。关闭时恢复显示。

### 3. 为什么 `closeOverlayPanel` 先恢复状态再执行动画？

**背景**：早期版本在 `setTimeout` 回调中检查 `currentOverlayPanel`。

**问题**：回调执行前 `currentOverlayPanel` 可能被改回 `previousOverlay`，导致条件判断失败，DOM 未被移除。

**决策**：在 `setTimeout` 前保存 `const overlayToClose = currentOverlayPanel`，回调中直接使用该引用。

### 4. 为什么 ECharts 打包进扩展而不是 CDN？

**背景**：早期版本通过 `<script src="cdn.jsdelivr.net">` 动态加载 ECharts。

**问题**：HIGO/DeepSeek 页面的 CSP（`script-src 'self'`）禁止加载外部脚本。

**决策**：将 ECharts 作为 npm 依赖，通过 `import * as echarts from 'echarts/core'` 按需引入，打包进 content script。

### 5. 为什么返回按钮要先 `closeOverlayPanel` 再 `openEchoMemHomePanel`？

**背景**：认知图谱浮层打开时会隐藏已有的 EchoMem 主面板 overlay（保存到 `_previousOverlay`）。

**问题**：返回时需要先关闭认知图谱浮层，再重新打开 EchoMem 主面板。

**决策**：返回按钮回调改为 `() => { closeOverlayPanel(); openEchoMemHomePanel(); }`，`closeOverlayPanel` 会自动恢复前序 overlay，然后 `openEchoMemHomePanel` 重新渲染主面板。

### 6. 为什么 `openEchoMemHomePanel` 要重置 `clawEventsBound`？

**背景**：`bindPanelNavigation` 使用 `dataset.clawEventsBound = 'true'` 防止重复绑定。

**问题**：从认知图谱返回时，新渲染的主面板 DOM 没有事件监听器，但标记还在。

**决策**：`openEchoMemHomePanel` 中在 `bindPanelNavigation()` 前执行 `delete customPanel.dataset.clawEventsBound`。

## 文件清单

### 核心文件

| 文件 | 说明 |
|------|------|
| `src/core/panel-host.js` | 浮层系统：新增 `openCenterOverlay()`、`closeOverlayPanel()`；修改 `restoreOriginalPanel()`、`bindPanelEvents()` |
| `src/core/router.js` | 路由：认知反馈入口调用 `openCenterOverlay()`；返回按钮先关浮层再开主面板；重置事件绑定标记 |
| `src/panels/feedback/index.js` | 图谱渲染：假数据、ECharts 初始化、响应式处理 |
| `src/panels/index.js` | 导出 `getGraphOverlayContent` |

### 配置变更

| 文件 | 说明 |
|------|------|
| `package.json` | 新增依赖 `echarts` |
| `dist/content.js` | 构建产物（1.4MB，包含 ECharts） |

## 已知限制

1. **打包体积**：1.4MB，主要因为 ECharts 的 force 布局依赖物理引擎。可考虑替换为更轻量的图谱库。
2. **假数据**：当前使用硬编码的 JavaScript 异步编程知识点，未接入真实对话内容。
3. **无持久化**：不保存用户的历史知识图谱，每次打开都是相同的假数据。

## 后续演进方向

1. **减小体积**：替换 ECharts 为 vis-network、Cytoscape.js 或自研 Canvas 渲染
2. **真实数据**：从对话内容中提取知识点和关系（需要 NLP 能力）
3. **持久化**：保存用户的历史知识图谱，支持跨会话查看
4. **导出功能**：支持将图谱导出为图片或 JSON

## 参考

- [方案提案](../proposals/2026-05-11-cognitive-feedback-graph-overlay.md)
- [功能设计文档](../design/cognitive-feedback-graph.md)
