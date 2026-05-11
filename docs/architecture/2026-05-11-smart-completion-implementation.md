# EchoMem 智能补全功能实现总结

## 状态

已上线 / 2026-05-11

## 功能概述

EchoMem 智能补全（输入联想）是一个基于 OpenViking 记忆召回 + 本地算法处理的实时输入辅助功能。当用户在支持的聊天平台（HIGO Office、DeepSeek）输入框中键入内容时，扩展会自动：

1. 调用 OpenViking `find` API 召回相关历史记忆
2. 使用本地算法从记忆内容中提取短语和关键词
3. 生成 Top-3 补全建议，以浮层形式展示在输入框上方
4. 支持键盘导航（↑↓ 选择、Tab/Enter 插入、Esc 关闭）和鼠标点击

## 架构总览

```
用户输入 (≥3 字符)
    │
    ▼
┌─────────────────────────────────────────────┐
│  input-tracker.js                            │
│  - 监听 textarea input 事件                  │
│  - 300ms debounce                            │
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
│  - 渲染浮层 UI                               │
│  - 键盘导航 (↑↓TabEnterEsc)                  │
│  - 鼠标点击插入                              │
│  - 替换整个输入框内容                        │
└─────────────────────────────────────────────┘
```

## 核心模块详解

### 1. 输入监听与触发 (`src/core/input-tracker.js`)

**职责**：绑定到平台输入框，监听用户输入，触发记忆召回流程。

**关键逻辑**：

```javascript
// 绑定条件
textarea.dataset.echomemTracking = 'true';  // 防止重复绑定

// Debounce 触发
const text = e.target.value.trim();
if (text.length >= 3) {
  debounceTimer = setTimeout(() => handleInput(textarea, text), 300);
}

// 处理流程
async function handleInput(textarea, userInput) {
  // 1. OpenViking 记忆召回
  const result = await ovClient.find(userInput, { limit: 5 });
  const memories = result.memories || [];

  // 2. 本地补全引擎生成建议
  const completions = await generateCompletions(userInput, memories, 3);

  // 3. 渲染或隐藏
  if (completions.length > 0) {
    renderCompletions(textarea, completions);
  } else {
    hideSuggestions();
  }
}
```

**注意**：`blur` 事件延迟 200ms 隐藏浮层，避免点击建议时浮层先消失。

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
| `bullet` | `^-\s+(.+)$` 或 `^*\s+(.+)$` | `- Clothing store owner` |
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

2. **Keyword 策略**：如果没有短语，使用关键词续写
   ```javascript
   {
     type: 'keyword',
     displayText: '编程语言 ... TypeScript、类型系统、代码',
     insertText: '编程语言 TypeScript、类型系统、代码',
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

**职责**：渲染补全建议浮层，处理用户交互。

#### 3.1 渲染

浮层定位在输入框上方（fixed 定位，基于输入框 `getBoundingClientRect`）：

```javascript
container.style.position = 'fixed';
container.style.left = `${rect.left}px`;
container.style.top = `${rect.top - containerHeight - 8}px`;
container.style.width = `${rect.width}px`;
```

每条建议展示：
- 左侧：`displayText`（截断至 40 字符）
- 右侧：来源标记 `[记忆]` + 分数（保留 2 位小数）

#### 3.2 键盘导航

| 按键 | 行为 |
|------|------|
| `↓` | 选择下一条建议 |
| `↑` | 选择上一条建议 |
| `Tab` | 插入当前选中建议（默认第一条） |
| `Enter` | 插入当前选中建议 |
| `Esc` | 隐藏浮层 |

**实现细节**：
- 只在浮层可见时拦截键盘事件
- `mousedown` 而非 `click`（避免 blur 先触发导致浮层消失）
- `mouseenter` 更新选中状态

#### 3.3 插入逻辑

```javascript
function insertSuggestion(inputElement, completion) {
  const text = completion.insertText || '';
  inputElement.value = text;  // 直接替换整个输入框内容
  inputElement.selectionStart = inputElement.selectionEnd = text.length;
  inputElement.focus();
  hideSuggestions();
}
```

> **设计决策**：使用替换而非在光标处插入，避免用户输入与建议内容重复。

---

### 4. 文本处理工具 (`src/utils/text-processor.js`)

**职责**：提供分词、停用词过滤、句子分割、相似度计算等基础能力。

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
    ├── 创建/更新浮层 DOM
    ├── 定位到输入框上方
    ├── 绑定点击事件
    └── 默认选中第一条（index = 0）
```

---

## 设计决策记录

### 1. 为什么移除 fallback 策略？

**背景**：早期版本在 `extractPhrases` 返回 0 时，fallback 使用 memory.abstract 作为建议。

**问题**：用户输入"编程语言"时，Gina.md（人物档案）的 semanticScore 为 0.36（> 0.21），但 abstract 与"编程语言"无关。fallback 导致不相关建议混入。

**决策**：移除 fallback，只有提取到有效短语或关键词时才生成建议。

### 2. 为什么使用替换而非插入？

**背景**：早期版本在光标位置插入建议文本。

**问题**：用户输入"怎么部署"，建议为"怎么部署 Docker 容器"，插入后变成"怎么部署怎么部署 Docker 容器"。

**决策**：直接替换整个输入框内容为 `insertText`。

### 3. 为什么移除会话内容提取？

**背景**：原计划同时从当前页面 DOM 提取聊天记录作为补全来源。

**问题**：HIGO Office DOM 结构复杂且不稳定，多次调整选择器仍无法可靠提取。用户最终决定放弃该功能。

**决策**：仅保留 OpenViking 记忆召回，移除 session-extractor 引用。

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

---

## 文件清单

### 新增文件

| 文件 | 说明 |
|------|------|
| `src/utils/text-processor.js` | 文本处理工具：分词、停用词、句子分割、截断、相似度计算 |
| `src/core/completion-engine.js` | 补全引擎：关键词/短语提取、相关性评分、补全生成、排序去重 |
| `src/core/session-extractor.js` | ~~会话内容提取（已废弃，保留文件但不再引用）~~ |
| `src/services/openviking-client.js` | OpenViking HTTP 客户端 |
| `src/services/config.js` | 配置管理（OpenViking + 补全算法） |
| `src/services/session-mapper.js` | ~~会话 ID 提取（已废弃）~~ |
| `src/panels/association/suggestions.js` | 建议浮层：渲染、键盘导航、鼠标交互 |

### 修改文件

| 文件 | 变更内容 |
|------|----------|
| `src/core/input-tracker.js` | 集成 completion-engine，移除 session-extractor 引用 |
| `src/core/state.js` | 添加 `initState()` 从 storage 加载状态，修复 platform 持久化问题 |
| `src/core/router.js` | 更新 association 面板导入路径 |
| `src/panels/association/index.js` | 阈值配置 UI 改为滑块 + 数字输入框，范围 0.2~0.8 |
| `src/entry/content.js` | 添加 `initState()` 调用和输入联想启动逻辑 |
| `src/platforms/higo.js` | 添加 messages 配置（当前未使用） |
| `src/platforms/deepseek.js` | 添加 messages 配置（当前未使用） |
| `content.css` | 新增来源标记样式、选中态样式 |

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

- [原始方案提案](../proposals/2026-05-09-smart-completion-unified.md)
- [OpenViking ContextLevel 定义](../../OpenViking-0.3.12/openviking/core/context.py)
- [输入联想实现计划](../proposals/2026-05-07-input-association-implementation-plan.md)
