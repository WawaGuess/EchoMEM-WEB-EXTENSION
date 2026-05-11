# EchoMem 智能补全综合方案 — 记忆召回 + 会话上下文 + 键盘导航

## 状态

Implemented / Partially Modified

> **注意**：本方案中的"会话上下文提取"（源B）已实现后废弃，当前仅保留 OpenViking 记忆召回（源A）。完整实现细节见 `docs/architecture/2026-05-11-smart-completion-implementation.md`。

## 目标

将 EchoMem 的输入联想升级为真正的"智能补全"：
1. **双源召回**：同时从 OpenViking 历史记忆 + 当前页面聊天会话中提取相关内容
2. **本地算法排序**：使用纯本地算法综合排序，选出 Top-3 最相关建议
3. **键盘交互**：支持上下键选择、Tab 补全、Enter 确认、Esc 关闭
4. **自然补全体验**：建议内容像"续写"而非"粘贴摘要"

## 核心设计

### 整体架构

```
用户输入
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│                    双源内容收集层                             │
│  ┌─────────────────────┐    ┌─────────────────────────────┐ │
│  │ 源A: OpenViking      │    │ 源B: 当前页面会话内容        │ │
│  │ 语义搜索历史记忆      │    │ DOM 提取实时聊天记录         │ │
│  │ (L0 abstract)        │    │ (用户消息 + AI 回复)         │ │
│  └──────────┬──────────┘    └──────────────┬──────────────┘ │
│             │                              │                │
│             └──────────────┬───────────────┘                │
│                            ▼                                │
│              ┌─────────────────────────┐                    │
│              │    本地补全引擎          │                    │
│              │  ┌───────────────────┐  │                    │
│              │  │ 1. 文本预处理      │  │                    │
│              │  │ 2. 关键词提取      │  │                    │
│              │  │ 3. 相关性评分      │  │                    │
│              │  │ 4. 补全生成        │  │                    │
│              │  │ 5. 综合排序        │  │                    │
│              │  └───────────────────┘  │                    │
│              └─────────────┬───────────┘                    │
│                            │                                │
│                            ▼                                │
│              ┌─────────────────────────┐                    │
│              │   Top-3 补全建议列表     │                    │
│              │  - 每条含: 展示文本      │                    │
│              │  - 插入文本              │                    │
│              │  - 来源标记              │                    │
│              │  - 相关性分数            │                    │
│              └─────────────┬───────────┘                    │
└────────────────────────────┼────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                    智能建议浮层 UI                            │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  ▶ 怎么部署 Docker 容器？              [记忆]  0.92  │   │
│  │    怎么部署 Nginx 反向代理？           [记忆]  0.85  │   │
│  │    怎么部署到生产环境？                [会话]  0.78  │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  交互: ↑↓ 选择 | Tab 补全 | Enter 确认 | Esc 关闭 | 点击选择 │
└─────────────────────────────────────────────────────────────┘
```

### 双源内容收集

#### 源 A：OpenViking 历史记忆（已有）

- **接口**：`POST /api/v1/search/find`
- **返回**：`memories[]`，每个含 `abstract`, `overview`, `uri`, `score`
- **层级使用**：
  - L0 `abstract`：用于语义匹配和相关性评分
  - L1 `overview`：提取结构化短语作为补全素材

#### 源 B：当前页面会话内容（新增）

从页面 DOM 实时提取当前会话的聊天记录：

**HIGO Office 提取策略**：
```javascript
// 聊天消息容器选择器（需根据实际 DOM 调整）
const MESSAGE_SELECTORS = {
  higo: {
    messageContainer: '[data-testid="message-list"], .message-list, [class*="message"]',
    userMessage: '[data-testid="user-message"], .user-message, [class*="user"]',
    assistantMessage: '[data-testid="assistant-message"], .assistant-message, [class*="assistant"]',
    textContent: '.text, .content, [class*="text"]'
  }
};

function extractSessionMessages(platformId) {
  const selectors = MESSAGE_SELECTORS[platformId];
  if (!selectors) return [];

  const messages = [];
  const containers = document.querySelectorAll(selectors.messageContainer);

  for (const container of containers) {
    // 提取用户消息
    const userMsgs = container.querySelectorAll(selectors.userMessage);
    for (const msg of userMsgs) {
      const text = msg.textContent?.trim();
      if (text) messages.push({ role: 'user', text, timestamp: Date.now() });
    }

    // 提取 AI 回复
    const assistantMsgs = container.querySelectorAll(selectors.assistantMessage);
    for (const msg of assistantMsgs) {
      const text = msg.textContent?.trim();
      if (text) messages.push({ role: 'assistant', text, timestamp: Date.now() });
    }
  }

  return messages;
}
```

**DeepSeek 提取策略**：
```javascript
deepseek: {
  messageContainer: '.ds-chat-message-list, [class*="chat-message"]',
  userMessage: '.ds-chat-message-user, [class*="message-user"]',
  assistantMessage: '.ds-chat-message-assistant, [class*="message-assistant"]',
  textContent: '.ds-chat-message-text, [class*="message-text"]'
}
```

**会话内容处理**：
```javascript
function processSessionContext(messages, userInput) {
  // 1. 合并最近 N 条消息为上下文文本
  const recentMessages = messages.slice(-10); // 最近10条
  const contextText = recentMessages.map(m => m.text).join(' ');

  // 2. 提取与用户输入相关的句子
  const sentences = splitSentences(contextText);
  const inputWords = new Set(tokenize(userInput));

  return sentences
    .map(sentence => ({
      text: sentence,
      score: calculateRelevance(inputWords, sentence),
      source: 'session'
    }))
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}
```

### 本地补全引擎

#### 模块结构

```
src/core/completion-engine.js
├── extractKeywords(text, userInput)     // 关键词提取
├── extractPhrases(overview, userInput)  // 短语提取（从 L1）
├── scoreRelevance(inputWords, text)     // 相关性评分
├── generateCompletions(userInput, memories, sessionContext)  // 主入口
└── mergeAndRank(suggestions)            // 综合排序
```

#### 1. 文本预处理与分词

```javascript
// 简单中文/英文混合分词
function tokenize(text) {
  // 策略：按非字母数字中文字符分割
  // 中文：保留连续中文字符
  // 英文：保留连续字母
  return text
    .toLowerCase()
    .replace(/[^\u4e00-\u9fa5a-z0-9]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 2); // 过滤单字/单字母
}

// 停用词表（简化版）
const STOP_WORDS = new Set([
  '的', '了', '是', '在', '我', '有', '和', '就', '不', '人', '都', '一', '一个', '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有', '看', '好', '自己', '这',
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should'
]);
```

#### 2. 关键词提取算法

```javascript
function extractKeywords(text, userInput, maxKeywords = 3) {
  const words = tokenize(text).filter(w => !STOP_WORDS.has(w));
  const userWords = new Set(tokenize(userInput));

  // 计算 TF（词频）
  const freq = {};
  for (const w of words) {
    freq[w] = (freq[w] || 0) + 1;
  }

  // 加权：用户输入中的词权重更高
  const scored = Object.entries(freq).map(([word, count]) => ({
    word,
    score: count * (userWords.has(word) ? 3 : 1) // 用户词 3 倍权重
  }));

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, maxKeywords)
    .map(x => x.word);
}
```

#### 3. 短语提取（从 L1 overview）

```javascript
function extractPhrases(overview, userInput) {
  if (!overview) return [];

  const lines = overview.split('\n');
  const phrases = [];
  const inputWords = new Set(tokenize(userInput));

  for (const line of lines) {
    // 匹配 markdown list 项: "- xxx" 或 "* xxx"
    const listMatch = line.match(/^\s*[-*]\s+(.+)$/);
    if (listMatch) {
      const phrase = listMatch[1].trim();
      const score = calculateOverlap(inputWords, new Set(tokenize(phrase)));
      if (score > 0) {
        phrases.push({ phrase, score, type: 'bullet' });
      }
      continue;
    }

    // 匹配 "Key User Messages" 下的引用
    const quoteMatch = line.match(/^\s*[""'](.+)[""']\s*\(/);
    if (quoteMatch) {
      const phrase = quoteMatch[1].trim();
      const score = calculateOverlap(inputWords, new Set(tokenize(phrase)));
      if (score > 0) {
        phrases.push({ phrase, score, type: 'quote' });
      }
    }
  }

  return phrases.sort((a, b) => b.score - a.score).slice(0, 3);
}
```

#### 4. 相关性评分

```javascript
function calculateRelevance(inputWords, text) {
  const textWords = new Set(tokenize(text));

  // Jaccard 相似度 + 加权
  let intersection = 0;
  let weightedIntersection = 0;

  for (const word of inputWords) {
    if (textWords.has(word)) {
      intersection++;
      weightedIntersection += 2; // 完全匹配权重更高
    } else {
      // 检查前缀匹配（如 "部署" 匹配 "部署方案"）
      for (const tw of textWords) {
        if (tw.includes(word) || word.includes(tw)) {
          weightedIntersection += 1;
          break;
        }
      }
    }
  }

  const union = new Set([...inputWords, ...textWords]).size;
  const jaccard = union > 0 ? intersection / union : 0;

  // 综合分数：Jaccard + 加权重叠 + 长度惩罚（避免太长）
  const lengthPenalty = Math.min(text.length / 200, 1); // 超过200字开始惩罚
  return (jaccard * 0.4 + (weightedIntersection / inputWords.size) * 0.6) * (1 - lengthPenalty * 0.2);
}
```

#### 5. 补全生成

```javascript
function buildSuggestion(userInput, source, memory, sessionItem) {
  const inputLower = userInput.toLowerCase().trim();

  // 策略 1：从 L1 提取的短语直接作为补全
  if (source === 'memory' && memory.phrases && memory.phrases.length > 0) {
    const bestPhrase = memory.phrases[0];
    return {
      type: 'phrase',
      displayText: `...${truncate(bestPhrase.phrase, 40)}`,
      insertText: bestPhrase.phrase,
      source: 'memory',
      sourceUri: memory.uri,
      score: memory.score * 0.8 + bestPhrase.score * 0.2,
      fullText: memory.abstract
    };
  }

  // 策略 2：关键词续写
  if (source === 'memory' && memory.keywords && memory.keywords.length > 0) {
    const continuation = memory.keywords.join('、');
    return {
      type: 'keyword',
      displayText: `${userInput} ... ${continuation}`,
      insertText: `${userInput}${userInput.endsWith(' ') ? '' : ' '}${continuation}`,
      source: 'memory',
      sourceUri: memory.uri,
      score: memory.score,
      fullText: memory.abstract
    };
  }

  // 策略 3：会话上下文续写
  if (source === 'session' && sessionItem) {
    return {
      type: 'session',
      displayText: `...${truncate(sessionItem.text, 40)}`,
      insertText: sessionItem.text,
      source: 'session',
      score: sessionItem.score,
      fullText: sessionItem.text
    };
  }

  // 兜底：返回记忆标题
  return {
    type: 'fallback',
    displayText: `[记忆] ${truncate(memory?.abstract || sessionItem?.text || '', 30)}`,
    insertText: memory?.abstract || sessionItem?.text || '',
    source: source,
    score: 0.1
  };
}
```

#### 6. 综合排序

```javascript
function mergeAndRank(memorySuggestions, sessionSuggestions, maxResults = 3) {
  const all = [
    ...memorySuggestions.map(s => ({ ...s, sourceType: 'memory' })),
    ...sessionSuggestions.map(s => ({ ...s, sourceType: 'session' }))
  ];

  // 排序：分数降序
  all.sort((a, b) => b.score - a.score);

  // 去重：相同 insertText 只保留分数最高的
  const seen = new Set();
  const unique = [];
  for (const s of all) {
    const key = s.insertText.slice(0, 50); // 前50字作为去重键
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(s);
    }
  }

  return unique.slice(0, maxResults);
}
```

### 主入口函数

```javascript
export async function generateCompletions(userInput, memories, platformConfig) {
  // 1. 提取当前会话内容
  const sessionMessages = extractSessionMessages(platformConfig.id);
  const sessionContext = processSessionContext(sessionMessages, userInput);

  // 2. 处理记忆来源
  const memorySuggestions = [];
  for (const memory of memories.slice(0, 5)) {
    // 从 L1 overview 提取短语
    const phrases = extractPhrases(memory.overview, userInput);

    // 从 L0 abstract 提取关键词
    const keywords = extractKeywords(memory.abstract, userInput);

    const enrichedMemory = { ...memory, phrases, keywords };

    // 生成补全建议
    if (phrases.length > 0) {
      memorySuggestions.push(buildSuggestion(userInput, 'memory', enrichedMemory, null));
    } else if (keywords.length > 0) {
      memorySuggestions.push(buildSuggestion(userInput, 'memory', enrichedMemory, null));
    } else {
      // 兜底
      memorySuggestions.push({
        type: 'fallback',
        displayText: `[记忆] ${truncate(memory.abstract, 30)}`,
        insertText: memory.abstract,
        source: 'memory',
        sourceUri: memory.uri,
        score: memory.score * 0.5
      });
    }
  }

  // 3. 处理会话来源
  const sessionSuggestions = [];
  for (const item of sessionContext) {
    sessionSuggestions.push(buildSuggestion(userInput, 'session', null, item));
  }

  // 4. 综合排序
  return mergeAndRank(memorySuggestions, sessionSuggestions, 3);
}
```

### 键盘交互设计

#### 事件处理

```javascript
// src/panels/association/suggestions.js

let selectedIndex = -1;
let currentSuggestions = [];
let keyboardBound = false;

export function bindKeyboardNavigation(textarea) {
  if (keyboardBound) return;
  keyboardBound = true;

  textarea.addEventListener('keydown', (e) => {
    if (!isSuggestionsVisible()) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        selectedIndex = Math.min(selectedIndex + 1, currentSuggestions.length - 1);
        updateSelection();
        break;

      case 'ArrowUp':
        e.preventDefault();
        selectedIndex = Math.max(selectedIndex - 1, -1);
        updateSelection();
        break;

      case 'Tab':
        e.preventDefault();
        if (selectedIndex >= 0) {
          insertSuggestion(textarea, currentSuggestions[selectedIndex]);
        } else if (currentSuggestions.length > 0) {
          // Tab 默认选第一条
          insertSuggestion(textarea, currentSuggestions[0]);
        }
        break;

      case 'Enter':
        if (selectedIndex >= 0) {
          e.preventDefault();
          insertSuggestion(textarea, currentSuggestions[selectedIndex]);
        }
        break;

      case 'Escape':
        hideSuggestions();
        break;
    }
  });
}

function updateSelection() {
  const items = document.querySelectorAll('.echomem-suggestion-item');
  items.forEach((item, i) => {
    if (i === selectedIndex) {
      item.classList.add('echomem-suggestion-active');
      item.style.background = '#e8eaf6';
    } else {
      item.classList.remove('echomem-suggestion-active');
      item.style.background = '';
    }
  });
}
```

#### 浮层渲染（支持来源标记）

```javascript
export function renderCompletions(textarea, completions) {
  currentSuggestions = completions;
  selectedIndex = completions.length > 0 ? 0 : -1;

  const container = getOrCreateContainer();

  const items = completions.map((c, i) => {
    const sourceBadge = c.sourceType === 'memory'
      ? '<span class="echomem-source-badge memory">记忆</span>'
      : '<span class="echomem-source-badge session">会话</span>';

    return `
      <div class="echomem-suggestion-item ${i === 0 ? 'echomem-suggestion-active' : ''}"
           data-index="${i}"
           style="${i === 0 ? 'background: #e8eaf6;' : ''}">
        <span class="suggestion-text">${escapeHtml(c.displayText)}</span>
        <div class="suggestion-meta">
          ${sourceBadge}
          <span class="suggestion-score">${c.score.toFixed(2)}</span>
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = items || '<div class="echomem-suggestion-empty">无相关建议</div>';
  container.style.display = 'block';
  positionContainer(container, textarea);

  // 绑定点击事件
  container.querySelectorAll('.echomem-suggestion-item').forEach(item => {
    item.addEventListener('mousedown', (e) => {
      e.preventDefault();
      const idx = Number(item.dataset.index);
      insertSuggestion(textarea, completions[idx]);
    });
  });
}
```

### 样式设计

```css
/* 新增/修改 content.css */

.echomem-suggestions-container {
  background: #fff;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  max-height: 200px;
  overflow-y: auto;
  z-index: 999999;
  font-size: 13px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.echomem-suggestion-item {
  padding: 10px 12px;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #f0f0f0;
  transition: background 0.15s;
}

.echomem-suggestion-item:last-child {
  border-bottom: none;
}

.echomem-suggestion-item:hover,
.echomem-suggestion-active {
  background: #e8eaf6;
}

.echomem-suggestion-item .suggestion-text {
  color: #333;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-right: 8px;
}

.echomem-suggestion-item .suggestion-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.echomem-source-badge {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 500;
}

.echomem-source-badge.memory {
  background: #e3f2fd;
  color: #1976d2;
}

.echomem-source-badge.session {
  background: #e8f5e9;
  color: #388e3c;
}

.echomem-suggestion-item .suggestion-score {
  color: #999;
  font-size: 11px;
}

.echomem-suggestion-empty {
  padding: 16px;
  text-align: center;
  color: #999;
  font-size: 13px;
}
```

## 文件变更计划

### 新增文件

| 文件 | 说明 |
|------|------|
| `src/core/completion-engine.js` | 补全引擎：关键词提取、短语提取、相关性评分、补全生成、综合排序 |
| `src/utils/text-processor.js` | 文本处理工具：分词、停用词、句子分割、截断 |
| `src/core/session-extractor.js` | 会话内容提取：从页面 DOM 提取当前聊天记录 |

### 修改文件

| 文件 | 变更内容 |
|------|----------|
| `src/core/input-tracker.js` | 集成 completion-engine，同时调用 OpenViking + 提取会话内容 |
| `src/panels/association/suggestions.js` | 重构为 renderCompletions，支持键盘导航、来源标记、新插入逻辑 |
| `src/platforms/higo.js` | 添加聊天消息 DOM 选择器配置 |
| `src/platforms/deepseek.js` | 添加聊天消息 DOM 选择器配置 |
| `content.css` | 新增来源标记样式、选中态样式 |

### 删除/废弃

无（完全兼容现有架构）

## 实施步骤

### Step 1: 文本处理工具（0.5 天）

- [ ] 新建 `src/utils/text-processor.js`
- [ ] 实现 `tokenize()` 中英文混合分词
- [ ] 实现 `splitSentences()` 句子分割
- [ ] 实现 `truncate()` 文本截断
- [ ] 定义 `STOP_WORDS` 停用词表

### Step 2: 会话内容提取（0.5 天）

- [ ] 新建 `src/core/session-extractor.js`
- [ ] 实现 HIGO 消息提取
- [ ] 实现 DeepSeek 消息提取
- [ ] 实现 `processSessionContext()` 上下文处理

### Step 3: 补全引擎（1 天）

- [ ] 新建 `src/core/completion-engine.js`
- [ ] 实现 `extractKeywords()`
- [ ] 实现 `extractPhrases()`
- [ ] 实现 `calculateRelevance()`
- [ ] 实现 `buildSuggestion()`
- [ ] 实现 `mergeAndRank()`
- [ ] 实现主入口 `generateCompletions()`

### Step 4: 建议浮层重构（1 天）

- [ ] 修改 `src/panels/association/suggestions.js`
- [ ] 实现键盘导航（↑↓TabEnterEsc）
- [ ] 实现来源标记展示
- [ ] 实现新的插入逻辑

### Step 5: 集成与测试（1 天）

- [ ] 修改 `src/core/input-tracker.js` 集成双源
- [ ] 修改平台配置添加消息选择器
- [ ] 更新 `content.css`
- [ ] `npm run build`
- [ ] 页面端测试验证

## 测试方案

### 测试用例

| # | 测试项 | 操作 | 预期结果 |
|---|--------|------|----------|
| 1 | 双源召回 | 输入与历史记忆和当前会话都相关的词 | 浮层同时显示 [记忆] 和 [会话] 标记的建议 |
| 2 | 记忆来源 | 输入只与历史记忆相关 | 显示 [记忆] 标记的建议 |
| 3 | 会话来源 | 输入只与当前会话相关 | 显示 [会话] 标记的建议 |
| 4 | 综合排序 | 输入同时触发多个来源 | Top-3 按分数排序，可能混合两种来源 |
| 5 | 键盘下键 | 按 ↓ | 选中第二条，高亮切换 |
| 6 | 键盘上键 | 按 ↑ | 选中第一条，高亮切换 |
| 7 | Tab 补全 | 按 Tab | 插入当前选中建议（默认第一条） |
| 8 | Enter 确认 | 按 Enter | 插入当前选中建议 |
| 9 | Esc 关闭 | 按 Esc | 浮层消失 |
| 10 | 点击选择 | 点击某条建议 | 插入该建议，浮层消失 |
| 11 | 短语补全 | 点击含 "..." 的建议 | 插入完整短语而非关键词 |
| 12 | 关键词补全 | 点击 "输入...关键词" 格式 | 插入 "输入 关键词1、关键词2" |
| 13 | 无建议 | 输入无关内容 | 浮层显示 "无相关建议" 或隐藏 |
| 14 | 中文分词 | 输入 "部署" | 能正确匹配 "Docker部署" 中的 "部署" |
| 15 | 跨平台 | DeepSeek 重复以上测试 | 行为一致 |

## 风险与应对

| 风险 | 影响 | 应对 |
|------|------|------|
| HIGO DOM 结构变化 | 会话提取失败 | 选择器配置支持多候选，增加容错 |
| 中文分词不准确 | 相关性评分偏差 | 先使用简单分词，后续可引入分词库 |
| 会话内容过多 | 处理延迟 | 只取最近 10 条消息，限制处理文本长度 |
| 建议质量不稳定 | 用户体验差 | 提供配置项调整算法参数（阈值、权重） |
| 与页面快捷键冲突 | Tab 等行为异常 | 只在浮层展示时拦截键盘事件 |

## 后续演进

1. **LLM 增强**：召回记忆 + 会话上下文作为 prompt，调用轻量 LLM 生成更自然的补全
2. **个性化学习**：记录用户点击行为，调整排序权重
3. **多轮补全**：支持连续补全（补全后继续触发下一轮）
4. **配置面板**：提供算法参数调节 UI（阈值、停用词、权重）

## 参考

- [OpenViking ContextLevel 定义](../OpenViking-0.3.12/openviking/core/context.py)
- [一次性兼容架构方案](./2026-05-07-input-association-unified.md)
- [输入联想实现计划](./2026-05-07-input-association-implementation-plan.md)
