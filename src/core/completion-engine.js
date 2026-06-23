// 文档：docs/flows/input-association/补全流程.md
// 补全引擎 — 关键词提取、短语提取、相关性评分、补全生成、排序

import {
  tokenize,
  tokenizeAndFilter,
  splitSentences,
  truncate,
  calculateOverlap,
  stripMetadataTags
} from '../utils/text-processor.js';
import { getCompletionConfig } from '../services/config.js';

let phraseScoreThreshold = 0.2;

async function refreshThreshold() {
  const config = await getCompletionConfig();
  phraseScoreThreshold = config.phraseScoreThreshold;
}

/**
 * 从文本中提取关键词
 * @param {string} text - 源文本
 * @param {string} userInput - 用户输入（用于加权）
 * @param {number} maxKeywords - 最多返回几个关键词
 * @returns {string[]}
 */
export function extractKeywords(text, userInput, maxKeywords = 3) {
  if (!text) return [];

  const words = tokenizeAndFilter(text);
  const userWords = new Set(tokenize(userInput));

  // 计算 TF（词频）
  const freq = {};
  for (const w of words) {
    freq[w] = (freq[w] || 0) + 1;
  }

  // 加权：用户输入中的词权重更高
  const scored = Object.entries(freq).map(([word, count]) => ({
    word,
    score: count * (userWords.has(word) ? 3 : 1)
  }));

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, maxKeywords)
    .map(x => x.word);
}

/**
 * 从 L1 overview 中提取结构化短语
 * @param {string} overview - L1 overview 文本
 * @param {string} userInput - 用户输入
 * @returns {Array<{phrase: string, score: number, type: string}>}
 */
export function extractPhrases(overview, userInput) {
  if (!overview) {
    console.log('EchoMem: extractPhrases overview is empty');
    return [];
  }

  const lines = overview.split('\n');
  const phrases = [];
  const inputWords = new Set(tokenize(userInput));

  console.log('EchoMem: extractPhrases inputWords', [...inputWords], 'threshold', phraseScoreThreshold);
  console.log('EchoMem: overview lines count', lines.length);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.length < 5) continue;

    // 匹配 markdown list 项: "- xxx" 或 "* xxx"
    const listMatch = trimmed.match(/^[-*]\s+(.+)$/);
    if (listMatch) {
      const phrase = listMatch[1].trim();
      const phraseWords = new Set(tokenize(phrase));
      const score = calculatePhraseScore(inputWords, phraseWords, phrase);
      console.log('EchoMem: list item', phrase.slice(0, 40), 'score', score, 'threshold', phraseScoreThreshold);
      if (score > phraseScoreThreshold) {
        phrases.push({ phrase, score, type: 'bullet' });
      }
      continue;
    }

    // 匹配 "Key User Messages" 下的引用: "xxx" (Speaker)
    const quoteMatch = trimmed.match(/^[""'](.+)[""']\s*\(/);
    if (quoteMatch) {
      const phrase = quoteMatch[1].trim();
      const phraseWords = new Set(tokenize(phrase));
      const score = calculatePhraseScore(inputWords, phraseWords, phrase);
      console.log('EchoMem: quote', phrase.slice(0, 40), 'score', score);
      if (score > phraseScoreThreshold) {
        phrases.push({ phrase, score, type: 'quote' });
      }
      continue;
    }

    // 匹配 "## 标题" 下的内容行
    if (!trimmed.startsWith('#') && !trimmed.startsWith('-') && !trimmed.startsWith('*')) {
      const phraseWords = new Set(tokenize(trimmed));
      const score = calculatePhraseScore(inputWords, phraseWords, trimmed);
      console.log('EchoMem: text line', trimmed.slice(0, 40), 'score', score, 'threshold', phraseScoreThreshold + 0.25);
      if (score > phraseScoreThreshold + 0.25) {
        phrases.push({ phrase: trimmed, score, type: 'text' });
      }
    }
  }

  console.log('EchoMem: extractPhrases result', phrases.length, 'phrases');
  return phrases.sort((a, b) => b.score - a.score).slice(0, 3);
}

/**
 * 计算短语与用户输入的相关性分数
 */
function calculatePhraseScore(inputWords, phraseWords, phrase) {
  if (!inputWords.size || !phraseWords.size) return 0;

  const overlap = calculateOverlap(inputWords, phraseWords);

  // Jaccard
  const intersection = new Set([...inputWords].filter(x => phraseWords.has(x))).size;
  const union = new Set([...inputWords, ...phraseWords]).size;
  const jaccard = union > 0 ? intersection / union : 0;

  // 长度惩罚（避免太长）
  const lengthPenalty = Math.min(phrase.length / 150, 1);

  return (jaccard * 0.4 + (overlap / (inputWords.size * 2)) * 0.6) * (1 - lengthPenalty * 0.15);
}

/**
 * 计算文本与用户输入的相关性
 * @param {Set<string>} inputWords
 * @param {string} text
 * @returns {number}
 */
export function calculateRelevance(inputWords, text) {
  if (!inputWords.size || !text) return 0;

  const textWords = new Set(tokenize(text));
  if (!textWords.size) return 0;

  const overlap = calculateOverlap(inputWords, textWords);

  // Jaccard
  const intersection = new Set([...inputWords].filter(x => textWords.has(x))).size;
  const union = new Set([...inputWords, ...textWords]).size;
  const jaccard = union > 0 ? intersection / union : 0;

  // 长度惩罚（避免太长）
  const lengthPenalty = Math.min(text.length / 200, 1);

  return (jaccard * 0.4 + (overlap / (inputWords.size * 2)) * 0.6) * (1 - lengthPenalty * 0.2);
}

/**
 * 构建单条补全建议
 * @param {string} userInput
 * @param {Object} memory - 记忆对象（含 phrases, keywords）
 * @returns {Object|null} - 如果没有提取到有效内容则返回 null
 */
function buildSuggestion(userInput, memory) {
  const inputTrimmed = userInput.trim();
  const cleanedText = stripMetadataTags(memory.text || memory.abstract || memory.overview || '');

  // 策略 1：从 L1 提取的短语直接作为补全
  if (memory?.phrases?.length > 0) {
    const bestPhrase = memory.phrases[0];
    return {
      type: 'phrase',
      displayText: `...${truncate(bestPhrase.phrase, 60)}`,
      insertText: bestPhrase.phrase,
      source: 'memory',
      sourceUri: memory.uri || memory.evidence_uri || '',
      score: (memory.score || 0.5) * 0.7 + bestPhrase.score * 0.3,
      fullText: cleanedText || bestPhrase.phrase
    };
  }

  // 策略 2：没有提取到短语时，用清理后的完整摘要兜底
  if (cleanedText) {
    return {
      type: 'summary',
      displayText: `...${truncate(cleanedText, 60)}`,
      insertText: cleanedText,
      source: 'memory',
      sourceUri: memory.uri || memory.evidence_uri || '',
      score: memory.score || 0.5,
      fullText: cleanedText
    };
  }

  // 策略 3：关键词续写（最后兜底）
  if (memory?.keywords?.length > 0) {
    const continuation = memory.keywords.join('、');
    return {
      type: 'keyword',
      displayText: `...${truncate(continuation, 60)}`,
      insertText: continuation,
      source: 'memory',
      sourceUri: memory.uri || memory.evidence_uri || '',
      score: memory.score || 0.5,
      fullText: cleanedText
    };
  }

  // 没有提取到有效内容，不生成建议
  return null;
}

/**
 * 处理记忆列表，生成补全建议
 * @param {string} userInput
 * @param {Array} memories - EchoMem 返回的记忆列表
 * @returns {Array}
 */
function processMemories(userInput, memories) {
  const suggestions = [];

  for (const memory of memories.slice(0, 5)) {
    // 使用 EchoMem 语义分数过滤（memory.score 已经是语义相关性）
    const semanticScore = memory.score || 0;
    if (semanticScore < phraseScoreThreshold) {
      console.log('EchoMem: memory filtered out by semantic score', semanticScore, '<', phraseScoreThreshold, memory.uri);
      continue;
    }

    // 从 text 提取短语（EchoMem 返回 text；兼容 overview/abstract 兜底）
    const sourceText = stripMetadataTags(memory.text || memory.overview || memory.abstract || '');
    const phrases = extractPhrases(sourceText, userInput);

    console.log('EchoMem: memory', memory.uri || memory.evidence_uri || 'no-uri', 'semanticScore', semanticScore, 'phrases', phrases.length);

    // 同时提取关键词作为备选
    const keywords = extractKeywords(sourceText, userInput, 3);
    const enrichedMemory = { ...memory, phrases, keywords };

    // 生成补全建议（可能为 null）
    const suggestion = buildSuggestion(userInput, enrichedMemory);
    if (suggestion) {
      suggestions.push(suggestion);
    } else {
      console.log('EchoMem: no suggestion generated for', memory.uri || memory.evidence_uri || 'no-uri');
    }
  }

  return suggestions;
}

/**
 * 排序并去重
 * @param {Array} suggestions
 * @param {number} maxResults
 * @returns {Array}
 */
function rankAndDeduplicate(suggestions, maxResults = 3) {
  // 按分数降序排序
  suggestions.sort((a, b) => b.score - a.score);

  // 去重：相同 insertText 只保留分数最高的
  const seen = new Set();
  const unique = [];

  for (const s of suggestions) {
    const key = s.insertText.slice(0, 50); // 前50字作为去重键
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(s);
    }
  }

  return unique.slice(0, maxResults);
}

/**
 * 主入口：生成补全建议
 * @param {string} userInput - 用户当前输入
 * @param {Array} memories - EchoMem 返回的记忆列表
 * @param {number} maxResults - 最多返回几条
 * @returns {Array}
 */
export async function generateCompletions(userInput, memories, maxResults = 3) {
  if (!userInput || !memories?.length) {
    return [];
  }

  // 每次生成前刷新阈值（用户可能在配置面板修改了）
  await refreshThreshold();
  console.log('EchoMem: phraseScoreThreshold =', phraseScoreThreshold);

  // 处理记忆来源
  const suggestions = processMemories(userInput, memories);
  console.log('EchoMem: raw suggestions =', suggestions.map(s => ({ type: s.type, score: s.score, display: s.displayText })));

  // 排序去重
  return rankAndDeduplicate(suggestions, maxResults);
}
