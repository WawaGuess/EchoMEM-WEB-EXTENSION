# 功能与外部接口对照（OpenViking 历史归档）

> **已归档**：本文档记录迁移 OpenViking 之前的接口对照，当前项目已迁移到 EchoMem 后端。最新接口说明请参考 [`docs/reference/外部接口清单.md`](../reference/外部接口清单.md)。

本文档按 EchoMem Web Extension 的功能模块分类，列出每个功能实际调用的外部网络接口。

> **说明**：所有 OpenViking 记忆后端引擎接口共用 `src/services/openviking-client.js` 客户端，基础地址可配置，默认 `http://127.0.0.1:1933`。详细的请求头、请求体、响应体字段说明见 [外部接口清单](外部接口清单.md)。

---

## 1. 资源管理

相关源码：

- `src/panels/resource/import.js`（资源导入、远程文件浏览）
- `src/panels/resource/manage.js`（资源列表、查看、插入、删除）

| 调用方法 | 接口 | 用途 |
|---|---|---|
| `tempUpload` | `POST /api/v1/resources/temp_upload` | 本地文件临时上传 |
| `addResource` | `POST /api/v1/resources` | 提交资源入库（异步处理） |
| `fsMkdir` | `POST /api/v1/fs/mkdir` | 确保目标目录存在 |
| `fsLs` | `GET /api/v1/fs/ls?uri=...` | 列出目录内容 |
| `fsStat` | `GET /api/v1/fs/stat?uri=...` | 获取文件元信息 |
| `fsRm` | `DELETE /api/v1/fs?uri=...` | 删除文件/文件夹 |
| `contentOverview` | `GET /api/v1/content/overview?uri=...` | 查看资源内容/插入对话 |
| `contentAbstract` | `GET /api/v1/content/abstract?uri=...` | 轮询资源处理状态 |

---

## 2. 输入联想

相关源码：

- `src/core/input-tracker.js`（监听输入框并触发召回）
- `src/core/completion-engine.js`（本地补全生成，不直接调接口）

| 调用方法 | 接口 | 用途 |
|---|---|---|
| `find` | `POST /api/v1/search/find` | 根据输入文本召回相关记忆 |

`completion-engine.js` 只负责本地短语提取、相关性评分和补全排序，数据来源是 `find` 返回的记忆列表。

---

## 3. Skill 管理

相关源码：

- `src/panels/skill-store/index.js`

| 调用方法 | 接口 | 用途 |
|---|---|---|
| `tempUpload` | `POST /api/v1/resources/temp_upload` | Skill 文件临时上传 |
| `addSkill` | `POST /api/v1/skills` | 创建 Skill |
| `fsMkdir` | `POST /api/v1/fs/mkdir` | 确保 `viking://agent/skills` 目录存在 |
| `fsLs` | `GET /api/v1/fs/ls?uri=...` | 列出已安装 Skill 目录 |
| `contentRead` | `GET /api/v1/content/read?uri=...` | 读取每个 Skill 的 `SKILL.md` |
| `fsRm` | `DELETE /api/v1/fs?uri=...` | 删除 Skill |

---

## 4. 效能

相关源码：

- `src/panels/performance/index.js`
- `background.js`

| 调用来源 | 接口 | 用途 |
|---|---|---|
| `fetchPerformanceData` → `background.js` | `GET http://127.0.0.1:8000/api/stats/summary` | 用户会话 Token 统计 |
| `fetchBackendUsageData` → `client.fetchUsage` | `GET /api/v1/usage` | 记忆后端 Token 消耗 |

---

## 5. 记忆后端配置

相关源码：

- `src/panels/echomem/config.js`

| 调用方法 | 接口 | 用途 |
|---|---|---|
| `healthCheck` | `GET /health` | 点击「测试连接」时验证后端可达 |

保存配置仅写入 `chrome.storage.local`，不调用外部接口。

---

## 6. 认知反馈

相关源码：

- `src/panels/feedback/index.js`

- **无外部接口调用**。当前使用本地假数据 `mockGraphData` 和打包的 ECharts 渲染知识图谱。

---

## 7. 自动会话录制（跨功能）

相关源码：

- `src/core/session-recorder.js`

| 调用方法 | 接口 | 用途 |
|---|---|---|
| `createSession` | `POST /api/v1/sessions` | 创建后端会话 |
| `appendMessages` | `POST /api/v1/sessions/{id}/messages` | 批量追加聊天消息 |
| `commitSession` | `POST /api/v1/sessions/{id}/commit` | 触发记忆提取（预留，未自动调用） |

---

## 汇总

| 功能模块 | 主要接口 |
|---|---|
| 资源管理 | `/api/v1/resources/temp_upload`、`/api/v1/resources`、文件系统接口、内容读取接口 |
| 输入联想 | `/api/v1/search/find` |
| Skill 管理 | `/api/v1/resources/temp_upload`、`/api/v1/skills`、文件系统接口、`/api/v1/content/read` |
| 效能 | `http://127.0.0.1:8000/api/stats/summary`、`/api/v1/usage` |
| 记忆后端配置 | `/health` |
| 认知反馈 | 无 |
| 自动会话录制 | `/api/v1/sessions`、`/api/v1/sessions/{id}/messages`、`/api/v1/sessions/{id}/commit` |
