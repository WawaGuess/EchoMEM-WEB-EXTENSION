# ADR-006: 用户会话 Token 统计迁移至 OpenView agent

## 状态

Implemented

## 备注

本方案已实施完成。OpenView 后端新增 `token_usage` 表与 `StatsModule`，`AiService` 在 LLM 调用时记录真实 token 消耗；EchoMem 扩展新增 OpenView 配置与认证客户端，配置面板支持登录，`background.js` 的 `fetchStatsSummary` 改为调用 OpenView `/v1/stats/summary`。相关流程文档与接口清单已同步更新。

## 背景

EchoMem Web Extension 效能面板目前展示两类数据：
1. **EchoMem 后端 Token 消耗** — 已通过解析 `GET /metrics` 实现。
2. **用户会话 Token 统计** — 仍由 `background.js` 请求 `http://127.0.0.1:8000/api/stats/summary`，该服务已不可用，导致面板报错。

OpenView agent 本身与 LLM 直接交互，能够获取真实的 prompt/completion token 消耗。因此，将用户会话统计迁移到 OpenView 后端是最合理的方案。

## 决策

**由 OpenView agent 记录每次 LLM 调用的 token 消耗，并按用户维度聚合；扩展通过 JWT 登录 OpenView 后拉取统计。**

OpenView `main.ts` 设置了全局前缀 `/v1`，默认端口 `31020`。因此实际接口路径为：
- `POST /v1/auth/login`
- `POST /v1/auth/refresh`
- `GET /v1/stats/summary`

## 后端改动（OpenView）

### 1. 认证接口支持扩展登录

**文件**：`src/modules/auth/auth.controller.ts`

当前 `POST /v1/auth/login` 把 token 写入 `httpOnly` cookie，扩展无法读取。需要在响应 body 中同时返回 `accessToken` 和 `refreshToken`，且不破坏现有前端 cookie 行为。

修改后响应示例：
```json
{
  "user": { "id": "...", "username": "...", "email": "..." },
  "accessToken": "...",
  "refreshToken": "..."
}
```

### 2. 新增 TokenUsage 实体与表

**文件**：`src/modules/stats/entities/token-usage.entity.ts`（新增）

字段：
| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | UUID | 主键 |
| `userId` | string | 用户 ID |
| `sessionId` | string / nullable | 会话 ID |
| `promptTokens` | int | prompt tokens |
| `completionTokens` | int | completion tokens |
| `totalTokens` | int | 总 tokens |
| `model` | string / nullable | 模型名称 |
| `createdAt` | datetime | 记录时间 |

**文件**：`src/database/migrations/1747xxxxxxxxx-AddTokenUsage.ts`（新增）

参考已有 migration 风格创建表。

### 3. 新增 Stats 模块

**文件**：
- `src/modules/stats/stats.module.ts`（新增）
- `src/modules/stats/token-usage.service.ts`（新增）
- `src/modules/stats/stats.controller.ts`（新增）

`TokenUsageService` 职责：
- `record(usage: CreateTokenUsageDto)`：记录一次 LLM 调用消耗
- `getSummary(userId: string)`：按用户汇总统计

`StatsController` 职责：
- `GET /v1/stats/summary`：返回当前用户的汇总

响应格式：
```json
{
  "total_sessions": 10,
  "total_turns": 42,
  "total_input_tokens": 1234,
  "total_output_tokens": 5678,
  "total_tokens": 6912,
  "since": "2026-01-01T00:00:00.000Z"
}
```

其中：
- `total_input_tokens` / `total_output_tokens` / `total_tokens` 来自 `token_usage` 聚合
- `total_sessions` 来自 `sessions` 表按 `user_id` 计数
- `total_turns` 来自 `messages` 表按 `user_id` 计数
- `since` 取该用户最早一条 `token_usage` 或 `session` 的创建时间

### 4. 修改 AiService 记录 token 消耗

**文件**：`src/modules/ai/ai.service.ts`

四个方法都需要记录：
- `singleTurnCompletion`
- `generateTitle`
- `chatCompletionStream`
- `chatCompletion`

#### 非流式调用

`response.usage` 直接包含：
```ts
const usage = response.usage;
if (usage) {
  await this.tokenUsageService.record({
    userId,
    sessionId,
    promptTokens: usage.prompt_tokens,
    completionTokens: usage.completion_tokens,
    totalTokens: usage.total_tokens,
    model,
  });
}
```

#### 流式调用

OpenAI 流式默认不返回 usage，需要在请求参数里加：
```ts
stream_options: { include_usage: true }
```

然后在流读取结束后，最后一个 chunk 会包含 `usage`：
```ts
let usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number } | null = null;
for await (const chunk of stream) {
  // ... 处理 delta ...
  if (chunk.usage) {
    usage = chunk.usage;
  }
}
if (usage) {
  await this.tokenUsageService.record({ ... });
}
```

#### userId / sessionId 如何传入

当前 `AiService` 不感知用户/会话。需要修改调用方传入：
- `singleTurnCompletion` / `chatCompletion` / `chatCompletionStream` 增加可选参数 `{ userId, sessionId }`
- `generateTitle` 增加可选参数 `{ userId, sessionId }`

调用方：
- `ai-handler.service.ts` 在调用 `chatCompletionStream` 时传入当前 session 的 `userId` 和 `sessionId`
- `session-title.service.ts` 在调用 `generateTitle` 时传入 `userId` 和 `sessionId`

### 5. 在 AppModule 注册 StatsModule

**文件**：`src/app.module.ts`

```ts
import { StatsModule } from './modules/stats/stats.module';

@Module({
  imports: [
    // ...existing modules...
    StatsModule,
  ],
})
```

## 前端改动（EchoMem Web Extension）

### 1. 新增 OpenView 配置管理

**文件**：`src/services/config.js`

新增 `DEFAULT_OPENVIEW_CONFIG`：
```ts
{
  baseUrl: 'http://127.0.0.1:31020',  // OpenView 默认端口
  username: '',
  password: '',
}
```

新增函数：
- `getOpenViewConfig()`
- `setOpenViewConfig(config)`

### 2. 新增 OpenView 认证客户端

**文件**：`src/services/openview-client.js`（新增）

职责：
- `login({ baseUrl, username, password })` → 调用 `POST /v1/auth/login`，返回 `{ accessToken, refreshToken, user }`
- `refreshToken({ baseUrl, refreshToken })` → 调用 `POST /v1/auth/refresh`
- `fetchStatsSummary({ baseUrl, accessToken })` → 调用 `GET /v1/stats/summary`，带 `Authorization: Bearer <token>`

Token 存储：使用 `chrome.storage.local` 存 `openviewAuth`。

### 3. 配置面板增加 OpenView 配置项

**文件**：`src/panels/echomem/config.js`

在现有 EchoMem 配置表单下方增加（**仅 HIGO 平台显示**）：
- OpenView 服务地址
- OpenView 用户名
- OpenView 密码
- “登录 OpenView” 按钮

点击登录后调用 `openview-client.login()`，成功后保存配置和 token。

> DeepSeek 等非 HIGO 平台不展示 OpenView 登录区域，因为会话 Token 统计仅与 HIGO/OpenView 链路相关。

### 4. 修改 background.js fetchStatsSummary

**文件**：`background.js`

当前：
```js
fetch('http://127.0.0.1:8000/api/stats/summary', { ... })
```

改为：
1. 读取 `openviewAuth`（accessToken, refreshToken, baseUrl）
2. 调用 OpenView `GET /v1/stats/summary`，带 `Authorization: Bearer <accessToken>`
3. 如果 401，先用 refreshToken 刷新，再重试
4. 返回统一格式 `{ success: true, data }`

### 5. performance 面板按平台区分展示

**文件**：`src/panels/performance/index.js`

- HIGO 平台：完整展示总 Token（会话 Token + EchoMem 后端消耗）、会话数、轮次数、Input/Output Tokens、EchoMem 后端消耗。
- 非 HIGO 平台（如 DeepSeek）：隐藏会话级 Token 统计，仅保留 EchoMem 后端消耗。`fetchPerformanceData()` 仅在 HIGO 平台调用。

面板轮询间隔为 5 秒，并额外提供手动刷新按钮，确保模型回复完成后 token_usage 记录能及时反映到界面上。

`fetchPerformanceData()` 已通过 `chrome.runtime.sendMessage({ action: 'fetchStatsSummary' })` 调用 background，返回格式保持不变。顶部“总 Token 消耗”计算方式为会话 Token 总量与 EchoMem 后端 Token 消耗之和。

## 文档更新

- `docs/flows/backend-migration/实施计划.md`：更新三期状态，勾选用户会话统计
- `docs/flows/performance/Token指标流程.md`：更新 fetchStatsSummary 调用链为 OpenView
- `docs/reference/外部接口清单.md`：补充 OpenView `/v1/auth/login`、`/v1/auth/refresh`、`/v1/stats/summary`
- `docs/decisions/005-后端迁移至EchoMem.md`：更新用户会话统计方案
- `docs/reference/EchoMem后端迁移现状与接口对照.md`：更新状态表

## 验证计划

1. **OpenView 后端**：
   - 启动 OpenView，执行 migration
   - 登录获取 token：`POST /v1/auth/login`
   - 进行一次聊天，确认 `token_usage` 表有记录
   - 调用 `GET /v1/stats/summary` 返回正确汇总

2. **扩展端**：
   - 在配置面板填写 OpenView 地址/用户名/密码并登录
   - 打开效能面板，确认会话统计区域显示真实数字
   - 模拟 token 过期，确认刷新机制工作

3. **构建**：
   - `npm run build` 无报错

## 风险与依赖

| 风险 | 说明 | 缓解 |
|---|---|---|
| OpenAI 流式 usage 为空 | 部分模型/供应商可能不支持 `stream_options.include_usage` | gracefully 忽略，只记录非流式调用；或 fallback 按字符估算 |
| AiService 调用方众多 | 需要把所有调用点都传入 userId/sessionId | 改为可选参数，未传入时不记录，逐步补齐 |
| 现有会话历史无 token 数据 | 旧会话无法 retroactively 统计 token | `since` 取最早有记录的时间，旧会话只会计数不计 token |
| OpenView 与扩展登录体验 | 需要用户额外配置 OpenView 账号 | 配置面板提供清晰的登录入口和错误提示 |

## 实施顺序

1. OpenView 后端：实体 + migration + StatsModule
2. OpenView 后端：AiService 记录 usage（先非流式，后流式）
3. OpenView 后端：auth controller 返回 token 到 body
4. 扩展端：config.js + openview-client.js
5. 扩展端：配置面板 + background.js
6. 文档更新
7. 构建与端到端验证

## 影响

1. OpenView 后端新增 `token_usage` 表和 Stats 模块。
2. `AiService` 需要感知 userId/sessionId，签名会变化。
3. 扩展配置面板增加 OpenView 登录配置。
4. `background.js` 的 `fetchStatsSummary` 目标地址从端口 8000 改为 OpenView。
5. 效能面板用户会话统计从“不可用”变为“真实 OpenView LLM 消耗”，且该统计仅在 HIGO 平台展示；其它平台仅展示 EchoMem 后端 Token 消耗。

## 相关代码

- OpenView：`src/modules/ai/ai.service.ts`、`src/modules/session/ai-handler.service.ts`、`src/modules/session/session-title.service.ts`、`src/modules/auth/auth.controller.ts`、`src/app.module.ts`
- 扩展：`src/services/config.js`、`src/services/openview-client.js`（新增）、`src/panels/echomem/config.js`、`background.js`、`src/panels/performance/index.js`
