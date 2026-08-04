// Data-driven renderer for the periodic-review v2 prototype page.
// Reads ATTEMPT4 (raw EchoMem summary schema v2 JSON) and maps it to the card view-model.
import { ATTEMPT4 } from './attempt4-review-data.js';

const PALETTE = ['#6558a8', '#418d88', '#c38742', '#d47463', '#5b78a8'];
const WEEKDAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
const DAILY_KEYS = Object.keys(ATTEMPT4.daily).sort();
const WEEKLY_KEYS = Object.keys(ATTEMPT4.weekly).sort();

const DEFAULT_DAILY = DAILY_KEYS.includes('2026-07-09') ? '2026-07-09' : DAILY_KEYS[0];
const DEFAULT_WEEKLY = WEEKLY_KEYS.includes('2026-W28') ? '2026-W28' : WEEKLY_KEYS[0];

const state = {
  mode: 'daily',
  keys: { daily: DEFAULT_DAILY, weekly: DEFAULT_WEEKLY },
  index: 0,
};

const cardsRoot = document.getElementById('cards');
const stepsRoot = document.getElementById('steps');
const pageCount = document.getElementById('pageCount');
const prevButton = document.getElementById('prevButton');
const nextButton = document.getElementById('nextButton');
const periodSelect = document.getElementById('periodSelect');

const ARROW_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>';

function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined && text !== null) element.textContent = text;
  return element;
}

function parseDay(dateStr) {
  return new Date(`${dateStr}T00:00:00Z`);
}

function weekdayLabel(dateStr) {
  return WEEKDAYS[(parseDay(dateStr).getUTCDay() + 6) % 7];
}

function fullDateLabel(dateStr) {
  const d = parseDay(dateStr);
  return `${d.getUTCFullYear()} 年 ${d.getUTCMonth() + 1} 月 ${d.getUTCDate()} 日`;
}

function shortDateLabel(dateStr) {
  const d = parseDay(dateStr);
  return `${String(d.getUTCMonth() + 1).padStart(2, '0')} / ${String(d.getUTCDate()).padStart(2, '0')}`;
}

function weekLabel(weekKey) {
  const [year, week] = weekKey.split('-W');
  return `${year} 年第 ${Number(week)} 周`;
}

function weekRangeLabel(weekly) {
  const range = weekly.date_range || {};
  if (!range.start || !range.end) return '';
  return `${fullDateLabel(range.start)} — ${fullDateLabel(range.end)}`;
}

function agentLine(label, text) {
  const line = node('div', 'agent-line');
  const avatar = node('div', 'agent-avatar', 'E');
  avatar.setAttribute('aria-hidden', 'true');
  const copy = node('div', 'agent-copy');
  copy.append(node('small', '', label));
  copy.append(document.createTextNode(text ?? '（本期没有生成观察）'));
  line.append(avatar, copy);
  return line;
}

function cardShell(label, kicker, title) {
  const card = node('article', 'card');
  card.dataset.label = label;
  card.append(node('div', 'card-kicker', kicker));
  const heading = document.createElement('h2');
  heading.textContent = title;
  card.appendChild(heading);
  return card;
}

function conicGradient(items) {
  let start = 0;
  const segments = items.map((item, index) => {
    const end = Math.min(100, start + item.percent);
    const segment = `${PALETTE[index % PALETTE.length]} ${start}% ${end}%`;
    start = end;
    return segment;
  });
  return `conic-gradient(${segments.join(', ')})`;
}

function actionList(items) {
  const list = node('div', 'action-list');
  items.forEach((item) => {
    const row = node('div', 'action-item');
    const mark = node('div', 'action-mark');
    mark.innerHTML = ARROW_SVG;
    const copy = node('div', 'action-copy');
    copy.append(node('strong', '', item.title));
    copy.append(node('span', '', item.detail || ''));
    row.append(mark, copy, node('span', 'status', item.status));
    list.appendChild(row);
  });
  return list;
}

function memoryGrid(items, showEvidence) {
  const grid = node('div', 'memory-grid');
  items.forEach((item) => {
    const cell = node('div', 'memory-item');
    cell.append(node('div', 'memory-tag', item.tag));
    cell.append(node('p', '', item.text));
    if (showEvidence && item.evidence) cell.append(node('small', '', item.evidence));
    grid.appendChild(cell);
  });
  return grid;
}

// ---- daily cards ----

function dailyOverviewCard(daily) {
  const card = cardShell(
    '今日概览',
    `${parseDay(daily.date).getUTCFullYear()} · ${shortDateLabel(daily.date)} · ${weekdayLabel(daily.date)}`,
    daily.recap.title || '这一天'
  );
  card.append(node('p', 'card-subtitle', daily.recap.subtitle));
  card.append(agentLine('ECHO 注意到', daily.recap.observation));
  return card;
}

function dailyAttentionCard(daily) {
  const card = cardShell('关注分布', '今日关注分布', '今天，你主要关注了什么');
  const attention = daily.attention || { expression_count: 0, items: [] };
  const items = attention.items || [];
  if (!items.length) {
    card.append(node('p', 'card-subtitle', '今天的记录不足以形成关注分布。'));
    return card;
  }

  const layout = node('div', 'attention-layout');
  const donutWrap = node('div', 'donut-wrap');
  const donut = node('div', 'donut');
  donut.setAttribute('role', 'img');
  donut.setAttribute(
    'aria-label',
    `今日关注分布：${items.map((item) => `${item.label} ${item.percent}%`).join('，')}`
  );
  donut.style.background = conicGradient(items);
  const center = node('div', 'donut-center');
  const value = node('div', 'donut-value', `${items[0].percent}%`);
  const topic = node('div', 'donut-topic', items[0].label);
  center.append(value, topic);
  donut.appendChild(center);
  donutWrap.append(
    donut,
    node(
      'div',
      'chart-note',
      `按你的 ${attention.expression_count} 条表达归入 ${items.length} 个主主题 · 原子用于校准事实`
    )
  );

  const right = document.createElement('div');
  const legend = node('div', 'legend');
  const insightText = node('span', '', items[0].insight || '');
  items.forEach((item, index) => {
    const button = node('button', 'legend-item');
    button.type = 'button';
    button.setAttribute('aria-pressed', String(index === 0));
    button.style.setProperty('--dot', PALETTE[index % PALETTE.length]);
    const dot = node('span', 'legend-dot');
    const copy = node('span', 'legend-copy');
    copy.append(node('strong', '', item.label));
    copy.append(node('span', '', `${item.count} 条表达`));
    button.append(dot, copy, node('span', 'legend-number', `${item.percent}%`));
    button.addEventListener('click', () => {
      legend.querySelectorAll('.legend-item').forEach((other) =>
        other.setAttribute('aria-pressed', String(other === button))
      );
      value.textContent = `${item.percent}%`;
      topic.textContent = item.label;
      insightText.textContent = item.insight || '';
    });
    legend.appendChild(button);
  });
  right.append(legend);
  const insight = agentLine('ECHO 的解读', '');
  insight.style.paddingTop = '16px';
  insight.querySelector('.agent-copy').appendChild(insightText);
  right.append(insight);

  layout.append(donutWrap, right);
  card.appendChild(layout);
  return card;
}

function dailyFactsCard(daily) {
  const card = cardShell('今天确定了什么', '值得记住', '今天真正确定了什么');
  if (!daily.facts?.length) {
    card.append(node('p', 'card-subtitle', '今天没有可确认的事实。'));
    return card;
  }
  card.append(memoryGrid(daily.facts, true));
  return card;
}

function dailyNextCard(daily) {
  const card = cardShell('接下来', '开放事项', '这些事情，还值得继续推进');
  if (daily.open_items?.length) card.append(actionList(daily.open_items));
  card.append(agentLine('ECHO 的整理', daily.next_observation));
  return card;
}

function buildDailyCards(daily) {
  return [
    dailyOverviewCard(daily),
    dailyAttentionCard(daily),
    dailyFactsCard(daily),
    dailyNextCard(daily),
  ];
}

// ---- weekly cards ----

function weeklyOverviewCard(weekly) {
  const kicker = `${weekly.year} · WEEK ${String(weekly.week).padStart(2, '0')} · ${shortDateLabel(
    weekly.date_range.start
  )} — ${shortDateLabel(weekly.date_range.end)}`;
  const card = cardShell('本周概览', kicker, weekly.recap.title || '这一周');
  card.append(node('p', 'card-subtitle', weekly.recap.subtitle));
  card.append(agentLine('ECHO 的周度观察', weekly.recap.observation));
  return card;
}

function weeklyHighlightsCard(weekly) {
  const card = cardShell('本周高光', '本周高光', '真正改变了后续方向的节点');
  if (!weekly.highlights?.length) {
    card.append(node('p', 'card-subtitle', '本周没有可标记的高光节点。'));
    return card;
  }
  const list = node('div', 'highlight-list');
  weekly.highlights.forEach((item) => {
    const row = node('div', 'highlight');
    row.append(
      node('div', 'highlight-date', item.date ? shortDateLabel(item.date) : '本周')
    );
    const copy = document.createElement('div');
    copy.append(node('strong', '', item.title));
    copy.append(node('p', '', item.text));
    row.append(copy);
    list.appendChild(row);
  });
  card.appendChild(list);
  return card;
}

function weeklyTrendCard(weekly) {
  const trend = weekly.attention_trend;
  if (!trend || !trend.rows?.length) return null;
  const card = cardShell('关注变化', '本周关注变化', '你的注意力，如何一步步转移');
  const chart = node('div', 'trend');
  chart.setAttribute('role', 'img');
  chart.setAttribute(
    'aria-label',
    `本周关注趋势：${trend.series.map((s) => s.label).join('、')}`
  );
  trend.rows.forEach((row) => {
    const item = node('div', 'trend-row');
    item.append(node('span', 'trend-day', row.day || shortDateLabel(row.date)));
    const bar = node('div', 'trend-bar');
    row.values.forEach((value, index) => {
      if (!value) return;
      const segment = node('span');
      segment.style.width = `${value}%`;
      segment.style.background = PALETTE[index % PALETTE.length];
      segment.title = `${trend.series[index]?.label || ''} ${value}%`;
      bar.appendChild(segment);
    });
    item.append(bar);
    chart.appendChild(item);
  });
  const legend = node('div', 'trend-legend');
  trend.series.forEach((series, index) => {
    const item = node('span');
    const dot = node('i');
    dot.style.setProperty('--dot', PALETTE[index % PALETTE.length]);
    item.append(dot, document.createTextNode(series.label));
    legend.appendChild(item);
  });
  chart.appendChild(legend);
  card.append(chart, agentLine('ECHO 注意到', trend.observation));
  return card;
}

function weeklyChangesCard(weekly) {
  const card = cardShell('形成的变化', '本周形成的变化', '这一周形成的变化');
  if (!weekly.changes?.length) {
    card.append(node('p', 'card-subtitle', '本周没有沉淀下明确的变化。'));
    return card;
  }
  card.append(memoryGrid(weekly.changes, false));
  return card;
}

function weeklyNextCard(weekly) {
  const card = cardShell('尚未结束', '开放事项', '这些事情，还值得继续推进');
  if (weekly.open_items?.length) card.append(actionList(weekly.open_items));
  card.append(agentLine('ECHO 的建议', weekly.next_observation));
  return card;
}

function buildWeeklyCards(weekly) {
  return [
    weeklyOverviewCard(weekly),
    weeklyHighlightsCard(weekly),
    weeklyTrendCard(weekly),
    weeklyChangesCard(weekly),
    weeklyNextCard(weekly),
  ].filter(Boolean);
}

// ---- frame ----

function railMeta() {
  if (state.mode === 'daily') {
    const daily = ATTEMPT4.daily[state.keys.daily];
    const basedOn = daily.based_on || {};
    return {
      kicker: 'DAILY RECAP',
      title: '今天，值得看清什么',
      period: `${fullDateLabel(daily.date)}<br>${(basedOn.sessions || []).length} 段会话 · ${
        basedOn.atom_count || 0
      } 条原子 · ${basedOn.message_count || 0} 条消息`,
    };
  }
  const weekly = ATTEMPT4.weekly[state.keys.weekly];
  return {
    kicker: 'WEEKLY RECAP',
    title: '这一周，什么最重要',
    period: `${weekLabel(`${weekly.year}-W${String(weekly.week).padStart(2, '0')}`)}<br>${weekRangeLabel(
      weekly
    )} · ${weekly.metrics?.days || 0} 天记录`,
  };
}

function fillPeriodSelect() {
  periodSelect.replaceChildren();
  const keys = state.mode === 'daily' ? DAILY_KEYS : WEEKLY_KEYS;
  keys.forEach((key) => {
    const option = document.createElement('option');
    option.value = key;
    option.textContent = state.mode === 'daily' ? fullDateLabel(key) : weekLabel(key);
    periodSelect.appendChild(option);
  });
  periodSelect.value = state.keys[state.mode];
}

function drawSteps() {
  stepsRoot.replaceChildren();
  cards().forEach((card, index) => {
    const button = document.createElement('button');
    button.className = 'step';
    const stepIndex = node('span', 'step-index', String(index + 1).padStart(2, '0'));
    const label = node('span', 'step-label', card.dataset.label);
    button.append(stepIndex, label);
    button.addEventListener('click', () => {
      state.index = index;
      update();
    });
    stepsRoot.appendChild(button);
  });
}

function cards() {
  return [...cardsRoot.querySelectorAll('.card')];
}

function update() {
  const allCards = cards();
  state.index = Math.max(0, Math.min(allCards.length - 1, state.index));
  allCards.forEach((card, index) => card.classList.toggle('is-active', index === state.index));
  [...stepsRoot.children].forEach((step, index) =>
    step.setAttribute('aria-current', index === state.index ? 'step' : 'false')
  );
  pageCount.textContent = `${String(state.index + 1).padStart(2, '0')} / ${String(
    allCards.length
  ).padStart(2, '0')}`;
  prevButton.disabled = state.index === 0;
  nextButton.disabled = state.index === allCards.length - 1;
}

function render() {
  const key = state.keys[state.mode];
  const built =
    state.mode === 'daily' ? buildDailyCards(ATTEMPT4.daily[key]) : buildWeeklyCards(ATTEMPT4.weekly[key]);
  cardsRoot.replaceChildren(...built);
  const meta = railMeta();
  document.getElementById('railKicker').textContent = meta.kicker;
  document.getElementById('railTitle').textContent = meta.title;
  document.getElementById('railPeriod').innerHTML = meta.period;
  drawSteps();
  update();
}

function renderMode(mode) {
  state.mode = mode;
  state.index = 0;
  document
    .querySelectorAll('.mode-tab')
    .forEach((button) => button.setAttribute('aria-selected', String(button.dataset.mode === mode)));
  fillPeriodSelect();
  render();
}

document
  .querySelectorAll('.mode-tab')
  .forEach((button) => button.addEventListener('click', () => renderMode(button.dataset.mode)));
periodSelect.addEventListener('change', () => {
  state.keys[state.mode] = periodSelect.value;
  state.index = 0;
  render();
});
prevButton.addEventListener('click', () => {
  state.index -= 1;
  update();
});
nextButton.addEventListener('click', () => {
  state.index += 1;
  update();
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowLeft') {
    state.index -= 1;
    update();
  }
  if (event.key === 'ArrowRight') {
    state.index += 1;
    update();
  }
});

renderMode('daily');
