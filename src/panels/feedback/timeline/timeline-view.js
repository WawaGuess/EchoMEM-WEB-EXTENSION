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
  const state = {
    episodes,
    activeId: '',
    detailOpen: false,
    detailPage: 'overview',
    detailDirection: 'forward',
    detailScroll: { overview: 0, story: 0, evidence: 0 },
    selectedEventDate: '',
    selectedEventId: '',
    expandedEventDates: new Set(),
    handlers: {},
  };

  const shell = node('div', 'em-episode-timeline-shell');
  const main = node('section', 'em-timeline-main');
  const detail = node('aside', 'em-episode-detail-panel');
  detail.setAttribute('aria-live', 'polite');
  detail.setAttribute('aria-label', '情节详情');
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
      state.selectedEventId = '';
      state.expandedEventDates = new Set();
      state.detailPage = 'overview';
      state.detailDirection = 'forward';
      state.detailScroll = { overview: 0, story: 0, evidence: 0 };
      state.detailOpen = true;
      syncSelection();
      renderDetail(detail, episode, state);
      return;
    }

    if (action === 'select-event' && episode) {
      const expandedDates = state.activeId === episode.id
        ? new Set(state.expandedEventDates)
        : new Set();
      state.activeId = episode.id;
      state.selectedEventDate = trigger.dataset.eventDate || '';
      state.selectedEventId = '';
      if (state.selectedEventDate) expandedDates.add(state.selectedEventDate);
      state.expandedEventDates = expandedDates;
      state.detailPage = 'story';
      state.detailDirection = 'forward';
      state.detailScroll = { overview: 0, story: 0, evidence: 0 };
      state.detailOpen = true;
      syncSelection();
      renderDetail(detail, episode, state);
      requestAnimationFrame(() => {
        detail.querySelector('.em-detail-date-group.is-selected')?.scrollIntoView({
          block: 'nearest',
          behavior: 'smooth',
        });
      });
      return;
    }

    if (action === 'open-story' && episode) {
      rememberDetailScroll(detail, state);
      state.detailPage = 'story';
      state.detailDirection = 'forward';
      state.selectedEventId = '';
      if (!state.expandedEventDates.size) {
        groupEventsByDate(episode.events).forEach((group) => {
          state.expandedEventDates.add(group.dateKey);
        });
      }
      renderDetail(detail, episode, state);
      focusDetailPage(detail);
      return;
    }

    if (action === 'open-evidence' && episode) {
      rememberDetailScroll(detail, state);
      state.detailPage = 'evidence';
      state.detailDirection = 'forward';
      state.selectedEventId = '';
      renderDetail(detail, episode, state);
      focusDetailPage(detail);
      return;
    }

    if (action === 'toggle-event-date' && episode) {
      const dateKey = trigger.dataset.eventDate || '';
      const expandedDates = new Set(state.expandedEventDates);
      if (expandedDates.has(dateKey)) expandedDates.delete(dateKey);
      else if (dateKey) expandedDates.add(dateKey);
      state.expandedEventDates = expandedDates;
      state.detailDirection = 'stay';
      renderDetail(detail, episode, state);
      requestAnimationFrame(() => {
        [...detail.querySelectorAll('[data-event-group]')]
          .find((item) => item.dataset.eventGroup === dateKey)
          ?.focus();
      });
      return;
    }

    if (action === 'open-event' && episode) {
      rememberDetailScroll(detail, state);
      state.selectedEventId = trigger.dataset.eventId || '';
      state.selectedEventDate = trigger.dataset.eventDate || '';
      state.detailPage = 'event';
      state.detailDirection = 'forward';
      renderDetail(detail, episode, state);
      focusDetailPage(detail);
      return;
    }

    if (action === 'back-detail' && episode) {
      const previousPage = state.detailPage === 'event' ? 'story' : 'overview';
      state.detailPage = previousPage;
      state.detailDirection = 'back';
      state.selectedEventId = '';
      renderDetail(detail, episode, state);
      restoreDetailScroll(detail, state, previousPage);
      focusDetailPage(detail);
      return;
    }

    if (action === 'close-detail') {
      state.detailOpen = false;
      state.activeId = '';
      state.selectedEventDate = '';
      state.selectedEventId = '';
      state.expandedEventDates = new Set();
      syncSelection();
      return;
    }

  };

  root.addEventListener('click', onClick);
  state.handlers = { root, onClick };
  container._timelineState = state;

  renderTimelineMain(main, episodes, state);
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
  const boundaryDates = episodes.flatMap((episode) => [episode.startTime, episode.endTime]);
  const ticks = buildTicks(range.min, range.max, 8, boundaryDates);

  const toolbar = node('header', 'em-timeline-toolbar');
  const heading = document.createElement('div');
  const eyebrow = node('div', 'em-kicker');
  eyebrow.textContent = '情节时间线';
  const titleLine = node('div', 'em-timeline-title-line');
  const title = document.createElement('h1');
  title.textContent = '按情节查看记忆';
  titleLine.append(title, pill(`${episodes.length} 段故事`));
  const subtitle = document.createElement('p');
  subtitle.textContent = `${formatRangeFromEpisodes(episodes)} · 横条表示故事跨度，短胶囊表示单日情节，节点表示关键事件`;
  heading.append(eyebrow, titleLine, subtitle);

  const legend = node('div', 'em-timeline-legend');
  legend.append(
    legendItem('em-legend-single-day', '单日情节'),
    legendItem('em-legend-node', '单个事件'),
    legendItem('em-legend-cluster', '同日事件簇', '2'),
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
    textNode('span', '时间轴按自然日对齐；同日多个事件显示为紫色数字节点，含决策时外圈变黄。'),
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

  const rawStart = episode.startTime ?? episode.lastActiveAt ?? episode.endTime ?? range.min;
  const rawEnd = episode.endTime ?? episode.lastActiveAt ?? episode.startTime ?? rawStart;
  const start = toTimelineDay(rawStart) ?? range.min;
  const end = toTimelineDay(rawEnd) ?? start;
  const spanStart = Math.min(start, end);
  const spanEnd = Math.max(start, end);
  const left = toPercent(spanStart, range.min, range.max);
  const right = toPercent(spanEnd, range.min, range.max);
  const isPoint = spanStart === spanEnd;

  const span = document.createElement('button');
  span.type = 'button';
  span.className = `em-episode-span is-${episode.arcStage || 'ongoing'}`;
  span.classList.toggle('is-point', isPoint);
  span.dataset.emAction = 'select-episode';
  span.dataset.episodeId = episode.id;
  span.setAttribute('aria-label', `查看情节：${episode.title}`);
  span.style.left = `${left}%`;
  if (isPoint) {
    span.style.setProperty('--em-span-shift', '-50%');
  } else {
    span.style.width = `${Math.max(0, right - left)}%`;
  }
  track.appendChild(span);

  const clusters = groupEventsByDate(episode.events);
  clusters.forEach((cluster) => {
    const eventTime = cluster.time ?? start;
    const isCluster = cluster.events.length > 1;
    const hasDecision = cluster.events.some((item) => item.type === 'decision');
    const mark = document.createElement('button');
    mark.type = 'button';
    mark.className = `em-timeline-event-mark ${isCluster ? 'is-cluster' : ''}`;
    if (!isCluster && hasDecision) mark.classList.add('is-decision');
    if (isCluster && hasDecision) mark.classList.add('contains-decision');
    mark.dataset.emAction = 'select-event';
    mark.dataset.episodeId = episode.id;
    mark.dataset.eventDate = cluster.dateKey;
    mark.style.left = `${toPercent(eventTime, range.min, range.max)}%`;
    if (isCluster) {
      mark.appendChild(textNode('span', String(cluster.events.length), 'em-timeline-event-count'));
    }
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
  const page = node('div', `em-detail-page is-${state.detailDirection || 'forward'}`);
  page.dataset.detailPage = state.detailPage;

  if (state.detailPage === 'story') renderStoryPage(page, episode, state);
  else if (state.detailPage === 'evidence') renderEvidencePage(page, episode);
  else if (state.detailPage === 'event') renderEventPage(page, episode, state);
  else renderOverviewPage(page, episode);

  container.dataset.detailPage = state.detailPage;
  container.replaceChildren(page);
}

function renderOverviewPage(page, episode) {
  page.appendChild(buildDetailHeader(episode));
  page.appendChild(detailHeading(episode.title));

  const summarySection = node('section', 'em-detail-section em-detail-summary-card');
  summarySection.append(
    sectionTitle('这段经历'),
    textNode('p', episode.summary || '这段记忆尚未生成摘要。', 'em-detail-summary')
  );
  page.appendChild(summarySection);

  const tags = visibleTags(episode);
  if (tags.length) {
    const tagSection = node('section', 'em-detail-section em-detail-tags-section');
    tagSection.appendChild(sectionTitle('相关人物与主题'));
    const tagList = node('div', 'em-card-tags');
    tags.forEach((item) => tagList.appendChild(pill(item)));
    tagSection.appendChild(tagList);
    page.appendChild(tagSection);
  }

  const routes = node('div', 'em-detail-routes');
  routes.append(
    detailRouteButton(
      'open-story',
      '事情如何发展',
      `${episode.events.length} 个关键事件`,
      '按日期查看这段经历的推进过程'
    ),
    detailRouteButton(
      'open-evidence',
      '记忆依据与系统判断',
      `${(episode.atomRefs || []).length} 条原子证据`,
      '了解这段情节由哪些记忆信息支撑'
    )
  );
  page.appendChild(routes);
}

function renderStoryPage(page, episode, state) {
  page.appendChild(buildDetailHeader(episode, '返回概览'));
  page.append(
    textNode('div', formatEpisodeDateRange(episode), 'em-detail-page-kicker'),
    detailHeading('事情如何发展'),
    textNode('p', episode.title, 'em-detail-context-title')
  );

  const groups = groupEventsByDate(episode.events);
  const groupList = node('div', 'em-detail-date-groups');
  if (!groups.length) {
    groupList.appendChild(textNode('p', '该情节暂未提取出关键事件。', 'em-source-note'));
  } else {
    groups.forEach((group) => {
      groupList.appendChild(buildEventDateGroup(group, episode, state));
    });
  }
  page.appendChild(groupList);
}

function buildEventDateGroup(group, episode, state) {
  const expanded = state.expandedEventDates.has(group.dateKey);
  const selected = Boolean(state.selectedEventDate && state.selectedEventDate === group.dateKey);
  const section = node('section', 'em-detail-date-group');
  section.classList.toggle('is-expanded', expanded);
  section.classList.toggle('is-selected', selected);
  section.dataset.eventDate = group.dateKey;

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'em-detail-date-toggle';
  toggle.dataset.emAction = 'toggle-event-date';
  toggle.dataset.episodeId = episode.id;
  toggle.dataset.eventDate = group.dateKey;
  toggle.dataset.eventGroup = group.dateKey;
  toggle.setAttribute('aria-expanded', String(expanded));
  toggle.append(
    textNode('span', formatEventDate(group), 'em-detail-date-label'),
    textNode('span', `${group.events.length} 个事件`, 'em-detail-date-count'),
    textNode('span', '›', 'em-detail-route-arrow')
  );
  section.appendChild(toggle);

  if (expanded) {
    const list = node('ol', 'em-detail-event-chain');
    group.events.forEach((event) => list.appendChild(buildStoryEvent(event, episode)));
    section.appendChild(list);
  }
  return section;
}

function buildStoryEvent(event, episode) {
  const meta = EVENT_TYPE_META[event.type] || EVENT_TYPE_META.observation;
  const item = node('li', 'em-detail-event');
  const dateKey = eventDateKey(event);
  item.dataset.eventDate = dateKey;

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'em-detail-event-button';
  button.dataset.emAction = 'open-event';
  button.dataset.episodeId = episode.id;
  button.dataset.eventId = event.id;
  button.dataset.eventDate = dateKey;
  button.style.setProperty('--event-color', meta.color);

  const marker = node('span', `em-detail-event-node is-${event.type}`);
  const body = document.createElement('div');
  const eventMeta = node('div', 'em-detail-event-meta');
  eventMeta.append(
    textNode('span', meta.label, 'em-detail-event-type'),
    textNode('time', formatEventDate(event))
  );
  const copy = textNode('p', event.description, 'em-detail-event-copy');
  body.append(eventMeta, copy);
  button.append(marker, body, textNode('span', '›', 'em-detail-event-arrow'));
  item.appendChild(button);
  return item;
}

function renderEventPage(page, episode, state) {
  const event = episode.events.find((item) => item.id === state.selectedEventId);
  if (!event) {
    state.detailPage = 'story';
    state.detailDirection = 'back';
    page.dataset.detailPage = 'story';
    renderStoryPage(page, episode, state);
    return;
  }
  const meta = EVENT_TYPE_META[event.type] || EVENT_TYPE_META.observation;
  page.appendChild(buildDetailHeader(episode, '返回事情经过'));

  const context = node('div', 'em-detail-event-context');
  context.style.setProperty('--event-color', meta.color);
  context.append(
    textNode('span', meta.label, 'em-detail-event-type'),
    textNode('time', formatEventDate(event))
  );
  page.append(
    context,
    detailHeading(event.description),
    detailInfoCard('所属情节', episode.title)
  );

  const facts = node('dl', 'em-detail-fact-list');
  facts.append(
    detailFact('事件类型', meta.label),
    detailFact('发生时间', formatEventDate(event)),
    detailFact('生成置信', formatOptionalScore(event.confidence))
  );
  if (event.sourceTurnId) facts.appendChild(detailFact('来源轮次', event.sourceTurnId));
  page.appendChild(facts);
}

function renderEvidencePage(page, episode) {
  page.appendChild(buildDetailHeader(episode, '返回概览'));
  page.append(
    textNode('div', '记忆解释', 'em-detail-page-kicker'),
    detailHeading('记忆依据与系统判断'),
    textNode('p', '这些信息说明 EchoMem 为什么把相关记忆组织成这一段情节。', 'em-detail-page-intro')
  );

  const measures = node('dl', 'em-detail-evidence-summary');
  measures.append(
    detailMeasure('原子证据', `${(episode.atomRefs || []).length} 条`),
    detailMeasure('关键事件', `${episode.events.length} 个`)
  );
  page.appendChild(measures);

  const factsSection = node('section', 'em-detail-section');
  factsSection.appendChild(sectionTitle('系统判断'));
  const facts = node('dl', 'em-detail-fact-list');
  facts.append(
    detailFact('生命周期', STATUS_LABEL[episode.status] || episode.status || '未记录'),
    detailFact('叙事阶段', ARC_LABEL[episode.arcStage] || episode.arcStage || '未记录'),
    detailFact('记忆状态', RETENTION_LABEL[episode.retentionTier] || '长期记忆'),
    detailFact('相关对话', `${episode.turnCount} 轮`),
    detailFact('显著度', formatScore(episode.salience)),
    detailFact('生成置信', formatOptionalScore(episode.confidence))
  );
  factsSection.appendChild(facts);
  page.appendChild(factsSection);

  const tags = visibleTags(episode);
  if (tags.length) {
    const tagSection = node('section', 'em-detail-section');
    tagSection.appendChild(sectionTitle('关联对象与主题'));
    const tagList = node('div', 'em-card-tags');
    tags.forEach((item) => tagList.appendChild(pill(item)));
    tagSection.appendChild(tagList);
    page.appendChild(tagSection);
  }

  if (episode.segments?.length) {
    const segmentSection = node('section', 'em-detail-section');
    segmentSection.appendChild(sectionTitle('覆盖的会话片段'));
    const segments = node('div', 'em-detail-source-list');
    episode.segments.forEach((segment) => {
      segments.appendChild(detailInfoCard(
        segment.sessionId || '未记录会话',
        `消息 ${segment.startMsgIdx}—${segment.endMsgIdx}`
      ));
    });
    segmentSection.appendChild(segments);
    page.appendChild(segmentSection);
  }

  const sourcedEvents = episode.events.filter((event) => event.sourceTurnId);
  if (sourcedEvents.length) {
    const sourceSection = node('section', 'em-detail-section');
    sourceSection.appendChild(sectionTitle('可追溯事件来源'));
    const sources = node('div', 'em-detail-source-list');
    sourcedEvents.forEach((event) => {
      sources.appendChild(detailInfoCard(event.description, event.sourceTurnId));
    });
    sourceSection.appendChild(sources);
    page.appendChild(sourceSection);
  }
}

function buildDetailHeader(episode, backLabel = '') {
  const top = node('div', 'em-detail-panel-top');
  if (backLabel) {
    const back = document.createElement('button');
    back.type = 'button';
    back.className = 'em-detail-back';
    back.dataset.emAction = 'back-detail';
    back.dataset.episodeId = episode.id;
    back.append(
      textNode('span', '‹', 'em-detail-back-arrow'),
      textNode('span', backLabel)
    );
    top.appendChild(back);
  } else {
    const overline = node('div', 'em-detail-overline');
    overline.append(
      pill(STATUS_LABEL[episode.status] || episode.status, 'em-status-pill'),
      textNode('span', formatEpisodeDateRange(episode))
    );
    top.appendChild(overline);
  }
  top.appendChild(iconButton('×', 'close-detail', '收起详情'));
  return top;
}

function detailHeading(text) {
  const heading = textNode('h2', text, 'em-detail-page-title');
  heading.tabIndex = -1;
  return heading;
}

function detailRouteButton(action, title, meta, copy) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'em-detail-route';
  button.dataset.emAction = action;
  const body = node('span', 'em-detail-route-body');
  body.append(
    textNode('strong', title),
    textNode('span', copy, 'em-detail-route-copy')
  );
  button.append(
    body,
    textNode('span', meta, 'em-detail-route-meta'),
    textNode('span', '›', 'em-detail-route-arrow')
  );
  return button;
}

function detailMeasure(label, value) {
  const item = node('div', 'em-detail-measure');
  item.append(
    textNode('dt', label),
    textNode('dd', value)
  );
  return item;
}

function detailFact(label, value) {
  const item = node('div', 'em-detail-fact');
  item.append(
    textNode('dt', label),
    textNode('dd', value)
  );
  return item;
}

function detailInfoCard(title, copy) {
  const card = node('div', 'em-detail-info-card');
  card.append(
    textNode('strong', title),
    textNode('span', copy)
  );
  return card;
}

function groupEventsByDate(events) {
  const groups = new Map();
  events.forEach((event, index) => {
    const day = toTimelineDay(event.time);
    const dateKey = day != null ? String(day) : (event.rawTime || `unknown-${index}`);
    const key = dateKey;
    if (!groups.has(key)) {
      groups.set(key, {
        dateKey,
        rawTime: event.rawTime || '',
        time: day,
        events: [],
      });
    }
    groups.get(key).events.push(event);
  });
  return [...groups.values()];
}

function rememberDetailScroll(detail, state) {
  const page = detail.querySelector('.em-detail-page');
  if (page && state.detailPage in state.detailScroll) {
    state.detailScroll[state.detailPage] = page.scrollTop;
  }
}

function restoreDetailScroll(detail, state, pageName) {
  requestAnimationFrame(() => {
    const page = detail.querySelector('.em-detail-page');
    if (page) page.scrollTop = state.detailScroll[pageName] || 0;
  });
}

function focusDetailPage(detail) {
  requestAnimationFrame(() => {
    detail.querySelector('.em-detail-page-title')?.focus({ preventScroll: true });
  });
}

function collectionRange(episodes) {
  const values = episodes
    .flatMap((episode) => [
      episode.startTime,
      episode.endTime,
      episode.lastActiveAt,
      ...episode.events.map((event) => event.time),
    ])
    .map(toTimelineDay)
    .filter((value) => value != null);

  if (!values.length) {
    const now = Date.now();
    return { min: now, max: now + DAY_MS };
  }

  const min = Math.min(...values);
  const rawMax = Math.max(...values);
  return { min, max: rawMax === min ? min + DAY_MS : rawMax };
}

function buildTicks(min, max, count, boundaryDates = []) {
  const meaningfulDays = [...new Set([
    min,
    ...boundaryDates.map(toTimelineDay).filter((value) => value != null),
    max,
  ])].sort((a, b) => a - b);
  const safeCount = Math.max(2, count);
  if (meaningfulDays.length <= safeCount) return meaningfulDays;

  const lastIndex = meaningfulDays.length - 1;
  const indexes = Array.from(
    { length: safeCount },
    (_, index) => Math.round((index * lastIndex) / (safeCount - 1))
  );
  return [...new Set(indexes)].map((index) => meaningfulDays[index]);
}

function toTimelineDay(value) {
  if (value == null) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
}

function eventDateKey(event) {
  const day = toTimelineDay(event?.time);
  return day != null ? String(day) : String(event?.rawTime || '');
}

function toPercent(value, min, max) {
  if (value == null || max <= min) return 0;
  return Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
}

function formatAxisDate(value) {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    timeZone: 'UTC',
  })
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

function formatScore(value) {
  const score = Number(value);
  return Number.isFinite(score) ? score.toFixed(2) : '未记录';
}

function formatOptionalScore(value) {
  if (value == null || value === '') return '未记录';
  const score = Number(value);
  if (!Number.isFinite(score)) return '未记录';
  return `${Math.round(Math.max(0, Math.min(1, score)) * 100)}%`;
}

function legendItem(className, label, markerText = '') {
  const item = node('span', 'em-legend-item');
  const marker = node('i', className);
  if (markerText) marker.textContent = markerText;
  item.append(marker, textNode('span', label));
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
    <p class="em-state-copy">相关事件积累后，EchoMem 会把它们组织为可阅读的情节故事线。</p>
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
