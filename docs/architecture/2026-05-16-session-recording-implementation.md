# 会话录制模块实现文档

## 1. 概述

会话录制模块负责监听支持平台（DeepSeek、HIGO）的聊天页面 DOM 变化，从页面中提取用户与 AI 的消息记录，并同步到 OpenViking 后端。

- **职责边界**：纯内容提取 + 同步，不涉及 UI 注入。
- **运行时入口**：`src/entry/content.js` 在平台检测通过后调用 `startRecording(platformId)` 启动。
- **模块关系**：
  - `session-extractor.js`：DOM 提取层，负责把页面元素解析成 `{role, text}` 消息数组。
  - `session-recorder.js`：状态管理层，负责 MutationObserver 监听、diff 计算、流式检测、OpenViking 同步。

## 2. 核心文件

| 文件 | 职责 |
|------|------|
| `src/core/session-recorder.js` | MutationObserver 挂载、消息 diff、流式完成检测、OpenViking HTTP 同步 |
| `src/core/session-extractor.js` | 从 DOM 提取当前会话的 `{role, text}` 消息数组 |
| `src/services/openviking-client.js` | `OpenVikingClient`：封装 `createSession`、`addMessage`、`appendMessages`、`commitSession` |
| `src/services/session-mapper.js` | 根据平台规则从 URL 提取 raw session ID |
| `src/config/platforms.json` | 各平台的 DOM 选择器配置（消息容器、用户/助手消息选择器、session ID 提取规则） |

## 3. `session-extractor.js` 实现细节

### 3.1 提取流程

`extractSessionMessages(platformId)` 按以下优先级尝试提取：

1. **按角色区分选择器**：如果 `userMessages` 和 `assistantMessages` 选择器都能匹配到元素，分别提取后按 DOM 顺序合并。
2. **通用选择器**（`allMessages`）：如果无法区分角色，使用通用选择器匹配所有消息，再通过 `isUserMessageHeuristic` 判断角色。
3. **智能兜底**：通过 `findSmartMessageContainer` 查找页面中最大的可滚动区域，再从直接子元素中提取。

### 3.2 角色判断（`isUserMessageHeuristic`）

针对 DeepSeek 的特殊处理：
- 包含 `.ds-assistant-message-main-content` 或 `.ds-think-content` 的元素判定为助手消息
- 不含以上特征的元素默认判定为用户消息（包含 class 名含 `user` 的元素和靠右对齐的元素）

### 3.3 DeepSeek 助手消息文本提取

助手消息的最终答案只在 `.ds-assistant-message-main-content` 中：
- 若该元素不存在（思考阶段），直接跳过该消息
- 提取前通过 `getCleanText` 移除 `button`、`svg`、`img`、`.ds-think-content` 等噪音节点

### 3.4 去重输出（`finalizeMessages`）

在 `extractSessionMessages` 所有 return 路径之前，统一调用 `finalizeMessages`：
- **DOM 引用去重**：使用 `WeakSet` 确保同一节点只被记录一次（防止嵌套选择器匹配到同一消息的不同层级）
- **相邻合并**：相邻且 `role` 和 `text` 完全相同的项合并为一条

### 3.5 嵌套元素过滤（`findMessagesInContainer`）

`querySelectorAll` 可能匹配到嵌套的 DOM 节点。新增过滤逻辑：
```javascript
elements = elements.filter((el, i, arr) =>
  !arr.some((other, j) => i !== j && other !== el && other.contains(el))
);
```
只保留不被其他匹配元素包含的最外层节点。

## 4. `session-recorder.js` 实现细节

### 4.1 状态机

```javascript
const recorderState = {
  platformId: null,           // 当前平台 ID
  rawSessionId: null,         // URL 中提取的原始 session ID
  openVikingSessionId: null,  // OpenViking 返回的 session ID
  lastMessages: [],           // 上一次成功同步的消息基线
  pendingQueue: [],           // 发送失败时的待重试队列
  observer: null,             // MutationObserver 实例
  debounceTimer: null,        // DOM 变化防抖定时器
  isRecording: false,         // 是否正在录制
  ovClient: null,             // OpenVikingClient 缓存实例
  assistantStableTimer: null, // 流式检测 interval
  streamingTimeoutTimer: null,// 流式超时 fallback timer
  streamingSnapshot: null,    // 流式开始前的 lastMessages 快照
  streamingWasActive: false,  // 是否已检测到正方形按钮（流式中）
};
```

### 4.2 启动与挂载（`startRecording` + `attachObserver`）

- `startRecording` 是**幂等的**：多次调用不会重复创建 observer，session ID 变化时会自动重置状态。
- `attachObserver` 挂载 `MutationObserver` 到消息容器，监听 `childList` 和 `subtree`。
- **初始基线**：
  - 如果已有 OpenViking session 映射（从 `chrome.storage.local` 恢复），将当前 DOM 消息设为 `lastMessages` 基线，跳过已发送消息
  - 如果是全新会话，设空基线并主动发送当前已存在的消息

### 4.3 消息 diff（`diffMessages`）

由于 DeepSeek 使用虚拟列表（`.ds-virtual-list`），不在视口内的消息会被卸载，导致 `newMessages` 可能比 `oldMessages` 短，或前缀不匹配。

`diffMessages` 实现三层对齐策略：

1. **前缀匹配**（正常追加）：
   ```
   old = [user1, assistant1]
   new = [user1, assistant1, user2]
   → added = [user2]
   ```

2. **后缀匹配**（虚拟列表卸载了前面的消息）：
   ```
   old = [user1, assistant1]
   new = [assistant1, user2]
   → 找到 old 的后缀 [assistant1] 与 new 开头对齐
   → added = [user2]
   ```

3. **签名去重兜底**（任何分支返回前都执行）：
   计算 `oldMessages` 中所有 `role:text` 签名，从 `added` 中剔除已存在的消息。即使 diff 对齐逻辑误判，同一内容也不会被重复发送。

### 4.4 流式完成检测（`startStreamingCheck`）

DeepSeek 在流式生成时，发送按钮的 SVG path 从箭头（`M8.3125`）变为正方形（`M2 4.88`），流式结束后变回箭头。

实现三层防护：

1. **清理已有轮询**：调用时先 `stopStreamingCheck()`，防止重复创建 interval
2. **立即发送**：如果调用时按钮已经是箭头（流式已结束），直接发送结果，不启动轮询
3. **60 秒超时回退**：即使按钮检测一直失败，60 秒后也会强制发送

```javascript
startStreamingCheck() {
  stopStreamingCheck();                 // 1. 清理已有轮询
  if (!isDeepSeekStreaming()) {         // 2. 流式已结束，立即发送
    sendStreamingResult(...);
    return;
  }
  streamingTimeoutTimer = setTimeout(..., 60000);  // 3. 超时回退
  assistantStableTimer = setInterval(...);         // 正常轮询
}
```

### 4.5 消息发送防重（`filterRecentlySent`）

`doSendMessages` 在发送前调用 `filterRecentlySent`：
- 维护全局 `sentSignatures` Map，键为 `role:text`，值为发送时间戳
- 签名缓存 TTL 为 **10 分钟**
- 若消息签名已存在于缓存中，直接跳过并打印日志
- `stopRecording` 时清空缓存，防止跨会话污染

这是发送层的最后一道防线，即使 diff 层和提取层都漏了重复，同一内容在 10 分钟内也只会被 POST 一次。

### 4.6 失败重试队列（`flushPendingMessages`）

`appendMessages` 单条失败时，消息会进入 `pendingQueue`。每次 `doSendMessages` 调用前都会先 `flushPendingMessages`：
- 如果尚未创建 OpenViking session，先调用 `createSession`
- 如果发送失败，将消息重新压入队列
- 队列上限 100 条，超出时丢弃最早的消息

## 5. 数据流图

```
┌─────────────────┐     DOM 变化      ┌─────────────────┐
│  聊天页面 (DOM)  │ ────────────────▶ │  MutationObserver │
└─────────────────┘                   └────────┬────────┘
                                               │
                                               ▼
                                      ┌─────────────────┐
                                      │  onMessagesChanged │
                                      └────────┬────────┘
                                               │
                      ┌────────────────────────┼────────────────────────┐
                      │                        │                        │
                      ▼                        ▼                        ▼
           ┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
           │ 流式状态检测    │      │ 正常 diff 分支   │      │ 用户发送新消息   │
           │ startStreaming  │      │ diffMessages    │      │ 强制结束流式     │
           └────────┬────────┘      └────────┬────────┘      └─────────────────┘
                    │                        │
                    ▼                        ▼
           ┌─────────────────┐      ┌─────────────────┐
           │ sendStreamingResult│     │  doSendMessages  │
           └────────┬────────┘      └────────┬────────┘
                    │                        │
                    ▼                        ▼
           ┌─────────────────┐      ┌─────────────────┐
           │ filterRecentlySent│     │ filterRecentlySent│
           └────────┬────────┘      └────────┬────────┘
                    │                        │
                    ▼                        ▼
           ┌─────────────────┐      ┌─────────────────┐
           │ OpenViking POST  │      │ OpenViking POST  │
           │ (createSession   │      │ (appendMessages) │
           │  + addMessage)   │      │                  │
           └─────────────────┘      └─────────────────┘
```

## 6. 关键常量

| 常量 | 值 | 说明 |
|------|-----|------|
| `DEBOUNCE_MS` | 500 | DOM 变化防抖延迟 |
| `STABLE_CHECK_INTERVAL_MS` | 500 | 流式按钮轮询间隔 |
| `PENDING_QUEUE_MAX` | 100 | 失败重试队列上限 |
| `SENT_SIGNATURE_TTL_MS` | 600000 (10分钟) | 已发送签名缓存有效期 |

## 7. 诊断日志

以下 Console 日志可用于排查问题：

| 日志前缀 | 触发时机 | 用途 |
|----------|----------|------|
| `EchoMem diag: newMessages=` | 每次 DOM 变化提取后 | 查看提取到的完整消息序列 |
| `EchoMem diag: posting=` | `doSendMessages` 发送前 | 查看即将 POST 的消息 |
| `EchoMem diag: prefix diff dropped duplicates` | diff 前缀匹配分支拦截重复 | 确认重复来源 |
| `EchoMem diag: suffix diff dropped duplicates` | diff 后缀匹配分支拦截重复 | 确认虚拟列表卸载场景 |
| `EchoMem diag: diff dropped duplicates` | diff 兜底分支拦截重复 | 确认完全无法对齐场景 |
| `EchoMem: skip recently sent message` | `filterRecentlySent` 拦截 | 确认发送层防重命中 |
| `EchoMem: assistant streaming detected` | 轮询检测到正方形按钮 | 确认流式检测正常工作 |
| `EchoMem: assistant streaming finished` | 流式完成 | 确认流式结束触发发送 |
| `EchoMem: streaming already finished` | 竞态条件防护触发 | 确认立即发送命中 |
| `EchoMem: streaming check timeout` | 60 秒超时回退 | 确认超时兜底命中 |

## 8. 已知问题与后续计划

### 8.1 当前已知问题

多轮对话后 OpenViking 中仍偶发重复消息（如 `user2, assistant2, user2, assistant2`）。当前三层防护（提取去重、diff 签名去重、发送签名防重）已能拦截大部分场景，但重复可能在以下情况发生：
- `sendStreamingResult` 与 `onMessagesChanged` 的非流式 diff 产生竞态
- OpenViking 服务端端或网络层重试导致重复入库

后续需要：
1. 在 `sendStreamingResult` 中也增加 `filterRecentlySent` 调用（当前只在 `doSendMessages` 中）
2. 考虑在 `onMessagesChanged` 中引入锁机制，禁止流式完成检测与正常 diff 同时执行
3. 增加 OpenViking 侧幂等性校验（如 message sequence number）

### 8.2 扩展计划

- **新平台接入**：在 `src/config/platforms.json` 中添加新平台的 `messages` 选择器配置即可
- **非 DeepSeek 流式检测**：当前流式检测逻辑（`isDeepSeekStreaming`）依赖 DeepSeek 特有的 SVG path，其他平台需要各自实现检测函数
- **commit 自动触发**：当前 `commitCurrentSession` 为预留接口，未自动调用。后续可在会话结束（页面关闭、session 切换）时自动 commit
