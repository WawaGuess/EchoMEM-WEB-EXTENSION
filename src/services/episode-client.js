// EchoMem Episode 时序数据服务
// 通过 fs/tree + fs/read 拉取 engine/echo0_plugin/memory/.episodes 下的 episode body。
// Episode body 已内嵌完整 key_events，故无需读取 events/ 与 timeline/。
// 设计文档：docs/flows/cognitive-feedback/episode-时序.md

import { createClient } from './echomem-client.js';
import { getEchoMemConfig } from './config.js';

const DEFAULT_ENGINE_ID = 'echo0_plugin';

// 事件类型 → 视觉编码（形状由 timeline-layout 消费）
export const EVENT_TYPE_META = {
  observation: { label: '观察', shape: 'circle', color: '#4facfe' },
  decision: { label: '决策', shape: 'diamond', color: '#f6c945' },
  action: { label: '动作', shape: 'dot', color: '#5ee6a8' },
  state_change: { label: '状态变化', shape: 'triangle', color: '#cc66ff' },
  milestone: { label: '里程碑', shape: 'star', color: '#ff7eb6' },
};

// arc_stage → 概览条配色
export const ARC_STAGE_COLOR = {
  beginning: '#3a8dde',
  middle: '#667eea',
  end: '#9b6ef0',
  ongoing: '#00c2c7',
};

function parseTime(value) {
  if (!value) return null;
  const t = Date.parse(value);
  return Number.isNaN(t) ? null : t;
}

// 根据后端 episode_sync 的因果规则，判断相邻事件是否构成因果链：
//   state_change|decision  →  action|milestone|state_change
function isCausalLink(prevType, nextType) {
  const causes = prevType === 'state_change' || prevType === 'decision';
  const effects =
    nextType === 'action' || nextType === 'milestone' || nextType === 'state_change';
  return causes && effects;
}

function normalizeEvent(raw, fallbackIdx) {
  return {
    id: String(raw.event_id || `evt_${fallbackIdx}`),
    type: String(raw.event_type || 'observation'),
    description: String(raw.description || ''),
    time: parseTime(raw.timestamp),
    rawTime: String(raw.timestamp || ''),
    precedingId: String(raw.preceding_event_id || ''),
    sourceTurnId: String(raw.source_turn_id || ''),
    confidence: typeof raw.confidence === 'number' ? raw.confidence : 1.0,
  };
}

function normalizeEpisode(raw) {
  const events = (raw.key_events || [])
    .map((e, i) => normalizeEvent(e, i))
    // 优先按 time 升序；无 time 的保持原顺序并排在末尾
    .sort((a, b) => {
      if (a.time == null && b.time == null) return 0;
      if (a.time == null) return 1;
      if (b.time == null) return -1;
      return a.time - b.time;
    });

  // 标记因果起点（供时间线连线区分 temporal_next / causal）
  for (let i = 0; i < events.length - 1; i++) {
    events[i].causalTo = isCausalLink(events[i].type, events[i + 1].type);
  }

  return {
    id: String(raw.episode_id || ''),
    title: String(raw.title || raw.episode_id || '未命名 Episode'),
    summary: String(raw.summary || ''),
    rawStartTime: String(raw.start_time || ''),
    rawEndTime: String(raw.end_time || ''),
    rawLastActiveAt: String(raw.last_active_at || ''),
    startTime: parseTime(raw.start_time),
    endTime: parseTime(raw.end_time),
    lastActiveAt: parseTime(raw.last_active_at),
    arcStage: String(raw.arc_stage || 'ongoing'),
    status: String(raw.status || 'ongoing'),
    salience: typeof raw.salience_score === 'number' ? raw.salience_score : 0,
    confidence: typeof raw.confidence === 'number' ? raw.confidence : null,
    retentionTier: String(raw.retention_tier || ''),
    turnCount: typeof raw.turn_count === 'number' ? raw.turn_count : 0,
    topics: Array.isArray(raw.topics) ? raw.topics.map(String) : [],
    entities: Array.isArray(raw.entities) ? raw.entities.map(String) : [],
    participants: Array.isArray(raw.participants) ? raw.participants.map(String) : [],
    atomRefs: Array.isArray(raw.atom_refs) ? raw.atom_refs.map(String) : [],
    segments: (raw.segments || []).map((s) => ({
      sessionId: String(s.session_id || ''),
      startMsgIdx: Number(s.start_msg_idx || 0),
      endMsgIdx: Number(s.end_msg_idx || 0),
    })),
    followsRefs: Array.isArray(raw.follows_refs) ? raw.follows_refs.map(String) : [],
    branchesToRefs: Array.isArray(raw.branches_to_refs)
      ? raw.branches_to_refs.map(String)
      : [],
    events,
  };
}

/**
 * 拉取并规范化 episode 时序模型
 * @returns {Promise<{episodes: object[], timeRange: {min: number|null, max: number|null}}>}
 */
export async function fetchEpisodeTimeline(options = {}) {
  const cfg = await getEchoMemConfig();
  const client = createClient(cfg);
  const engineId = options.engineId || DEFAULT_ENGINE_ID;
  const baseUri = `echo://engine/${engineId}/memory/.episodes`;

  const tree = await client.fsTree(baseUri, { maxDepth: 3 });
  const entries = tree?.entries || [];

  const bodyFiles = entries.filter(
    (e) =>
      e.kind === 'file' &&
      e.uri.includes('/episodes/') &&
      e.uri.endsWith('.json')
  );

  const results = await Promise.all(
    bodyFiles.map(async (entry) => {
      try {
        const text = await client.fsRead(entry.uri);
        return JSON.parse(text);
      } catch (err) {
        console.warn('EchoMem episode: failed to read body', entry.uri, err.message);
        return null;
      }
    })
  );

  const episodes = results
    .filter(Boolean)
    .map(normalizeEpisode)
    .filter((ep) => ep.id);

  // 全局时间范围（用于时间轴 scale）
  const stamps = [];
  episodes.forEach((ep) => {
    if (ep.startTime != null) stamps.push(ep.startTime);
    if (ep.endTime != null) stamps.push(ep.endTime);
    ep.events.forEach((ev) => {
      if (ev.time != null) stamps.push(ev.time);
    });
  });

  const timeRange =
    stamps.length > 0
      ? { min: Math.min(...stamps), max: Math.max(...stamps) }
      : { min: null, max: null };

  return { episodes, timeRange };
}
