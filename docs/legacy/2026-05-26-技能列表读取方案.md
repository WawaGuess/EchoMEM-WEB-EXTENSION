# Skill 列表与详情查看功能方案

## 状态

Draft

## 背景

EchoMEM 扩展「Skill 商店」面板中的「我的 Skill」和「安装管理」区域目前均为占位 UI，数据是前端硬编码的静态示例。用户无法看到真实存储在 OpenViking 中的 Skill 列表，也无法查看某个 Skill 的详细信息。

OpenViking 后端目前没有暴露专门的 Skill CRUD 接口（如 `GET /api/v1/skills`），但 Skill 以文件形式存储在 VikingFS 中，可以通过现有的 `fs/ls` 和 `content/read` 接口间接实现列表和详情查看功能。

## 目标

1. 支持在「我的 Skill」页面展示 OpenViking 中真实存储的 Skill 列表。
2. 支持点击某个 Skill 查看其详细信息（名称、描述、指令、版本等 frontmatter 字段）。
3. Skill 列表按创建时间倒序排列，名称支持搜索过滤。
4. 列表加载失败时给出明确错误提示。

## 非目标

1. 不实现 Skill 的在线编辑或修改功能（只读查看）。
2. 不实现 Skill 的启用/停用持久化状态（前端只做 UI 展示，不涉及状态同步）。
3. 不实现 Skill 删除功能（不在本方案范围内）。
4. 不修改 OpenViking 后端代码（完全复用现有接口）。
5. 不实现 Skill 的搜索排序等高级功能（仅基础列表 + 本地过滤）。

## 方案

### 1. 整体流程

```
用户进入「我的 Skill」页面
    │
    ▼
GET /api/v1/fs/ls?uri=viking://agent/skills&show_all_hidden=false
    │  返回目录下的子目录列表，每个子目录即为一个 Skill
    ▼
对每个 Skill 目录，读取 SKILL.md
    │  GET /api/v1/content/read?uri=viking://agent/skills/{name}/SKILL.md
    ▼
解析 frontmatter，提取 name / description / version 等字段
    │
    ▼
渲染 Skill 列表卡片
    │
    ▼
用户点击某个 Skill
    │
    ▼
展开详情面板，显示完整的 frontmatter + Markdown 正文预览
```

### 2. Skill 在 VikingFS 中的存储结构

OpenViking 处理上传的 Skill 后，会在以下位置落盘：

```
viking://agent/skills/{skill_name}/
├── SKILL.md          ← 原始 Skill 文件（含 frontmatter + Markdown 正文）
├── .abstract.md      ← 系统生成的摘要（隐藏文件）
└── .overview.md      ← 系统生成的概述（隐藏文件）
```

Skill 目录本身即为 Skill 的标识，目录名通常是 Skill frontmatter 中的 `name` 字段。

前端调用 `fsLs` 时需设置 `showAllHidden: false`，过滤掉 `.abstract.md`、`.overview.md` 等隐藏文件。

### 3. 前端修改

#### 3.1 新增依赖

需要引入 `js-yaml` 用于解析 SKILL.md 的 YAML frontmatter。

```bash
npm install js-yaml
```

> **注意**：由于扩展通过 esbuild 打包为 IIFE 格式，需要确认 `js-yaml` 是否支持浏览器环境直接引用（v4 版本支持）。

#### 3.2 `src/utils/skill-parser.js` 新增（新建文件）

```javascript
import yaml from 'js-yaml';

const FRONTMATTER_PATTERN = /^---\s*\n(.*?)\n---\s*\n(.*)$/s;

export function parseSkillMd(content) {
  const match = content.match(FRONTMATTER_PATTERN);
  if (!match) {
    return {
      frontmatter: {},
      body: content,
    };
  }

  let frontmatter = {};
  try {
    frontmatter = yaml.load(match[1]) || {};
  } catch (err) {
    console.warn('Failed to parse skill frontmatter:', err);
  }

  return {
    frontmatter,
    body: match[2],
  };
}
```

**关键说明**：正则表达式 `^---\s*\n(.*?)\n---\s*\n(.*)$` 与 OpenViking 后端的 `skill_loader.py` 中的 `FRONTMATTER_PATTERN` 逻辑保持一致，确保前端解析结果与服务端一致。

#### 3.3 `src/panels/skill-store/index.js` 列表区域改造

将「我的 Skill」和「安装管理」的静态占位 UI 替换为真实数据驱动。

**核心列表加载函数**：

```javascript
const SKILL_ROOT_URI = 'viking://agent/skills';

async function loadSkillList() {
  try {
    const result = await ovClient.fsLs(SKILL_ROOT_URI, {
      showAllHidden: false,
    });

    // result.entries 为目录和文件混合列表
    const dirs = (result.entries || []).filter(e => e.isDir);

    // 并行读取每个 Skill 的 SKILL.md
    const skills = await Promise.all(
      dirs.map(async (dir) => {
        try {
          const skillUri = `${SKILL_ROOT_URI}/${dir.name}/SKILL.md`;
          const readResult = await ovClient.contentRead(skillUri);
          const { frontmatter, body } = parseSkillMd(readResult.content || '');

          return {
            name: frontmatter.name || dir.name,
            dirName: dir.name,
            description: frontmatter.description || '',
            version: frontmatter.version || '',
            author: frontmatter.author || '',
            uri: `${SKILL_ROOT_URI}/${dir.name}/`,
            rawContent: body.slice(0, 500), // 正文前 500 字符用于预览
            modifiedAt: dir.modifiedAt || dir.mtime,
          };
        } catch (err) {
          console.warn(`Failed to read skill ${dir.name}:`, err);
          return {
            name: dir.name,
            dirName: dir.name,
            description: '读取失败',
            uri: `${SKILL_ROOT_URI}/${dir.name}/`,
            error: true,
          };
        }
      })
    );

    // 过滤掉读取失败的（可选：保留并显示占位）
    return skills.filter(s => !s.error);
  } catch (err) {
    showToast(`加载 Skill 列表失败: ${err.message}`, 'error');
    return [];
  }
}
```

**列表渲染结构**：

| 字段 | 来源 |
|------|------|
| Skill 名称 | `frontmatter.name` → fallback 目录名 |
| 描述 | `frontmatter.description` |
| 版本 | `frontmatter.version` |
| 作者 | `frontmatter.author` |
| 更新时间 | `dir.modifiedAt` |

**详情面板展开**：

用户点击列表中的 Skill 卡片后，在右侧或下方展开详情面板，显示：

- 完整的 frontmatter 字段（name、description、version、author、tags 等）
- Markdown 正文预览（前 1000 字符，可折叠）
- 原始 SKILL.md 的 VikingURI（用于调试）

#### 3.4 搜索过滤

列表加载完成后，在页面顶部提供搜索输入框，对本地已加载的 Skill 进行过滤：

```javascript
function filterSkills(skills, keyword) {
  if (!keyword.trim()) return skills;
  const k = keyword.toLowerCase();
  return skills.filter(s =>
    s.name.toLowerCase().includes(k) ||
    (s.description && s.description.toLowerCase().includes(k))
  );
}
```

### 4. 错误处理

| 错误场景 | 处理方式 |
|---------|---------|
| fsLs 失败（网络/服务端错误） | Toast 提示「加载失败: {具体错误}」，显示空状态 |
| 某个 Skill 的 SKILL.md 读取失败 | 跳过该 Skill，console.warn 记录，其余正常展示 |
| SKILL.md frontmatter 解析失败 | 回退到无 frontmatter 模式，只展示原始正文 |
| Skill 目录为空（无 Skill） | 显示空状态提示「暂无 Skill，请先上传」 |

### 5. 性能优化

1. **并行读取**：使用 `Promise.all` 并行读取所有 Skill 的 `SKILL.md`，避免串行等待。
2. **正文截断**：详情面板中 Markdown 正文只渲染前 1000 字符，点击「展开」再加载完整内容。
3. **缓存**：Skill 列表和解析结果可缓存在内存中，切换面板时优先使用缓存，提供「刷新」按钮手动重新加载。
4. **节流搜索**：搜索输入框使用 300ms debounce，避免频繁过滤渲染。

## 影响范围

| 文件 | 修改类型 | 说明 |
|------|---------|------|
| `package.json` | 新增依赖 | 添加 `js-yaml` |
| `src/utils/skill-parser.js` | 新建 | YAML frontmatter 解析工具 |
| `src/panels/skill-store/index.js` | 重写列表区域 | 替换静态占位 UI，实现真实数据加载与展示 |

## 验收标准

- [ ] 「我的 Skill」页面能正确展示 OpenViking 中真实存储的所有 Skill
- [ ] 列表按更新时间倒序排列
- [ ] 每个 Skill 卡片显示名称、描述、版本、作者等信息
- [ ] 点击 Skill 卡片能展开详情面板，显示完整的 frontmatter 和正文预览
- [ ] 搜索框支持按名称和描述实时过滤
- [ ] Skill 目录为空时显示友好空状态提示
- [ ] 列表加载失败时给出明确错误提示
- [ ] 单个 Skill 读取失败时不影响其他 Skill 展示

## 后续归档

方案实现并验证后：
- 将最终稳定行为沉淀到 `docs/architecture/2026-05-26-skill-list-reading-implementation.md`
- 更新 `docs/README.md` 索引
- 原 proposal 视决策参考价值移入 `docs/legacy/` 或删除
