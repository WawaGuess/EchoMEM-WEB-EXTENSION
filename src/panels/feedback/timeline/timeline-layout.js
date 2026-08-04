// 纯布局函数：TimelineModel + 配置 -> SVG 绘制坐标。
// 不触碰 DOM，便于单测。

import { EVENT_TYPE_META, ARC_STAGE_COLOR } from '../../../services/episode-client.js';

const STATUS_OPACITY = {
  ongoing: 0.95,
  closed: 0.85,
  merged: 0.5,
  stale: 0.35,
};

const BAR_H = 22;
const BAR_GAP = 8;
const OVERVIEW_TOP = 24;
const MARK_MIN_GAP = 18; // 同 lane 内事件点最小像素间距

/**
 * @param {object} model fetchEpisodeTimeline 的返回
 * @param {object} cfg
 * @param {'by_event_type'|'by_episode'|'flat'} cfg.groupBy
 * @param {object} cfg.scale createTimeScale 实例
 * @param {number} cfg.laneHeight 单泳道高度
 * @param {number} cfg.topPad 顶部留白（给概览条/刻度）
 * @param {string} [cfg.activeEpisodeId] 当前选中的 episode（事件链只画它）
 */
export function layoutTimeline(model, cfg) {
  const { scale, laneHeight = 64, topPad = 96, groupBy = 'by_event_type' } = cfg;
  const episodes = model.episodes || [];

  // ── 概览条：动态层数 greedy packing，保证不重合 ──
  const { bars, rowCount: overviewRows } = layoutOverviewBars(episodes, scale, model.timeRange);

  // 选中事件链来源：优先 activeEpisodeId，否则取第一个有事件的 episode
  const active =
    episodes.find((e) => e.id === cfg.activeEpisodeId) ||
    episodes.find((e) => e.events.length > 0) ||
    episodes[0];

  // ── 泳道划分 ──
  const { lanes, laneOf } = buildLanes(active, episodes, groupBy);
  lanes.forEach((lane, i) => {
    lane.y = topPad + i * laneHeight + laneHeight / 2;
  });

  // ── 事件点 ──
  const marks = [];
  const markById = {};
  const sourceEpisodes = groupBy === 'by_episode' ? episodes : [active].filter(Boolean);

  sourceEpisodes.forEach((ep) => {
    ep.events.forEach((ev) => {
      const laneKey = laneOf(ep, ev);
      const lane = lanes.find((l) => l.key === laneKey);
      if (!lane) return;
      const meta = EVENT_TYPE_META[ev.type] || EVENT_TYPE_META.observation;
      const x = ev.time != null ? scale.toX(ev.time) : null;
      const mark = {
        eventId: ev.id,
        episodeId: ep.id,
        x,
        y: lane.y,
        baseY: lane.y,
        shape: meta.shape,
        color: meta.color,
        label: ev.description,
        type: ev.type,
        typeLabel: meta.label,
        time: ev.time,
        rawTime: ev.rawTime,
        confidence: ev.confidence,
        hasTime: x != null,
      };
      marks.push(mark);
      markById[ev.id] = mark;
    });
  });

  // 无 time 的事件：在其泳道内按出现顺序均匀铺开
  spreadTimelessMarks(marks, scale);

  // 同 lane 内 mark 防重叠：x 太近时上下错开
  staggerMarks(marks, laneHeight);

  // ── 事件连线（temporal_next / causal）──
  const links = [];
  sourceEpisodes.forEach((ep) => {
    for (let i = 0; i < ep.events.length - 1; i++) {
      const a = markById[ep.events[i].id];
      const b = markById[ep.events[i + 1].id];
      if (!a || !b) continue;
      links.push({
        x1: a.x, y1: a.y, x2: b.x, y2: b.y,
        kind: ep.events[i].causalTo ? 'causal' : 'temporal_next',
      });
    }
  });

  // ── episode 间关系箭头（画在概览条层）──
  const barById = {};
  bars.forEach((b) => { barById[b.episodeId] = b; });
  episodes.forEach((ep) => {
    ep.followsRefs.forEach((ref) => addEpisodeArrow(links, barById, ref, ep.id, 'follows'));
    ep.branchesToRefs.forEach((ref) => addEpisodeArrow(links, barById, ep.id, ref, 'branches'));
  });

  const contentHeight = topPad + lanes.length * laneHeight + 40;

  return { lanes, bars, marks, links, activeId: active?.id || null, contentHeight, overviewRows };
}

function layoutOverviewBars(episodes, scale, timeRange) {
  const bars = episodes.map((ep) => {
    const x1raw = scale.toX(ep.startTime ?? ep.endTime ?? timeRange.min);
    const x2raw = scale.toX(ep.endTime ?? ep.startTime ?? timeRange.max);
    const x = Math.min(x1raw, x2raw);
    const w = Math.max(8, Math.abs(x2raw - x1raw));
    return {
      episodeId: ep.id,
      title: ep.title,
      x,
      w,
      h: BAR_H,
      color: ARC_STAGE_COLOR[ep.arcStage] || ARC_STAGE_COLOR.ongoing,
      opacity: STATUS_OPACITY[ep.status] ?? 0.85,
      status: ep.status,
      arcStage: ep.arcStage,
      isOngoing: ep.status === 'ongoing',
    };
  });

  // 按起点排序，greedy 分配到第一个不冲突的行
  bars.sort((a, b) => a.x - b.x || a.w - b.w);
  const rows = [];
  bars.forEach((bar) => {
    let placed = false;
    for (let r = 0; r < rows.length; r++) {
      const conflict = rows[r].some((b) => bar.x < b.x + b.w + BAR_GAP);
      if (!conflict) {
        bar.row = r;
        rows[r].push(bar);
        placed = true;
        break;
      }
    }
    if (!placed) {
      bar.row = rows.length;
      rows.push([bar]);
    }
  });

  bars.forEach((bar) => {
    bar.y = OVERVIEW_TOP + bar.row * (BAR_H + BAR_GAP);
  });

  return { bars, rowCount: rows.length };
}

function buildLanes(active, episodes, groupBy) {
  if (groupBy === 'flat') {
    const lanes = [{ key: '__flat__', label: '全部事件' }];
    return { lanes, laneOf: () => '__flat__' };
  }
  if (groupBy === 'by_episode') {
    const lanes = episodes.map((ep) => ({ key: ep.id, label: ep.title }));
    return { lanes, laneOf: (ep) => ep.id };
  }
  // by_event_type（默认）：仅基于当前 active episode 出现过的类型
  const types = [];
  const seen = new Set();
  (active?.events || []).forEach((ev) => {
    if (!seen.has(ev.type)) {
      seen.add(ev.type);
      types.push(ev.type);
    }
  });
  if (types.length === 0) types.push('observation');
  const lanes = types.map((t) => ({
    key: t,
    label: (EVENT_TYPE_META[t] || EVENT_TYPE_META.observation).label,
  }));
  return { lanes, laneOf: (_ep, ev) => ev.type };
}

function spreadTimelessMarks(marks, scale) {
  const timeless = marks.filter((m) => !m.hasTime);
  if (timeless.length === 0) return;
  const { min } = scale.domain();
  const startX = scale.toX(min) + 24;
  timeless.forEach((m, i) => {
    m.x = startX + i * 40;
    m.estimated = true;
  });
}

function staggerMarks(marks, laneHeight) {
  // 按 lane + x 排序，同一 lane 内 x 距离太近则上下错开
  const byLane = {};
  marks.forEach((m) => {
    const key = `${m.episodeId}:${m.type}`;
    if (!byLane[key]) byLane[key] = [];
    byLane[key].push(m);
  });

  const offsetStep = laneHeight / 5;
  Object.values(byLane).forEach((group) => {
    group.sort((a, b) => (a.x ?? 0) - (b.x ?? 0));
    let lastX = -Infinity;
    let stagger = 0;
    group.forEach((m) => {
      if (m.x - lastX < MARK_MIN_GAP) {
        stagger += 1;
      } else {
        stagger = 0;
      }
      m.y = m.baseY + stagger * offsetStep;
      lastX = m.x;
    });
  });
}

function addEpisodeArrow(links, barById, srcId, dstId, kind) {
  const s = barById[srcId];
  const d = barById[dstId];
  if (!s || !d) return;
  links.push({
    x1: s.x + s.w, y1: s.y + s.h / 2,
    x2: d.x, y2: d.y + d.h / 2,
    kind,
    onBars: true,
  });
}
