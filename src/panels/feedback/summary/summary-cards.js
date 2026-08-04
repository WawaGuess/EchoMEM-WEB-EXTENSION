// Periodic-review cards for the frontend preview data.
// All memory-derived copy is assigned through textContent; no tenant data is interpolated into HTML.

export function renderDailyCards(review) {
  const cards = review.cards;
  return buildReview(review, [
    overviewCard(cards.overview),
    topicCard(cards.topics),
    memoryCard(cards.facts),
    actionCard(cards.next),
  ], '每日回顾');
}

export function renderWeeklyCards(review) {
  const cards = review.cards;
  return buildReview(review, [
    overviewCard(cards.overview),
    highlightsCard(cards.highlights),
    trendCard(cards.trend),
    memoryCard(cards.changes),
    actionCard(cards.next),
  ], '每周回顾');
}

function buildReview(review, cards, label) {
  const root = node('section', 'em-periodic-review');
  root.tabIndex = 0;
  root.setAttribute('aria-label', label);

  const rail = node('aside', 'em-periodic-rail');
  const railHeading = node('div', 'em-periodic-rail-heading');
  const kicker = node('span', 'em-periodic-rail-kicker');
  kicker.textContent = review.modeLabel;
  const title = document.createElement('h2');
  title.textContent = review.railTitle;
  railHeading.append(kicker, title);

  const steps = node('nav', 'em-periodic-steps');
  steps.setAttribute('aria-label', '回顾卡片');
  const stepButtons = cards.map((card, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'em-periodic-step';
    button.setAttribute('aria-label', `查看第 ${index + 1} 张：${card.dataset.label}`);
    const number = node('span', 'em-periodic-step-index');
    number.textContent = String(index + 1).padStart(2, '0');
    const copy = node('span', 'em-periodic-step-label');
    copy.textContent = card.dataset.label;
    button.append(number, copy);
    steps.appendChild(button);
    return button;
  });
  rail.append(railHeading, steps);

  const stage = node('div', 'em-periodic-stage');
  const cardStack = node('div', 'em-periodic-card-stack');
  cards.forEach((card) => cardStack.appendChild(card));
  const navRow = node('div', 'em-periodic-nav-row');
  const count = node('span', 'em-periodic-page-count');
  count.setAttribute('aria-live', 'polite');
  const navButtons = node('div', 'em-periodic-nav-buttons');
  const prev = navButton('prev', '上一张卡片');
  const next = navButton('next', '下一张卡片');
  navButtons.append(prev, next);
  navRow.append(count, navButtons);
  stage.append(cardStack, navRow);
  root.append(rail, stage);

  let currentIndex = 0;

  function update(index) {
    currentIndex = Math.max(0, Math.min(cards.length - 1, index));
    cards.forEach((card, cardIndex) => {
      const active = cardIndex === currentIndex;
      card.hidden = !active;
      card.classList.toggle('is-active', active);
      card.setAttribute('aria-hidden', String(!active));
      if (active) card.scrollTop = 0;
    });
    stepButtons.forEach((button, buttonIndex) => {
      const active = buttonIndex === currentIndex;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-current', active ? 'step' : 'false');
    });
    count.textContent = `${String(currentIndex + 1).padStart(2, '0')} / ${String(cards.length).padStart(2, '0')}`;
    prev.disabled = currentIndex === 0;
    next.disabled = currentIndex === cards.length - 1;
  }

  stepButtons.forEach((button, index) => button.addEventListener('click', () => update(index)));
  prev.addEventListener('click', () => update(currentIndex - 1));
  next.addEventListener('click', () => update(currentIndex + 1));
  root.addEventListener('keydown', (event) => {
    if (event.target.closest?.('.em-periodic-topic-button')) return;
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      update(currentIndex - 1);
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      update(currentIndex + 1);
    }
  });

  root._cleanup = () => {};
  update(0);
  return root;
}

function overviewCard(data) {
  const card = cardShell(data);
  const title = cardTitle(data.title, 'em-periodic-hero-title');
  const subtitle = node('p', 'em-periodic-subtitle');
  subtitle.textContent = data.subtitle;
  card.append(title, subtitle, agentLine(data.agentLabel, data.agentText));
  return card;
}

function topicCard(data) {
  const card = cardShell(data);
  card.appendChild(cardTitle(data.title));
  const layout = node('div', 'em-periodic-attention-layout');
  const chartWrap = node('div', 'em-periodic-donut-wrap');
  const donut = node('div', 'em-periodic-donut');
  donut.setAttribute('role', 'img');
  donut.setAttribute('aria-label', data.items.map((item) => `${item.label} ${item.percent}%`).join('，'));
  donut.style.background = conicGradient(data.items);
  const donutCenter = node('div', 'em-periodic-donut-center');
  const donutValue = node('strong', 'em-periodic-donut-value');
  const donutTopic = node('span', 'em-periodic-donut-topic');
  donutCenter.append(donutValue, donutTopic);
  donut.appendChild(donutCenter);
  const note = node('p', 'em-periodic-chart-note');
  note.textContent = data.note;
  chartWrap.append(donut, note);

  const detail = node('div', 'em-periodic-topic-detail');
  const legend = node('div', 'em-periodic-topic-legend');
  const insight = agentLine('ECHO 的解读', data.items[0]?.insight || '');
  const insightCopy = insight.querySelector('.em-periodic-agent-text');
  const buttons = data.items.map((item, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'em-periodic-topic-button';
    button.setAttribute('aria-pressed', String(index === 0));
    const dot = node('span', 'em-periodic-topic-dot');
    dot.style.background = item.color;
    const copy = node('span', 'em-periodic-topic-copy');
    const name = document.createElement('strong');
    name.textContent = item.label;
    const count = document.createElement('span');
    count.textContent = item.countLabel;
    copy.append(name, count);
    const value = node('span', 'em-periodic-topic-value');
    value.textContent = `${item.percent}%`;
    button.append(dot, copy, value);
    button.addEventListener('click', () => {
      buttons.forEach((other) => other.setAttribute('aria-pressed', String(other === button)));
      donutValue.textContent = `${item.percent}%`;
      donutTopic.textContent = item.label;
      insightCopy.textContent = item.insight;
    });
    legend.appendChild(button);
    return button;
  });
  detail.append(legend, insight);
  layout.append(chartWrap, detail);
  card.appendChild(layout);

  if (data.items[0]) {
    donutValue.textContent = `${data.items[0].percent}%`;
    donutTopic.textContent = data.items[0].label;
  }
  return card;
}

function memoryCard(data) {
  const card = cardShell(data);
  card.appendChild(cardTitle(data.title));
  const grid = node('div', 'em-periodic-memory-grid');
  data.items.forEach((item) => {
    const memory = node('section', 'em-periodic-memory-item');
    const tag = node('span', 'em-periodic-memory-tag');
    tag.textContent = item.tag;
    const copy = document.createElement('p');
    copy.textContent = item.text;
    memory.append(tag, copy);
    if (item.evidence) {
      const evidence = document.createElement('small');
      evidence.textContent = item.evidence;
      memory.appendChild(evidence);
    }
    grid.appendChild(memory);
  });
  card.appendChild(grid);
  return card;
}

function actionCard(data) {
  const card = cardShell(data);
  card.appendChild(cardTitle(data.title));
  const list = node('div', 'em-periodic-action-list');
  data.items.forEach((item) => {
    const row = node('div', 'em-periodic-action-item');
    const mark = node('span', 'em-periodic-action-mark');
    mark.appendChild(arrowIcon('right'));
    const copy = node('span', 'em-periodic-action-copy');
    const title = document.createElement('strong');
    title.textContent = item.title;
    const detail = document.createElement('span');
    detail.textContent = item.detail;
    copy.append(title, detail);
    const status = node('span', 'em-periodic-status');
    status.textContent = item.status;
    row.append(mark, copy, status);
    list.appendChild(row);
  });
  card.appendChild(list);
  if (data.agentText) card.appendChild(agentLine(data.agentLabel, data.agentText));
  return card;
}

function highlightsCard(data) {
  const card = cardShell(data);
  card.appendChild(cardTitle(data.title));
  const list = node('div', 'em-periodic-highlight-list');
  data.items.forEach((item) => {
    const highlight = node('section', 'em-periodic-highlight');
    const date = node('span', 'em-periodic-highlight-date');
    date.textContent = item.date;
    const copy = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = item.title;
    const text = document.createElement('p');
    text.textContent = item.text;
    copy.append(title, text);
    highlight.append(date, copy);
    list.appendChild(highlight);
  });
  card.appendChild(list);
  return card;
}

function trendCard(data) {
  const card = cardShell(data);
  card.appendChild(cardTitle(data.title));
  const chart = node('div', 'em-periodic-trend');
  chart.setAttribute('role', 'img');
  chart.setAttribute('aria-label', data.ariaLabel);
  data.rows.forEach((row) => {
    const item = node('div', 'em-periodic-trend-row');
    const day = document.createElement('span');
    day.textContent = row.day;
    const bar = node('div', 'em-periodic-trend-bar');
    row.values.forEach((value, index) => {
      if (!value) return;
      const segment = document.createElement('span');
      segment.style.width = `${value}%`;
      segment.style.background = data.series[index].color;
      segment.title = `${data.series[index].label} ${value}%`;
      bar.appendChild(segment);
    });
    item.append(day, bar);
    chart.appendChild(item);
  });
  const legend = node('div', 'em-periodic-trend-legend');
  data.series.forEach((series) => {
    const item = document.createElement('span');
    const dot = document.createElement('i');
    dot.style.background = series.color;
    item.append(dot, document.createTextNode(series.label));
    legend.appendChild(item);
  });
  chart.append(legend, trendTable(data));
  card.append(chart, agentLine(data.agentLabel, data.agentText));
  return card;
}

function trendTable(data) {
  const table = document.createElement('table');
  table.className = 'em-sr-only';
  const caption = document.createElement('caption');
  caption.textContent = '本周每日关注主题占比';
  const head = document.createElement('thead');
  const headRow = document.createElement('tr');
  ['日期', ...data.series.map((series) => series.label)].forEach((label) => {
    const cell = document.createElement('th');
    cell.scope = 'col';
    cell.textContent = label;
    headRow.appendChild(cell);
  });
  head.appendChild(headRow);
  const body = document.createElement('tbody');
  data.rows.forEach((row) => {
    const tableRow = document.createElement('tr');
    [row.day, ...row.values.map((value) => `${value}%`)].forEach((value, index) => {
      const cell = document.createElement(index === 0 ? 'th' : 'td');
      if (index === 0) cell.scope = 'row';
      cell.textContent = value;
      tableRow.appendChild(cell);
    });
    body.appendChild(tableRow);
  });
  table.append(caption, head, body);
  return table;
}

function cardShell(data) {
  const card = node('article', 'em-periodic-card');
  card.dataset.label = data.label;
  const kicker = node('span', 'em-periodic-card-kicker');
  kicker.textContent = data.kicker;
  card.appendChild(kicker);
  return card;
}

function cardTitle(text, className = '') {
  const title = document.createElement('h2');
  title.className = ['em-periodic-card-title', className].filter(Boolean).join(' ');
  title.textContent = text;
  return title;
}

function agentLine(label, text) {
  const line = node('div', 'em-periodic-agent-line');
  const avatar = node('span', 'em-periodic-agent-avatar');
  avatar.textContent = 'E';
  avatar.setAttribute('aria-hidden', 'true');
  const copy = document.createElement('div');
  const heading = document.createElement('small');
  heading.textContent = label;
  const content = node('span', 'em-periodic-agent-text');
  content.textContent = text;
  copy.append(heading, content);
  line.append(avatar, copy);
  return line;
}

function navButton(direction, label) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'em-periodic-nav-button';
  button.setAttribute('aria-label', label);
  button.appendChild(arrowIcon(direction === 'prev' ? 'left' : 'right'));
  return button;
}

function arrowIcon(direction) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.8');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', direction === 'left' ? 'm15 18-6-6 6-6' : 'm9 18 6-6-6-6');
  svg.appendChild(path);
  return svg;
}

function conicGradient(items) {
  let start = 0;
  const segments = items.map((item) => {
    const end = start + item.percent;
    const segment = `${item.color} ${start}% ${end}%`;
    start = end;
    return segment;
  });
  return `conic-gradient(${segments.join(', ')})`;
}

function node(tag, className) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  return element;
}
