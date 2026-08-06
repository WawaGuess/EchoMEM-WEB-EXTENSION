# 效能面板 Token 指标流程

> 相关代码：`src/panels/performance/index.js`、`src/panels/performance/view-state.js`、`src/core/router.js`、`background.js`

## 当前能力

效能面板保留两类 Token 数据的展示位置，但当前只有 EchoMem 后端统计具备真实数据链路：

1. **EchoMem 后端 Token 消耗**：所有支持平台均通过 `GET /metrics` 获取。
2. **HIGO 会话统计**：保留总 Token、会话数、轮次数、Input/Output Tokens 卡片；当前 EchoAgent 未提供面板需要的汇总能力，因此展示为不可用状态，而不是伪造的 `0`。

DeepSeek 等非 HIGO 平台不渲染会话统计卡片，只展示 EchoMem 后端 Token 消耗。

## 展示状态

数值与状态必须区分以下情况：

| 状态 | 数值区 | 辅助文案 | 颜色 |
|---|---|---|---|
| 加载中 | 骨架屏 | 正在加载 | 中性 |
| 成功返回零 | `0` | `tokens` 或空 | 正常 |
| 服务暂不支持 | `—` | 暂不可用 | 中性 |
| 请求失败 | `—` | 获取失败 | 错误色 |

`0` 只能来自成功响应。不可用、请求失败或缺失数据不得降级为 `0`。

### HIGO 会话统计不可用

会话统计请求返回当前已知的“不支持”错误时：

- 顶部“总 Token 消耗”显示 `—`，辅助文案为“缺少会话统计，暂无法计算”；
- 会话数、轮次数、Input Tokens、Output Tokens 均显示 `—`；
- 四张卡片的辅助文案显示“暂不可用”；
- 会话统计区域上方展示中性提示框：
  - 标题：“会话统计暂不可用”；
  - 详情：“EchoAgent 当前未提供会话汇总数据。”；
- 已成功获取的 EchoMem 后端 Token 仍单独展示；
- 不显示虚构的统计起始时间。

### 临时请求失败

未知网络或接口错误与“不支持”状态分开处理：

- 对应数值显示 `—`；
- 辅助文案显示“获取失败”；
- 会话统计提示框说明“请稍后重试”；
- 手动刷新和五秒轮询继续提供重试机会。

## 数据获取

### EchoMem 后端消耗

`fetchBackendUsageData()` 使用 `EchoMemClient.fetchUsage()` 请求：

```text
GET {echomemConfig.baseUrl}/metrics
```

客户端解析 Prometheus 文本并汇总以下 counter 的全部 label series：

- `echomem_router_llm_input_tokens_total`
- `echomem_router_llm_output_tokens_total`
- `echomem_engine_llm_input_tokens_total`
- `echomem_engine_llm_output_tokens_total`

该值表示当前 EchoMem 后端实例暴露的累计 LLM Token 计数，不是当前页面会话的 Token 数。

### HIGO 会话统计

HIGO 页面仍会发送：

```js
chrome.runtime.sendMessage({ action: 'fetchStatsSummary' })
```

当前 `background.js` 明确返回：

```js
{
  success: false,
  error: '当前 EchoAgent 服务暂不支持会话统计汇总'
}
```

Service Worker 不会继续请求旧的 `/v1/stats/summary`。当 EchoAgent 将来提供稳定的汇总接口后，可以恢复 `fetchStatsSummary` 的真实代理逻辑；现有视图状态模型已经保留成功数据的展示路径。

## 状态转换

`Promise.allSettled()` 允许会话统计和后端统计独立成功或失败。结果由 `buildPerformanceState()` 统一转换：

```ts
interface PerformanceState {
  sessionStatus: 'available' | 'unavailable' | 'error' | 'hidden';
  backendStatus: 'available' | 'error';
  totalSessions: number | null;
  totalTurns: number | null;
  totalInputTokens: number | null;
  totalOutputTokens: number | null;
  sessionTokens: number | null;
  backendTokens: number | null;
  totalTokens: number | null;
  since: string | null;
}
```

顶部总量只有在 HIGO 会话统计和 EchoMem 后端统计都可用时才计算：

```text
totalTokens = sessionTokens + backendTokens
```

任一组成部分不可用时，`totalTokens` 为 `null`，视图显示 `—`，避免把部分数据冒充完整总量。

## 页面生命周期

1. `getPerformanceContent()` 先渲染骨架屏。
2. `initPerformancePanel()` 立即并行加载当前平台需要的数据。
3. `updatePerformanceDOM()` 按状态填充数值、辅助文案和提示框。
4. 路由层每五秒轮询一次，也支持手动刷新。
5. 用户返回、切换面板或关闭 overlay 时，`cleanupPerformancePanel()` 停止轮询。

## 验证边界

- `tests/performance-panel.test.js` 覆盖不可用状态不降级为零、真实零值保留、非 HIGO 隐藏和请求失败状态。
- `npm run check` 验证生成 bundle、JavaScript 语法和扩展结构。
- 自动检查不替代 HIGO/DeepSeek 浏览器交互和真实 EchoMem `/metrics` 集成验证。
