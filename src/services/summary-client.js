// EchoMem Summary 数据服务
// 通过 EchoFS 拉取 engines/echo0_plugin/memory/summary/daily/ 和 weekly/ 下的 JSON。

import { createClient } from './echomem-client.js';
import { getEchoMemConfig } from './config.js';

const DEFAULT_ENGINE_ID = 'echo0_plugin';

function formatWeekKey(d) {
  const iso = d.toISOString().slice(0, 10);
  return iso;
}

function getWeekKey(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z');
  const day = d.getUTCDay();
  const diff = (day === 0 ? -6 : 1) - day; // Monday-based
  const monday = new Date(d.getTime() + diff * 24 * 60 * 60 * 1000);
  const year = monday.getUTCFullYear();
  const week = getISOWeek(monday);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

function getISOWeek(d) {
  const tmp = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  return Math.ceil((((tmp - yearStart) / 86400000) + 1) / 7);
}

function parseSummary(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const type = raw.type === 'weekly' ? 'weekly' : 'daily';
  return {
    type,
    date: raw.date || raw.date_range?.start || '',
    year: raw.year || 0,
    week: raw.week || 0,
    dateRange: raw.date_range || null,
    generatedAt: raw.generated_at || '',
    basedOn: raw.based_on || {},
    metrics: raw.metrics || {},
    overview: raw.overview || '',
    narrative: raw.narrative || '',
    keyFacts: Array.isArray(raw.key_facts) ? raw.key_facts.map(_normalizeFact) : [],
    decisions: Array.isArray(raw.decisions) ? raw.decisions.map(_normalizeDecision) : [],
    actionItems: Array.isArray(raw.action_items) ? raw.action_items.map(_normalizeActionItem) : [],
    emotions: Array.isArray(raw.emotions) ? raw.emotions : [],
    topics: Array.isArray(raw.topics) ? raw.topics : [],
    people: Array.isArray(raw.people) ? raw.people : [],
    highlight: _normalizeHighlight(raw.highlight),
    themeClusters: Array.isArray(raw.theme_clusters) ? raw.theme_clusters.map(_normalizeThemeCluster) : [],
    highlights: Array.isArray(raw.highlights) ? raw.highlights.map(_normalizeHighlightItem) : [],
    memoryUpdates: Array.isArray(raw.memory_updates) ? raw.memory_updates.map(_normalizeMemoryUpdate) : [],
    suggestions: Array.isArray(raw.suggestions) ? raw.suggestions : [],
    agentNote: raw.agent_note || '',
  };
}

function _normalizeHighlight(item) {
  if (!item) return null;
  if (typeof item === 'string') return { type: '', description: item };
  if (typeof item === 'object') {
    return {
      type: item.type || item.category || '',
      description: item.description || item.content || item.text || '',
    };
  }
  return { type: '', description: String(item) };
}

function _normalizeFact(item) {
  if (typeof item === 'string') {
    return { statement: item, importance: '', is_update: false, previous_version: '', atom_ids: [], source_turn_ids: [] };
  }
  if (item && typeof item === 'object') {
    return {
      statement: item.statement || item.fact || item.content || JSON.stringify(item),
      importance: item.importance || '',
      is_update: Boolean(item.is_update),
      previous_version: item.previous_version || '',
      atom_ids: Array.isArray(item.atom_ids) ? item.atom_ids : [],
      source_turn_ids: Array.isArray(item.source_turn_ids) ? item.source_turn_ids : [],
    };
  }
  return { statement: String(item || ''), importance: '', is_update: false, previous_version: '', atom_ids: [], source_turn_ids: [] };
}

function _normalizeDecision(item) {
  if (typeof item === 'string') {
    return { description: item, evidence: '' };
  }
  if (item && typeof item === 'object') {
    return {
      description: item.description || item.decision || item.content || JSON.stringify(item),
      evidence: item.evidence || '',
    };
  }
  return { description: String(item || ''), evidence: '' };
}

// 主题聚类：后端可能直接给字符串，也可能给 { theme, keywords } 对象
function _normalizeThemeCluster(item) {
  if (typeof item === 'string') {
    return { theme: item, keywords: [] };
  }
  if (item && typeof item === 'object') {
    return {
      theme: item.theme || item.name || item.title || item.topic || JSON.stringify(item),
      keywords: Array.isArray(item.keywords) ? item.keywords : [],
    };
  }
  return { theme: String(item || ''), keywords: [] };
}

// 本周高光：后端可能直接给字符串，也可能给 { type, description } 对象
function _normalizeHighlightItem(item) {
  if (typeof item === 'string') {
    return { type: '', description: item };
  }
  if (item && typeof item === 'object') {
    return {
      type: item.type || item.category || '',
      description: item.description || item.content || item.text || JSON.stringify(item),
    };
  }
  return { type: '', description: String(item || '') };
}

// 记忆更新：后端可能直接给字符串，也可能给 { statement, is_update } 对象
function _normalizeMemoryUpdate(item) {
  if (typeof item === 'string') {
    return { statement: item, is_update: false };
  }
  if (item && typeof item === 'object') {
    return {
      statement: item.statement || item.fact || item.content || item.description || JSON.stringify(item),
      is_update: Boolean(item.is_update),
    };
  }
  return { statement: String(item || ''), is_update: false };
}

function _normalizeActionItem(item) {
  if (typeof item === 'string') {
    return { description: item, due: '', source: '' };
  }
  if (item && typeof item === 'object') {
    return {
      description: item.description || item.task || item.content || JSON.stringify(item),
      due: item.due || '',
      source: item.source || '',
    };
  }
  return { description: String(item || ''), due: '', source: '' };
}

export async function fetchSummaryList(options = {}) {
  const cfg = await getEchoMemConfig();
  const client = createClient(cfg);
  const engineId = options.engineId || DEFAULT_ENGINE_ID;
  const dailyUri = `echo://engine/${engineId}/memory/summary/daily`;
  const weeklyUri = `echo://engine/${engineId}/memory/summary/weekly`;

  const [dailyTree, weeklyTree] = await Promise.all([
    emptyTreeOnNotFound(client.fsTree(dailyUri, { maxDepth: 2 })),
    emptyTreeOnNotFound(client.fsTree(weeklyUri, { maxDepth: 2 })),
  ]);

  const dailyFiles = (dailyTree?.entries || [])
    .filter((e) => e.kind === 'file' && e.uri.endsWith('.json'))
    .map((e) => e.name.replace('.json', ''))
    .sort();

  const weeklyFiles = (weeklyTree?.entries || [])
    .filter((e) => e.kind === 'file' && e.uri.endsWith('.json'))
    .map((e) => e.name.replace('.json', ''))
    .sort();

  return { daily: dailyFiles, weekly: weeklyFiles };
}

async function emptyTreeOnNotFound(request) {
  try {
    return await request;
  } catch (error) {
    if (error?.status === 404) return { entries: [] };
    throw error;
  }
}

export async function fetchDailySummary(dateStr, options = {}) {
  const cfg = await getEchoMemConfig();
  const client = createClient(cfg);
  const engineId = options.engineId || DEFAULT_ENGINE_ID;
  const uri = `echo://engine/${engineId}/memory/summary/daily/${dateStr}.json`;
  const text = await client.fsRead(uri);
  if (!text) return null;
  return parseSummary(JSON.parse(text));
}

export async function fetchWeeklySummary(weekKey, options = {}) {
  const cfg = await getEchoMemConfig();
  const client = createClient(cfg);
  const engineId = options.engineId || DEFAULT_ENGINE_ID;
  const uri = `echo://engine/${engineId}/memory/summary/weekly/${weekKey}.json`;
  const text = await client.fsRead(uri);
  if (!text) return null;
  return parseSummary(JSON.parse(text));
}

export async function fetchLatestSummary(options = {}) {
  const { daily, weekly } = await fetchSummaryList(options);
  const latestDaily = daily.length ? daily[daily.length - 1] : null;
  const latestWeekly = weekly.length ? weekly[weekly.length - 1] : null;
  return {
    daily: latestDaily ? await fetchDailySummary(latestDaily, options) : null,
    weekly: latestWeekly ? await fetchWeeklySummary(latestWeekly, options) : null,
  };
}

export { getWeekKey, formatWeekKey, parseSummary, _normalizeFact, _normalizeDecision, _normalizeActionItem, emptyTreeOnNotFound };
