# EchoMem 智能补全功能实现总结

## 状态

已上线 / 2026-05-11（多选模式重构完成）

## 功能概述

EchoMem 智能补全（输入联想）是一个基于 OpenViking 记忆召回 + 本地算法处理的实时输入辅助功能。当用户在支持的聊天平台（HIGO Office、DeepSeek）输入框中键入内容时，扩展会自动：

1. 调用 OpenViking `find` API 召回相关历史记忆
2. 使用本地算法从记忆内容中提取短语和关键词
3. 生成 Top-3 补全建议，以多选浮层形式展示在输入框上方
4. 用户可多选记忆条目，点击「确定」后按统一格式追加到输入框
5. 支持键盘导航（↑↓ 高亮、空格 切换勾选、Enter 确认、Esc 关闭）和鼠标交互

## 架构总览

```
用户输入 (≥3 字符)
    │
    ▼
┌─────────────────────────────────────────────┐
│  input-tracker.js                            │
│  - 监听 textarea input 事件                  │
│  - 300ms debounce                            │
│  - 忽略程序触发的事件 (e.isTrusted)          │
│  - 调用 OpenViking find API                  │
└──────────────┬──────────────────────────────┘
               │ memories[]
               ▼
┌─────────────────────────────────────────────┐
│  completion-engine.js                        │
│  - 语义分数过滤（memory.score ≥ threshold）  │
│  - 从 L1 overview 提取结构化短语             │
│  - 从 L0 abstract 提取关键词                 │
│  - 相关性评分（Jaccard + 重叠度）            │
│  - 生成补全建议（phrase / keyword）          │
│  - 排序去重，返回 Top-3                      │
└──────────────┬──────────────────────────────┘
               │ completions[]
               ▼
┌─────────────────────────────────────────────┐
│  suggestions.js                              │
│  - 渲染多选浮层 UI（checkbox + 全选 + 折叠） │
│  - 键盘导航（↑↓空格 Enter Esc）              │
│  - 点击外部关闭                              │
│  - 合并式插入（单记忆段 + key 级去重）       │
└─────────────────────────────────────────────┘
```

## 核心模块详解

### 1. 输入监听与触发 (`src/core/input-tracker.js`)

**职责**：绑定到平台输入框，监听用户输入，触发记忆召回流程。

**关键逻辑**：

```javascript
// 绑定条件
textarea.dataset.echomemTracking = 'true';  // 防止重复绑定

// Debounce 触发（忽略程序触发的事件）
textarea.addEventListener('input', (e) => {
  if (!e.isTrusted) return;  // 避免 composeAndInsert 触发的 input 重新打开浮层
  // ...
  if (text.length >= 3) {
    debounceTimer = setTimeout(() => handleInput(textarea, text), 300);
  }
});

// Blur 处理：浮层内点击时抑制关闭
textarea.addEventListener('blur', () => {
  setTimeout(() => {
    if (shouldSuppressBlurClose()) return;
    const active = document.activeElement;
    const container = document.getElementById('echomem-suggestions');
    if (container && active && container.contains(active)) return;
    hideSuggestions();
  }, 200);
});
```

---

### 2. 补全引擎 (`src/core/completion-engine.js`)

**职责**：处理 OpenViking 返回的记忆列表，提取有效内容，生成补全建议。

#### 2.1 阈值配置

```javascript
let phraseScoreThreshold = 0.2;  // 默认阈值，可通过配置面板调整（范围 0.2 ~ 0.8）

// 每次生成前刷新（用户可能在配置面板修改）
async function refreshThreshold() {
  const config = await getCompletionConfig();
  phraseScoreThreshold = config.phraseScoreThreshold;
}
```

#### 2.2 语义分数过滤

```javascript
const semanticScore = memory.score || 0;
if (semanticScore < phraseScoreThreshold) {
  // 过滤掉语义相关性不足的记忆
  continue;
}
```

#### 2.3 短语提取 (`extractPhrases`)

从 L1 `overview` 中提取结构化短语：

| 类型 | 匹配模式 | 示例 |
|------|----------|------|
| `bullet` | `^[-*]\s+(.+)$` | `- Clothing store owner` |
| `quote` | `^[""'](.+)[""']\s*\(` | `"I need help" (User)` |
| `text` | 非标题、非列表的内容行 | `用户最喜欢的编程语言是 TypeScript` |

**评分公式**（`calculatePhraseScore`）：

```
score = (jaccard * 0.4 + (overlap / (inputWords.size * 2)) * 0.6) * (1 - lengthPenalty * 0.15)

其中：
- jaccard = intersection / union
- overlap = exactMatch * 2 + partialMatch * 1
- lengthPenalty = min(phrase.length / 150, 1)
```

**阈值规则**：
- bullet/quote：`score > phraseScoreThreshold`
- text line：`score > phraseScoreThreshold + 0.25`（更严格）

#### 2.4 关键词提取 (`extractKeywords`)

从 L0 `abstract` 中提取关键词：

```javascript
// 1. 分词并过滤停用词
const words = tokenizeAndFilter(text);

// 2. 计算 TF（词频）
const freq = {};
for (const w of words) {
  freq[w] = (freq[w] || 0) + 1;
}

// 3. 加权：用户输入中的词权重 3 倍
const scored = Object.entries(freq).map(([word, count]) => ({
  word,
  score: count * (userWords.has(word) ? 3 : 1)
}));

// 4. 取 Top-3
return scored.sort((a, b) => b.score - a.score).slice(0, 3).map(x => x.word);
```

#### 2.5 补全建议生成 (`buildSuggestion`)

**策略优先级**：

1. **Phrase 策略**（最高优先级）：如果 `extractPhrases` 提取到相关短语，直接使用短语作为补全
   ```javascript
   {
     type: 'phrase',
     displayText: '...用户最喜欢的编程语言是 TypeScript',
     insertText: '用户最喜欢的编程语言是 TypeScript，原因是它有强大的类型系统。',
     score: memory.score * 0.7 + phrase.score * 0.3
   }
   ```

2. **Keyword 策略**：如果没有短语，使用关键词续写（不包含用户输入前缀）
   ```javascript
   {
     type: 'keyword',
     displayText: '...TypeScript、类型系统、代码',
     insertText: 'TypeScript、类型系统、代码',
     score: memory.score
   }
   ```

3. **无建议**：如果短语和关键词都提取不到，返回 `null`，该记忆不生成建议

> **设计决策**：早期版本有 fallback 策略（直接用 abstract 作为建议），但用户反馈这导致不相关记忆也显示。已移除 fallback，现在只有提取到有效内容时才生成建议。

#### 2.6 排序与去重 (`rankAndDeduplicate`)

```javascript
// 1. 按分数降序排序
suggestions.sort((a, b) => b.score - a.score);

// 2. 去重：insertText 前 50 字相同的只保留分数最高的
const seen = new Set();
const unique = [];
for (const s of suggestions) {
  const key = s.insertText.slice(0, 50);
  if (!seen.has(key)) {
    seen.add(key);
    unique.push(s);
  }
}

// 3. 取 Top-3
return unique.slice(0, maxResults);
```

---

### 3. 建议浮层 (`src/panels/association/suggestions.js`)

**职责**：渲染多选补全建议浮层，处理用户交互，管理记忆段的合并式插入。

#### 3.1 浮层结构

浮层定位在输入框上方（fixed 定位，基于输入框 `getBoundingClientRect`）：

```
┌──────────────────────────────────────────────┐
│  ☑ 全选        相关记忆 (3)           [▾]    │  ← header
├──────────────────────────────────────────────┤
│  ☐  ...用户最喜欢的编程语言是 TypeScript     │  ← item 0
│     [记忆] 0.53                              │
├──────────────────────────────────────────────┤
│  ☐  ...Docker 容器部署方案                   │  ← item 1
│     [记忆] 0.42                              │
├──────────────────────────────────────────────┤
│  ☐  ...Nginx 反向代理配置                    │  ← item 2
│     [记忆] 0.38                              │
├──────────────────────────────────────────────┤
│                         [取消] [确定 (0)]    │  ← actions
└──────────────────────────────────────────────┘
```

**头部**：全选 checkbox + 标题（显示条目数）+ 折叠/展开按钮
**列表**：每条含 checkbox、展示文本、来源标记、分数
**操作栏**：取消按钮 + 确定按钮（显示已选数量，无选中时 disabled）

#### 3.2 状态管理

```javascript
let selectedIndex = -1;            // 键盘高亮索引（仅视觉聚焦）
let currentSuggestions = [];       // 当前浮层数据
let checkedKeys = new Set();       // 已勾选条目 key（每次重渲染清空）
let currentInputElement = null;    // 当前绑定的输入元素
let keyboardBound = false;
let collapsed = false;             // 折叠状态（保持跨重渲染）
let suppressBlurClose = false;     // 浮层内点击时抑制 blur 关闭
let committedItems = new Map();    // 已提交到 textarea 的记忆 key -> body（跨选择保持）
```

**稳定 key 生成**：
```javascript
function getItemKey(c, i) {
  return c.sourceUri || c.insertText || `idx-${i}`;
}
```

#### 3.3 键盘导航

| 按键 | 行为 |
|------|------|
| `↓` | 高亮下一条建议 |
| `↑` | 高亮上一条建议 |
| `空格` | 切换当前高亮行的勾选状态 |
| `Enter` | 确认插入（仅在有勾选时阻止默认行为） |
| `Esc` | 隐藏浮层 |

**实现细节**：
- 只在浮层可见时拦截键盘事件
- `mouseenter` 更新高亮状态
- 空格切换勾选时同步更新 UI

#### 3.4 多选交互

**行点击**：点击整行（非 checkbox 本身）切换勾选状态
**全选**：点击头部 checkbox，同步所有行的勾选状态，支持 indeterminate 态
**折叠**：点击 `▾`/`▸` 按钮折叠/展开列表和操作栏
**取消**：清空勾选并关闭浮层
**确定**：将勾选条目合并插入到输入框

#### 3.5 记忆段合并式插入

**输出格式**：
```
<用户原始输入>

当前我的相关记忆如下：
1. <记忆内容 A>
2. <记忆内容 B>
```

**核心逻辑**（`composeAndInsert`）：

```javascript
const MEM_HEADER = '当前我的相关记忆如下：';
let committedItems = new Map();  // key -> 格式化后的记忆内容

function composeAndInsert(textarea, userText, selected) {
  // 1. 从 userText 中剥离已有的记忆段
  const basePart = stripMemoryBlock(userText);

  // 2. 追加新选条目（key 去重）
  for (const { key, item } of selected) {
    if (committedItems.has(key)) continue;
    const body = formatItem(item);  // 清理换行，确保单行
    if (!body) continue;
    committedItems.set(key, body);
  }

  // 3. 构建新的记忆段
  const bodies = Array.from(committedItems.values());
  const lines = bodies.map((b, i) => `${i + 1}. ${b}`);
  const prefix = basePart ? `${basePart}\n\n` : '';
  const next = `${prefix}${MEM_HEADER}\n${lines.join('\n')}`;

  // 4. 写入输入框并触发 input 事件
  textarea.value = next;
  textarea.selectionStart = textarea.selectionEnd = next.length;
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
  textarea.focus();
}
```

**`stripMemoryBlock`**：使用 `lastIndexOf` 找到最后一个 `MEM_HEADER`，删除它及之后的所有内容。如果检测到多个 `MEM_HEADER`（嵌套），清空 `committedItems` 并从第一个位置截断，彻底清理。

**`formatItem`**：清理记忆内容中的换行和多余空白，确保单行输出：
```javascript
function formatItem(it) {
  return (it.insertText || '').trim().replace(/\s+/g, ' ');
}
```

**设计决策**：
- 使用 `committedItems` Map 做 key 级去重，跨多次选择保持已提交记忆
- 每次确定时，旧记忆段被整体替换为新累积的条目，始终只保留一个记忆段
- 通过 `dispatchEvent(new Event('input', { bubbles: true }))` 触发受控组件同步

#### 3.6 浮层生命周期

**打开**：用户输入 ≥3 字符且召回到有效记忆时渲染
**关闭**：
- 点击「取消」按钮
- 点击「确定」按钮（插入后关闭）
- 按 Esc 键
- 点击浮层外部（`bindOutsideClick` 监听 document mousedown）
- 输入框 blur（浮层内点击时通过 `suppressBlurClose` 抑制）

**重渲染**：新一轮搜索结果到达时，`checkedKeys` 被清空，但 `committedItems` 和 `collapsed` 保持

---

### 4. 文本处理工具 (`src/utils/text-processor.js`)

**职责**：提供分词、停用词过滤、句子分割、相似度计算、HTML 转义等基础能力。

#### 4.1 分词 (`tokenize`)

```javascript
// 匹配中文词（2字以上）或英文/数字词（2字符以上）
const regex = /[\u4e00-\u9fa5]{2,}|[a-zA-Z0-9]{2,}/g;

// 示例：
// "编程语言 JavaScript" -> ["编程语言", "JavaScript"]
// "Docker 部署" -> ["Docker", "部署"]
```

#### 4.2 停用词表

包含 70+ 中文和英文停用词（如：的、了、是、the、a、is 等）。

#### 4.3 重叠度计算 (`calculateOverlap`)

```javascript
// 精确匹配：+2 分
// 部分包含匹配（如 "部署" 匹配 "部署方案"）：+1 分
function calculateOverlap(inputWords, textWords) {
  let exactMatch = 0;
  let partialMatch = 0;

  for (const iw of inputWords) {
    if (textWords.has(iw)) {
      exactMatch += 2;
    } else {
      for (const tw of textWords) {
        if (tw.includes(iw) || iw.includes(tw)) {
          partialMatch += 1;
          break;
        }
      }
    }
  }

  return exactMatch + partialMatch;
}
```

#### 4.4 HTML 转义 (`escapeHtml`)

使用 DOM `textContent` 进行安全转义，用于浮层内容渲染。

---

### 5. OpenViking 客户端 (`src/services/openviking-client.js`)

**职责**：封装 HTTP 调用，与 OpenViking 服务通信。

```javascript
// 调用接口
POST ${baseUrl}/api/v1/search/find
Body: {
  query: userInput,
  target_uri: 'viking://user/memories',
  limit: 5,
  score_threshold: 0
}

// 返回数据结构
{
  memories: [
    {
      uri: 'viking://user/default/memories/...',
      score: 0.6359,        // 语义相关性分数
      abstract: '一句话摘要（L0）',
      overview: '结构化 markdown（L1）',
      // ... 其他字段
    }
  ]
}
```

**超时**：默认 5000ms，使用 `AbortController` 处理超时。

---

### 6. 配置管理 (`src/services/config.js` & `src/panels/association/index.js`)

#### 6.1 配置项

| 配置项 | 默认值 | 范围 | 说明 |
|--------|--------|------|------|
| `baseUrl` | `http://127.0.0.1:1933` | - | OpenViking 服务地址 |
| `apiKey` | `''` | - | API Key（可选） |
| `agentId` | `'echomem-extension'` | - | Agent 标识 |
| `phraseScoreThreshold` | `0.2` | 0.2 ~ 0.8 | 短语过滤阈值 |

#### 6.2 配置面板 UI

- 滑块：`type="range"`，范围 0.2 ~ 0.8，步长 0.01
- 数字输入框：`type="number"`，同范围，宽度 60px
- 双向同步：滑块拖动更新输入框，输入框输入更新滑块（自动限制边界）

#### 6.3 配置持久化

使用 `chrome.storage.local` 持久化配置，保存后调用 `resetClient()` 重置客户端以使用新配置。

---

## 数据流详解

### 完整调用链

```
用户输入 "编程语言"
    │
    ▼
input-tracker.js: handleInput()
    │
    ├── OpenVikingClient.find("编程语言", { limit: 5 })
    │       └── 返回 5 条记忆（semanticScore 0.36 ~ 0.64）
    │
    ▼
completion-engine.js: generateCompletions("编程语言", memories, 3)
    │
    ├── refreshThreshold() -> 0.21
    │
    ├── processMemories()
    │   │
    │   ├── memory 1: favorite_programming_language.md
    │   │   ├── semanticScore = 0.636 >= 0.21 ✓
    │   │   ├── extractPhrases(overview) -> 1 phrase (score 0.289)
    │   │   ├── extractKeywords(abstract) -> ["TypeScript", "类型系统"]
    │   │   └── buildSuggestion() -> phrase 策略
    │   │       └── { type: 'phrase', insertText: '...', score: 0.53 }
    │   │
    │   ├── memory 2: Gina.md
    │   │   ├── semanticScore = 0.362 >= 0.21 ✓
    │   │   ├── extractPhrases(overview) -> 0 phrases
    │   │   ├── extractKeywords(abstract) -> [] (无相关关键词)
    │   │   └── buildSuggestion() -> null (跳过)
    │   │
    │   ├── memory 3~5: 类似 Gina.md
    │   │   └── 均返回 null
    │   │
    │   └── 结果：[{ phrase 建议 }]
    │
    ├── rankAndDeduplicate([{ phrase 建议 }], 3)
    │   └── 返回 [{ phrase 建议 }]
    │
    └── 结果：1 条建议
        │
        ▼
suggestions.js: renderCompletions(textarea, [suggestion])
    │
    ├── 创建/更新浮层 DOM（含 checkbox、全选、操作按钮）
    ├── 定位到输入框上方
    ├── 绑定点击事件（行点击、checkbox、全选、折叠、取消、确定）
    ├── 绑定外部点击关闭
    └── 默认高亮第一条（index = 0）
```

### 用户确认插入流程

```
用户勾选第 1、3 条记忆，点击「确定 (2)」
    │
    ▼
composeAndInsert(textarea, textarea.value, [
  { key: 'viking://.../mem1', item: completion1 },
  { key: 'viking://.../mem3', item: completion3 }
])
    │
    ├── stripMemoryBlock(textarea.value)
    │   ├── 查找 "当前我的相关记忆如下："
    │   ├── 若存在：删除该 header 及之后所有内容，返回用户原文
    │   └── 若不存在：返回原文
    │
    ├── 遍历 selected，key 去重追加到 committedItems
    │   ├── committedItems.set('viking://.../mem1', 'TypeScript 类型系统优势')
    │   └── committedItems.set('viking://.../mem3', 'Docker 容器化部署')
    │
    ├── 构建新文本
    │   └── "用户原文\n\n当前我的相关记忆如下：\n1. TypeScript 类型系统优势\n2. Docker 容器化部署"
    │
    ├── textarea.value = 新文本
    ├── 设置光标到末尾
    ├── dispatchEvent(new Event('input', { bubbles: true }))
    └── textarea.focus()
```

---

## 设计决策记录

### 1. 为什么移除 fallback 策略？

**背景**：早期版本在 `extractPhrases` 返回 0 时，fallback 使用 memory.abstract 作为建议。

**问题**：用户输入"编程语言"时，Gina.md（人物档案）的 semanticScore 为 0.36（> 0.21），但 abstract 与"编程语言"无关。fallback 导致不相关建议混入。

**决策**：移除 fallback，只有提取到有效短语或关键词时才生成建议。

### 2. 为什么使用合并式插入而非替换？

**背景**：早期版本直接替换整个输入框内容为 `insertText`。

**问题**：用户输入"怎么部署"，建议为"怎么部署 Docker 容器"，替换后用户原文丢失。

**决策**：改为合并式插入——保留用户原文，追加格式化记忆段。每次确定时替换旧记忆段，始终只保留一个记忆段。

### 3. 为什么使用 key 级去重（committedItems Map）？

**背景**：用户可能多次打开浮层选择不同记忆，需要避免同一条记忆重复插入。

**问题**：纯文本去重无法识别同一记忆的不同表述，且记忆内容含换行时解析困难。

**决策**：使用 `committedItems` Map，以 `sourceUri || insertText` 为 key，跨多次选择保持去重状态。`stripMemoryBlock` 负责清理旧文本，`committedItems` 负责逻辑去重。

### 4. 为什么阈值范围设为 0.2 ~ 0.8？

**背景**：原始范围 0 ~ 0.5，默认 0.05。

**问题**：0.05 过于宽松，几乎所有记忆都通过过滤；0 会导致无意义记忆也显示。

**决策**：
- 最小值 0.2：低于此值的记忆通常与输入几乎无关
- 最大值 0.8：极高阈值，只显示高度相关的记忆
- 默认 0.2：平衡召回率与精确率

### 5. 平台持久化 bug 及修复

**背景**：`initState()` 从 storage 加载状态时，会覆盖 `platform` 字段。

**问题**：如果之前访问过 HIGO 页面，`toggleAssociationEnabled()` 调用 `persistState()` 把 HIGO 平台持久化。之后打开 DeepSeek 页面时，`initState()` 加载了旧的 HIGO platform，导致检测错误，日志显示 "Starting input tracking for HIGO Office"。

**修复**：`initState()` 加载状态时强制 `platform: null`，确保每次页面加载都重新检测平台。

```javascript
state = {
  ...DEFAULT_STATE,
  ...saved,
  platform: null  // 平台需要每次重新检测，不持久化
};
```

### 6. 为什么使用 click 而非 mousedown 处理 checkbox？

**背景**：早期版本在 checkbox 上使用 `mousedown` + `preventDefault()`。

**问题**：`preventDefault()` 阻止了 checkbox 的原生状态切换，导致全选 checkbox 与实际行勾选状态不同步。

**决策**：改为 `click` 事件，使用 `e.target.checked` 作为真值源，不再手动干预 checkbox 的 checked 状态。

### 7. 为什么忽略非 trusted 的 input 事件？

**背景**：`composeAndInsert` 在写入 textarea 后会 dispatch `input` 事件以同步受控组件。

**问题**：该事件会触发 `input-tracker.js` 的监听器，导致浮层关闭后又立即重新打开。

**决策**：在 input 监听器中添加 `if (!e.isTrusted) return;`，忽略程序触发的事件。

---

## 文件清单

### 核心文件

| 文件 | 说明 |
|------|------|
| `src/utils/text-processor.js` | 文本处理工具：分词、停用词、句子分割、截断、相似度计算、HTML 转义 |
| `src/core/completion-engine.js` | 补全引擎：关键词/短语提取、相关性评分、补全生成、排序去重 |
| `src/core/input-tracker.js` | 输入框监听：debounce、OpenViking 调用、浮层触发、blur 处理 |
| `src/panels/association/suggestions.js` | 建议浮层：多选 UI、checkbox 同步、键盘导航、合并式插入 |
| `src/services/openviking-client.js` | OpenViking HTTP 客户端 |
| `src/services/config.js` | 配置管理（OpenViking + 补全算法） |

### 样式文件

| 文件 | 说明 |
|------|------|
| `content.css` | 浮层容器、头部、列表项、checkbox、来源标记、操作按钮、高亮态、勾选态 |

---

## 调试日志

核心模块在关键节点输出日志，便于排查问题：

```
EchoMem: recall triggered, query= 编程语言
EchoMem: found 5 memories
EchoMem: first memory keys ['context_type', 'uri', 'level', 'score', ...]
EchoMem: first memory overview missing
EchoMem: phraseScoreThreshold = 0.21
EchoMem: extractPhrases inputWords ['编程语言'] threshold 0.21
EchoMem: overview lines count 7
EchoMem: list item Clothing store owner score 0 threshold 0.21
EchoMem: extractPhrases result 0 phrases
EchoMem: memory viking://.../Gina.md semanticScore 0.362 phrases 0
EchoMem: no suggestion generated for viking://.../Gina.md
EchoMem: raw suggestions = [{ type: 'phrase', score: 0.53, display: '...用户最喜欢的编程语言是 TypeScript' }]
EchoMem: generated 1 completions
```

---

## 已知限制

1. **中文分词精度**：使用正则分词（2字以上连续中文字符），无法处理复杂分词场景（如"上海市"会被整体匹配，不会拆分"上海"+"市"）
2. **L1 overview 依赖**：短语提取依赖 overview 字段，如果 OpenViking 返回的 overview 为空或格式不符，只能 fallback 到关键词策略
3. **单平台输入框**：目前只绑定第一个匹配的 textarea，不支持多输入框切换
4. **无个性化学习**：不记录用户点击行为，无法根据用户偏好调整排序

---

## 后续演进方向

1. **LLM 增强补全**：将召回的记忆作为上下文，调用轻量 LLM 生成更自然的续写
2. **点击行为学习**：记录用户点击历史，调整排序权重
3. **多轮补全**：支持连续补全（插入后继续触发下一轮建议）
4. **更精细的分词**：引入中文分词库（如 jieba-wasm）提升分词精度

---

## 参考

- [原始方案提案](../legacy/2026-05-09-smart-completion-unified.md)
- [OpenViking ContextLevel 定义](../../OpenViking-0.3.12/openviking/core/context.py)
- [输入联想实现计划](../proposals/2026-05-07-input-association-implementation-plan.md)
