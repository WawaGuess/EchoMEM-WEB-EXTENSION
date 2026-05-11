# 认知反馈图谱浮层方案

## 状态

Draft

## 背景

当前 EchoMem 的"认知反馈"入口点击后在右侧 sidebar 打开一个占位面板，仅显示对话轮次、响应时间、Token 消耗等静态统计，没有实际的可视化价值。

用户期望将该入口改造为：点击后直接打开一个**居中、大尺寸浮动窗口**，在窗口内渲染**知识图谱**，以可视化方式呈现会话中的知识结构或对话脉络。

## 目标

1. 点击"认知反馈"按钮后，不再打开右侧 sidebar，而是直接打开一个居中浮层。
2. 浮层内使用 ECharts 渲染一张可交互的知识图谱（力导向图）。
3. 使用假数据验证视觉效果和交互体验。

## 非目标

1. 不从真实对话内容中提取知识点（本次仅用假数据）。
2. 不实现图谱数据的持久化存储。
3. 不修改其他四个入口（资源管理、输入联想、skill 商店、效能）的打开方式。

## 方案

### 1. 浮层打开方式

新增一个独立的居中浮层函数 `openCenterOverlay()`，与现有的 `openCustomPanel()` 并存：

- `openCustomPanel()`：继续负责正常的 sidebar / 右侧 overlay 逻辑，供其他入口使用。
- `openCenterOverlay()`：专门打开居中、大尺寸的浮层，仅用于认知反馈图谱。

`openCenterOverlay()` 内部直接调用现有的 `createOverlayPanel()`，但强制传入 `position: 'center'` 和更大的尺寸参数，不读取 platform config。

### 2. 浮层样式

```
position: fixed
width: 85vw (max-width: 1000px)
height: 80vh (max-height: 700px)
top: 50%; left: 50%
transform: translate(-50%, -50%)
border-radius: 16px
box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2)
z-index: 9999
backdrop: rgba(0, 0, 0, 0.5) z-index: 9998
```

### 3. 浮层结构

```
┌─────────────────────────────────────────┐
│  ← 返回    认知图谱              ✕ 关闭  │  ← header
├─────────────────────────────────────────┤
│                                         │
│         [ ECharts 力导向图区域 ]          │  ← body
│                                         │
│    节点可拖拽、可缩放、点击显示详情        │
│                                         │
└─────────────────────────────────────────┘
```

### 4. 图谱库选型

使用 **ECharts 5.x**（通过 CDN 动态加载）。

理由：
- 文档完善，中文支持好
- 内置力导向图布局，开箱即用
- 支持缩放、拖拽、节点点击等交互
- 体积可通过 CDN 按需加载，不增加打包体积

加载方式：
```javascript
function loadECharts() {
  return new Promise((resolve, reject) => {
    if (window.echarts) return resolve(window.echarts);
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/echarts@5.4.3/dist/echarts.min.js';
    script.onload = () => resolve(window.echarts);
    script.onerror = reject;
    document.head.appendChild(script);
  });
}
```

### 5. 假数据设计

场景：用户正在学习"JavaScript 异步编程"，图谱展示相关知识点及关联。

```javascript
const mockGraphData = {
  nodes: [
    // 核心概念（大节点，紫色）
    { id: 'js', name: 'JavaScript', symbolSize: 70, category: 0, value: 100 },
    { id: 'async', name: '异步编程', symbolSize: 60, category: 0, value: 90 },

    // 关键知识点（中等节点，粉色）
    { id: 'promise', name: 'Promise', symbolSize: 50, category: 1, value: 80 },
    { id: 'async-await', name: 'async/await', symbolSize: 50, category: 1, value: 80 },
    { id: 'callback', name: '回调函数', symbolSize: 45, category: 1, value: 70 },
    { id: 'event-loop', name: '事件循环', symbolSize: 45, category: 1, value: 70 },

    // 细节概念（小节点，蓝色）
    { id: 'then', name: '.then()', symbolSize: 35, category: 2, value: 50 },
    { id: 'catch', name: '.catch()', symbolSize: 35, category: 2, value: 50 },
    { id: 'resolve', name: 'resolve', symbolSize: 30, category: 2, value: 40 },
    { id: 'reject', name: 'reject', symbolSize: 30, category: 2, value: 40 },
    { id: 'microtask', name: '微任务', symbolSize: 35, category: 2, value: 50 },
    { id: 'macrotask', name: '宏任务', symbolSize: 35, category: 2, value: 50 },
    { id: 'settimeout', name: 'setTimeout', symbolSize: 30, category: 2, value: 40 },
    { id: 'fetch', name: 'Fetch API', symbolSize: 35, category: 2, value: 50 },
    { id: 'xhr', name: 'XMLHttpRequest', symbolSize: 30, category: 2, value: 40 },

    // 问题/注意（小节点，红色）
    { id: 'hell', name: '回调地狱', symbolSize: 35, category: 3, value: 50 },
  ],
  links: [
    // 层级关系
    { source: 'js', target: 'async', name: '包含' },
    { source: 'async', target: 'promise', name: '核心方案' },
    { source: 'async', target: 'callback', name: '基础方式' },
    { source: 'async', target: 'event-loop', name: '底层机制' },

    // Promise 相关
    { source: 'promise', target: 'then', name: '方法' },
    { source: 'promise', target: 'catch', name: '方法' },
    { source: 'promise', target: 'resolve', name: '状态' },
    { source: 'promise', target: 'reject', name: '状态' },
    { source: 'promise', target: 'async-await', name: '语法糖' },

    // 事件循环相关
    { source: 'event-loop', target: 'microtask', name: '包含' },
    { source: 'event-loop', target: 'macrotask', name: '包含' },
    { source: 'macrotask', target: 'settimeout', name: '示例' },

    // 实际应用
    { source: 'async', target: 'fetch', name: '应用场景' },
    { source: 'callback', target: 'xhr', name: '传统用法' },
    { source: 'callback', target: 'hell', name: '导致' },
    { source: 'promise', target: 'hell', name: '解决' },
  ],
  categories: [
    { name: '核心概念', itemStyle: { color: '#667eea' } },
    { name: '关键知识点', itemStyle: { color: '#f093fb' } },
    { name: '细节/方法', itemStyle: { color: '#4facfe' } },
    { name: '问题/注意', itemStyle: { color: '#fa709a' } },
  ],
};
```

### 6. ECharts 配置

```javascript
const option = {
  tooltip: {
    trigger: 'item',
    formatter: (params) => {
      if (params.dataType === 'node') {
        return `<b>${params.data.name}</b><br/>类型: ${categories[params.data.category].name}`;
      }
      return `${params.data.source} → ${params.data.target}<br/>关系: ${params.data.name}`;
    },
  },
  legend: {
    data: categories.map((c) => c.name),
    bottom: 10,
  },
  series: [
    {
      type: 'graph',
      layout: 'force',
      data: nodes,
      links: links,
      categories: categories,
      roam: true, // 启用缩放/拖拽
      draggable: true,
      label: { show: true, position: 'inside' },
      force: {
        repulsion: 300,
        edgeLength: [80, 150],
        gravity: 0.1,
      },
      lineStyle: {
        color: 'source',
        curveness: 0.2,
      },
      emphasis: {
        focus: 'adjacency',
        lineStyle: { width: 4 },
      },
    },
  ],
};
```

### 7. 交互行为

| 操作 | 行为 |
|------|------|
| 点击节点 | 高亮该节点及其相邻节点和边，其他节点变暗 |
| 拖拽节点 | 调整节点位置，力导向图会重新平衡 |
| 滚轮/双指缩放 | 放大/缩小整个图谱 |
| 拖拽空白处 | 平移整个图谱 |
| 点击关闭按钮 | 关闭浮层，恢复页面 |
| 点击遮罩层 | 关闭浮层 |
| 点击返回按钮 | 关闭浮层，回到 EchoMem 主面板 |

### 8. 时序流程

```
用户点击"认知反馈"
    │
    ▼
router 调用 openCenterOverlay('认知图谱', contentHtml)
    │
    ▼
createOverlayPanel() 创建居中浮层 + 遮罩层
    │
    ▼
浮层 DOM 插入页面，显示 header + body
    │
    ▼
body 内创建 <div id="echarts-container">
    │
    ▼
动态加载 ECharts CDN
    │
    ▼
初始化 echarts.init(container)
    │
    ▼
setOption(mockGraphData) 渲染力导向图
    │
    ▼
用户交互（点击/拖拽/缩放）
    │
    ▼
点击关闭/遮罩/返回
    │
    ▼
restoreOriginalPanel() 关闭浮层，清理 echarts 实例
```

## 影响范围

### 修改文件

| 文件 | 修改内容 |
|------|----------|
| `src/core/panel-host.js` | 新增 `openCenterOverlay()` 函数；导出供外部调用 |
| `src/panels/feedback/index.js` | 完全重写：移除静态统计，改为加载 ECharts 并渲染图谱 |
| `src/core/router.js` | 调整 feedback 入口的打开逻辑，调用 `openCenterOverlay` 而非 `openCustomPanel` |

### 不修改的文件

- `src/panels/echomem/index.js`（EchoMem 主面板）
- `src/panels/resource/index.js`
- `src/panels/association/index.js`
- `src/panels/skill-store/index.js`
- `src/panels/performance/index.js`
- `manifest.json`（无需新权限）

## 验收标准

1. 点击"认知反馈"后，右侧 sidebar 不打开，而是屏幕中央出现一个圆角浮层。
2. 浮层尺寸合理（占屏幕 80% 左右），有阴影和遮罩，视觉上突出。
3. 浮层内渲染一张力导向图，节点大小和颜色按分类区分。
4. 节点可拖拽，图谱可缩放，点击节点高亮相邻元素。
5. 点击关闭按钮、返回按钮或遮罩层，浮层平滑关闭。
6. 关闭后页面恢复正常，无残留 DOM。
7. 其他四个入口不受影响，继续正常打开 sidebar。

## 后续归档

方案确认采用并实现后：
- 更新 `docs/design/echomem-launcher-sidebar.md`，在功能入口表格中更新"认知反馈"的描述。
- 将本文档移入 `docs/legacy/` 作为实现记录，或保留在 `docs/proposals/` 直到下次架构调整。
