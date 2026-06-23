# 效能面板 Token 指标流程

> 相关代码：`src/panels/performance/index.js`, `src/core/router.js`, `background.js`

## 概述

效能面板展示用户会话 Token 统计数据，通过骨架屏 + 异步加载 + 轮询刷新三段式流程提供流畅的数据体验。

## 界面布局

面板宽度沿用平台配置 `320px`，内部采用纵向多段式布局：

### 1. 核心指标区（全宽大卡片）

- 蓝色渐变背景（`#eff6ff → #dbeafe`），视觉突出
- 标题："总 Token 消耗"
- 数值：32px 大字号，blue-700 色

### 2. 会话统计区（双列网格）

- 2 列等宽卡片，gap 10px
- 左卡："会话数" + 数值
- 右卡："轮次数" + 数值

### 3. Input / Output 拆分区（双列网格）

- 左卡："Input Tokens" + 数值
- 右卡："Output Tokens" + 数值

### 4. 后端消耗 & 节省区（双列网格）

- 左卡："EchoMem 后端消耗" + 数值（来自 `EchoMemClient.fetchUsage()` stub）+ "tokens"
- 右卡（置灰）："预计节省 Token" + "--" + "待计算"

### 5. 说明文字区

- 累计统计说明，含 `since` 时间
- 加载失败显示红色错误提示

## 加载流程（三段式）

```
用户点击"效能"菜单
    │
    ▼
① 先调用 getPerformanceContent() 渲染骨架屏 HTML
    │     - 数值区域显示灰色脉冲占位条
    │     - 说明区域显示"正在加载数据…"
    │
    ▼
② openCustomPanel() 打开面板（用户立刻看到 loading 状态）
    │
    ▼
③ initPerformancePanel(bodyElement, { pollInterval: 30000 })
    │     - 立即执行 fetchPerformanceData() 获取数据
    │     - 成功后调用 updatePerformanceDOM() 填充真实数值
    │     - 同时启动 setInterval 轮询（30s）
    │
    ▼
④ 用户持续浏览面板，数据每 30 秒静默刷新
    │
    ▼
⑤ 用户点击返回/关闭 → cleanupPerformancePanel() 停止轮询
```

## 关键模块

| 模块 | 路径 | 职责 |
|------|------|------|
| `getPerformanceContent` | `src/panels/performance/index.js` | 返回带骨架屏的 HTML 字符串 |
| `fetchPerformanceData` | `src/panels/performance/index.js` | 异步获取 Token 数据 |
| `updatePerformanceDOM` | `src/panels/performance/index.js` | 纯 DOM 更新函数 |
| `initPerformancePanel` | `src/panels/performance/index.js` | 首次加载 + 轮询 |
| `navigateToEchoMemPanel` | `src/core/router.js` | 路由层集成 |
| `cleanupPerformancePanel` | `src/core/router.js` | 面板关闭时清理轮询 |

## 数据获取

### 主统计（用户会话 Token）

通过 background script 代理请求绕过页面域 CORS 限制：

```js
export async function fetchPerformanceData() {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ action: 'fetchStatsSummary' }, (response) => {
      // ... 处理 response
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

对应 background script handler：

```js
if (request.action === 'fetchStatsSummary') {
  fetch('http://127.0.0.1:8000/api/stats/summary', { ... })
    .then(...)
    .catch(...);
  return true;
}
```

### 后端消耗统计（EchoMem stub）

二期暂时保留该卡片 UI，但后端 usage 接口尚未就绪。`EchoMemClient.fetchUsage()` 当前返回 stub：

```js
async function fetchBackendUsageData() {
  const config = await getEchoMemConfig();
  const client = createClient(config);
  const result = await client.fetchUsage();
  return result.total?.total_tokens ?? 0;  // 当前固定返回 0
}
```

三期将替换为真实的 EchoMem usage 接口。当前 `backendTokens` 固定为 `0`，UI 显示为 `--`。

## 数据结构

```ts
interface PerformanceData {
  totalSessions: number;      // 累计会话数
  totalTurns: number;         // 累计对话轮次
  totalInputTokens: number;   // 累计 Input Tokens
  totalOutputTokens: number;  // 累计 Output Tokens
  totalTokens: number;        // Token 消耗总量
  since: string | null;       // 统计起始时间
  backendTokens?: number;     // EchoMem 后端 Token 消耗量（二期 stub，三期接入真实接口）
}
```

| 字段 | 状态 | 说明 |
|------|------|------|
| `backendTokens` | 二期 stub / 三期接入 | EchoMem 后端 Token 消耗量（`fetchUsage()` 当前固定返回 0） |
| `savedTokens` | 待逻辑确定 | 预计节省 Token 量 |

## 生命周期管理

- `perfPanelCleanup` 为模块级变量，持有当前效能面板的 `destroy` 函数
- 以下场景自动调用 `cleanupPerformancePanel()`：
  - 用户点击效能面板的"返回"按钮
  - 用户切换到其他 EchoMem 面板
  - 用户关闭整个 EchoMem 面板

## 调用链

```
用户点击"效能"菜单
    │
    ▼
navigateToEchoMemPanel('performance')
    │
    ├── cleanupPerformancePanel()
    │
    ├── openCustomPanel(title, getPerformanceContent())
    │
    ├── getPanelBodyElement()
    │
    └── perfPanelCleanup = initPerformancePanel(body, { pollInterval: 30000 })
            │
            ├── refresh()
            │       ├── fetchPerformanceData()
            │       │       └── chrome.runtime.sendMessage({ action: 'fetchStatsSummary' })
            │       │               └── background.js fetch('http://127.0.0.1:8000/api/stats/summary')
            │       └── fetchBackendUsageData()
            │               ├── getEchoMemConfig()
            │               ├── createClient(config)
            │               └── client.fetchUsage() → 二期 stub，三期替换为真实 EchoMem usage 接口
            │
            ├── updatePerformanceDOM(body, data)
            │       └── 修改 #perf-total / #perf-sessions / #perf-turns / #perf-input / #perf-output / #perf-backend / #perf-desc
            │
            └── setInterval(refresh, 30000)

用户点击"返回"
    │
    ▼
openEchoMemHomePanel()
    │
    ├── cleanupPerformancePanel()  // clearInterval + 置空
    │
    └── openCustomPanel('EchoMem', getEchoMemHomeContent())
```

## 错误处理

- **接口异常**：`try/catch` 捕获后，在说明文字区显示"数据加载失败，请稍后重试"
- **DOM 已销毁**：轮询回调中检查 `destroyed` 标志，防止面板关闭后仍操作 DOM

## 关键实现决策

1. **骨架屏用内联 `<style>` 而非外部 CSS**：保证动画定义一定存在，避免面板切换时 CSS 被卸载
2. **不传入数据到 `getPerformanceContent()`**：保持生成和更新职责分离
3. **`destroyed` 标志**：防止 `await` 异步间隙中面板被关闭后仍操作 DOM
4. **轮询间隔 30 秒**：写死在 `router.js`，可按需改为配置化读取
