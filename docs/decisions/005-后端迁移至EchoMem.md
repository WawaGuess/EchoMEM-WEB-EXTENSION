# ADR-005: 后端从 OpenViking 迁移至 EchoMem

## 状态

Implemented

> 默认地址的当前发行策略已由 [ADR-008](008-单分支双发行包.md) 取代；本 ADR 中的 localhost 地址保留为迁移当时的历史决策。

## 背景

当前 EchoMem Web Extension 默认对接的记忆后端已从 OpenViking 迁移到 EchoMem 本地后端（默认地址 `http://127.0.0.1:8010`）。原 `src/services/openviking-client.js` 已删除，统一由 `src/services/echomem-client.js` 封装 EchoMem HTTP API。

随着 EchoMem 后端能力逐步完善，继续维护 OpenViking 专属客户端会带来以下问题：

1. **双线适配成本**：同一套功能需要维护两套请求路径、认证头、返回解析逻辑。
2. **能力错位**：EchoMem 后端在设计上不再暴露通用文件系统写接口（`mkdir`/`rm`），资源和 Skill 的生命周期通过独立服务接口管理；而 OpenViking 的 `fs` 写操作在 EchoMem 中没有直接对应。
3. **统计接口悬空**：迁移前 `background.js` 中 `fetchStatsSummary` 调用的本地 `/api/stats/summary` 既非 OpenViking 接口，也非 EchoMem 接口，来源不明确。
4. **认证模型差异**：OpenViking 使用 `X-OpenViking-Agent` / `X-API-Key` / `X-OpenViking-Account` / `X-OpenViking-User` 组合；EchoMem 使用单一 `X-Auth-Key`，配置项需要精简。

因此需要评估：当前 OpenViking 接口哪些可以迁移到 EchoMem 后端，哪些需要改造或新增后端能力。

## 决策

**将 EchoMem Web Extension 的后端目标从 OpenViking 逐步迁移到 EchoMem 本地后端。**

迁移原则：

- **能直接映射的接口优先迁移**：会话、消息、提交、召回、只读 fs 查询等语义一致的接口，通过调整路径和字段完成替换。
- **不再依赖通用 fs 写操作**：资源上传、Skill 上传、删除改走 EchoMem 的 `/api/resources` 和 `/api/skills` 服务接口；前端不再维护目录树，改为以资源 ID / Skill 名为核心进行操作。
- **缺失能力明确列出**：`/api/stats/summary`、内容 abstract/overview 等 EchoMem 尚未暴露的能力，作为后端新增需求单独跟进；后端 Token 消耗统计已通过解析现有 `GET /metrics` 端点实现，用户会话 Token 汇总仍等待 EchoAgent 提供稳定接口（历史候选方案已归档至 `docs/legacy/006-用户会话Token统计方案.md`）。
- **认证统一为 X-Auth-Key**：配置面板从多字段认证简化为单一 auth key，默认后端地址改为 `http://127.0.0.1:8010`。
- **迁移分阶段完成**：一期（核心记忆链路）、二期（资源/Skill 管理）已实施；三期（效能统计）中后端 Token 消耗已接入，用户会话统计待后续完成。

## 接口迁移对照表

### 可直接迁移（低改动）

| 原 OpenViking 接口 | EchoMem 接口 | 改动点 |
|---|---|---|
| `GET /health` | `GET /health` | 响应体从 OpenViking 格式适配为 EchoMem 的 `{"status":"ok","service":"echomem"}` |
| `POST /api/v1/search/find` | `POST /api/retrieval/search` | 请求体字段改为 `query`、`agent_id`、`session_id`、`limit`、`include_explain`；**`user_id` 由 `X-Auth-Key` 推导，禁止放入请求体**；消费 `result.items` 替代 `result.memories` |
| `POST /api/v1/sessions` | `POST /api/sessions/open` | 请求体必须增加 `agent_id`，`session_id` 保持可选 |
| `POST /api/v1/sessions/{id}/messages` | `POST /api/sessions/{id}/messages` | 路径与字段一致，响应包装不同 |
| `POST /api/v1/sessions/{id}/commit` | `POST /api/sessions/{id}/commit` | 路径一致，返回 `commit_id` / `archive_id` |
| `GET /api/v1/fs/ls?uri=` | `GET /fs/ls?uri=` | 返回包装为 `{status, result: {uri, entries}}`，`entries` 字段为 `uri/name/kind/size/updated_at` |
| `GET /api/v1/fs/stat?uri=` | `GET /fs/stat?uri=` | 同上 |
| `GET /api/v1/content/read?uri=` | `GET /fs/read?uri=` | 返回 `{status, result: {uri, text}}`，不再嵌套 `content` |

### 需要重新设计（中到高改动）

| 原 OpenViking 接口 | EchoMem 现状 | 迁移方案 |
|---|---|---|
| `POST /api/v1/resources/temp_upload` | **无对应接口** | 移除临时上传步骤；前端读取文件内容为 `text/base64`，直接调用 `POST /api/resources` |
| `POST /api/v1/resources` | `POST /api/resources` 要求 `content`、`name`、`content_type`、`tags`、`metadata` | 重写 `resource/import.js` 上传流程，构造 `AddResourceReq` 对应字段 |
| `POST /api/v1/skills` | `POST /api/skills` 要求 `data` 为 SKILL.md 内容 | 上传文件后读取文本，传入 `data`；`name`、`description`、`tags`、`allowed_tools` 可选 |
| `POST /api/v1/fs/mkdir` | **HTTP fs API 只读**，`mkdir` 仅内部服务调用 | 移除前端目录管理概念；资源根目录由 `LocalResourceService` 自动创建 |
| `DELETE /api/v1/fs?uri=` | **无通用 fs 删除接口** | 资源删除改用 `DELETE /api/resources/{resource_id}`；Skill 删除改用 `DELETE /api/skills/{name}` |
| `GET /api/v1/content/overview` | **无对应接口** | 移除或改为调用 `GET /fs/read?uri=` 读取完整内容后前端提取摘要 |
| `GET /api/v1/content/abstract` | **无对应接口** | 移除轮询逻辑，资源提交后由后端异步处理，前端不再轮询 abstract |
| `GET /api/v1/usage` | **无对应接口** | 改为解析 EchoMem 现有 `GET /metrics` Prometheus 指标，汇总 router + engine 的 LLM input/output tokens |
| 迁移前本地 `GET /api/stats/summary` | **非 EchoMem 接口** | 当前暂不可用；OpenView `/v1/stats/summary` 仅为历史候选方案，扩展未调用（见 `docs/legacy/006-用户会话Token统计方案.md`） |

## 前端改造范围

1. **新增 `src/services/echomem-client.js`**
   - 替代 `src/services/openviking-client.js`
   - 统一处理 `X-Auth-Key`、超时、错误码转换
   - 封装 EchoMem 接口，返回结构与原 client 尽量保持一致，减少面板层改动

2. **改造 `src/services/config.js`**
   - 默认 `baseUrl` 从 OpenViking 地址迁移为 EchoMem 配置；当前发行包地址由构建环境注入，不固定到本地端口
   - 配置项从 `agentId/apiKey/accountId/userId/authEnabled` 简化为 `baseUrl/authKey`

3. **改造 `src/panels/resource/import.js`**
   - 移除 `tempUpload` 和 `contentAbstract` 轮询
   - 上传时读取文件内容，调用 `POST /api/resources`
   - 列表展示从 `viking://resources/echomem/` 改为 `echo://resources/`，使用 `GET /fs/ls`
   - 删除从 `fsRm` 改为 `DELETE /api/resources/{resource_id}`
   - 移除新建文件夹功能

4. **改造 `src/panels/skill-store/index.js`**
   - 上传流程改为读取 SKILL.md 内容并调用 `POST /api/skills`
   - 列表展示从 `viking://agent/skills` 改为 `echo://skills/`，使用 `GET /fs/ls` 或 `POST /fs/glob`
   - 删除从 `fsRm` 改为 `DELETE /api/skills/{name}`
   - 详情读取从 `contentRead` 改为 `GET /fs/read?uri=echo://skills/{name}/SKILL.md`

5. **改造 `src/core/session-recorder.js`**
   - `createSession` 改为 `POST /api/sessions/open`，并传入 `agent_id`
   - 会话映射缓存 key 从 `echomem_session_{platform}_{rawSessionId}` 保留，但值存储 EchoMem `session_id`

6. **改造 `src/panels/performance/index.js` 与 `background.js`**
   - `fetchBackendUsageData` 改为调用 `EchoMemClient.fetchUsage()`，内部解析 `GET /metrics` 获取后端 Token 消耗
   - `fetchStatsSummary` 当前不再代理旧统计接口，而是明确返回“不支持”错误；待 EchoAgent 提供稳定的汇总接口与认证契约后再接入

## 后端需新增能力

- 如需保留内容摘要展示，可考虑 `GET /fs/read` 已满足读取，abstract 提取可放在前端或新增 `/resources/{id}/abstract`

> 后端 Token 消耗统计已通过 `GET /metrics` 实现，无需新增专用 usage 接口。
> 用户会话统计当前暂不可用；效能页明确展示 `— / 暂不可用`，历史迁移方案见 `docs/legacy/006-用户会话Token统计方案.md`。

## 备选方案

| 方案 | 拒绝原因 |
|---|---|
| 继续维护 OpenViking 客户端，同时新增 EchoMem 适配层 | 不能解决双线维护问题，长期债务更高 |
| 完全保留 OpenViking 的 `fs` 写操作语义，在 EchoMem 上新增通用 fs 写接口 | 与 EchoMem 后端设计冲突（fs 写仅对内部服务开放），会引入安全和权限边界问题 |
| 一次性全量替换所有面板 | 统计接口等后端能力尚未就绪，建议分阶段迁移，先完成会话/资源/Skill，再补齐统计 |

## 影响

1. `src/services/openviking-client.js` 将被 `echomem-client.js` 替代。
2. 配置存储格式变化，旧版 `openvikingConfig` 需要兼容或引导用户重新配置。
3. 资源管理和 Skill 商店的交互模型从“目录树操作”变为“资源/Skill 服务操作”。
4. 效能概览的后端 Token 统计通过解析 `GET /metrics` 实现，不再依赖后端新增 usage 接口；用户会话统计等待 EchoAgent 稳定汇总接口，当前展示不可用状态（历史方案已归档至 `docs/legacy/006-用户会话Token统计方案.md`）。
5. 文档同步更新：`docs/reference/外部接口清单.md` 需替换为 EchoMem 接口说明。

## 相关代码

- `src/services/openviking-client.js`
- `src/services/config.js`
- `src/core/session-recorder.js`
- `src/core/input-tracker.js`
- `src/panels/resource/import.js`
- `src/panels/skill-store/index.js`
- `src/panels/performance/index.js`
- `background.js`
- `docs/reference/外部接口清单.md`
