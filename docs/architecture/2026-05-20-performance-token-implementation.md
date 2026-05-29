# 效能面板 Token 消耗展示 — 代码实现文档

## 变更范围

本次改动涉及 3 个文件，新增 1 份文档，无删除操作。

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/panels/performance/index.js` | 重写 | 原 46 行占位逻辑全部替换，新增骨架屏、异步加载、轮询刷新 |
| `src/panels/index.js` | 修改 | 新增 `initPerformancePanel` 导出 |
| `src/core/router.js` | 修改 | 新增效能面板生命周期管理（清理句柄 + 导航集成） |
| `docs/design/performance-token-metrics.md` | 新增 | 需求设计文档（已独立提交） |

---

## `src/panels/performance/index.js`

### 文件结构

该文件现为纯效能面板模块，共 166 行，导出 3 个函数：

```
src/panels/performance/index.js
├── 模块常量
│   └── FMT = (n) => n.toLocaleString('zh-CN')
├── 内部辅助函数
│   └── skeletonValue(width)               // 骨架屏占位条 HTML
│   └── updatePerformanceDOM(body, data)   // DOM 更新（内部不导出）
├── 导出函数
│   ├── getPerformanceContent()            // 返回骨架屏 HTML
│   ├── fetchPerformanceData()             // 异步获取数据（TODO 占位）
│   └── initPerformancePanel(body, opts)   // 初始化 + 轮询，返回 destroy()
```

### `skeletonValue(width)`

内部函数，返回一段内联 style 的 `<span>`，用于在数值未加载前做脉冲动画占位。

```js
function skeletonValue(width = '60px') {
  return `<span class="perf-skeleton" style="
    display: inline-block;
    width: ${width}; height: 20px;
    background: #e5e7eb;
    border-radius: 4px;
    animation: perf-skeleton-pulse 1.5s ease-in-out infinite;
  "></span>`;
}
```

配合内联 `<style>` 定义 `@keyframes perf-skeleton-pulse`，实现 opacity 1 → 0.4 → 1 的循环闪烁。

### `getPerformanceContent()`

返回完整的 HTML 字符串（无参数）。关键特征：

- 数值区域使用以下 id 作为 DOM 更新锚点：
  - `id="perf-total"` — 总 Token 消耗（核心指标区）
  - `id="perf-sessions"` / `id="perf-turns"` — 会话统计区
  - `id="perf-input"` / `id="perf-output"` — Input/Output 拆分区
  - `id="perf-backend"` / `id="perf-saved"` — 后端消耗 & 节省占位区（当前写死为"--"）
- 说明区域使用 `id="perf-desc"` 作为状态/错误提示锚点
- 骨架屏占位条宽度：核心指标 100px，双列卡片 60px~80px

### `fetchPerformanceData()`

已实现真实接口接入，通过 background script 代理请求绕过页面域 CORS 限制：

```js
export async function fetchPerformanceData() {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ action: 'fetchStatsSummary' }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      if (!response || !response.success) {
        reject(new Error(response?.error || 'Unknown error'));
        return;
      }
      const data = response.data;
      resolve({
        totalSessions: data.total_sessions ?? 0,
        totalTurns: data.total_turns ?? 0,
        totalInputTokens: data.total_input_tokens ?? 0,
        totalOutputTokens: data.total_output_tokens ?? 0,
        totalTokens: data.total_tokens ?? 0,
        since: data.since,
      });
    });
  });
}
```

对应的 background script handler 在 `background.js` 中：

```js
if (request.action === 'fetchStatsSummary') {
  fetch('http://127.0.0.1:8000/api/stats/summary', { ... })
    .then(...)
    .catch(...);
  return true;
}
```

当前接口仅返回用户会话统计字段，`backendTokens` 和 `savedTokens` 仍待后续接入。

### `updatePerformanceDOM(bodyElement, data)`

内部函数，通过 `querySelector` 定位 6 个 id 锚点，直接修改 `textContent` 或 `innerHTML`：

| 元素 id | 更新内容 |
|---------|----------|
| `perf-total` | `data.totalTokens` 格式化后文本 |
| `perf-sessions` | `data.totalSessions` 格式化后文本 |
| `perf-turns` | `data.totalTurns` 格式化后文本 |
| `perf-input` | `data.totalInputTokens` 格式化后文本 |
| `perf-output` | `data.totalOutputTokens` 格式化后文本 |
| `perf-desc` | 替换为累计统计说明 HTML（含 `since` 时间） |

`perf-backend` 和 `perf-saved` 当前为写死的占位值（"--"），不参与 DOM 更新。

**注意**：该函数不处理骨架屏 class 的移除。当 `textContent` 被真实数值覆盖后，骨架屏的 `<span>` 元素即被替换，无需额外清理样式。

### `initPerformancePanel(bodyElement, options)`

核心入口函数，负责首次数据加载和可选轮询。

**闭包状态**：

```js
let pollTimer = null;   // setInterval 句柄
let destroyed = false;  // 销毁标记，防止面板关闭后仍操作 DOM
```

**内部 `refresh()` 流程**：

1. 检查 `destroyed`，已销毁则直接返回
2. `await fetchPerformanceData()` 获取数据
3. 再次检查 `destroyed`（异步间隙面板可能被关闭）
4. 调用 `updatePerformanceDOM(bodyElement, data)` 更新数值
5. 若抛异常，在 `#perf-desc` 中显示红色错误文字

**轮询逻辑**：

```js
const { pollInterval } = options;
if (pollInterval && pollInterval > 0) {
  pollTimer = setInterval(refresh, pollInterval);
}
```

**返回值**：

```js
return {
  destroy() {
    destroyed = true;
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }
};
```

---

## `src/panels/index.js`

仅修改 import 和 export 语句。

**Import 变更**：

```js
import {
  getPerformanceContent,
  fetchPerformanceData,
  initPerformancePanel
} from './performance/index.js';
```

**Export 变更**：

```js
export {
  // ... 其他导出不变
  getPerformanceContent,
  fetchPerformanceData,
  initPerformancePanel,   // 新增
  // ...
};
```

---

## `src/core/router.js`

### 新增：效能面板轮询生命周期管理

在模块顶层（`skillStoreRoutes` 定义之前）新增模块级变量和清理函数：

```js
// 效能面板轮询清理句柄
let perfPanelCleanup = null;

function cleanupPerformancePanel() {
  if (perfPanelCleanup) {
    perfPanelCleanup.destroy();
    perfPanelCleanup = null;
  }
}
```

### `openEchoMemHomePanel()` 改动

在 `setCurrentRoute` 之前插入清理调用：

```js
export function openEchoMemHomePanel() {
  cleanupPerformancePanel();   // 新增
  setCurrentRoute({ type: 'home' });
  openCustomPanel('EchoMem', getEchoMemHomeContent());
  // ... 后续不变
}
```

**原因**：用户从效能面板点击"返回"回到 EchoMem 主页时，需停止后台的 `setInterval` 轮询，避免内存泄漏和无效 DOM 操作。

### `navigateToEchoMemPanel()` 改动

原逻辑为同步渲染（先 `await fetchPerformanceData()`，再 `openCustomPanel`），改为异步骨架屏流程。

**变更前**：

```js
let content;
if (panel.id === 'performance') {
  try {
    const perfData = await fetchPerformanceData();
    content = getPerformanceContent(perfData);
  } catch (err) {
    content = getPerformanceContent();
  }
} else {
  content = getPanelContent(panel.id);
}
openCustomPanel(panel.title, content, { showBack: true, onBack: openEchoMemHomePanel });
```

**变更后**：

```js
cleanupPerformancePanel();

if (panel.id === 'performance') {
  // 先渲染骨架屏，再异步加载数据（支持轮询刷新）
  openCustomPanel(panel.title, getPerformanceContent(), {
    showBack: true,
    onBack: openEchoMemHomePanel
  });
  const body = getPanelBodyElement();
  perfPanelCleanup = initPerformancePanel(body, {
    pollInterval: 30000
  });
} else {
  openCustomPanel(panel.title, getPanelContent(panel.id), {
    showBack: true,
    onBack: openEchoMemHomePanel
  });
}
```

**关键差异**：

1. 不再 `await` 数据后再打开面板，而是**立即** `openCustomPanel(getPerformanceContent())`，用户看到的是骨架屏
2. 面板打开后，再调用 `initPerformancePanel()` 异步加载数据
3. 通过 `getPanelBodyElement()` 获取 `.claw-custom-panel-body` 元素传入 `initPerformancePanel`
4. `pollInterval: 30000` 表示每 30 秒自动轮询一次
5. 将 `initPerformancePanel` 返回的 `destroy` 函数保存在 `perfPanelCleanup` 中

### Import 变更

新增 `initPerformancePanel` 的导入：

```js
import {
  // ... 其他导入
  getPerformanceContent,
  fetchPerformanceData,
  initPerformancePanel    // 新增
} from '../panels/index.js';
```

---

## 调用链

```
用户点击"效能"菜单
    │
    ▼
navigateToEchoMemPanel('performance')
    │
    ├── cleanupPerformancePanel()          // 清理上一次轮询（如有）
    │
    ├── openCustomPanel(title, getPerformanceContent())
    │       │
    │       └── panel-host.js:226  container.innerHTML = panelHtml
    │           // 此时面板已显示，内容为骨架屏
    │
    ├── getPanelBodyElement()              // 获取 .claw-custom-panel-body
    │
    └── perfPanelCleanup = initPerformancePanel(body, { pollInterval: 30000 })
            │
            ├── refresh()                  // 立即执行
            │       └── fetchPerformanceData()
            │               └── chrome.runtime.sendMessage({ action: 'fetchStatsSummary' })
            │                       └── background.js fetch('http://127.0.0.1:8000/api/stats/summary')
            │
            └── updatePerformanceDOM(body, data)
                    └── 修改 #perf-total / #perf-sessions / #perf-turns / #perf-input / #perf-output / #perf-desc
            │
            └── setInterval(refresh, 30000)  // 启动轮询

用户点击"返回"
    │
    ▼
openEchoMemHomePanel()
    │
    ├── cleanupPerformancePanel()          // clearInterval + 置空
    │
    └── openCustomPanel('EchoMem', getEchoMemHomeContent())
```

---

## 关键实现决策

### 1. 骨架屏用内联 `<style>` 而非外部 CSS

原因：效能面板 HTML 通过 `openCustomPanel` 直接注入到 `.claw-custom-panel-body` 中，不经过 Shadow DOM，外部 CSS 选择器 `.perf-skeleton` 也能生效。但为保证动画定义一定存在（避免面板切换时 CSS 被卸载），将 `@keyframes` 直接内联在返回的 HTML 中。

### 2. 不传入数据到 `getPerformanceContent()`

原方案曾考虑 `getPerformanceContent(data)` 接受数据对象，但最终改为无参数版本。原因是：

- 骨架屏不需要数据，传参无意义
- 真实数据通过 `updatePerformanceDOM` 在渲染后异步注入，保持生成和更新职责分离

### 3. `destroyed` 标志的必要性

`refresh()` 内部为 `async`，从 `await fetchPerformanceData()` 到 `updatePerformanceDOM()` 之间存在异步间隙。若用户在此期间关闭面板，`pollTimer` 会被 `destroy()` 清理，但已进入微任务的 `updatePerformanceDOM` 仍可能执行。`destroyed` 标志在 `await` 前后双重检查，防止操作已不存在的 DOM。

### 4. 轮询间隔 30 秒

当前写死在 `router.js:123`。该值可根据后端实际更新频率调整，或改为从配置读取。若设为 `0` 或省略 `pollInterval`，则关闭轮询，仅执行一次加载。

---

## TODO 标记

| 位置 | 说明 |
|------|------|
| `src/panels/performance/index.js` | `backendTokens` 接口地址待补充，接入后更新 `fetchPerformanceData` 和 DOM 渲染逻辑 |
| `src/panels/performance/index.js` | `savedTokens` 前端计算逻辑待确定，确定后更新 DOM 渲染和说明文案 |
| `src/core/router.js` | `pollInterval: 30000` 可按需改为配置化读取 |
