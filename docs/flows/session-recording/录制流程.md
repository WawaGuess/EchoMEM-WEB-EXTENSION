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
| `src/core/session-recorder.js` | MutationObserver 挂载、消息 diff、流式状态机编排、OpenViking HTTP 同步。**平台无关**，所有差异通过 adapter / 配置注入 |
| `src/core/session-extractor.js` | 通用 DOM 提取编排：按配置查找容器、按 adapter 判定角色 / 提取文本。**平台无关** |
| `src/adapters/base-adapter.js` | adapter 基类：findMessageContainer / isUserMessage / extractAssistantText / createStreamingDetector 等，全部默认实现"配置驱动" |
| `src/adapters/{deepseek,higo}-adapter.js` | 平台 adapter：当前差异已全部收敛到 JSON 配置，文件为空壳，预留覆盖点 |
| `src/adapters/registry.js` | platformId → adapter 映射，未注册的平台回退到 BaseAdapter |
| `src/streaming/registry.js` | 流式完成检测策略注册表：strategy name → factory(params) → detector |
| `src/streaming/button-svg-poll.js` | 按钮图标特征轮询策略，参数化版本（适用 DeepSeek） |
| `src/streaming/text-stability.js` | 文本稳定策略：N 毫秒不变即完成 |
| `src/streaming/selector-state.js` | 元素 attr/class 状态切换策略 |
| `src/services/openviking-client.js` | `OpenVikingClient`：封装 `createSession`、`addMessage`、`appendMessages`、`commitSession` |
| `src/services/session-mapper.js` | 根据平台规则从 URL 提取 raw session ID |
| `src/config/platforms.json` | 各平台的声明式配置：DOM 选择器、噪音过滤、助手文本规则、流式策略与参数 |
| `src/config/loader.js` | 加载 JSON 并附加运行时函数（如 `launcher.getBackgroundColor`），按通用规则工作、不写平台 id 分支 |

## 3. `session-extractor.js` 实现细节

### 3.1 提取流程

`extractSessionMessages(platformId)` 是平台无关的编排器，按以下优先级尝试提取：

1. **按角色区分选择器**：如果 `messages.userMessages` 和 `messages.assistantMessages` 选择器（来自 `platforms.json`）都能匹配到元素，分别经 `adapter.extractUserText` / `adapter.extractAssistantText` 提取，再按 DOM 顺序合并。
2. **通用选择器**（`messages.allMessages`）：如果无法区分角色，使用通用选择器匹配所有消息，再通过 `adapter.isUserMessage(el, config)` 判断角色。
3. **智能兜底**：通过 `adapter.findSmartMessageContainer(config)` 查找页面中候选容器（先用 `messages.smartContainerHints` 命中,失败则回退到"最大可滚动区域"启发式），再从直接子元素中提取。

整个流程不出现任何平台字面量，所有差异都通过 `adapter` 和 `config` 注入。

### 3.2 角色判断（`adapter.isUserMessage`）

`BaseAdapter.isUserMessage(el, config)` 按通用规则工作：
- 优先读取 `config.messages.assistant.roleSignals` 数组中的选择器；命中任何一个 → 判定为 assistant
- 兜底启发式：class 名含 `user` 或样式靠右对齐 → user，其余默认 assistant

DeepSeek 在 `platforms.json` 里通过 `assistant.roleSignals: [".ds-assistant-message-main-content", ".ds-think-content"]` 表达自己的特征,无需写代码分支。
新平台只需在 JSON 里列出自己的特征选择器即可。

### 3.3 助手消息文本提取（`adapter.extractAssistantText`）

`BaseAdapter.extractAssistantText(el, config)` 按通用规则工作：
- 如果 `config.messages.assistant.textSelector` 不为空，仅从该子元素中提取（DeepSeek 的最终答案在 `.ds-assistant-message-main-content`)
- 如果 `assistant.skipIfMissing = true` 且子选择器未命中 → 返回空（被外层判为"思考中",整条消息跳过）
- 提取前通过 `cleanText` 移除噪音节点：内建 `DEFAULT_NOISE_SELECTORS = ['button','svg','img','script','style']`,再合并 `config.messages.noiseSelectors`(DeepSeek 追加 `.ds-think-content`)

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
  config: null,               // PLATFORM_CONFIGS[platformId]
  adapter: null,              // getAdapter(platformId)（默认 BaseAdapter）
  rawSessionId: null,         // URL 中提取的原始 session ID
  openVikingSessionId: null,  // OpenViking 返回的 session ID
  lastMessages: [],           // 上一次成功同步的消息基线
  pendingQueue: [],           // 发送失败时的待重试队列
  observer: null,             // MutationObserver 实例
  debounceTimer: null,        // DOM 变化防抖定时器
  isRecording: false,         // 是否正在录制
  ovClient: null,             // OpenVikingClient 缓存实例
  streamingDetector: null,    // 当前活动的流式检测器（adapter 创建）
  streamingSnapshot: null,    // 流式开始前的 lastMessages 快照
};
```

录制器不再持有任何平台特化字段（无 `assistantStableTimer`、`streamingTimeoutTimer`、`streamingWasActive`）—— 所有计时器和状态都被封装进 detector 实例内部。

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
   匹配循环同时比较 `role` 和 `text`，确保索引对齐是精确的。对齐成功后直接返回 `added`，不再做额外的签名过滤。

2. **后缀匹配**（虚拟列表卸载了前面的消息）：
   ```
   old = [user1, assistant1]
   new = [assistant1, user2]
   → 找到 old 的后缀 [assistant1] 与 new 开头对齐
   → added = [user2]
   ```
   同样同时比较 `role` 和 `text`，对齐成功后直接返回。

3. **签名去重兜底**（仅当完全无法对齐时执行）：
   如果前缀和后缀都无法对齐（页面大规模重构），计算 `oldMessages` 中所有 `role:text` 签名，从 `added` 中剔除已存在的消息。

### 4.4 流式完成检测（`startStreamingDetection` + 可插拔策略）

录制器自身**不再**包含任何平台特化的流式检测逻辑。当 `onMessagesChanged` 发现新出现一条 assistant 消息时,调用 `startStreamingDetection()`：

```javascript
function startStreamingDetection() {
  disposeStreamingDetector();
  const detector = recorderState.adapter?.createStreamingDetector?.(recorderState.config);
  if (!detector) {
    // 无流式检测策略：立即把当前消息当作完成态处理
    const currentMessages = extractSessionMessages(recorderState.platformId);
    sendStreamingResult(currentMessages).catch(...);
    return;
  }
  recorderState.streamingDetector = detector;
  detector.start(() => {
    recorderState.streamingDetector = null;
    const currentMessages = extractSessionMessages(recorderState.platformId);
    sendStreamingResult(currentMessages).catch(...);
  });
}
```

`adapter.createStreamingDetector(config)` 默认实现读取 `config.streaming.strategy` 并到 `src/streaming/registry.js` 中查表得到工厂函数。当前内建策略：

| strategy 名称 | 文件 | 适用场景 | 关键参数 |
|--------------|------|----------|----------|
| `button-svg-poll` | `src/streaming/button-svg-poll.js` | 平台有"停止/发送"按钮且图标会切换（如 DeepSeek） | `anchorSelector`、`buttonSelector`、`iconSelector`、`iconAttr`、`streamingMatch`、`idleMatch`、`pollIntervalMs`、`timeoutMs` |
| `text-stability` | `src/streaming/text-stability.js` | 平台无流式状态指示器，只能靠"文本 N 毫秒不变" | `targetSelector`、`stableMs`、`pollIntervalMs`、`timeoutMs` |
| `selector-state` | `src/streaming/selector-state.js` | 平台在某元素上挂 `data-streaming` / `aria-busy` 等 attribute / class | `selector`、`attr`/`classToken`、`streamingValue`、`idleValue`、`timeoutMs` |
| `none` | — | 不做流式检测，每次 DOM 变化即刻发送 | — |

每个 detector 内部都遵循统一契约：
- `start(onComplete)`：开始观察；当判定为"流式结束"时调用一次 `onComplete()`
- `stop()`：清理所有定时器 / observer，使后续 `onComplete` 不再触发

`button-svg-poll` 的三层防护（清理已有轮询、立即发送已结束的状态、N 秒超时回退）现已作为通用模式内建在策略实现中,而非散布在录制器中。所有策略都自带 `timeoutMs` 超时兜底,防止因平台 DOM 变化导致检测永远挂起。

### 4.5 消息发送防重（`filterRecentlySent`）

`doSendMessages` 在发送前调用 `filterRecentlySent`：
- 维护全局 `sentSignatures` Map，键为**整批消息指纹**，值为发送时间戳
- 指纹格式：`lastMessages.length:messages.length:role1:text1|role2:text2|...`
- 签名缓存 TTL 为 **10 分钟**
- 若整批指纹已存在于缓存中，直接跳过并打印日志
- `stopRecording` 时清空缓存，防止跨会话污染

整批指纹包含会话当前长度前缀，确保不同轮次发送的相同内容消息（如用户连续发送同一问题）不会被误判为重复。同一批完全相同的消息在 10 分钟内只会被 POST 一次。

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

录制器侧（`session-recorder.js`）：

| 常量 | 值 | 说明 |
|------|-----|------|
| `DEBOUNCE_MS` | 500 | DOM 变化防抖延迟 |
| `PENDING_QUEUE_MAX` | 100 | 失败重试队列上限 |
| `SENT_SIGNATURE_TTL_MS` | 600000 (10分钟) | 已发送签名缓存有效期 |

策略侧（`src/streaming/*`）：轮询间隔、稳定时长、超时时长等都通过 `platforms.json` 的 `streaming.params` 注入,不再写死在代码中。当前 DeepSeek 的 `button-svg-poll` 配置 `pollIntervalMs=500`、`timeoutMs=60000`。

## 7. 诊断日志

以下 Console 日志可用于排查问题：

| 日志前缀 | 触发时机 | 用途 |
|----------|----------|------|
| `EchoMem diag: newMessages=` | 每次 DOM 变化提取后 | 查看提取到的完整消息序列 |
| `EchoMem diag: posting=` | `doSendMessages` 发送前 | 查看即将 POST 的消息 |
| `EchoMem diag: prefix diff dropped duplicates` | diff 前缀匹配分支拦截重复 | 确认重复来源 |
| `EchoMem diag: suffix diff dropped duplicates` | diff 后缀匹配分支拦截重复 | 确认虚拟列表卸载场景 |
| `EchoMem diag: diff dropped duplicates` | diff 兜底分支拦截重复 | 确认完全无法对齐场景 |
| `EchoMem: skip recently sent batch` | `filterRecentlySent` 拦截整批重复消息 | 确认发送层防重命中 |
| `EchoMem: message container found via adapter` | adapter 找到容器 | 确认容器查找成功 |
| `EchoMem: start recording for ...` | `startRecording` 进入活动状态 | 确认录制启动 |
| `EchoMem: session id changed ... resetting recorder` | URL 变化触发重置 | 确认 session 切换 |
| `EchoMem: streaming detector stop threw` | detector 清理异常 | 排查策略实现缺陷 |
| `EchoMem: streaming send failed` | 流式回调发送失败 | 排查网络 / 服务端问题 |

具体策略内部的日志（按钮命中、超时回退等）由各策略实现自行打印,前缀通常为 `EchoMem streaming: ...`。

## 8. 已知问题与后续计划

### 8.1 当前已知问题

多轮对话后 OpenViking 中仍偶发重复消息（如 `user2, assistant2, user2, assistant2`）。重复可能在以下情况发生：
- `sendStreamingResult` 与 `onMessagesChanged` 的非流式 diff 产生竞态
- OpenViking 服务端或网络层重试导致重复入库

后续需要：
1. 在 `sendStreamingResult` 中也增加 `filterRecentlySent` 调用（当前只在 `doSendMessages` 中）
2. 考虑在 `onMessagesChanged` 中引入锁机制，禁止流式完成检测与正常 diff 同时执行
3. 增加 OpenViking 侧幂等性校验（如 message sequence number）

### 8.2 扩展计划

#### 添加新平台的步骤

整套架构按"声明优先,代码兜底"的方式工作。新增平台时按以下顺序操作:

1. **改 `src/config/platforms.json`**（90% 的场景到此结束）：
   - 在 `platforms` 数组里追加一项,填入 `id`、`name`、`detection`（URL / 标题 / DOM 特征）
   - 配置 `messages.messageContainers` / `userMessages` / `assistantMessages` / `allMessages`(选择器列表)
   - 如果存在助手消息特定的"答案子节点"（如 DeepSeek 的 `.ds-assistant-message-main-content`),填入 `messages.assistant.textSelector` + `skipIfMissing: true`
   - 如果需要过滤噪音节点(思考块、按钮、引用框等),追加到 `messages.noiseSelectors`
   - 若助手 / 用户区分需要特征选择器,填入 `messages.assistant.roleSignals`
   - 配置 `streaming.strategy`:
     - 有"停止生成"按钮 → `button-svg-poll`,填入按钮锚点和图标识别规则
     - 有 `data-streaming` / `aria-busy` 等状态属性 → `selector-state`
     - 都没有,只能等文本停 N 毫秒 → `text-stability`
     - 完全不需要 → `none`(每次 DOM 变化即刻发送)
   - 配置 `sessionId.type` 决定如何从 URL 提取 session ID(`path` / `regex`)

2. **跑一次 `npm run build`,在该平台真实页面验证**:
   - 控制台无 `EchoMem: no message selectors`、`failed to extract` 等错误
   - 提取到的 `newMessages` 序列正确(看 `EchoMem diag: newMessages=` 日志)
   - 流式完成后 200~500ms 内能看到 `EchoMem: appended N messages`

3. **(可选)在 `src/adapters/` 下写覆盖**:
   仅当 JSON + 通用规则**无法**表达平台特化逻辑时,才在对应 adapter 文件中覆盖 `BaseAdapter` 的某个方法(如 `isAssistantPending`、`extractAssistantText`)。然后在 `src/adapters/registry.js` 注册。

4. **(可选)写新的流式策略**:
   仅当上述四种策略都不适用(例如平台通过 SSE response header / WebSocket 帧判定),才在 `src/streaming/` 下新增策略文件,并在 `src/streaming/registry.js` 注册。新策略需遵循 `{ start(onComplete), stop() }` 接口约定。

#### 后续优化方向

- **commit 自动触发**：当前 `commitCurrentSession` 为预留接口,未自动调用。后续可在会话结束（页面关闭、session 切换）时自动 commit
- **配置热加载**：当前 `platforms.json` 在打包时静态导入。后续可考虑通过 `chrome.storage` 支持运行时覆盖,方便用户调试新平台
- **adapter 单元测试**：抽象 DOM 上下文后,可对 `BaseAdapter` 各方法编写单测,提高扩展安全性
