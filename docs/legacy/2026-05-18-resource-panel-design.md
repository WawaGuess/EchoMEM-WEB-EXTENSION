# EchoMem 资源管理面板设计文档

日期: 2026-05-18
作者: Claude Code (superpowers brainstorming skill)
状态: 待审阅

---

## 1. 需求概述

将 EchoMem 扩展中的"资源管理"占位面板替换为完整功能，支持：

- **本地文件上传**（拖拽/选择文件）
- **URL 资源录入**（粘贴远程链接）
- **资源浏览与搜索**（列出已上传资源，含状态指示）
- **内容预览与插入**（展开查看摘要，一键插入当前对话）
- **资源删除**

上传后资源存入 OpenViking 知识库，按**平台 + 年月**自动分类目录。

**核心使用场景**: 用户在聊天时临时投喂资料（文件或 URL），AI 可基于这些资料回答；同时资源进入长期知识库，后续可搜索复用。

---

## 2. 设计决策

### 2.1 后端对接策略

采用**混合架构（方案 3）**：

- **第一阶段**: Content Script 直连 OpenViking（DirectResourceService），快速落地
- **预留扩展**: ResourceService 为抽象接口，未来可替换为 Background Script 代理实现，不影响业务逻辑

**理由**: EchoMem 现有的 `find` / `createSession` 等 API 已在 Content Script 中直连 localhost 运行良好，先验证用户价值，后续按需迁移。

### 2.2 目录组织规则

资源按**平台 + 年月**自动归档：

```
viking://resources/{platform}/{YYYY-MM}/
```

- `platform`: 从当前页面平台 ID 映射（`higo` → `higo`, `deepseek` → `deepseek`）
- `YYYY-MM`: 上传时的年月，如 `2026-05`
- 用户不可编辑目录路径，面包屑仅展示

**示例路径**:
- `viking://resources/deepseek/2026-05/设计文档.pdf`
- `viking://resources/higo/2026-05/https-docs-example-com-api`（URL 资源）

### 2.3 上传后行为

上传完成弹出确认模态，两个选项：

1. **仅保存到知识库** — 资源入库并向量化，不立即影响当前对话
2. **保存并插入对话** — 先执行「仅保存」，再调 `content/read` 获取文本内容，格式化为 `<relevant-memories>` 标签注入当前聊天输入框

---

## 3. 架构设计

### 3.1 组件拆分

```
┌─────────────────────────────────────────────────────────────┐
│                    EchoMem Content Script                     │
│  ┌─────────────┐  ┌──────────────────┐  ┌──────────────┐   │
│  │ Resource    │  │ DirectResource   │  │ Resource     │   │
│  │ Panel UI    │◄─┤ Service          │  │ Service      │   │
│  │ (resource/  │  │ (默认实现)        │  │ Interface    │   │
│  │  index.js)  │  │                  │  │ (抽象契约)    │   │
│  └─────────────┘  └──────────────────┘  └──────────────┘   │
│         ▲                                           ▲       │
│         │  bind events                              │       │
│         │                                           │       │
│  ┌─────────────┐                           ┌──────────────┐│
│  │ router.js   │◄── 扩展 bindPanelControls  │ 未来可替换:  ││
│  │ (面板路由)   │                           │ Background   ││
│  └─────────────┘                           │ Resource     ││
│                                             │ Service      ││
│                                             └──────────────┘│
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │ OpenViking Server│
                    │ (localhost:1933) │
                    └──────────────────┘
```

### 3.2 文件变更清单

| 文件 | 类型 | 说明 |
|------|------|------|
| `src/services/resource-service.js` | 新增 | ResourceService 抽象接口 |
| `src/services/direct-resource-service.js` | 新增 | 默认实现：Content Script 直接 fetch |
| `src/services/openviking-client.js` | 修改 | 抽离 `getHeaders()` 公共方法供 ResourceService 复用 |
| `src/panels/resource/index.js` | 重写 | 从占位 HTML 到完整面板 + 状态管理 + 事件绑定 |
| `src/core/router.js` | 修改 | 扩展 `bindPanelControls`，资源面板渲染后绑定事件 |
| `src/panels/index.js` | 修改 | 导出资源面板的事件绑定函数供 router 调用 |
| `src/panels/registry.js` | 无修改 | render 函数签名不变（仍返回字符串），但内部行为全变 |
| `src/core/content-injector.js` | 新增 | 轻量文本注入工具，将资源内容插入当前聊天输入框 |

### 3.3 接口定义

`ResourceService` 抽象接口（`src/services/resource-service.js`）：

```javascript
export class ResourceService {
  async uploadFile(file, parent, config) { throw new Error('Not implemented'); }
  async addResourceByUrl(url, parent, config) { throw new Error('Not implemented'); }
  async listDirectory(uri, config) { throw new Error('Not implemented'); }
  async statResource(uri, config) { throw new Error('Not implemented'); }
  async getOverview(uri, config) { throw new Error('Not implemented'); }
  async getContent(uri, config) { throw new Error('Not implemented'); }
  async deleteResource(uri, config) { throw new Error('Not implemented'); }
}
```

---

## 4. 数据流设计

### 4.1 本地文件上传流程

```
用户拖拽文件到面板
    │
    ▼
显示模态确认对话框：
  「仅保存到知识库」/「保存并插入对话」
    │
    ├──► 「仅保存到知识库」
    │      │
    │      ▼
    │   POST /api/v1/resources/temp_upload (multipart/form-data)
    │      │
    │      ▼
    │   返回 { temp_file_id }
    │      │
    │      ▼
    │   POST /api/v1/resources
    │   { temp_file_id, parent: "viking://resources/{platform}/{YYYY-MM}" }
    │      │
    │      ▼
    │   返回 { uri, status }
    │      │
    │      ▼
    │   面板列表插入新项，状态为 ⏳ 处理中
    │
    └──► 「保存并插入对话」
           │
           └──► 走完「仅保存」流程
                  │
                  ▼
               GET /api/v1/content/read?uri={uri}
                  │
                  ▼
               将内容格式化为 <relevant-memories> 标签
               注入当前聊天输入框
```

### 4.2 URL 资源录入流程

```
用户粘贴 URL
    │
    ▼
同样的确认对话框
    │
    ▼
POST /api/v1/resources
{ path: "https://...", parent: "viking://resources/{platform}/{YYYY-MM}" }
    │
    ▼
（无需 temp_upload 步骤，直接入库）
```

### 4.3 列表浏览流程

```
打开资源面板
    │
    ▼
计算当前自动路径 viking://resources/{platform}/{YYYY-MM}
    │
    ▼
GET /api/v1/fs/ls?uri={path}
    │
    ▼
遍历结果，对每个 item 调 GET /api/v1/fs/stat?uri={item.uri}
    │
    ▼
综合生成列表数据（含状态推断）
    │
    ▼
渲染列表
```

**性能优化**: 先调 `fs/ls` 获取目录条目，再对所有条目并行调 `fs/stat` 获取各自状态。后续仅刷新变更项。

---

## 5. UI 设计

### 5.1 面板整体布局

```
┌──────────────────────────────────────────┐
│ 📁 资源管理                              │
├──────────────────────────────────────────┤
│ 📤 拖拽文件到此处  或  粘贴 URL 链接      │  ← 上传区域
│ [选择文件]                               │
├──────────────────────────────────────────┤
│ 📍 viking://resources/deepseek/2026-05   │  ← 面包屑（只读）
│ [刷新 🔄]                                │
├──────────────────────────────────────────┤
│ 📄 需求文档.pdf              ✅ 已索引   ✕ │  ← 列表项 1
│    2.3MB · 2026-05-18 10:30              │
├──────────────────────────────────────────┤
│ 🌐 https://docs.example.com/api          │  ← 列表项 2（展开中）
│    ✅ 已索引                    ✕  [收起▲] │
│    ─────────────────────────────────────  │
│    📋 内容摘要:                           │
│    本文档描述了 OpenAPI v3 的接口规范...  │
│    [插入到对话]  [查看完整内容]            │
├──────────────────────────────────────────┤
│ 📄 meeting_notes.pdf         ⏳ 处理中   ✕ │  ← 列表项 3
│    1.1MB · 刚刚                          │
└──────────────────────────────────────────┘
```

### 5.2 列表项状态规则

| 后端信号 | 前端状态 | 图标 |
|---------|---------|------|
| `stat` 返回且 `abstract` 字段非空 | ✅ 已索引 | 绿色圆点 |
| `stat` 返回但 `abstract` 字段为空/缺失 | ⏳ 处理中 | 黄色圆点 |
| `add_resource` 返回 error 或 `stat` 404 | ❌ 提取失败 | 红色圆点 |
| 本地文件（有原始文件名） | 📄 | 文件图标 |
| URL 资源 | 🌐 | 链接图标 |

### 5.3 展开后操作按钮

| 按钮 | 动作 |
|------|------|
| **插入到对话** | `content/read` → 格式化 `<relevant-memories>` → 注入输入框 |
| **查看完整内容** | `openCenterOverlay` 弹层显示完整文本 |
| **重新索引** | `content/reindex`（仅状态为 ❌ 时显示）|
| **删除** | `fs/rm` + confirm 确认 |

---

## 6. 错误处理

| 场景 | 前端表现 |
|------|---------|
| OpenViking 未启动 | 顶部红色提示条：「OpenViking 服务未连接」 |
| URL 不可达 | 列表项标记 ❌，tooltip 显示错误 |
| 资源被外部删除 | 显示「资源已丢失」，提供「删除引用」 |
| 二进制文件预览 | 显示「无法直接预览」，隐藏「查看完整内容」 |
| 删除失败（无权限）| Alert 提示，不自动刷新 |
| 超大文件 | 前端限制 50MB，超限提示压缩或分卷 |
| 非 URL 文本粘贴 | 正则校验，不触发上传 |
| 目录不存在 | 自动 `fs/mkdir` 创建后重试 |
| `content/overview` 为空 | 显示「摘要生成中，请稍后刷新」 |

---

## 7. 与现有系统的集成

### 7.1 面板渲染模式

延续现有架构：

1. `getResourceContent()` 返回 HTML 字符串
2. `router.js` 调用 `openCustomPanel()` 渲染
3. 渲染完成后 `router.js` 调用 `bindResourcePanelEvents()` 绑定事件
4. 事件处理中调用 `ResourceService` 方法发 API 请求

### 7.2 配置复用

使用 `getOpenVikingConfig()`（`src/services/config.js`）获取连接配置，与输入联想、会话录制共用同一套配置。

### 7.3 输入框注入

「插入到对话」功能新建轻量注入工具 `src/core/content-injector.js`，不耦合 `input-tracker.js`（后者职责为输入联想补全）。注入格式：

```
<relevant-memories>
来源: 需求文档.pdf
---
[文件内容]
</relevant-memories>
```

---

## 8. 测试要点

- [ ] 拖拽上传 PDF → 列表出现 ⏳ → 刷新后变 ✅
- [ ] 粘贴 URL → 列表出现 🌐 → 可展开预览
- [ ] 点击「插入到对话」→ 输入框出现 `<relevant-memories>` 标签
- [ ] 删除资源 → confirm 确认 → 列表移除该项
- [ ] 切换平台（HIGO ↔ DeepSeek）→ 面包屑路径变化 → 列表内容变化
- [ ] 跨月切换 → 新月份自动创建目录
- [ ] OpenViking 未启动 → 顶部显示错误提示
- [ ] 上传 60MB 文件 → 前端拦截并提示超限

---

## 9. 未来扩展（预留，本次不实现）

- **Background Script 代理**: 替换 `DirectResourceService` 为 `BackgroundResourceService`，解决上传中断和 CSP 问题
- **自动轮询状态**: 对 ⏳ 状态资源自动 `fs/stat` 轮询，无需手动刷新
- **语义搜索**: 顶部搜索框支持 `search/find` 语义召回
- **文件夹浏览**: 支持点击进入子目录、新建文件夹、拖拽移动
- **Watch 任务**: 上传时可选 `watch_interval`，自动同步更新
