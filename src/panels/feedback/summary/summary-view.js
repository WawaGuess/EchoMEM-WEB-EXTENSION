// Tenant-memory review with a calendar-card period picker and Wrapped-style cards.
import { fetchDailySummary, fetchWeeklySummary, fetchSummaryList, getWeekKey } from '../../../services/summary-client.js';
import { renderDailyCards, renderWeeklyCards } from './summary-cards.js';
import { injectSummaryTheme } from './summary-theme.js';

const MODE_OPTIONS = [
  { key: 'daily', label: '每日回顾' },
  { key: 'weekly', label: '每周回顾' },
];

export function renderSummary(container, options = {}) {
  cleanupSummary(container);
  container.innerHTML = '';
  container.style.position = 'relative';
  injectSummaryTheme(container);

  const state = {
    mode: options.mode || 'daily',
    currentDate: options.date || todayStr(),
    currentWeek: options.week || getWeekKey(todayStr()),
    calendarMonth: monthKey(options.date || todayStr()),
    calendarOpen: false,
    summary: null,
    available: { daily: [], weekly: [] },
    handlers: {},
    cardsRoot: null,
    loadRevision: 0,
  };

  const root = document.createElement('div');
  root.className = 'em-summary-view';
  const toolbar = buildToolbar(state);
  const stage = document.createElement('div');
  stage.className = 'em-summary-stage';
  root.append(toolbar, stage);
  container.appendChild(root);

  async function load({ preserveKey = false } = {}) {
    const revision = ++state.loadRevision;
    const isCurrent = () => (
      container.isConnected
      && container._summaryState === state
      && state.loadRevision === revision
    );
    setLoading(stage);
    try {
      const available = await fetchSummaryList();
      if (!isCurrent()) return;
      state.available = available;
      alignPeriodWithAvailable(state, preserveKey);
      state.calendarMonth = monthKey(state.currentDate || todayStr());
      const key = currentKey(state);
      const summary = !key
        ? null
        : state.mode === 'daily'
          ? await fetchDailySummary(key)
          : await fetchWeeklySummary(key);
      if (!isCurrent()) return;
      state.summary = summary;
      updateToolbar(toolbar, state);
      draw();
    } catch (err) {
      console.error('EchoMem: 加载记忆回顾失败', err);
      if (isCurrent()) setError(stage, err, () => load({ preserveKey: true }));
    }
  }

  function draw() {
    state.cardsRoot?._cleanup?.();
    state.cardsRoot = null;
    stage.innerHTML = '';
    if (!state.summary) {
      setEmpty(stage, state.mode);
      return;
    }
    state.cardsRoot = state.mode === 'daily'
      ? renderDailyCards(state.summary)
      : renderWeeklyCards(state.summary);
    stage.appendChild(state.cardsRoot);
  }

  function switchMode(mode) {
    if (mode === state.mode) return;
    state.mode = mode;
    state.calendarOpen = false;
    alignPeriodWithAvailable(state, false);
    updateToolbar(toolbar, state);
    load();
  }

  function toggleCalendar(force) {
    state.calendarOpen = typeof force === 'boolean' ? force : !state.calendarOpen;
    updateToolbar(toolbar, state);
  }

  function selectPeriod(key) {
    setCurrentKey(state, key);
    state.calendarOpen = false;
    updateToolbar(toolbar, state);
    load({ preserveKey: true });
  }

  function shiftCalendarMonth(delta) {
    const months = [...new Set(state.available.daily.map(monthKey))].sort();
    if (!months.length) return;
    const currentIndex = Math.max(0, months.indexOf(state.calendarMonth));
    state.calendarMonth = months[Math.max(0, Math.min(months.length - 1, currentIndex + delta))];
    updateToolbar(toolbar, state);
  }

  const onOutside = (event) => {
    if (state.calendarOpen && !toolbar.contains(event.target)) toggleCalendar(false);
  };
  const onEscape = (event) => {
    if (event.key === 'Escape' && state.calendarOpen) toggleCalendar(false);
  };
  document.addEventListener('pointerdown', onOutside);
  document.addEventListener('keydown', onEscape);

  state.handlers = {
    switchMode, toggleCalendar, selectPeriod, shiftCalendarMonth, load, onOutside, onEscape,
  };
  container._summaryState = state;
  load();
}

function buildToolbar(state) {
  const bar = document.createElement('div');
  bar.className = 'em-toolbar em-summary-toolbar';

  const heading = document.createElement('div');
  heading.className = 'em-episode-heading';
  const title = document.createElement('strong');
  title.textContent = '记忆回顾';
  heading.appendChild(title);

  const modeWrap = document.createElement('div');
  modeWrap.className = 'em-segmented';
  MODE_OPTIONS.forEach((option) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = option.label;
    button.dataset.key = option.key;
    button.setAttribute('aria-pressed', String(option.key === state.mode));
    button.addEventListener('click', () => state.handlers.switchMode(option.key));
    modeWrap.appendChild(button);
  });

  const dateControl = document.createElement('div');
  dateControl.className = 'em-date-control';
  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'em-calendar-trigger';
  trigger.setAttribute('aria-haspopup', 'dialog');
  trigger.setAttribute('aria-expanded', 'false');
  const icon = document.createElement('span');
  icon.className = 'em-calendar-icon';
  icon.textContent = '▦';
  const label = document.createElement('span');
  label.className = 'em-calendar-label';
  const chevron = document.createElement('span');
  chevron.className = 'em-calendar-chevron';
  chevron.textContent = '⌄';
  trigger.append(icon, label, chevron);
  trigger.addEventListener('click', (event) => {
    event.stopPropagation();
    state.handlers.toggleCalendar();
  });

  const popover = document.createElement('div');
  popover.className = 'em-date-popover';
  popover.setAttribute('role', 'dialog');
  popover.setAttribute('aria-label', '选择记忆回顾日期');
  dateControl.append(trigger, popover);
  bar.append(heading, modeWrap, dateControl);

  bar._modeWrap = modeWrap;
  bar._trigger = trigger;
  bar._label = label;
  bar._popover = popover;
  return bar;
}

function updateToolbar(bar, state) {
  bar._modeWrap.querySelectorAll('button').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.key === state.mode));
  });
  bar._label.textContent = formatPeriodLabel(state.mode, currentKey(state));
  bar._trigger.setAttribute('aria-expanded', String(state.calendarOpen));
  bar._trigger.classList.toggle('is-open', state.calendarOpen);
  bar._popover.classList.toggle('is-open', state.calendarOpen);
  renderPeriodPicker(bar._popover, state);
}

function renderPeriodPicker(container, state) {
  container.innerHTML = '';
  if (state.mode === 'weekly') {
    renderWeekPicker(container, state);
    return;
  }
  renderCalendar(container, state);
}

function renderCalendar(container, state) {
  const available = new Set(state.available.daily);
  const months = [...new Set(state.available.daily.map(monthKey))].sort();
  const currentMonth = state.calendarMonth || months[months.length - 1] || monthKey(todayStr());
  const monthIndex = months.indexOf(currentMonth);

  const header = document.createElement('div');
  header.className = 'em-calendar-head';
  const prev = calendarArrow('‹', '上一个有回顾的月份');
  const title = document.createElement('strong');
  title.textContent = formatMonth(currentMonth);
  const next = calendarArrow('›', '下一个有回顾的月份');
  prev.disabled = monthIndex <= 0;
  next.disabled = monthIndex < 0 || monthIndex >= months.length - 1;
  prev.addEventListener('click', () => state.handlers.shiftCalendarMonth(-1));
  next.addEventListener('click', () => state.handlers.shiftCalendarMonth(1));
  header.append(prev, title, next);

  const weekdays = document.createElement('div');
  weekdays.className = 'em-calendar-weekdays';
  ['一', '二', '三', '四', '五', '六', '日'].forEach((day) => {
    const item = document.createElement('span');
    item.textContent = day;
    weekdays.appendChild(item);
  });

  const grid = document.createElement('div');
  grid.className = 'em-calendar-grid';
  const [year, month] = currentMonth.split('-').map(Number);
  const first = new Date(Date.UTC(year, month - 1, 1));
  const offset = (first.getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  for (let index = 0; index < offset; index += 1) grid.appendChild(document.createElement('span'));
  for (let day = 1; day <= days; day += 1) {
    const key = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = String(day);
    button.disabled = !available.has(key);
    button.classList.toggle('is-selected', key === state.currentDate);
    button.classList.toggle('is-today', key === todayStr());
    button.setAttribute('aria-label', available.has(key) ? `查看 ${formatPeriodLabel('daily', key)}的回顾` : `${key} 没有回顾`);
    if (available.has(key)) button.addEventListener('click', () => state.handlers.selectPeriod(key));
    grid.appendChild(button);
  }

  const hint = document.createElement('p');
  hint.className = 'em-calendar-hint';
  hint.textContent = '亮起的日期已有记忆回顾';
  container.append(header, weekdays, grid, hint);
}

function renderWeekPicker(container, state) {
  const title = document.createElement('div');
  title.className = 'em-week-picker-title';
  title.textContent = '选择一周';
  const list = document.createElement('div');
  list.className = 'em-week-picker';
  [...state.available.weekly].reverse().forEach((key) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.classList.toggle('is-selected', key === state.currentWeek);
    const main = document.createElement('strong');
    main.textContent = formatPeriodLabel('weekly', key);
    const range = document.createElement('span');
    range.textContent = weekRange(key);
    button.append(main, range);
    button.addEventListener('click', () => state.handlers.selectPeriod(key));
    list.appendChild(button);
  });
  if (!state.available.weekly.length) {
    const empty = document.createElement('p');
    empty.className = 'em-calendar-hint';
    empty.textContent = '暂时没有每周回顾';
    list.appendChild(empty);
  }
  container.append(title, list);
}

function calendarArrow(symbol, label) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = symbol;
  button.setAttribute('aria-label', label);
  return button;
}

function alignPeriodWithAvailable(state, preserveKey) {
  const keys = availableKeys(state);
  const key = currentKey(state);
  if (!keys.length) {
    setCurrentKey(state, '');
    return;
  }
  if (!preserveKey || !keys.includes(key)) setCurrentKey(state, keys[keys.length - 1]);
}

function availableKeys(state) {
  return state.mode === 'daily' ? state.available.daily : state.available.weekly;
}

function currentKey(state) {
  return state.mode === 'daily' ? state.currentDate : state.currentWeek;
}

function setCurrentKey(state, key) {
  if (state.mode === 'daily') state.currentDate = key;
  else state.currentWeek = key;
}

function formatPeriodLabel(mode, key) {
  if (!key) return '选择日期';
  if (mode === 'weekly') {
    const [year, week] = key.split('-W');
    return `${year} 年第 ${Number(week)} 周`;
  }
  const date = new Date(`${key}T00:00:00Z`);
  return new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }).format(date);
}

function formatMonth(key) {
  const [year, month] = key.split('-').map(Number);
  return `${year} 年 ${month} 月`;
}

function monthKey(dateKey) {
  return String(dateKey || '').slice(0, 7);
}

function weekRange(key) {
  const [year, week] = key.split('-W').map(Number);
  const monday = isoWeekMonday(year, week);
  const sunday = new Date(monday);
  sunday.setUTCDate(sunday.getUTCDate() + 6);
  const fmt = (date) => `${date.getUTCMonth() + 1}月${date.getUTCDate()}日`;
  return `${fmt(monday)} — ${fmt(sunday)}`;
}

function isoWeekMonday(year, week) {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const day = jan4.getUTCDay() || 7;
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - day + 1 + (week - 1) * 7);
  return monday;
}

function setLoading(container) {
  container.innerHTML = `
    <div class="em-loading">
      <div class="em-state-orb"></div>
      <p class="em-state-title">正在整理记忆回顾</p>
    </div>
  `;
}

function setError(container, err, retry) {
  container.innerHTML = '';
  const root = document.createElement('div');
  root.className = 'em-error';
  root.innerHTML = '<div class="em-state-orb"></div><p class="em-state-title">暂时无法读取记忆回顾</p>';
  const copy = document.createElement('p');
  copy.className = 'em-state-copy';
  copy.textContent = err?.message || '请确认 EchoMem 服务与记忆存储可访问。';
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'em-primary-btn';
  button.textContent = '重新读取';
  button.addEventListener('click', retry);
  root.append(copy, button);
  container.appendChild(root);
}

function setEmpty(container, mode) {
  container.innerHTML = `
    <div class="em-empty">
      <div class="em-state-orb"></div>
      <p class="em-state-title">还没有${mode === 'daily' ? '每日' : '每周'}记忆回顾</p>
      <p class="em-state-copy">完成记忆提交并等待对应周期的回顾生成后，这里会自动出现。</p>
    </div>
  `;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export function cleanupSummary(container) {
  const state = container?._summaryState;
  if (state) state.loadRevision += 1;
  state?.cardsRoot?._cleanup?.();
  if (state?.handlers?.onOutside) document.removeEventListener('pointerdown', state.handlers.onOutside);
  if (state?.handlers?.onEscape) document.removeEventListener('keydown', state.handlers.onEscape);
  if (container) container._summaryState = null;
}
