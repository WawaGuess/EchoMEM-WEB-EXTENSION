# 资源导入 FTP 化改造 — 代码实现逻辑文档

> 文档版本：V3（对应 proposals/2026-05-19-resource-import-ftp-like.md V3）
> 更新日期：2026-05-20

---

## 一、项目概述

本次改造涉及两个项目：

| 项目 | 路径 | 角色 |
|------|------|------|
| EchoMEM Web Extension | `EchoMEM-WEB-EXTENSION/` | Chrome 扩展前端（Manifest V3） |
| OpenViking | `OpenViking/` | AI 资源处理后端 |

**核心目标**：将 EchoMEM 扩展的「资源导入」页面改造成类似 FTP 客户端的体验，支持文件上传、目录浏览、文件夹创建，同时保留用户上传的原始文件备份。

---

## 二、EchoMEM 前端修改

### 2.1 修改文件列表

| 文件 | 修改类型 | 说明 |
|------|---------|------|
| `src/core/panel-host.js` | 增强 | `openCenterOverlay` 支持自定义尺寸参数 |
| `src/core/router.js` | 调整 | 导航到 resources 面板时自动初始化导入面板 |
| `src/panels/registry.js` | 调整 | 资源面板入口改为 `import.js` |
| `src/panels/resource/import.js` | **重写** | 核心：上传、轮询、文件浏览、删除、新建文件夹 |
| `src/services/openviking-client.js` | 增强 | `addResource` 新增 `keepOriginal` 字段透传 |

### 2.2 各文件详细修改

#### `src/core/panel-host.js`

**修改点**：`openCenterOverlay` 函数的 `options` 参数新增四个可选字段

```javascript
export function openCenterOverlay(title, contentHtml, options = {}) {
  const {
    showBack = false,
    onBack = null,
    width,      // 新增：自定义宽度
    height,     // 新增：自定义高度
    maxWidth,   // 新增：自定义最大宽度
    maxHeight   // 新增：自定义最大高度
  } = options;
  // ...
}
```

**用途**：支持「新建文件夹」等小尺寸居中对话框（360x240px），同时保持认知反馈等大浮层的默认尺寸不变。

---

#### `src/panels/resource/import.js`（核心文件）

**功能模块**：

1. **本地文件上传区域**
   - 点击或拖拽上传（支持 PDF, DOC, TXT, MD）
   - 文件选择后调用 `doUpload(file)` 执行上传流程

2. **异步上传与轮询流程**

   ```
   Step 1: tempUpload(file)     → POST /api/v1/resources/temp_upload
           返回 temp_file_id

   Step 2: addResource({        → POST /api/v1/resources
             tempFileId,
             parent: currentDirUri,
             wait: false,
             sourceName: file.name,
             keepOriginal: true
           })
           返回 root_uri

   Step 3: loadRemoteFileList() → GET /api/v1/fs/ls
           刷新当前目录文件列表

   Step 4: pollResourceStatus() → GET /api/v1/content/abstract
           每 5 秒轮询，最多 120 次
           检查资源处理是否完成
   ```

3. **远程文件浏览**
   - 根目录：`viking://resources/echomem/`
   - 支持点击进入子文件夹、返回上级
   - 文件夹和文件分开展示（文件夹在上），按修改时间倒序
   - 显示隐藏文件（`showAllHidden: true`）
   - 过滤 `.DS_Store`

4. **文件删除**
   - 点击删除按钮 → `confirm()` 确认 → `fsRm(uri, false)` → 刷新列表

5. **新建文件夹**
   - 点击「+ 新建文件夹」→ 打开居中浮层（360x240px）
   - 输入名称 → 校验（非空、不含斜杠）→ `fsMkdir(targetUri)` → 刷新列表
   - 支持 Enter 确认、Escape 取消

**关键状态变量**：

```javascript
let currentDirUri = 'viking://resources/echomem/';  // 当前浏览目录
let activePollTimer = null;                          // 轮询定时器
```

---

#### `src/services/openviking-client.js`

**修改点**：`addResource` 方法请求 body 中新增 `keep_original` 字段

```javascript
body: JSON.stringify({
  // ... 其他字段
  keep_original: options.keepOriginal ?? false,
}),
```

---

## 三、OpenViking 后端修改

### 3.1 修改文件列表

| 文件 | 修改类型 | 说明 |
|------|---------|------|
| `openviking/server/routers/resources.py` | 增强 | `AddResourceRequest` 新增 `keep_original` 字段 |
| `openviking/service/resource_service.py` | **新增功能** | `keep_original` 原始文件备份逻辑 |

### 3.2 各文件详细修改

#### `openviking/server/routers/resources.py`

**修改 1**：`AddResourceRequest` 模型新增字段

```python
class AddResourceRequest(BaseModel):
    # ... 原有字段
    keep_original: bool = False   # 新增
```

**修改 2**：`add_resource` 接口透传字段

```python
kwargs = {
    # ... 其他字段
    "keep_original": request.keep_original,   # 新增
}
```

---

#### `openviking/service/resource_service.py`

**新增功能**：`keep_original` 原始文件备份

**执行流程**：

```
add_resource() 被调用
    │
    ├── 如果 kwargs.get("keep_original") 为 True:
    │   └── 预读取原始文件字节到内存
    │       original_file_bytes = await asyncio.to_thread(Path(path).read_bytes)
    │
    ├── 调用 _resource_processor.process_resource(...) 进行正常处理
    │   （语义提取、向量化、落盘）
    │
    └── 处理完成后，如果 keep_original=True 且成功:
        └── 调用 _backup_original_to_originals(...)
            ├── 计算 parent URI（去掉 root_uri 最后一级）
            ├── 备份目录 = {parent_uri}/_originals
            ├── 确保目录存在（mkdir exist_ok=True）
            ├── 清理文件名非法字符（VikingURI.sanitize_segment）
            ├── 解决文件名冲突（自动追加 _1, _2 序号）
            └── 写入原始文件字节（viking_fs.write_file_bytes）
```

**关键设计决策**：

| 决策 | 说明 |
|------|------|
| 预读取时机 | 在 `process_resource` **之前**预读取，因为临时文件处理后会被删除 |
| 读取方式 | 使用 `Path(path).read_bytes()` 直接读取本地文件，不通过 `viking_fs` |
| 备份位置 | `{parent}/_originals/`，与资源目录同级 |
| 文件名来源 | 优先使用 `source_name`（用户原始文件名），fallback 到路径名 |
| 文件名冲突 | 自动追加 `_1`, `_2` 等序号 |
| 失败处理 | 备份失败仅记录 warning，不影响主流程 |

---

## 四、HTTP 接口清单

EchoMEM 前端调用的所有 OpenViking HTTP 接口：

| 接口路径 | 方法 | 用途 | 调用位置 | 关键参数 |
|---------|------|------|---------|---------|
| `/api/v1/resources/temp_upload` | POST | 临时上传本地文件 | `tempUpload()` | `file: FormData` |
| `/api/v1/resources` | POST | 添加资源（触发语义提取） | `addResource()` | `temp_file_id`, `parent`, `source_name`, `keep_original` |
| `/api/v1/fs/ls` | GET | 列出目录内容 | `fsLs()` | `uri`, `show_all_hidden` |
| `/api/v1/fs/stat` | GET | 获取文件/目录元信息 | `fsStat()` | `uri` |
| `/api/v1/fs/mkdir` | POST | 创建目录 | `fsMkdir()` | `uri`, `description` |
| `/api/v1/fs` | DELETE | 删除文件/目录 | `fsRm()` | `uri`, `recursive` |
| `/api/v1/content/abstract` | GET | 获取资源摘要（轮询状态） | `contentAbstract()` | `uri` |
| `/api/v1/search/find` | POST | 语义搜索 | `find()` | `query`, `target_uri` |
| `/health` | GET | 健康检查 | `healthCheck()` | - |

---

## 五、整体数据流

```
┌─────────────────────────────────────────────────────────────────────┐
│                         用户操作（EchoMEM 扩展）                      │
└─────────────────────────────────────────────────────────────────────┘
    │
    ▼
点击上传 / 拖拽文件
    │
    ▼
┌─────────────────────────────────────────────────────────────────────┐
│  1. tempUpload(file)                                                │
│     ──POST /api/v1/resources/temp_upload──▶ OpenViking              │
│     返回 temp_file_id                                               │
└─────────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────────┐
│  2. addResource({                                                   │
│       tempFileId,                                                   │
│       parent: currentDirUri,    ← 当前浏览的目录                    │
│       wait: false,              ← 异步，不阻塞                      │
│       sourceName: file.name,    ← 用户原始文件名                    │
│       keepOriginal: true        ← 保留原始文件                      │
│     })                                                              │
│     ──POST /api/v1/resources──▶ OpenViking                          │
│     返回 root_uri                                                   │
└─────────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────────┐
│  3. loadRemoteFileList()                                            │
│     ──GET /api/v1/fs/ls──▶ OpenViking                               │
│     参数: show_all_hidden=true                                      │
│     刷新当前目录文件列表                                            │
└─────────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────────┐
│  4. pollResourceStatus(resourceUri, fileName)                       │
│     ──GET /api/v1/content/abstract──▶ OpenViking                    │
│     每 5 秒检查一次，最多 120 次（约 10 分钟）                       │
│     直到返回内容不含 "not ready"                                    │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                    OpenViking 后端处理（异步）                        │
└─────────────────────────────────────────────────────────────────────┘
    │
    ├── 如果 keep_original=true:
    │   └── 预读取原始文件字节到内存（Path.read_bytes）
    │
    ├── 调用 ResourceProcessor.process_resource()
    │   ├── 解析文件内容
    │   ├── 语义提取、向量化
    │   └── 落盘到 viking://resources/echomem/{resource_name}/
    │
    └── 处理完成后，如果 keep_original=true:
        └── 备份原始文件到 {parent}/_originals/{filename}
            ├── 创建 _originals/ 目录
            ├── 清理文件名
            ├── 解决冲突（_1, _2...）
            └── 写入文件字节
```

---

## 六、目录结构示例

用户上传 `report.pdf` 到 `viking://resources/echomem/` 后：

```
viking://resources/echomem/                    ← 根目录
├── _originals/                                ← 原始文件备份目录
│   └── report.pdf                             ← 用户上传的原始文件
├── report_pdf/                                ← OpenViking 处理后的资源
│   ├── .abstract.md                           ← 摘要（隐藏文件）
│   └── .overview.md                           ← 概览（隐藏文件）
└── project_a/                                 ← 用户创建的子文件夹
    ├── _originals/
    └── ...
```

---

## 七、验收标准对应

| 编号 | 验收项 | 实现方式 |
|------|--------|---------|
| 1 | 上传文件 | `tempUpload` + `addResource` |
| 2 | 原始文件名保留 | `sourceName` + `keepOriginal` |
| 3 | 文件列表显示 | `fsLs` + `fsStat` |
| 4 | 列表刷新 | 上传成功后调用 `loadRemoteFileList` |
| 5 | 删除功能 | `fsRm` + 确认对话框 |
| 6 | 异步处理 | `wait: false` |
| 7 | 轮询状态 | `contentAbstract` 每 5 秒轮询 |
| 8 | 空状态 | 列表为空时显示友好提示 |
| 9 | 错误处理 | `formatError` 统一格式化错误信息 |
| 10 | 根目录变更 | `getRootDirUri()` 返回 `echomem/` |
| 11 | 显示文件夹 | `fsLs` 返回的 `isDir` 条目 |
| 12 | 点击进入文件夹 | `loadRemoteFileList(uri + '/')` |
| 13 | 返回上级 | `getParentUri()` + `loadRemoteFileList(parent)` |
| 14 | 路径显示 | `pathEl.textContent = currentDirUri` |
| 15 | 上传位置 | `parent: currentDirUri` |
| 16 | 显示隐藏文件 | `showAllHidden: true` |
| 17 | 过滤 `.DS_Store` | `entries.filter(...)` |
| 18 | 新建文件夹按钮 | UI 中添加按钮 |
| 19 | 新建文件夹对话框 | `openCenterOverlay` 居中浮层 |
| 20 | 文件夹创建 | `fsMkdir` + 刷新列表 |
| 21 | 输入校验 | 非空 + 不含斜杠校验 |
| 22 | 键盘支持 | Enter / Escape 事件监听 |
| 23 | 浮层尺寸 | `width: 360px, maxHeight: 240px` |
