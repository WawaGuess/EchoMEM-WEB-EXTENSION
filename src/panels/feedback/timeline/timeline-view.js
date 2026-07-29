// Episode timeline: each lane is one coherent story arc; key events sit on the story's time span.
import { EVENT_TYPE_META } from '../../../services/episode-client.js';

const STATUS_LABEL = {
  ongoing: '进行中',
  closed: '已结束',
  merged: '已归并',
  stale: '已沉寂',
};

const ARC_LABEL = {
  beginning: '起始',
  middle: '发展',
  end: '收尾',
  ongoing: '长期',
};

const RETENTION_LABEL = {
  hot: '高活跃',
  warm: '近期活跃',
  cold: '低频长期',
};

const GENERIC_TAGS = new Set(['用户', 'user', 'agent', 'assistant']);
const DAY_MS = 24 * 60 * 60 * 1000;

export function renderTimeline(container, model) {
  cleanupTimeline(container);
  container.innerHTML = '';
  container.style.position = 'relative';

  const episodes = [...(model?.episodes || [])].sort((a, b) => {
    const aTime = a.startTime ?? a.endTime ?? a.lastActiveAt ?? 0;
    const bTime = b.startTime ?? b.endTime ?? b.lastActiveAt ?? 0;
    return aTime - bTime || (a.endTime ?? 0) - (b.endTime ?? 0);
  });

  if (!episodes.length) {
    renderEmpty(container);
    return;
  }

  const root = node('div', 'em-episode-view');
  const compact = window.matchMedia?.('(max-width: 820px)').matches;
  const state = {
    episodes,
    activeId: episodes[0].id,
    detailOpen: !compact,
    selectedEventDate: '',
    handlers: {},
  };

  const shell = node('div', 'em-episode-timeline-shell');
  const main = node('section', 'em-timeline-main');
  const detail = node('aside', 'em-episode-detail-panel');
  detail.setAttribute('aria-live', 'polite');
  detail.setAttribute('aria-label', 'Episode 详情');
  shell.append(main, detail);
  root.appendChild(shell);
  container.appendChild(root);

  const onClick = (event) => {
    const trigger = event.target.closest('[data-em-action]');
    if (!trigger || !root.contains(trigger)) return;

    const action = trigger.dataset.emAction;
    const episodeId = trigger.dataset.episodeId || state.activeId;
    const episode = state.episodes.find((item) => item.id === episodeId);

    if (action === 'select-episode' && episode) {
      state.activeId = episode.id;
      state.selectedEventDate = '';
      state.detailOpen = true;
      syncSelection();
      renderDetail(detail, episode, state);
      return;
    }

    if (action === 'select-event' && episode) {
      state.activeId = episode.id;
      state.selectedEventDate = trigger.dataset.eventDate || '';
      state.detailOpen = true;
      syncSelection();
      renderDetail(detail, episode, state);
      requestAnimationFrame(() => {
        detail.querySelector('.em-detail-event.is-selected')?.scrollIntoView({
          block: 'nearest',
          behavior: 'smooth',
        });
      });
      return;
    }

    if (action === 'close-detail') {
      state.detailOpen = false;
      state.selectedEventDate = '';
      syncSelection();
      return;
    }

  };

  root.addEventListener('click', onClick);
  state.handlers = { root, onClick };
  container._timelineState = state;

  renderTimelineMain(main, episodes, state);
  renderDetail(detail, episodes[0], state);
  syncSelection();

  function syncSelection() {
    shell.classList.toggle('is-detail-closed', !state.detailOpen);
    detail.classList.toggle('is-open', state.detailOpen);
    detail.setAttribute('aria-hidden', String(!state.detailOpen));

    root.querySelectorAll('[data-episode-row]').forEach((row) => {
      const selected = row.dataset.episodeRow === state.activeId;
      row.classList.toggle('is-selected', selected);
    });
    root.querySelectorAll('[data-em-action="select-episode"]').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.episodeId === state.activeId));
    });
  }
}

function renderTimelineMain(container, episodes, state) {
  const range = collectionRange(episodes);
  const ticks = buildTicks(range.min, range.max, 6);

  const toolbar = node('header', 'em-timeline-toolbar');
  const heading = document.createElement('div');
  const eyebrow = node('div', 'em-kicker');
  eyebrow.textContent = 'Episode timeline';
  const titleLine = node('div', 'em-timeline-title-line');
  const title = document.createElement('h1');
  title.textContent = '按 Episode 查看记忆';
  titleLine.append(title, pill(`${episodes.length} 段故事`));
  const subtitle = document.createElement('p');
  subtitle.textContent = `${formatRangeFromEpisodes(episodes)} · 横条表示故事跨度，节点表示关键事件`;
  heading.append(eyebrow, titleLine, subtitle);

  const legend = node('div', 'em-timeline-legend');
  legend.append(
    legendItem('em-legend-node', '单个事件'),
    legendItem('em-legend-cluster', '同日事件簇'),
    legendItem('em-legend-decision', '决策')
  );
  toolbar.append(heading, legend);

  const chart = node('div', 'em-timeline-chart');
  const axis = node('div', 'em-timeline-axis');
  axis.appendChild(node('span', 'em-axis-spacer'));
  const axisTrack = node('div', 'em-axis-track');
  ticks.forEach((tick) => {
    const item = textNode('span', formatAxisDate(tick), 'em-axis-tick');
    item.style.left = `${toPercent(tick, range.min, range.max)}%`;
    axisTrack.appendChild(item);
  });
  axis.appendChild(axisTrack);
  axis.appendChild(textNode('span', '关键点', 'em-axis-tail'));
  chart.appendChild(axis);

  episodes.forEach((episode) => {
    chart.appendChild(buildEpisodeRow(episode, range, ticks));
  });

  const footnote = node('footer', 'em-timeline-footnote');
  footnote.append(
    textNode('span', '时间仅来自事件发生时间；日期型数据不补造具体时刻。'),
    textNode('span', '点击故事或节点查看右侧详情。')
  );

  container.append(toolbar, chart, footnote);
}

function buildEpisodeRow(episode, range, ticks) {
  const row = node('article', 'em-timeline-row');
  row.dataset.episodeRow = episode.id;

  const label = document.createElement('button');
  label.type = 'button';
  label.className = 'em-timeline-row-label';
  label.dataset.emAction = 'select-episode';
  label.dataset.episodeId = episode.id;
  label.setAttribute('aria-pressed', 'false');

  const labelTop = node('span', 'em-row-title');
  labelTop.textContent = episode.title;
  const labelMeta = node('span', 'em-row-meta');
  labelMeta.textContent = `${STATUS_LABEL[episode.status] || episode.status} · ${(episode.atomRefs || []).length} 条证据`;
  label.append(labelTop, labelMeta);

  const track = node('div', 'em-timeline-track');
  ticks.forEach((tick) => {
    const line = node('span', 'em-timeline-gridline');
    line.style.left = `${toPercent(tick, range.min, range.max)}%`;
    track.appendChild(line);
  });

  const start = episode.startTime ?? episode.endTime ?? range.min;
  const end = episode.endTime ?? episode.startTime ?? start;
  const left = toPercent(start, range.min, range.max);
  const right = toPercent(end, range.min, range.max);
  const width = Math.max(2.2, right - left);

  const span = document.createElement('button');
  span.type = 'button';
  span.className = `em-episode-span is-${episode.arcStage || 'ongoing'}`;
  span.dataset.emAction = 'select-episode';
  span.dataset.episodeId = episode.id;
  span.setAttribute('aria-label', `查看 Episode：${episode.title}`);
  span.style.left = `${Math.min(left, 100 - width)}%`;
  span.style.width = `${Math.min(width, 100)}%`;
  track.appendChild(span);

  const clusters = groupEventsByDate(episode.events);
  clusters.forEach((cluster) => {
    const eventTime = cluster.time ?? start;
    const mark = document.createElement('button');
    mark.type = 'button';
    mark.className = `em-timeline-event-mark ${cluster.events.length > 1 ? 'is-cluster' : ''}`;
    if (cluster.events.some((item) => item.type === 'decision')) mark.classList.add('has-decision');
    mark.dataset.emAction = 'select-event';
    mark.dataset.episodeId = episode.id;
    mark.dataset.eventDate = cluster.rawTime;
    mark.style.left = `${toPercent(eventTime, range.min, range.max)}%`;
    mark.textContent = cluster.events.length > 1 ? String(cluster.events.length) : '';
    mark.setAttribute(
      'aria-label',
      `${formatEventDate(cluster)}，${cluster.events.length} 个关键事件：${cluster.events.map((item) => item.description).join('；')}`
    );
    track.appendChild(mark);
  });

  const tail = node('div', 'em-timeline-row-tail');
  tail.append(
    textNode('strong', String(episode.events.length)),
    textNode('span', '事件')
  );

  row.append(label, track, tail);
  return row;
}

function renderDetail(container, episode, state) {
  container.innerHTML = '';

  const top = node('div', 'em-detail-panel-top');
  const overline = node('div', 'em-detail-overline');
  overline.append(
    pill(STATUS_LABEL[episode.status] || episode.status, 'em-status-pill'),
    textNode('span', formatEpisodeDateRange(episode))
  );
  const close = iconButton('×', 'close-detail', '收起详情');
  top.append(overline, close);

  const title = document.createElement('h2');
  title.textContent = episode.title;
  const stage = node('div', 'em-detail-stage-line');
  stage.append(
    detailDatum('生命周期', STATUS_LABEL[episode.status] || episode.status),
    detailDatum('叙事阶段', ARC_LABEL[episode.arcStage] || episode.arcStage || '未记录')
  );

  const summarySection = node('section', 'em-detail-section');
  summarySection.append(
    sectionTitle('故事摘要'),
    textNode('p', episode.summary || '这段记忆尚未生成摘要。', 'em-detail-summary')
  );

  const stats = node('dl', 'em-detail-stats');
  stats.append(
    stat('原子证据', `${(episode.atomRefs || []).length} 条`),
    stat('关键事件', `${episode.events.length} 个`),
    stat('显著度', formatScore(episode.salience)),
    stat('生成置信', formatOptionalScore(episode.confidence))
  );

  const tags = visibleTags(episode);
  const tagSection = node('section', 'em-detail-section');
  tagSection.appendChild(sectionTitle('关联对象与主题'));
  const tagList = node('div', 'em-card-tags');
  if (tags.length) tags.forEach((item) => tagList.appendChild(pill(item)));
  else tagList.appendChild(textNode('span', '暂无有效标签', 'em-source-note'));
  tagSection.appendChild(tagList);

  const eventSection = node('section', 'em-detail-section em-detail-events-section');
  eventSection.appendChild(sectionTitle('关键事件链'));
  const chain = node('ol', 'em-detail-event-chain');
  if (episode.events.length) {
    episode.events.forEach((event) => chain.appendChild(buildDetailEvent(event, state.selectedEventDate)));
  } else {
    chain.appendChild(textNode('li', '该情节暂未提取出关键事件。', 'em-source-note'));
  }
  eventSection.appendChild(chain);

  const memoryMeta = node('div', 'em-detail-memory-meta');
  memoryMeta.append(
    textNode('span', RETENTION_LABEL[episode.retentionTier] || '长期记忆'),
    textNode('span', `${episode.turnCount} 轮相关对话`)
  );

  container.append(top, title, stage, summarySection, stats, tagSection, eventSection, memoryMeta);
}

function buildDetailEvent(event, selectedDate) {
  const meta = EVENT_TYPE_META[event.type] || EVENT_TYPE_META.observation;
  const item = node('li', 'em-detail-event');
  item.dataset.eventDate = event.rawTime || '';
  item.classList.toggle('is-selected', Boolean(selectedDate && event.rawTime === selectedDate));
  item.style.setProperty('--event-color', meta.color);

  const marker = node('span', `em-detail-event-node is-${event.type}`);
  const body = document.createElement('div');
  const eventMeta = node('div', 'em-detail-event-meta');
  eventMeta.append(
    textNode('span', meta.label, 'em-detail-event-type'),
    textNode('time', formatEventDate(event))
  );
  const copy = textNode('p', event.description, 'em-detail-event-copy');
  body.append(eventMeta, copy);
  item.append(marker, body);
  return item;
}

function groupEventsByDate(events) {
  const groups = new Map();
  events.forEach((event, index) => {
    const key = event.rawTime || (event.time != null ? String(event.time) : `unknown-${index}`);
    if (!groups.has(key)) {
      groups.set(key, {
        rawTime: event.rawTime || '',
        time: event.time,
        events: [],
      });
    }
    groups.get(key).events.push(event);
  });
  return [...groups.values()];
}

function collectionRange(episodes) {
  const values = episodes
    .flatMap((episode) => [
      episode.startTime,
      episode.endTime,
      ...episode.events.map((event) => event.time),
    ])
    .filter((value) => value != null);

  if (!values.length) {
    const now = Date.now();
    return { min: now, max: now + DAY_MS };
  }

  const min = Math.min(...values);
  const rawMax = Math.max(...values);
  return { min, max: rawMax === min ? min + DAY_MS : rawMax };
}

function buildTicks(min, max, count) {
  const safeCount = Math.max(2, count);
  const step = (max - min) / (safeCount - 1);
  return Array.from({ length: safeCount }, (_, index) => min + step * index);
}

function toPercent(value, min, max) {
  if (value == null || max <= min) return 0;
  return Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
}

function formatAxisDate(value) {
  return new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit' })
    .format(new Date(value))
    .replace('/', '.');
}

function formatRangeFromEpisodes(episodes) {
  const first = episodes[0];
  const last = episodes.reduce((latest, episode) => {
    const latestTime = latest.endTime ?? latest.startTime ?? 0;
    const episodeTime = episode.endTime ?? episode.startTime ?? 0;
    return episodeTime > latestTime ? episode : latest;
  }, first);
  const start = first.rawStartTime || first.rawEndTime;
  const end = last.rawEndTime || last.rawStartTime;
  return formatRawDateRange(start, end);
}

function formatEpisodeDateRange(episode) {
  return formatRawDateRange(
    episode.rawStartTime || episode.rawEndTime,
    episode.rawEndTime || episode.rawStartTime
  );
}

function formatRawDateRange(start, end) {
  if (!start && !end) return '时间未记录';
  if (!start) return formatRawDate(end);
  if (!end || start === end) return formatRawDate(start);
  return `${formatRawDate(start)} — ${formatRawDate(end)}`;
}

function formatRawDate(value) {
  const raw = String(value || '');
  const dayMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dayMatch) return `${dayMatch[1]}年${Number(dayMatch[2])}月${Number(dayMatch[3])}日`;
  const monthMatch = raw.match(/^(\d{4})-(\d{2})$/);
  if (monthMatch) return `${monthMatch[1]}年${Number(monthMatch[2])}月`;
  if (/^\d{4}$/.test(raw)) return `${raw}年`;
  const parsed = Date.parse(raw);
  if (Number.isNaN(parsed)) return raw || '时间未记录';
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(parsed));
}

function formatEventDate(eventOrCluster) {
  const raw = eventOrCluster.rawTime || '';
  if (raw) return formatRawDate(raw);
  if (eventOrCluster.time != null) {
    return new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(new Date(eventOrCluster.time));
  }
  return '时间未记录';
}

function visibleTags(episode) {
  return unique([...(episode.entities || []), ...(episode.topics || [])])
    .filter((item) => item && !GENERIC_TAGS.has(item.toLocaleLowerCase()));
}

function unique(items) {
  return [...new Set(items.map((item) => String(item).trim()).filter(Boolean))];
}

function sectionTitle(text) {
  return textNode('h3', text, 'em-detail-section-title');
}

function detailDatum(label, value) {
  const item = node('span', 'em-detail-datum');
  item.append(
    textNode('span', label),
    textNode('strong', value)
  );
  return item;
}

function stat(label, value) {
  const item = node('div', 'em-detail-stat');
  item.append(
    textNode('dt', label),
    textNode('dd', value, 'em-detail-stat-value')
  );
  return item;
}

function formatScore(value) {
  const score = Number(value);
  return Number.isFinite(score) ? score.toFixed(2) : '未记录';
}

function formatOptionalScore(value) {
  const score = Number(value);
  if (!Number.isFinite(score)) return '未记录';
  return `${Math.round(Math.max(0, Math.min(1, score)) * 100)}%`;
}

function legendItem(className, label) {
  const item = node('span', 'em-legend-item');
  item.append(node('i', className), textNode('span', label));
  return item;
}

function iconButton(label, action, ariaLabel) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'em-detail-close';
  button.dataset.emAction = action;
  button.setAttribute('aria-label', ariaLabel);
  button.textContent = label;
  return button;
}

function pill(text, extraClass = '') {
  const item = node('span', `em-pill ${extraClass}`.trim());
  item.appendChild(textNode('span', text));
  return item;
}

function textNode(tag, text, className = '') {
  const element = node(tag, className);
  element.textContent = text;
  return element;
}

function renderEmpty(container) {
  const empty = node('div', 'em-empty');
  empty.innerHTML = `
    <div class="em-state-orb"></div>
    <p class="em-state-title">长期记忆还没有形成情节</p>
    <p class="em-state-copy">相关事件积累后，EchoMem 会把它们组织为可阅读的 Episode 故事线。</p>
  `;
  container.appendChild(empty);
}

function node(tag, className) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  return element;
}

export function cleanupTimeline(container) {
  const state = container?._timelineState;
  if (state?.handlers?.root) {
    state.handlers.root.removeEventListener('click', state.handlers.onClick);
  }
  if (container) container._timelineState = null;
}
