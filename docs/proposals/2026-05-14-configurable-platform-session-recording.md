# 可配置多平台会话自动记录方案

## 背景

当前 EchoMem 仅支持 HIGO Office 和 DeepSeek 两个硬编码平台。平台配置分散在 `src/platforms/higo.js`、`src/platforms/deepseek.js`、`src/core/detection.js`、`src/core/buttons.js`、`src/core/session-extractor.js`、`src/services/session-mapper.js` 等多个文件中。新增平台需要修改多处源码。

本次改造目标：
1. 将所有平台配置收敛到一个 JSON 文件中，纯配置驱动
2. 支持为每个平台独立开启/关闭「聊天内容自动记录」
3. 自动将记录的内容通过 OpenViking API（`POST /api/v1/sessions`）保存
4. 不对用户开放配置 UI，所有配置以 JSON 文件形式维护在代码中

---

## 方案概述

| 阶段 | 内容 |
|------|------|
| Phase 1 | 平台配置化改造：将硬编码平台信息迁移到 `src/config/platforms.json`，改造 detection、injection、extraction 为配置驱动 |
| Phase 2 | 自动记录引擎：基于 MutationObserver 实时监听聊天消息变化，增量同步到 OpenViking，预留 commit 口子（当前不调用） |

---

## Phase 1：平台配置化改造

### 1.1 配置文件：`src/config/platforms.json`

配置采用 JSON Schema，每个平台一条记录：

```json
{
  "version": 1,
  "platforms": [
    {
      "id": "higo",
      "name": "HIGO Office",
      "enabled": true,
      "record": true,
      "detection": {
        "urlPatterns": ["/home/session/", "/home/workspace/"],
        "titleKeywords": ["Higo", "HIGO", "Higo2", "Higo Office"],
        "domSelectors": {
          "required": [".MuiDrawer-root", ".MuiPaper-root"],
          "launcherContainer": ".MuiPaper-root",
          "launcherInsertPosition": "before",
          "panelHost": ".MuiDrawer-anchorRight .MuiDrawer-paper",
          "panelHostType": "sidebar",
          "inputElement": "textarea[placeholder*='发送消息']"
        }
      },
      "messages": {
        "containers": [".chat-message-list", "[data-testid='chat-message-list']"],
        "user": [".user-message", "[data-testid='user-message']"],
        "assistant": [".assistant-message", "[data-testid='assistant-message']"],
        "all": [".message-item", "[data-testid='message']"]
      },
      "sessionId": {
        "type": "regex",
        "pattern": "/home/session/([a-f0-9-]+)",
        "flags": "i"
      }
    },
    {
      "id": "deepseek",
      "name": "DeepSeek",
      "enabled": true,
      "record": true,
      "detection": {
        "urlPatterns": ["chat.deepseek.com"],
        "titleKeywords": ["DeepSeek"],
        "domSelectors": {
          "required": ["textarea[placeholder*='DeepSeek']", "._24fad49"],
          "launcherContainer": "._77cefa5, ._24fad49",
          "launcherInsertPosition": "append",
          "panelHost": "body",
          "panelHostType": "overlay",
          "panelPosition": "right",
          "panelWidth": "400px",
          "inputElement": "textarea[placeholder*='DeepSeek']"
        }
      },
      "messages": {
        "containers": [".ds-chat-messages", "[class*='chat_messages']"],
        "user": [".user-message", "[class*='user']"],
        "assistant": [".assistant-message", "[class*='assistant']"],
        "all": [".message-item"]
      },
      "sessionId": {
        "type": "path",
        "segment": -1
      }
    }
  ]
}
```

### 1.2 配置加载器：`src/config/loader.js`

职责：
- 运行时加载 `src/config/platforms.json`（通过 `fetch` 或构建时 inline）
- 校验 JSON 结构完整性（必需字段、选择器语法）
- 与内置默认配置合并（内置配置作为 fallback）
- 提供 `getPlatformConfig(id)`、`getAllEnabledPlatforms()`、`shouldRecord(platformId)` 等 API

### 1.3 改造清单

| 文件 | 改造内容 |
|------|----------|
| `src/platforms/registry.js` | 不再 `import` 硬编码配置，改为从 loader 获取 |
| `src/platforms/higo.js` | 删除（配置已迁移到 JSON） |
| `src/platforms/deepseek.js` | 删除（配置已迁移到 JSON） |
| `src/core/detection.js` | `detectPlatform()` 遍历 JSON 中的平台列表进行多层检测 |
| `src/core/buttons.js` | `addCustomButtons()` 从 JSON 读取 launcher 注入位置和插入方式 |
| `src/core/panel-host.js` | 从 JSON 读取 `panelHostType`、`panelPosition`、`panelWidth` |
| `src/core/session-extractor.js` | `extractSessionMessages()` 从 JSON 读取消息选择器 |
| `src/core/input-tracker.js` | `findInputElement()` 从 JSON 读取 `inputElement` 选择器 |
| `src/services/session-mapper.js` | `extractSessionId()` 从 JSON 读取 `sessionId` 提取规则 |

---

## Phase 2：自动记录引擎

### 2.1 扩展 OpenViking 客户端

在 `src/services/openviking-client.js` 中新增三个方法：

```javascript
async createSession(messages, metadata = {}) {
  // POST /api/v1/sessions
  // body: { messages: [{role, content}], metadata, wait: true }
  // return: { sessionId }
}

async appendMessages(sessionId, messages) {
  // POST /api/v1/sessions/{sessionId}
  // body: { messages: [{role, content}], wait: true }
}

async commitSession(sessionId) {
  // POST /api/v1/sessions/{sessionId}/commit
  // body: { wait: true }
  // ⚠️ 当前不自动调用，仅预留口子
}
```

### 2.2 会话记录器：`src/core/session-recorder.js`

核心状态（模块级单例）：

```javascript
const recorderState = {
  platformId: null,
  rawSessionId: null,
  openVikingSessionId: null,  // 与 OpenViking 的 session 映射
  lastMessages: [],           // 上次提取的消息快照（用于 diff）
  pendingQueue: [],           // 网络失败时暂存的消息队列
  observer: null,             // MutationObserver 实例
  isRecording: false,
};
```

工作流程：

```
平台检测通过 && record: true
    │
    ▼
初始化 recorderState（platformId, rawSessionId）
    │
    ▼
对消息容器设置 MutationObserver（childList + subtree）
    │
    ▼
消息容器变化回调
    │
    ▼
提取全部消息 → extractSessionMessages(platformId)
    │
    ▼
与 lastMessages 做 diff，得到新增消息列表
    │
    ├─ 首次有新消息 ──→ createSession(新增消息)
    │                     │
    │                     ▼
    │               缓存 openVikingSessionId
    │
    └─ 非首次 ────────→ appendMessages(openVikingSessionId, 新增消息)
                            │
                            ▼
                      更新 lastMessages
                            │
                            ▼
                      发送失败 → 进入 pendingQueue
                      下次发送前 → 先 flush pendingQueue
```

Diff 策略：
- 以 `role + content` 做消息指纹
- 新提取的消息列表与 `lastMessages` 逐条比对
- 只发送 `lastMessages` 中没有的消息
- 兼容 DOM 重新渲染导致的位置变化

网络容错：
- 每次调用 API 前，先检查 `pendingQueue` 是否有待发送消息
- 若有，与新消息合并后一次性发送
- API 调用失败时，将未成功发送的消息重新放入 `pendingQueue`
- `pendingQueue` 最多保留 100 条，超出时丢弃最旧的消息

### 2.3 预留 commit 口子

导出但不自动调用的函数：

```javascript
export async function commitCurrentSession() {
  if (!recorderState.openVikingSessionId) return;
  try {
    const client = await getClient();
    await client.commitSession(recorderState.openVikingSessionId);
    console.log('EchoMem: session committed', recorderState.openVikingSessionId);
  } catch (err) {
    console.warn('EchoMem: session commit failed', err);
  }
}
```

当前策略：
- **不自动 commit**
- **不在页面切换时 commit**
- **不在页面 unload 时 commit**

后续如需启用 commit，只需在合适时机调用 `commitCurrentSession()` 即可。

### 2.4 入口集成

修改 `src/entry/content.js`：

```javascript
// 平台检测通过后
if (platform.config.record) {
  import('../core/session-recorder.js').then(({ startRecording }) => {
    startRecording(platform.id);
  });
}
```

---

## 数据流图

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Web Page (Claw AI Chat)                      │
│  ┌──────────────┐      ┌──────────────────┐      ┌──────────────┐  │
│  │   Mutation   │─────▶│ Session Recorder │─────▶│   Session    │  │
│  │  Observer    │      │ (diff + debounce)│      │  Extractor   │  │
│  └──────────────┘      └──────────────────┘      └──────────────┘  │
│                               │                                      │
│                               ▼                                      │
│                        ┌──────────────┐                             │
│                        │ OpenViking   │                             │
│                        │ Client       │                             │
│                        │ (create/     │                             │
│                        │  append)     │                             │
│                        └──────┬───────┘                             │
│                               │                                      │
│                               ▼                                      │
│                        ┌──────────────┐                             │
│                        │ 127.0.0.1:1933│                            │
│                        │ /api/v1/...  │                             │
│                        └──────────────┘                             │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 可扩展性设计

### 新增一个平台

开发者只需在 `src/config/platforms.json` 中新增一条平台配置：

1. 填写 `id`、`name`、`enabled`、`record`
2. 填写 `detection` 规则（URL、标题、DOM 选择器）
3. 填写 `messages` 选择器（用户消息、AI 消息、兜底选择器）
4. 填写 `sessionId` 提取规则

无需修改任何 `.js` 源码文件。

### 关闭某个平台的记录

将对应平台的 `record` 改为 `false`。该平台仍会注入 EchoMem launcher，但不再自动监听和保存聊天内容。

### 未来支持 commit

在 `session-recorder.js` 中已有 `commitCurrentSession()` 导出函数。未来如需在「用户手动点击按钮」或「检测到会话切换」时 commit，只需调用该函数即可。

---

## 风险与应对

| 风险 | 应对 |
|------|------|
| 平台 DOM 结构变化导致选择器失效 | `messages.all` 作为兜底选择器 + 启发式角色判断（flex-end 对齐等） |
| 消息提取频率过高导致频繁 API 调用 | 使用 debounce（500ms），批量合并多次 DOM 变化 |
| OpenViking 服务未启动导致消息丢失 | `pendingQueue` 缓存 + 页面刷新后重新提取并补发 |
| 同一页面有多个聊天窗口 | Phase 1 先保持「单实例」限制；Phase 2 中 `session-recorder` 按 `rawSessionId` 隔离，同页面多会话可分别记录 |
