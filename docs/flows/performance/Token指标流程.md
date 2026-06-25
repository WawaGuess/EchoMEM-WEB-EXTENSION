# 效能面板 Token 指标流程

> 相关代码：`src/panels/performance/index.js`, `src/core/router.js`, `background.js`

## 概述

效能面板展示两类 Token 数据：

1. **用户会话 Token 统计**（OpenView）：仅在华大九天（HIGO）平台展示，包含总 Token、会话数、轮次数、Input/Output Tokens。
2. **EchoMem 后端 Token 消耗**（`GET /metrics`）：在所有支持平台展示。

数据通过骨架屏 + 异步加载 + 轮询刷新三段式流程提供流畅体验。

## 界面布局

面板宽度沿用平台配置 `320px`，内部采用纵向多段式布局。以下 1-3 区仅在 HIGO 平台显示，DeepSeek 等其它平台隐藏：

### 1. 核心指标区（全宽大卡片）

- 蓝色渐变背景（`#eff6ff → #dbeafe`），视觉突出
- 标题："总 Token 消耗"
- 数值：32px 大字号，blue-700 色
- 计算方式：**会话 Token 消耗总量 + EchoMem 后端 Token 消耗量**
- **仅在 HIGO 平台显示**

### 2. 会话统计区（双列网格）

- 2 列等宽卡片，gap 10px
- 左卡："会话数" + 数值
- 右卡："轮次数" + 数值
- **仅在 HIGO 平台显示**

### 3. Input / Output 拆分区（双列网格）

- 左卡："Input Tokens" + 数值
- 右卡："Output Tokens" + 数值
- **仅在 HIGO 平台显示**

### 4. 后端消耗区

- "EchoMem 后端消耗" + 数值（来自 `EchoMemClient.fetchUsage()`，实际请求 `GET /metrics`）+ "tokens"
- **所有平台均显示**

### 5. 说明文字区

- HIGO 平台：累计统计说明，含 `since` 时间
- 其它平台：提示"当前平台仅展示 EchoMem 后端 Token 消耗"
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
③ initPerformancePanel(bodyElement, { pollInterval: 5000 })
    │     - 立即执行 fetchPerformanceData() 获取数据
    │     - 成功后调用 updatePerformanceDOM() 填充真实数值
    │     - 同时启动 setInterval 轮询（5s）
    │     - 绑定"刷新"按钮支持手动刷新
    │
    ▼
④ 用户持续浏览面板，数据每 5 秒静默刷新，也可手动点击刷新
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

**仅当检测到 HIGO 平台时请求。** 通过 background script 代理请求绕过页面域 CORS 限制，目标改为 OpenView agent 后端（默认 `http://127.0.0.1:31020`）。扩展在配置面板登录 OpenView 后，`chrome.storage.local` 会保存 `openviewAuth`（含 `accessToken`、`refreshToken`、`baseUrl`），background script 读取后调用 `GET /v1/stats/summary`：

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

若 accessToken 过期返回 401，background script 会使用 `refreshToken` 调用 `POST /v1/auth/refresh` 刷新，再重试一次；刷新失败则清除本地 auth 并要求重新登录。

> 补充说明：`background.js` 同时监听 `openViewRequest` 消息，用于代理内容脚本对 OpenView 的登录、刷新、stats 请求。`src/services/openview-client.js` 在 Service Worker 内部会直接 `fetch`，避免 Service Worker 无法接收自己发出的 `chrome.runtime.sendMessage` 消息。

```js
if (request.action === 'fetchStatsSummary') {
  // 1. 读取 chrome.storage.local 中的 openviewAuth
  // 2. 调用 OpenView GET /v1/stats/summary，带 Authorization: Bearer <accessToken>
  // 3. 若 401，使用 refreshToken 调用 POST /v1/auth/refresh，重试一次
  // 4. 返回 { success: true, data } 或 { success: false, error }
}
```

### 后端消耗统计（EchoMem /metrics）

三期已接入真实数据。`EchoMemClient.fetchUsage()` 调用后端 `GET /metrics`，解析 Prometheus text 格式，汇总以下 4 个 counter：

- `echomem_router_llm_input_tokens_total`
- `echomem_router_llm_output_tokens_total`
- `echomem_engine_llm_input_tokens_total`
- `echomem_engine_llm_output_tokens_total`

```js
async function fetchBackendUsageData() {
  const config = await getEchoMemConfig();
  const client = createClient(config);
  const result = await client.fetchUsage();
  return result.total?.total_tokens ?? 0;
}
```

统计口径：EchoMem 后端所有 LLM 调用的 input + output token 总量。`/metrics` 端点无需认证，background script 代理会同时返回 JSON `data` 与原始 `text`，解析器从 `text` 中提取指标。

## 数据结构

```ts
interface PerformanceData {
  totalSessions: number;      // 累计会话数
  totalTurns: number;         // 累计对话轮次
  totalInputTokens: number;   // 累计 Input Tokens
  totalOutputTokens: number;  // 累计 Output Tokens
  totalTokens: number;        // 会话 Token 消耗总量
  since: string | null;       // 统计起始时间
  backendTokens?: number;     // EchoMem 后端 Token 消耗量（来自 GET /metrics）
}
```

总 Token 消耗展示值 = `totalTokens + backendTokens`。

| 字段 | 状态 | 说明 |
|------|------|------|
| `backendTokens` | 三期已实现 | EchoMem 后端 Token 消耗量，汇总 router + engine 的 LLM input/output tokens |
| `totalTokens` | 三期已实现 | 会话级 Token 消耗总量，来自 OpenView `/v1/stats/summary` |
| 顶部"总 Token 消耗" | 三期已实现 | 展示值 = `totalTokens + backendTokens` |

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
            │       ├── fetchPerformanceData()  ── 失败时回退为全 0，不阻断后续更新
            │       │       └── chrome.runtime.sendMessage({ action: 'fetchStatsSummary' })
            │       │               └── background.js
            │       │                       ├── 读取 openviewAuth (baseUrl/accessToken/refreshToken)
            │       │                       ├── fetch GET /v1/stats/summary (Authorization: Bearer ...)
            │       │                       ├── 401 时 POST /v1/auth/refresh 并重试
            │       │                       └── 返回 { success, data }
            │       └── fetchBackendUsageData()
            │               ├── getEchoMemConfig()
            │               ├── createClient(config)
            │               └── client.fetchUsage()
            │                       ├── client.fetchMetrics() → GET /metrics
            │                       └── _sumTokenCounters() → 4 个 LLM token counter 求和
            │
            ├── updatePerformanceDOM(body, data)
            │       └── 修改 #perf-total / #perf-sessions / #perf-turns / #perf-input / #perf-output / #perf-backend / #perf-desc
            │
            ├── 绑定 #perf-refresh-btn 点击事件 → refresh()
            │
            └── setInterval(refresh, 5000)

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
- **部分接口失败**：`fetchPerformanceData`（会话统计）失败时回退为全 0，不阻塞 `fetchBackendUsageData`（后端消耗）的展示；反之亦然。失败原因单独打印到 console.warn。
- **DOM 已销毁**：轮询回调中检查 `destroyed` 标志，防止面板关闭后仍操作 DOM

## 关键实现决策

1. **骨架屏用内联 `<style>` 而非外部 CSS**：保证动画定义一定存在，避免面板切换时 CSS 被卸载
2. **不传入数据到 `getPerformanceContent()`**：保持生成和更新职责分离
3. **`destroyed` 标志**：防止 `await` 异步间隙中面板被关闭后仍操作 DOM
4. **轮询间隔 5 秒**：模型回复完成后 token_usage 记录会尽快反映到面板；同时提供手动刷新按钮兜底
5. **`/metrics` 纯文本响应处理**：`background.js` 的 `echoMemRequest` 同时返回 JSON `data` 与原始 `text`，`echomem-client.js` 从 `text` 解析 Prometheus 指标，避免引入额外依赖
