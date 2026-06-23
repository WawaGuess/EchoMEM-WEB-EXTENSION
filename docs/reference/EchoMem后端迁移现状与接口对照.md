# EchoMem 后端迁移现状与接口对照

> 本文档汇总 EchoMem Web Extension 从 OpenViking 后端迁移到 EchoMem 后端的当前状态：哪些接口可以直接替换、哪些功能需要改造、哪些能力需要 EchoMem 后端新增。
> 
> 相关决策记录：`docs/decisions/005-后端迁移至EchoMem.md`
> 相关实施计划：`docs/flows/backend-migration/实施计划.md`

## 1. 迁移节奏

迁移按三期推进，优先保证核心记忆链路可用，再逐步替换资源和 Skill 管理，最后接入统计能力。

| 阶段 | 目标 | 状态 |
|---|---|---|
| 一期 | 核心记忆链路（健康检查、记忆召回、会话创建/消息/提交）迁移到 EchoMem | 已完成 |
| 二期 | 资源管理、Skill 商店迁移到 EchoMem 服务接口 | 已完成 |
| 三期 | 效能统计面板接入 EchoMem 后端的 usage / stats 接口 | 依赖后端新增接口 |

## 2. 可直接切换的接口（低改动）

以下接口在 EchoMem 后端已有对应实现，前端只需调整路径、请求体字段或响应解析即可。

| 原 OpenViking 接口 | EchoMem 对应接口 | 功能 | 主要改动点 |
|---|---|---|---|
| `GET /health` | `GET /health` | 健康检查 | 响应体从 OpenViking 格式适配为 `{"status":"ok","service":"echomem","version":...}` |
| `POST /api/v1/search/find` | `POST /api/retrieval/search` | 输入联想记忆召回 | 请求体字段改为 `query`、`agent_id`、`session_id`、`limit`、`include_explain`；**`user_id` 由 `X-Auth-Key` 推导，禁止放入请求体**；消费 `result.items` 替代 `result.memories`，item 字段为 `text`/`score`（`include_debug` 时额外含 `kind`/`source`/`evidence_uri`） |
| `POST /api/v1/sessions` | `POST /api/sessions/open` | 创建会话 | 请求体必须增加 `agent_id`，`session_id` 保持可选；响应从 `scope.session_id` 取 session_id |
| `POST /api/v1/sessions/{id}/messages` | `POST /api/sessions/{id}/messages` | 追加消息 | 路径与字段一致，响应包装为 `{message: {...}}` |
| `POST /api/v1/sessions/{id}/commit` | `POST /api/sessions/{id}/commit` | 提交会话 | 路径一致；请求体只传 `metadata`（不要传 `wait: true`）；返回包含 `commit_id` / `archive_id` |
| `GET /api/v1/fs/ls?uri=` | `GET /fs/ls?uri=` | 列出目录 | 返回包装为 `{status, result: {uri, entries}}`，`entries` 字段为 `uri/name/kind/size/updated_at` |
| `GET /api/v1/fs/stat?uri=` | `GET /fs/stat?uri=` | 获取资源状态 | 同上 |
| `GET /api/v1/content/read?uri=` | `GET /fs/read?uri=` | 读取内容 | 返回 `{status, result: {uri, text}}`，不再嵌套 `content` |

## 3. 需要改造的功能（中到高改动）

以下功能在 EchoMem 后端有替代方案，但前端交互或调用链需要重新设计。

| 原 OpenViking 功能 | EchoMem 替代方案 | 需要改造的点 |
|---|---|---|
| 文件临时上传 `POST /api/v1/resources/temp_upload` | **无对应接口** | 前端读取文件内容，直接调用 `POST /api/resources` |
| 添加资源 `POST /api/v1/resources` | `POST /api/resources` | 请求体改为 `content`、`name`、`content_type`、`tags`、`metadata`，不再传 `temp_file_id` |
| 添加 Skill `POST /api/v1/skills` | `POST /api/skills` | 请求体改为 `data`（SKILL.md 内容），可附加 `name`、`description`、`tags`、`allowed_tools` |
| 创建目录 `POST /api/v1/fs/mkdir` | **HTTP fs 只读**，无写接口 | 移除前端新建文件夹功能，资源根目录由后端服务自动创建 |
| 删除文件/目录 `DELETE /api/v1/fs?uri=` | **无通用 fs 删除接口** | 资源删除改用 `DELETE /api/resources/{resource_id}`；Skill 删除改用 `DELETE /api/skills/{name}` |
| 内容摘要 `GET /api/v1/content/abstract` | **无对应接口** | 移除资源导入后的轮询逻辑，或改用 `GET /fs/read` 读取完整内容后前端处理 |
| 内容概览 `GET /api/v1/content/overview` | **无对应接口** | 移除概览展示，或改用 `GET /fs/read` 读取完整内容 |

## 4. 暂时无法实现的功能（依赖 EchoMem 后端新增接口）

以下功能在 EchoMem 后端当前 HTTP API 中找不到对应能力，需要后端新增接口后才能接入。

| 功能 | 原接口 | 需要 EchoMem 后端提供的能力 | 影响面板 |
|---|---|---|---|
| 后端 Token 消耗统计 | `GET /api/v1/usage` | 新增 usage 统计接口，返回总 Token、Input/Output Token 等 | 效能概览 |
| 用户会话 Token 汇总 | `GET /api/stats/summary`（原 Background 直接调用） | 新增用户会话级统计接口，返回 `total_sessions`、`total_turns`、`total_input_tokens`、`total_output_tokens`、`total_tokens`、`since` | 效能概览 |
| 通用文件系统写操作 | `POST /api/v1/fs/mkdir`、`DELETE /api/v1/fs?uri=` | 如需保留目录树写操作，需 EchoMem 暴露 fs 写接口；或提供资源/Skill 的 `list/update/delete` 服务接口替代前端目录管理 | 资源管理、Skill 商店 |

## 5. 需要 EchoMem 后端暴露的接口清单

按优先级排序：

1. **Usage 统计接口**
   - 建议路径：`GET /api/v1/usage` 或 `GET /api/usage`
   - 用途：替代原 `GET /api/v1/usage`，返回后端 Token 消耗
   - 期望响应字段：`total.total_tokens`、`total.input_tokens`、`total.output_tokens` 等

2. **用户会话统计接口**
   - 建议路径：`GET /api/stats/summary`
   - 用途：替代 Background 中直接调用的 `http://127.0.0.1:8010/api/stats/summary`
   - 期望响应字段：`total_sessions`、`total_turns`、`total_input_tokens`、`total_output_tokens`、`total_tokens`、`since`

3. **资源/Skill 列表接口（可选，用于替代 `/fs/ls` 方案）**
   - 建议路径：`GET /api/resources`、`GET /api/skills`
   - 用途：让前端不再依赖 `/fs/ls` 读取目录结构，直接获取资源/Skill 列表
   - 优势：避免前端假设后端文件系统布局

4. **通用文件系统写接口（可选）**
   - 建议路径：`POST /fs/mkdir`、`DELETE /fs?uri=`
   - 用途：如需保留前端目录树写操作能力
   - 风险：与 EchoMem 当前设计冲突，可能引入权限边界问题

## 6. 功能切换状态总览

| 功能模块 | 一期是否切换 | 二期是否切换 | 依赖后端新增接口 |
|---|---|---|---|
| 输入联想 | 是 | — | 否 |
| 会话录制 | 是 | — | 否 |
| 健康检查 | 是 | — | 否 |
| 资源上传 | — | 是 | 否 |
| 资源列表 | — | 是 | 否 |
| 资源删除 | — | 是 | 否 |
| Skill 上传 | — | 是 | 否 |
| Skill 列表 | — | 是 | 否 |
| Skill 删除 | — | 是 | 否 |
| 后端 Token 统计 | — | — | 是（三期） |
| 用户会话统计 | — | — | 是（三期） |

## 7. 相关代码锚点

- 客户端封装：`src/services/echomem-client.js`
- 配置读取：`src/services/config.js`
- 输入联想：`src/core/input-tracker.js`
- 会话录制：`src/core/session-recorder.js`
- 资源管理：`src/panels/resource/import.js`、`src/panels/resource/manage.js`
- Skill 商店：`src/panels/skill-store/index.js`
- 效能概览：`src/panels/performance/index.js`、`background.js`
- 配置面板：`src/panels/echomem/config.js`

## 8. 配置说明

`echomemConfig` 包含以下字段：

| 字段 | 必填 | 默认值 | 说明 |
|---|---|---|---|
| `baseUrl` | 是 | `http://127.0.0.1:8010` | EchoMem 后端地址 |
| `authKey` | 是 | `''` | 认证密钥，对应后端 `X-Auth-Key` |
| `agentId` | 否 | `echoagent` | 请求时使用的 `agent_id`，决定记忆隔离范围；可在配置面板修改 |

> 注意：`agent_id` 必须与写入记忆时使用的 `agent_id` 一致，否则 recall 会返回空结果。例如后端数据写入 `higo_agent` 时，扩展配置面板也应填 `higo_agent`。
