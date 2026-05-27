# Skill 上传创建功能方案

## 状态

Draft

## 背景

EchoMEM 扩展的「Skill 商店」面板目前已有一个「上传 Skill」的 UI 占位区域，但只有拖拽区域的视觉骨架，没有真实的上传逻辑和后端交互。用户无法将本地编写的 SKILL.md 文件或 Skill 压缩包上传到 OpenViking。

OpenViking 后端已具备完整的 Skill 处理能力（解析、VLM 概述生成、VikingFS 落盘、向量化索引），且暴露了 `POST /api/v1/skills` 接口，前端只需补齐上传流程即可对接。

## 目标

1. 支持用户在 EchoMEM 扩展中上传本地 SKILL.md 单文件到 OpenViking。
2. 支持用户上传 zip 压缩包（内含 SKILL.md 及附件）到 OpenViking。
3. 上传成功后自动刷新 Skill 列表。
4. 提供清晰的上传状态反馈（成功/失败/校验错误）。

## 非目标

1. 不实现 Skill 的在线编辑功能（本方案只覆盖「上传创建」）。
2. 不实现 Skill 版本管理（覆盖同名 Skill 的行为由 OpenViking 后端决定，前端不额外处理）。
3. 不实现上传进度条（文件通常较小，使用 loading 状态即可）。
4. 不修改 OpenViking 后端代码（完全复用现有接口）。

## 方案

### 1. 整体流程

用户选择文件 → 前端基础校验 → 临时文件上传 → 调用 add_skill → 刷新列表

```
用户选择 .md 文件 或 .zip 文件
    │
    ▼
前端校验（文件大小、frontmatter 格式）
    │
    ▼
POST /api/v1/resources/temp_upload
    │  返回 temp_file_id
    ▼
POST /api/v1/skills
    │  { temp_file_id, wait: false }
    ▼
服务端处理（解析 → 概述生成 → 落盘 → 索引）
    │
    ▼
返回 { status, uri, name, auxiliary_files }
    │
    ▼
前端刷新 Skill 列表 + Toast 提示
```

### 2. Zip 结构要求

OpenViking 的 `SkillProcessor` 在服务端会自动解压 zip 并查找 `SKILL.md`。

- **正确**：zip 根目录下直接包含 `SKILL.md`
- **错误**：zip 内多套一层目录（如 GitHub 源码包），会导致解析失败

前端可在用户选择 zip 后给出提示，告知正确的打包方式。

### 3. 前端修改

#### 3.1 新增依赖

无需新增依赖，复用现有的 `openviking-client.js` 的 `tempUpload` 方法。

#### 3.2 `src/services/openviking-client.js` 新增方法

```javascript
async addSkill(options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), this.cfg.timeoutMs);

  try {
    const headers = this._buildHeaders();
    const response = await fetch(`${this.cfg.baseUrl}/api/v1/skills`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        data: options.data || undefined,
        temp_file_id: options.tempFileId || undefined,
        wait: options.wait ?? false,
        timeout: options.timeout || undefined,
      }),
      signal: controller.signal,
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.status === 'error') {
      throw new Error(data.error?.message || `HTTP ${response.status}`);
    }
    return data.result || data;
  } finally {
    clearTimeout(timer);
  }
}
```

#### 3.3 `src/panels/skill-store/index.js` 上传区域改造

当前占位 UI 替换为真实上传逻辑：

- 文件选择器：`accept=".md,.txt,.zip,.skill"`
- 拖拽区域：复用现有视觉，绑定 `drop` 事件
- 上传按钮：点击触发 `doUpload(file)`
- 状态显示：上传中禁用按钮，显示 loading

**核心上传函数**：

```javascript
async function doUpload(file) {
  try {
    const uploadResult = await ovClient.tempUpload(file);
    const skillResult = await ovClient.addSkill({
      tempFileId: uploadResult.temp_file_id,
      wait: false,
    });
    await loadSkillList();   // 刷新列表
    showToast(`Skill「${skillResult.name}」上传成功`);
  } catch (err) {
    showToast(`上传失败: ${err.message}`, 'error');
  }
}
```

### 4. 前端校验（可选）

对于单文件 `.md`，可在上传前做轻量校验：

- 文件大小 < 10MB
- 内容以 `---` 开头（有 YAML frontmatter）
- frontmatter 中包含 `name` 字段

校验失败时立即提示，减少无效请求。

### 5. 错误处理

| 错误场景 | 提示文案 |
|---------|---------|
| 文件超过 10MB | 文件过大，请压缩附件后重试 |
| 缺少 frontmatter | SKILL.md 必须以 `---` 开头 |
| 缺少 name 字段 | frontmatter 中必须包含 `name` |
| zip 内无 SKILL.md | zip 根目录下必须包含 SKILL.md |
| 网络/服务端错误 | 上传失败: {具体错误信息} |

## 前端显式提示

以下限制和注意事项必须在 UI 中显式展示给用户：

| 限制/注意点 | 代码来源 | 前端提示位置与文案 |
|-------------|---------|-------------------|
| **Zip 结构要求** | `skill_processor.py:176`：目录下必须有 `SKILL.md` | 拖拽区域下方提示：「zip 根目录下必须直接包含 SKILL.md，不能套在子文件夹里」 |
| **zip 多套一层目录会失败** | 常见 GitHub 下载包格式 | 选择 zip 后弹窗提示：「检测到 zip 内包含子目录，请解压后重新打包，确保 SKILL.md 在根目录」 |
| **文件大小限制** | 浏览器/扩展限制 + 体验考虑 | 文件选择器下方：「单个文件不超过 10MB」 |
| **temp 文件 1 小时清理** | `resources.py:120-138`：`_cleanup_temp_files(max_age_hours=1)` | 上传失败后提示：「上传超时，请重新选择文件上传（临时文件将在 1 小时后自动清理）」 |
| **不能直接传文件路径** | `local_input_guard.py:47-53`：拒绝本地路径字符串 | 无需提示（前端不会走这条路径，仅通过文件选择器读取 File 对象） |
| **SKILL.md 必须有 name 字段** | `skill_processor.py` 解析依赖 | 校验失败提示：「SKILL.md 的 frontmatter 中必须包含 `name` 字段」 |
| **前端校验仅供参考** | 校验为辅助性质 | 校验提示末尾加：「前端校验仅供参考，最终格式以服务端解析为准」 |
| **同名 Skill 覆盖** | OpenViking 写入行为 | 上传确认弹窗：「如存在同名 Skill，将直接覆盖，是否继续？」 |

## 影响范围

| 文件 | 修改类型 | 说明 |
|------|---------|------|
| `src/services/openviking-client.js` | 新增方法 | 新增 `addSkill()` |
| `src/panels/skill-store/index.js` | 重写上传区域 | 替换占位 UI，实现真实上传交互 |

## 验收标准

- [ ] 可选择 `.md` 文件并成功上传为 Skill
- [ ] 可选择 `.zip` 文件并成功上传（服务端自动解压）
- [ ] 上传成功后自动刷新 Skill 列表
- [ ] 上传中按钮禁用，防止重复提交
- [ ] 成功/失败均有 Toast 提示
- [ ] 单文件上传前校验 frontmatter 格式
- [ ] 同名 Skill 覆盖行为符合 OpenViking 后端逻辑
- [ ] 所有前端显式提示均在对应场景正确展示

## 后续归档

方案实现并验证后：
- 将最终稳定行为沉淀到 `docs/architecture/2026-05-26-skill-upload-implementation.md`
- 更新 `docs/README.md` 索引
- 原 proposal 视决策参考价值移入 `docs/legacy/` 或删除
