// 文本处理工具 — 分词、停用词、句子分割、截断

/**
 * 停用词表（中文 + 英文）
 */
const STOP_WORDS = new Set([
  // 中文停用词
  '的', '了', '是', '在', '我', '有', '和', '就', '不', '人', '都', '一', '一个', '上', '也',
  '很', '到', '说', '要', '去', '你', '会', '着', '没有', '看', '好', '自己', '这', '那',
  '中', '为', '来', '个', '以', '大', '地', '到', '及', '与', '或', '等', '之', '而',
  '可以', '这个', '那个', '什么', '怎么', '如何', '还是', '但是', '因为', '所以',
  // 英文停用词
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
  'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them',
  'my', 'your', 'his', 'its', 'our', 'their', 'this', 'that', 'these', 'those',
  'and', 'or', 'but', 'if', 'then', 'else', 'when', 'where', 'why', 'how',
  'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such',
  'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very',
  'can', 'just', 'should', 'now', 'to', 'of', 'in', 'for', 'on', 'with', 'at',
  'from', 'by', 'about', 'into', 'through', 'during', 'before', 'after',
  'above', 'below', 'between', 'under', 'again', 'further', 'then', 'once'
]);

/**
 * 中英文混合分词
 * - 中文：保留连续中文字符（长度>=2）
 * - 英文/数字：保留连续字母数字（长度>=2）
 * @param {string} text
 * @returns {string[]}
 */
export function tokenize(text) {
  if (!text || typeof text !== 'string') return [];

  const tokens = [];
  // 匹配中文词（2字以上）或英文/数字词（2字符以上）
  const regex = /[\u4e00-\u9fa5]{2,}|[a-zA-Z0-9]{2,}/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    tokens.push(match[0].toLowerCase());
  }

  return tokens;
}

/**
 * 过滤停用词
 * @param {string[]} tokens
 * @returns {string[]}
 */
export function filterStopWords(tokens) {
  return tokens.filter(w => !STOP_WORDS.has(w));
}

/**
 * 分词并过滤停用词（快捷方法）
 * @param {string} text
 * @returns {string[]}
 */
export function tokenizeAndFilter(text) {
  return filterStopWords(tokenize(text));
}

/**
 * 句子分割
 * 按句号、问号、感叹号、换行分割
 * @param {string} text
 * @returns {string[]}
 */
export function splitSentences(text) {
  if (!text) return [];
  return text
    .split(/[。！？\n]+/)
    .map(s => s.trim())
    .filter(s => s.length >= 5); // 过滤过短句子
}

/**
 * 文本截断，添加省略号
 * @param {string} text
 * @param {number} maxLength
 * @returns {string}
 */
export function truncate(text, maxLength = 60) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

/**
 * 清理后端摘要中的元数据标记，如 `[time_expression=下个月]`、`[时间=None]`
 * @param {string} text
 * @returns {string}
 */
export function stripMetadataTags(text) {
  if (!text) return '';
  return text.replace(/\s*\[[^\]]+\]/g, '').trim();
}

/**
 * 计算两个词集合的 Jaccard 相似度
 * @param {Set<string>} setA
 * @param {Set<string>} setB
 * @returns {number}
 */
export function jaccardSimilarity(setA, setB) {
  if (!setA.size || !setB.size) return 0;
  let intersection = 0;
  for (const a of setA) {
    if (setB.has(a)) intersection++;
  }
  const union = new Set([...setA, ...setB]).size;
  return union > 0 ? intersection / union : 0;
}

/**
 * 计算重叠分数（支持包含匹配）
 * @param {Set<string>} inputWords
 * @param {Set<string>} textWords
 * @returns {number}
 */
export function calculateOverlap(inputWords, textWords) {
  if (!inputWords.size || !textWords.size) return 0;

  let exactMatch = 0;
  let partialMatch = 0;

  for (const iw of inputWords) {
    if (textWords.has(iw)) {
      exactMatch += 2;
      continue;
    }
    // 检查部分包含匹配
    for (const tw of textWords) {
      if (tw.includes(iw) || iw.includes(tw)) {
        partialMatch += 1;
        break;
      }
    }
  }

  return exactMatch + partialMatch;
}

/**
 * HTML 转义
 * @param {string} str
 * @returns {string}
 */
export function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}
