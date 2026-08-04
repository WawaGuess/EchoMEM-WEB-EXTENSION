// EchoMem Summary 数据服务
// 通过 fs/tree + fs/read 拉取 engine/echo0_plugin/memory/summary 下的 daily / weekly body。
// 将后端 schema v2 映射为 summary-view.js 所需的 card view-model。

import { createClient } from '../../../services/echomem-client.js';
import { getEchoMemConfig } from '../../../services/config.js';

const DEFAULT_ENGINE_ID = 'echo0_plugin';

const TOPIC_COLORS = ['#6750a4', '#3b8f6c', '#b87a24', '#d47463', '#5b78a8'];
const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

function colorFor(index) {
  return TOPIC_COLORS[index % TOPIC_COLORS.length];
}

function parseDateKey(key) {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function weekdayFor(key) {
  return WEEKDAYS[parseDateKey(key).getUTCDay()];
}

function formatMonthDay(key) {
  const d = parseDateKey(key);
  return `${String(d.getUTCMonth() + 1).padStart(2, '0')} / ${String(d.getUTCDate()).padStart(2, '0')}`;
}

function formatChineseDate(key) {
  const d = parseDateKey(key);
  return `${d.getUTCFullYear()} 年 ${d.getUTCMonth() + 1} 月 ${d.getUTCDate()} 日`;
}

function parseWeekKey(key) {
  const [year, week] = key.split('-W');
  return { year: Number(year), week: Number(week) };
}

function isoWeekMonday(year, week) {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const day = jan4.getUTCDay() || 7;
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - day + 1 + (week - 1) * 7);
  return monday;
}

function weekRangeLabel(key) {
  const { year, week } = parseWeekKey(key);
  const monday = isoWeekMonday(year, week);
  const sunday = new Date(monday);
  sunday.setUTCDate(sunday.getUTCDate() + 6);
  const fmt = (d) => `${d.getUTCMonth() + 1}月${d.getUTCDate()}日`;
  return `${fmt(monday)} — ${fmt(sunday)}`;
}

function safeJson(text) {
  try {
    return JSON.parse(text || '{}');
  } catch {
    return {};
  }
}

async function listJsonFiles(client, uri) {
  const tree = await client.fsTree(uri, { maxDepth: 2 });
  return (tree?.entries || []).filter(
    (e) => e.kind === 'file' && e.uri.endsWith('.json')
  );
}

async function readBodies(client, uri) {
  const files = await listJsonFiles(client, uri);
  const results = await Promise.all(
    files.map(async (entry) => {
      try {
        const text = await client.fsRead(entry.uri);
        return { key: entry.uri.split('/').pop().replace(/\.json$/, ''), body: safeJson(text) };
      } catch (err) {
        console.warn('EchoMem summary: failed to read', entry.uri, err.message);
        return null;
      }
    })
  );
  return results.filter(Boolean);
}

function mapDailyToReview(raw) {
  const date = raw.date || '';
  const based = raw.based_on || {};
  const recap = raw.recap || {};
  const attention = raw.attention || { expression_count: 0, items: [] };
  const facts = Array.isArray(raw.facts) ? raw.facts : [];
  const openItems = Array.isArray(raw.open_items) ? raw.open_items : [];

  return {
    modeLabel: 'DAILY RECAP',
    railTitle: '今天，值得看清什么',
    period: formatChineseDate(date),
    evidenceLabel: `${based.sessions?.length || 0} 段会话 · ${based.atom_count || 0} 条原子 · ${based.message_count || 0} 条消息`,
    cards: {
      overview: {
        label: '今日概览',
        kicker: `${date.slice(0, 4)} · ${formatMonthDay(date)} · ${weekdayFor(date)}`,
        title: recap.title || '这一天',
        subtitle: recap.subtitle || '',
        agentLabel: 'ECHO 注意到',
        agentText: recap.observation || '',
      },
      topics: {
        label: '关注分布',
        kicker: '今日关注分布',
        title: '今天，你主要关注了什么',
        note: `按你的 ${attention.expression_count || 0} 条表达归入 ${attention.items?.length || 0} 个主主题 · 原子用于校准事实`,
        items: (attention.items || []).map((item, index) => ({
          label: item.label || '其他',
          countLabel: `${item.count || 0} 条表达`,
          percent: item.percent || 0,
          insight: item.insight || '',
          color: colorFor(index),
        })),
      },
      facts: {
        label: '今天确定了什么',
        kicker: '值得记住',
        title: '今天真正确定了什么',
        items: facts.map((fact) => ({
          tag: fact.tag || '事实',
          text: fact.text || '',
          evidence: fact.evidence || '',
        })),
      },
      next: {
        label: '接下来',
        kicker: '开放事项',
        title: openItems.length ? '这些事情，还值得继续推进' : '暂时没有明确的后续事项',
        items: openItems.map((item) => ({
          title: item.title || '',
          detail: item.detail || '',
          status: item.status || '待跟进',
        })),
        agentLabel: 'ECHO 的整理',
        agentText: raw.next_observation || '',
      },
    },
  };
}

function mapWeeklyToReview(raw) {
  const year = Number(raw.year || 0);
  const week = Number(raw.week || 0);
  const range = raw.date_range || {};
  const recap = raw.recap || {};
  const trend = raw.attention_trend || { series: [], rows: [] };
  const highlights = Array.isArray(raw.highlights) ? raw.highlights : [];
  const changes = Array.isArray(raw.changes) ? raw.changes : [];
  const openItems = Array.isArray(raw.open_items) ? raw.open_items : [];

  return {
    modeLabel: 'WEEKLY RECAP',
    railTitle: '这一周，什么最重要',
    period: `${year} 年第 ${week} 周`,
    evidenceLabel: `${range.start || ''} — ${range.end || ''} · ${raw.metrics?.days || 0} 天记录`,
    cards: {
      overview: {
        label: '本周概览',
        kicker: `${year} · WEEK ${week} · ${formatMonthDay(range.start)} — ${formatMonthDay(range.end)}`,
        title: recap.title || '这一周',
        subtitle: recap.subtitle || '',
        agentLabel: 'ECHO 的周度观察',
        agentText: recap.observation || '',
      },
      highlights: {
        label: '本周高光',
        kicker: '本周高光',
        title: '真正改变了后续方向的节点',
        items: highlights.map((h) => ({
          date: h.date ? `${formatMonthDay(h.date)} · ${weekdayFor(h.date)}` : '',
          title: h.title || '',
          text: h.text || '',
        })),
      },
      trend: {
        label: '关注变化',
        kicker: '本周关注变化',
        title: '你的注意力，如何一步步转移',
        ariaLabel: `本周关注趋势：${trend.series.map((s) => s.label).join('、')}`,
        series: (trend.series || []).map((s, index) => ({ label: s.label || '', color: colorFor(index) })),
        rows: (trend.rows || []).map((row) => ({
          day: row.day || (row.date ? weekdayFor(row.date) : ''),
          values: Array.isArray(row.values) ? row.values : [],
        })),
        agentLabel: 'ECHO 注意到',
        agentText: trend.observation || '',
      },
      changes: {
        label: '形成的变化',
        kicker: '本周形成的变化',
        title: '目标、协作和风控都发生了具体变化',
        items: changes.map((change) => ({
          tag: change.tag || '变化',
          text: change.text || '',
        })),
      },
      next: {
        label: '尚未结束',
        kicker: '开放事项',
        title: '这些事情，还值得继续推进',
        items: openItems.map((item) => ({
          title: item.title || '',
          detail: item.detail || '',
          status: item.status || '待跟进',
        })),
        agentLabel: 'ECHO 的建议',
        agentText: raw.next_observation || '',
      },
    },
  };
}

function latestKey(keys) {
  return keys.length ? keys.sort().pop() : '';
}

/**
 * 拉取并规范化周期总结模型
 * @param {object} options
 * @param {string} [options.engineId]
 * @param {string} [options.date] 指定日报 key (YYYY-MM-DD)
 * @param {string} [options.week] 指定周报 key (YYYY-Www)
 * @returns {Promise<{daily: {defaultKey:string,items:object}, weekly: {defaultKey:string,items:object}}>}
 */
export async function fetchPeriodicReview(options = {}) {
  const cfg = await getEchoMemConfig();
  const client = createClient(cfg);
  const engineId = options.engineId || DEFAULT_ENGINE_ID;

  const [dailyEntries, weeklyEntries] = await Promise.all([
    readBodies(client, `echo://engine/${engineId}/memory/summary/daily`),
    readBodies(client, `echo://engine/${engineId}/memory/summary/weekly`),
  ]);

  const dailyItems = {};
  dailyEntries.forEach(({ key, body }) => {
    if (body.date) dailyItems[key] = mapDailyToReview(body);
  });

  const weeklyItems = {};
  weeklyEntries.forEach(({ key, body }) => {
    if (body.year && body.week) weeklyItems[key] = mapWeeklyToReview(body);
  });

  const dailyKeys = Object.keys(dailyItems).sort();
  const weeklyKeys = Object.keys(weeklyItems).sort();

  const dailyDefault =
    (options.date && dailyItems[options.date] ? options.date : '') || latestKey(dailyKeys);
  const weeklyDefault =
    (options.week && weeklyItems[options.week] ? options.week : '') || latestKey(weeklyKeys);

  return {
    daily: { defaultKey: dailyDefault, items: dailyItems },
    weekly: { defaultKey: weeklyDefault, items: weeklyItems },
  };
}
