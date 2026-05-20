# 资源导入页面 FTP 化改造方案

## 背景

当前 EchoMem 扩展的「资源导入」页面存在以下问题：

1. 用户上传文件后，下方「已备份原始文件」列表显示的是 OpenViking 后端返回的临时文件名（如 `upload_a1b2c3d4.pdf`），而非用户原始文件名
2. `addResource` 接口虽然支持 `keep_original: true` 参数，但后端并未真正实现原始文件备份逻辑
3. 用户无法直观看到已上传到远程目录的文件列表，体验不像 FTP 客户端

## 目标

将资源导入页面改造成类似 FTP 客户端的体验：

- **上方**：保留现有拖拽/点击上传区域
- **下方**：实时显示远程目录 `viking://resources/echomem/_originals/` 下的文件列表，使用用户原始文件名
- 上传后自动调用 `addResource` 进行语义处理，同时保留原始文件备份

## 涉及项目

| 项目 | 路径 |
|------|------|
| EchoMem Web Extension | `/Users/xueyandong/Desktop/0-XYD-Mac/5-Code/10-plugin/EchoMEM-WEB-EXTENSION` |
| OpenViking | `/Users/xueyandong/Desktop/0-XYD-Mac/5-Code/0-github/OpenViking` |

---

## 一、OpenViking 后端修改

### 1.1 修改点概述

在 `addResource` 处理流程中，当 `keep_original: true` 时，在资源落盘完成后将原始文件复制到 `_originals/` 目录。

### 1.2 具体修改

#### 文件：`openviking/service/resource_service.py`

**修改 `add_resource` 方法**：在资源落盘成功后，增加 `keep_original` 处理逻辑。

当前代码在落盘成功后（约第 294 行）直接结束，需要在此处插入备份逻辑：

```python
# 在 result["temp_uri"] = root_uri 之后（约第 294 行）插入：

# keep_original: 备份原始文件到 _originals/
if kwargs.get("keep_original") and result.get("root_uri"):
    try:
        await self._backup_original_to_originals(
            source_path=path,
            root_uri=result["root_uri"],
            source_name=kwargs.get("source_name"),
            ctx=ctx,
        )
    except Exception as e:
        logger.warning(f"[ResourceService] keep_original backup failed: {e}")
        # 备份失败不影响主流程
```

**新增 `_backup_original_to_originals` 方法**：

```python
async def _backup_original_to_originals(
    self,
    source_path: str,
    root_uri: str,
    source_name: Optional[str],
    ctx: RequestContext,
) -> None:
    """将原始文件备份到 {parent}/_originals/ 目录下。

    Args:
        source_path: 原始文件路径（本地临时文件路径）
        root_uri: 资源最终落盘的 URI，如 viking://resources/echomem/my_doc
        source_name: 原始文件名（用户上传时的文件名）
        ctx: 请求上下文
    """
    viking_fs = self._viking_fs

    # 计算 parent URI: viking://resources/echomem/my_doc -> viking://resources/echomem
    parts = root_uri.rstrip("/").split("/")
    if len(parts) <= 3:
        # 资源在根目录下，无法创建 _originals
        return
    parent_uri = "/".join(parts[:-1])
    originals_uri = f"{parent_uri}/_originals"

    # 确定备份文件名
    backup_name = source_name or Path(source_path).name
    if not backup_name:
        return

    # 清理文件名中的非法字符
    backup_name = VikingURI.sanitize_segment(backup_name)

    # 确保 _originals 目录存在
    try:
        await viking_fs.mkdir(originals_uri, exist_ok=True, ctx=ctx)
    except Exception as e:
        logger.warning(f"[ResourceService] mkdir _originals failed: {e}")
        return

    # 目标备份 URI
    backup_uri = f"{originals_uri}/{backup_name}"

    # 如果目标已存在，追加序号
    backup_uri = await self._resolve_unique_backup_uri(backup_uri, viking_fs, ctx)

    # 复制原始文件
    try:
        src_path = viking_fs._uri_to_path(source_path, ctx=ctx)
        dst_path = viking_fs._uri_to_path(backup_uri, ctx=ctx)
        await asyncio.to_thread(viking_fs.agfs.cp, src_path, dst_path)
        logger.info(f"[ResourceService] Original file backed up: {source_path} -> {backup_uri}")
    except Exception as e:
        logger.warning(f"[ResourceService] Copy original file failed: {e}")
        raise

async def _resolve_unique_backup_uri(
    self, uri: str, viking_fs, ctx, max_attempts: int = 100
) -> str:
    """如果备份 URI 已存在，自动追加 _1, _2 等序号。"""
    async def _exists(u: str) -> bool:
        try:
            await viking_fs.stat(u, ctx=ctx)
            return True
        except Exception:
            return False

    if not await _exists(uri):
        return uri

    base, ext = os.path.splitext(uri)
    for i in range(1, max_attempts + 1):
        candidate = f"{base}_{i}{ext}"
        if not await _exists(candidate):
            return candidate

    raise FileExistsError(f"Cannot resolve unique backup name for {uri}")
```

### 1.3 关键设计决策

| 决策 | 说明 |
|------|------|
| 备份位置 | `{parent}/_originals/`，与资源目录同级。例如资源在 `viking://resources/echomem/my_doc`，则备份到 `viking://resources/echomem/_originals/my_file.pdf` |
| 备份时机 | 资源落盘成功后（Phase 3.5 之后），失败不影响主流程 |
| 文件名冲突 | 自动追加 `_1`, `_2` 序号 |
| 文件名清理 | 使用 `VikingURI.sanitize_segment` 清理非法字符 |
| source_name 优先级 | 优先使用 `source_name`（用户原始文件名），fallback 到 `Path(source_path).name` |

---

## 二、EchoMem 前端修改

### 2.1 修改点概述

改造 `src/panels/resource/import.js`：

1. 保留上方上传区域
2. 下方改为显示 `viking://resources/echomem/_originals/` 目录的远程文件列表
3. 列表使用用户原始文件名
4. 支持删除操作
5. 上传完成后自动刷新列表

### 2.2 具体修改

#### 文件：`src/panels/resource/import.js`

**HTML 结构调整**：

```javascript
export function getResourceImportContent() {
  return `
    <div style="display: flex; flex-direction: column; gap: 12px; color: #333;">
      <!-- 本地文件上传 -->
      <div>
        <p style="font-weight: 600; font-size: 14px; margin-bottom: 8px;">📁 本地文件上传</p>
        <div id="claw-resource-dropzone" style="...">
          <!-- 保持现有样式 -->
        </div>
      </div>

      <!-- 状态提示 -->
      <div id="claw-resource-import-status" style="display: none;"></div>

      <!-- 处理结果区 -->
      <div id="claw-resource-import-result" style="display: none;"></div>

      <!-- 远程文件列表（FTP 风格） -->
      <div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <p style="font-weight: 600; font-size: 14px; margin: 0;">📂 远程文件</p>
          <p style="font-size: 11px; color: #888; margin: 0;">viking://resources/echomem/_originals/</p>
        </div>
        <div id="claw-remote-list-loading" style="text-align: center; padding: 16px; color: #888; font-size: 12px;">⏳ 正在加载...</div>
        <div id="claw-remote-list-content" style="display: none;"></div>
      </div>
    </div>
  `;
}
```

**新增 `loadRemoteFileList` 函数**：

```javascript
async function loadRemoteFileList() {
  if (!backupLoadingEl || !backupContentEl) return;
  backupLoadingEl.style.display = 'block';
  backupContentEl.style.display = 'none';

  try {
    const client = createClient(await getOpenVikingConfig());
    const originalsUri = getOriginalsDirUri(); // viking://resources/echomem/_originals/

    // 确保目录存在
    try {
      await client.fsMkdir(originalsUri, 'Original file backups');
    } catch (mkdirErr) {
      if (!mkdirErr.message?.toLowerCase().includes('exist')) {
        console.warn('EchoMem: mkdir _originals warning', mkdirErr.message);
      }
    }

    const lsResult = await client.fsLs(originalsUri, { output: 'agent', absLimit: 128 });
    const entries = Array.isArray(lsResult) ? lsResult : (lsResult?.entries || []);

    // 过滤掉 .abstract.md 等隐藏文件
    const fileEntries = entries.filter(e => {
      const name = e.name || '';
      return !name.startsWith('.') && !name.startsWith('_');
    });

    if (fileEntries.length === 0) {
      // 显示空状态
      backupLoadingEl.style.display = 'none';
      backupContentEl.style.display = 'block';
      backupContentEl.innerHTML = `
        <div style="text-align: center; padding: 16px; color: #999; font-size: 12px;">
          <p>📂 暂无文件</p>
        </div>
      `;
      return;
    }

    // 获取每个文件的 stat 信息
    const enrichedEntries = await Promise.all(
      fileEntries.map(async (entry) => {
        try {
          const stat = await client.fsStat(entry.uri);
          return { ...entry, stat };
        } catch {
          return { ...entry, stat: null };
        }
      })
    );

    // 按修改时间倒序
    enrichedEntries.sort((a, b) => {
      const ta = a.stat?.modTime ? new Date(a.stat.modTime).getTime() : 0;
      const tb = b.stat?.modTime ? new Date(b.stat.modTime).getTime() : 0;
      return tb - ta;
    });

    // 渲染 FTP 风格列表
    const itemsHtml = enrichedEntries.map((entry) => {
      const name = entry.name || entry.uri?.split('/').pop() || '未命名';
      const size = formatSize(entry.stat?.size);
      const date = formatDate(entry.stat?.modTime);

      return `
        <div class="claw-remote-item" data-uri="${entry.uri}" style="...">
          <span style="flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"
            title="${name}">${name}</span>
          <span style="color: #6b7280; white-space: nowrap; width: 70px; text-align: right;">${size}</span>
          <span style="color: #9ca3af; white-space: nowrap; width: 90px; text-align: right;">${date}</span>
          <button class="claw-remote-btn-delete" data-uri="${entry.uri}" style="...">删除</button>
        </div>
      `;
    }).join('');

    backupLoadingEl.style.display = 'none';
    backupContentEl.style.display = 'block';
    backupContentEl.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 4px;">
        ${itemsHtml}
      </div>
    `;

    // 绑定删除事件
    // ...（同现有逻辑）
  } catch (err) {
    // 错误处理
  }
}
```

**修改 `doUpload` 函数**：上传完成后刷新远程列表

```javascript
async function doUpload(file) {
  clearActivePoll();
  hideResult();
  showStatus('正在上传...', 'info');

  try {
    const config = await getOpenVikingConfig();
    const client = createClient(config);

    // Step 1: temp upload
    const uploadResult = await client.tempUpload(file);
    const tempFileId = uploadResult?.temp_file_id;
    if (!tempFileId) throw new Error('上传失败：未返回临时文件 ID');

    // 确保目标目录存在
    const parentUri = getResourceDirUri(); // viking://resources/echomem/
    try {
      await client.fsMkdir(parentUri, 'EchoMem resources');
    } catch (mkdirErr) {
      if (!mkdirErr.message?.toLowerCase().includes('exist')) {
        console.warn('EchoMem: mkdir warning', mkdirErr.message);
      }
    }

    // Step 2: add resource（异步，keepOriginal: true）
    showStatus('文件已上传，正在提交处理...', 'info');
    const addResult = await client.addResource({
      tempFileId,
      parent: parentUri,
      wait: false,
      sourceName: file.name,  // 传递原始文件名
      keepOriginal: true,
    });

    const resourceUri = addResult?.root_uri || `${parentUri}/${file.name}`;
    showStatus(`✅ 「${file.name}」已提交，开始轮询处理状态...`, 'success');

    // Step 3: 刷新远程文件列表
    await loadRemoteFileList();

    // Step 4: 开始轮询处理状态
    pollResourceStatus(resourceUri, file.name);
  } catch (err) {
    showStatus(`❌ 上传失败: ${formatError(err)}`, 'error');
  }
}
```

### 2.3 样式设计

远程文件列表采用 FTP 客户端风格：

```
┌─────────────────────────────────────────────────────────┐
│ 文件名                    大小       日期        操作   │
├─────────────────────────────────────────────────────────┤
│ report.pdf                2.3 MB    2026-05-19   [删除] │
│ notes.md                  12 KB     2026-05-18   [删除] │
│ data.xlsx                 156 KB    2026-05-17   [删除] │
└─────────────────────────────────────────────────────────┘
```

---

## 三、数据流

```
用户选择文件
    │
    ▼
┌─────────────────┐
│  tempUpload()   │ ──→ 上传临时文件，返回 temp_file_id
└─────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│  addResource({                          │
│    tempFileId,                          │
│    parent: "viking://resources/echomem/",│
│    sourceName: "report.pdf",            │
│    keepOriginal: true                   │
│  })                                     │
└─────────────────────────────────────────┘
    │
    ├──→ OpenViking 处理资源（语义提取、向量化）
    │
    └──→ 落盘到 viking://resources/echomem/report_pdf/
         │
         └──→ keep_original=true: 复制原始文件到
               viking://resources/echomem/_originals/report.pdf
    │
    ▼
前端调用 fsLs("viking://resources/echomem/_originals/")
    │
    ▼
显示远程文件列表（真实文件名）
```

---

## 四、验收标准

| 编号 | 验收项 | 标准 |
|------|--------|------|
| 1 | 上传文件 | 用户可以通过点击或拖拽上传文件，上传区域样式不变 |
| 2 | 原始文件名保留 | `_originals/` 目录下的文件名与用户上传时的文件名一致 |
| 3 | 文件列表显示 | 下方列表实时显示 `_originals/` 目录下的所有文件，包含文件名、大小、日期 |
| 4 | 列表刷新 | 上传完成后列表自动刷新，新文件出现在列表顶部 |
| 5 | 删除功能 | 点击删除按钮可以删除远程文件，删除后列表自动刷新 |
| 6 | 异步处理 | `addResource` 保持异步模式（`wait: false`），上传不阻塞 |
| 7 | 轮询状态 | 上传后仍然轮询资源处理状态，处理完成后可插入对话 |
| 8 | 空状态 | 当 `_originals/` 目录为空时，显示友好的空状态提示 |
| 9 | 错误处理 | 网络错误、认证错误等场景有明确的错误提示 |

---

---

## 五、V2 迭代：文件夹浏览功能

### 5.1 需求

用户希望在远程文件列表中：
1. **显示文件夹**（子目录），带 📁 图标
2. **点击进入文件夹**，浏览子目录内容
3. **返回上级目录**
4. **上传文件到当前浏览的目录**

### 5.2 根目录变更

**V1 根目录**：`viking://resources/echomem/_originals/`

**V2 根目录**：`viking://resources/echomem/`

变更原因：`_originals/` 只是存放原始文件备份的子目录，用户应该能看到完整的目录结构，包括资源文件夹和 `_originals/` 文件夹。

### 5.3 目录结构示例

```
viking://resources/echomem/              ← 根目录
├── _originals/                          ← 根目录上传的原始文件备份
│   ├── report.pdf
│   └── notes.md
├── report_pdf/                          ← 根目录上传的资源（提取后的内容）
│   ├── .abstract.md
│   └── .overview.md
├── notes_md/                            ← 根目录上传的资源（提取后的内容）
├── project_a/                           ← 用户创建的子文件夹
│   ├── _originals/                      ← 在 project_a 下上传的原始文件备份
│   ├── doc1_pdf/                        ← 在 project_a 下上传的资源
│   └── doc2_md/                         ← 在 project_a 下上传的资源
└── project_b/                           ← 另一个子文件夹
    ├── _originals/
    └── ...
```

### 5.4 页面布局

```
┌─────────────────────────────────────────────────────────┐
│ 📂 远程文件                    viking://resources/echomem/│
├─────────────────────────────────────────────────────────┤
│ ← 返回上级                                              │
├─────────────────────────────────────────────────────────┤
│ 📁 _originals/                           2026-05-20     │
│ 📁 report_pdf/                           2026-05-20     │
│ 📁 notes_md/                             2026-05-19     │
│ 📁 project_a/                            2026-05-18     │
│ 📁 project_b/                            2026-05-17     │
└─────────────────────────────────────────────────────────┘
```

### 5.5 前端修改

#### 状态管理

```javascript
// 当前浏览的目录，初始为 echomem/（根目录）
let currentDirUri = getRootDirUri();  // viking://resources/echomem/

// 返回上级
function getParentUri(uri) {
  return uri.replace(/\/$/, '').split('/').slice(0, -1).join('/') + '/';
}
```

#### HTML 结构调整

- 标题区域：增加当前路径显示
- 列表上方：增加"← 返回上级"按钮（根目录时隐藏）
- 列表项：区分文件夹和文件
  - 文件夹：📁 + 名称 + 日期，点击进入
  - 文件：📄 + 名称 + 大小 + 日期 + 删除按钮

#### `loadRemoteFileList(dirUri)` 改造

```javascript
async function loadRemoteFileList(dirUri = currentDirUri) {
  currentDirUri = dirUri;

  // 更新路径显示
  pathEl.textContent = dirUri;

  // 显示/隐藏返回按钮（根目录时隐藏）
  backBtn.style.display = dirUri === getRootDirUri() ? 'none' : 'flex';

  // 加载逻辑...
  const entries = await client.fsLs(dirUri, { output: 'agent', absLimit: 128 });

  // 分离文件夹和文件
  const dirs = entries.filter(e => e.isDir);
  const files = entries.filter(e => !e.isDir);

  // 渲染：文件夹在前，文件在后
}
```

#### 上传逻辑修改

```javascript
async function doUpload(file) {
  // 上传到当前浏览的目录
  const targetDir = currentDirUri;

  const addResult = await client.addResource({
    tempFileId,
    parent: targetDir,  // 使用当前目录
    wait: false,
    sourceName: file.name,
    keepOriginal: true,
  });

  // 刷新当前目录列表
  await loadRemoteFileList();
}
```

### 5.6 交互设计

| 操作 | 行为 |
|------|------|
| 点击 📁 文件夹 | 进入该文件夹，加载其内容 |
| 点击 ← 返回上级 | 返回上级目录 |
| 点击 📄 文件 | 无操作（或预览） |
| 点击删除按钮 | 删除该文件，刷新列表 |
| 上传文件 | 上传到当前浏览的目录 |

### 5.7 验收标准（V2 新增）

| 编号 | 验收项 | 标准 |
|------|--------|------|
| 10 | 根目录变更 | 根目录为 `viking://resources/echomem/`，而非 `_originals/` |
| 11 | 显示文件夹 | 列表中正确显示子文件夹，带 📁 图标 |
| 12 | 点击进入文件夹 | 点击文件夹后进入该目录，显示其内容 |
| 13 | 返回上级 | 非根目录时显示返回按钮，点击返回上级 |
| 14 | 路径显示 | 顶部显示当前完整路径 |
| 15 | 上传位置 | 文件上传到当前浏览的目录，原始文件备份到该目录的 `_originals/` 下 |

---

## 六、V3 迭代：隐藏文件、过滤与新建文件夹

### 6.1 需求

1. **显示隐藏文件**：OpenViking 后端 `_ls_agent` 默认过滤以 `.` 开头的隐藏文件，导致 `.abstract.md`、`.overview.md` 等文件不显示
2. **过滤 `.DS_Store`**：macOS 系统会在目录中自动生成 `.DS_Store` 文件，用户不希望看到它
3. **新建文件夹**：用户需要在当前目录下创建子文件夹，以便更好地组织文件
4. **美观的输入对话框**：浏览器原生 `prompt` 样式不美观，需要与现有 UI 风格一致的对话框

### 6.2 显示隐藏文件

**前端修改** (`import.js`)：

```javascript
const lsResult = await client.fsLs(dirUri, {
  output: 'agent',
  absLimit: 128,
  showAllHidden: true  // 新增：显示隐藏文件
});
```

**后端逻辑**：OpenViking 的 `_ls_agent` 方法在 `show_all_hidden=true` 时不过滤以 `.` 开头的文件。

### 6.3 过滤 `.DS_Store`

**前端修改** (`import.js`)：

```javascript
let entries = Array.isArray(lsResult) ? lsResult : (lsResult?.entries || []);
entries = entries.filter((e) => (e.name || e.uri?.split('/').pop() || '') !== '.DS_Store');
```

### 6.4 新建文件夹

#### UI 布局

在「返回上级」按钮旁边添加「+ 新建文件夹」按钮：

```
┌─────────────────────────────────────────────────────────┐
│ 📂 远程文件                    viking://resources/echomem/│
├─────────────────────────────────────────────────────────┤
│ ← 返回上级    + 新建文件夹                              │
├─────────────────────────────────────────────────────────┤
│ 📁 _originals/                           2026-05-20     │
│ 📁 project_a/                            2026-05-18     │
│ 📄 report.pdf              2.3 MB        2026-05-20  删除│
└─────────────────────────────────────────────────────────┘
```

#### 居中浮层对话框

点击「+ 新建文件夹」后打开居中浮层（使用 `openCenterOverlay`）：

```
┌─────────────────────────────┐
│ 新建文件夹              [×]  │
├─────────────────────────────┤
│  文件夹名称                 │
│  ┌─────────────────────┐   │
│  │ 请输入文件夹名称    │   │
│  └─────────────────────┘   │
│                            │
│              [取消] [确定]  │
└─────────────────────────────┘
```

**实现细节**：

- 浮层尺寸：`360px × auto`（约原默认尺寸的 1/3）
- 支持 Enter 确认、Escape 取消
- 空名称或含斜杠时显示红色错误提示
- 创建中按钮显示「创建中...」并禁用

#### `panel-host.js` 扩展

`openCenterOverlay` 新增支持自定义尺寸参数：

```javascript
export function openCenterOverlay(title, contentHtml, options = {}) {
  const {
    showBack = false,
    onBack = null,
    width,      // 自定义宽度，默认 '85vw'
    height,     // 自定义高度，默认 '80vh'
    maxWidth,   // 自定义最大宽度，默认 '1000px'
    maxHeight   // 自定义最大高度，默认 '700px'
  } = options;
  // ...
}
```

#### 调用示例

```javascript
openCenterOverlay('新建文件夹', dialogHtml, {
  showBack: false,
  width: '360px',
  maxWidth: '360px',
  height: 'auto',
  maxHeight: '240px'
});
```

### 6.5 验收标准（V3 新增）

| 编号 | 验收项 | 标准 |
|------|--------|------|
| 16 | 显示隐藏文件 | `.abstract.md`、`.overview.md` 等隐藏文件正确显示 |
| 17 | 过滤 `.DS_Store` | `.DS_Store` 文件不在列表中显示 |
| 18 | 新建文件夹按钮 | 远程文件列表区域显示「+ 新建文件夹」按钮 |
| 19 | 新建文件夹对话框 | 点击按钮后弹出居中浮层，包含输入框和取消/确定按钮 |
| 20 | 文件夹创建 | 输入合法名称后点击确定，在当前目录创建文件夹并刷新列表 |
| 21 | 输入校验 | 空名称或含斜杠时显示红色错误提示，不关闭对话框 |
| 22 | 键盘支持 | Enter 确认，Escape 取消 |
| 23 | 浮层尺寸 | 新建文件夹浮层大小约为认知反馈浮层的 1/3 |

---

## 七、风险与注意事项

1. **OpenViking 后端 `agfs.cp` 方法**：需要确认 `agfs` 客户端是否支持 `cp` 操作。如果不支持，可能需要改用 `shutil.copy2` 或其他方式。

2. **文件名冲突**：当用户上传同名文件时，后端会自动追加 `_1`, `_2` 序号，前端列表会如实显示。

3. **目录权限**：确保 EchoMem 扩展配置的 OpenViking 账号有权限读写 `viking://resources/echomem/` 目录。

4. **向后兼容**：`keep_original` 默认为 `false`，不影响现有行为。

5. **文件夹删除**：当前版本不支持删除文件夹，仅支持删除文件。如需删除文件夹，需要递归删除（`fsRm(uri, true)`），风险较高，暂不实现。
