// 认知反馈 - 周期总结视图
// 从 EchoMem 后端读取 summary/daily 与 summary/weekly，并渲染为卡片式回顾。

import { fetchPeriodicReview } from './summary-client.js';
import { renderDailyCards, renderWeeklyCards } from './summary-cards.js';
import { injectSummaryTheme } from './summary-theme.js';

const MODE_OPTIONS = [
  { key: 'daily', label: '每日回顾' },
  { key: 'weekly', label: '每周回顾' },
];

export function renderSummary(container, options = {}) {
  cleanupSummary(container);
  container.innerHTML = '';
  injectSummaryTheme(container);
  container.style.position = 'relative';

  const isActive = () => {
    if (typeof options.api?.isActive === 'function') return options.api.isActive();
    return container.isConnected;
  };

  const root = document.createElement('div');
  root.className = 'em-summary-view';
  container.appendChild(root);

  const loading = document.createElement('div');
  loading.className = 'em-summary-loading';
  loading.style.cssText = 'display:flex;align-items:center;justify-content:center;height:100%;min-height:240px;color:#e3e3e3;font-size:14px;';
  loading.textContent = '正在加载周期总结…';
  root.appendChild(loading);

  fetchPeriodicReview({
    engineId: options.engineId,
    date: options.date,
    week: options.week,
  })
    .then((model) => {
      if (!isActive()) return;
      loading.remove();
      init(model, root, container, options);
    })
    .catch((err) => {
      console.error('EchoMem summary: 加载失败', err);
      if (!isActive()) return;
      loading.remove();
      renderError(root, err, () => renderSummary(container, options));
    });
}

function renderError(root, err, onRetry) {
  root.innerHTML = '';
  const box = document.createElement('div');
  box.className = 'em-summary-error';
  box.style.cssText = 'display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;min-height:240px;color:#e3e3e3;gap:12px;';
  const title = document.createElement('p');
  title.textContent = '加载周期总结失败';
  title.style.cssText = 'margin:0;font-weight:500;';
  const copy = document.createElement('p');
  copy.textContent = err?.message || '请确认 EchoMem 后端已启动并已生成总结';
  copy.style.cssText = 'margin:0;font-size:13px;opacity:0.8;';
  const retry = document.createElement('button');
  retry.type = 'button';
  retry.className = 'em-primary-btn';
  retry.textContent = '重试';
  retry.addEventListener('click', onRetry);
  box.append(title, copy, retry);
  root.appendChild(box);
}

function init(model, root, container, options) {
  const hasMode = (m) => Boolean(model[m]?.items && Object.keys(model[m].items).length);
  const initialMode = options.mode === 'weekly' && hasMode('weekly') ? 'weekly' : 'daily';

  const state = {
    model,
    mode: initialMode,
    currentKeys: {
      daily: validKey('daily', options.date, model) || model.daily?.defaultKey || '',
      weekly: validKey('weekly', options.week, model) || model.weekly?.defaultKey || '',
    },
    calendarMonth: '',
    calendarOpen: false,
    handlers: {},
    cardsRoot: null,
  };

  if (state.currentKeys.daily) {
    state.calendarMonth = monthKey(state.currentKeys.daily);
  }

  root.innerHTML = '';
  const toolbar = buildToolbar(state);
  const stage = document.createElement('div');
  stage.className = 'em-summary-stage';
  stage.id = 'em-summary-review-panel';
  stage.setAttribute('role', 'tabpanel');
  stage.setAttribute('aria-live', 'polite');
  root.append(toolbar, stage);

  function draw() {
    state.cardsRoot?._cleanup?.();
    stage.replaceChildren();
    const review = currentReview(state);
    if (!review) {
      stage.textContent = '所选周期暂无总结';
      stage.style.color = '#e3e3e3';
      stage.style.display = 'flex';
      stage.style.alignItems = 'center';
      stage.style.justifyContent = 'center';
      stage.style.minHeight = '200px';
      return;
    }
    stage.style = '';
    state.cardsRoot = state.mode === 'daily'
      ? renderDailyCards(review)
      : renderWeeklyCards(review);
    stage.appendChild(state.cardsRoot);
    updateToolbar(toolbar, state, review);
  }

  function switchMode(mode) {
    if (!model[mode] || mode === state.mode) return;
    state.mode = mode;
    state.calendarOpen = false;
    draw();
  }

  function toggleCalendar(force) {
    state.calendarOpen = typeof force === 'boolean' ? force : !state.calendarOpen;
    updateToolbar(toolbar, state, currentReview(state));
  }

  function selectPeriod(key) {
    if (!validKey(state.mode, key, model)) return;
    state.currentKeys[state.mode] = key;
    if (state.mode === 'daily') state.calendarMonth = monthKey(key);
    state.calendarOpen = false;
    draw();
    toolbar._trigger?.focus();
  }

  function shiftCalendarMonth(delta) {
    const months = availableMonths(model);
    const currentIndex = Math.max(0, months.indexOf(state.calendarMonth));
    state.calendarMonth = months[Math.max(0, Math.min(months.length - 1, currentIndex + delta))];
    updateToolbar(toolbar, state, currentReview(state));
  }

  const onOutside = (event) => {
    if (state.calendarOpen && !toolbar.contains(event.target)) toggleCalendar(false);
  };
  const onEscape = (event) => {
    if (event.key !== 'Escape' || !state.calendarOpen) return;
    toggleCalendar(false);
    toolbar._trigger?.focus();
  };
  document.addEventListener('pointerdown', onOutside);
  document.addEventListener('keydown', onEscape);

  state.handlers = {
    switchMode,
    toggleCalendar,
    selectPeriod,
    shiftCalendarMonth,
    onOutside,
    onEscape,
  };
  container._summaryState = state;
  draw();
}

function buildToolbar(state) {
  const bar = document.createElement('div');
  bar.className = 'em-toolbar em-summary-toolbar';

  const heading = document.createElement('div');
  heading.className = 'em-summary-heading';
  const title = document.createElement('h1');
  title.textContent = '周期总结';
  const note = document.createElement('span');
  note.textContent = '真实记忆证据 · LLM 生成';
  heading.append(title, note);

  const modeWrap = document.createElement('div');
  modeWrap.className = 'em-segmented em-summary-mode-tabs';
  modeWrap.setAttribute('role', 'tablist');
  modeWrap.setAttribute('aria-label', '回顾周期');
  MODE_OPTIONS.forEach((option) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = option.label;
    button.dataset.key = option.key;
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-controls', 'em-summary-review-panel');
    button.addEventListener('click', () => state.handlers.switchMode(option.key));
    modeWrap.appendChild(button);
  });

  const dateControl = document.createElement('div');
  dateControl.className = 'em-date-control em-summary-date-control';
  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'em-calendar-trigger em-summary-period-trigger';
  trigger.setAttribute('aria-haspopup', 'dialog');
  trigger.setAttribute('aria-expanded', 'false');
  const icon = document.createElement('span');
  icon.className = 'em-calendar-icon';
  icon.appendChild(calendarIcon());
  const label = document.createElement('span');
  label.className = 'em-summary-period-label';
  trigger.append(icon, label);
  trigger.addEventListener('click', () => state.handlers.toggleCalendar());
  dateControl.appendChild(trigger);

  const popover = document.createElement('div');
  popover.className = 'em-date-popover';
  dateControl.appendChild(popover);
  bar._trigger = trigger;
  bar._label = label;
  bar._popover = popover;

  bar.append(heading, modeWrap, dateControl);
  return bar;
}

function updateToolbar(toolbar, state, review) {
  const mode = state.mode;
  const activeKey = state.currentKeys[mode];

  toolbar.querySelectorAll('.em-summary-mode-tabs [role="tab"]').forEach((btn) => {
    const selected = btn.dataset.key === mode;
    btn.setAttribute('aria-selected', String(selected));
    btn.tabIndex = selected ? 0 : -1;
    btn.classList.toggle('is-active', selected);
  });

  toolbar._trigger.setAttribute('aria-expanded', String(state.calendarOpen));
  toolbar._popover.classList.toggle('is-open', state.calendarOpen);
  toolbar._trigger.classList.toggle('is-open', state.calendarOpen);
  toolbar._label.textContent = review?.period || formatPeriodLabel(mode, activeKey);

  if (state.calendarOpen) {
    toolbar._popover.replaceChildren();
    if (mode === 'daily') {
      renderCalendar(toolbar._popover, state);
    } else {
      renderWeekPicker(toolbar._popover, state);
    }
  }
}

function renderCalendar(container, state) {
  const months = availableMonths(state.model);
  const currentMonth = state.calendarMonth || months[0] || '';

  const header = document.createElement('div');
  header.className = 'em-calendar-head';
  const prev = calendarArrow('left', '上个月');
  const next = calendarArrow('right', '下个月');
  const title = document.createElement('strong');
  title.textContent = formatMonth(currentMonth);
  prev.addEventListener('click', () => state.handlers.shiftCalendarMonth(-1));
  next.addEventListener('click', () => state.handlers.shiftCalendarMonth(1));
  header.append(prev, title, next);

  const weekdays = document.createElement('div');
  weekdays.className = 'em-calendar-weekdays';
  ['一', '二', '三', '四', '五', '六', '日'].forEach((d) => {
    const cell = document.createElement('span');
    cell.textContent = d;
    weekdays.appendChild(cell);
  });

  const grid = document.createElement('div');
  grid.className = 'em-calendar-grid';
  const available = new Set(availableKeys('daily', state.model));
  const [year, month] = currentMonth.split('-').map(Number);
  const firstDay = new Date(Date.UTC(year, month - 1, 1));
  const startOffset = (firstDay.getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  for (let i = 0; i < startOffset; i++) {
    const pad = document.createElement('span');
    grid.appendChild(pad);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const key = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const enabled = available.has(key);
    const selected = key === state.currentKeys.daily;
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = String(day);
    button.disabled = !enabled;
    button.classList.toggle('is-selected', selected);
    button.setAttribute('aria-label', enabled ? `查看 ${formatPeriodLabel('daily', key)}` : `${key} 没有回顾`);
    if (selected) button.setAttribute('aria-current', 'date');
    if (enabled) button.addEventListener('click', () => state.handlers.selectPeriod(key));
    grid.appendChild(button);
  }

  const hint = document.createElement('p');
  hint.className = 'em-calendar-hint';
  hint.textContent = '有圆点的日期可以查看每日回顾';
  container.append(header, weekdays, grid, hint);
}

function renderWeekPicker(container, state) {
  const title = document.createElement('div');
  title.className = 'em-week-picker-title';
  title.textContent = '选择一周';
  const list = document.createElement('div');
  list.className = 'em-week-picker';
  availableKeys('weekly', state.model).reverse().forEach((key) => {
    const button = document.createElement('button');
    button.type = 'button';
    const selected = key === state.currentKeys.weekly;
    button.classList.toggle('is-selected', selected);
    if (selected) button.setAttribute('aria-current', 'true');
    const main = document.createElement('strong');
    main.textContent = formatPeriodLabel('weekly', key);
    const range = document.createElement('span');
    range.textContent = weekRange(key);
    button.append(main, range);
    button.addEventListener('click', () => state.handlers.selectPeriod(key));
    list.appendChild(button);
  });
  container.append(title, list);
}

function calendarArrow(direction, label) {
  const button = document.createElement('button');
  button.type = 'button';
  button.setAttribute('aria-label', label);
  button.appendChild(directionIcon(direction));
  return button;
}

function currentReview(state) {
  const items = state.model[state.mode]?.items;
  if (!items) return null;
  return items[state.currentKeys[state.mode]] || null;
}

function validKey(mode, key, model) {
  return key && model[mode]?.items[key] ? key : '';
}

function availableKeys(mode, model) {
  return Object.keys(model[mode]?.items || {}).sort();
}

function availableMonths(model) {
  return [...new Set(availableKeys('daily', model).map(monthKey))];
}

function formatPeriodLabel(mode, key) {
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
  const format = (date) => `${date.getUTCMonth() + 1}月${date.getUTCDate()}日`;
  return `${format(monday)} — ${format(sunday)}`;
}

function isoWeekMonday(year, week) {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const day = jan4.getUTCDay() || 7;
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - day + 1 + (week - 1) * 7);
  return monday;
}

function calendarIcon() {
  return svgIcon('M7 2v3M17 2v3M3.5 9h17M5 4h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z');
}

function chevronIcon() {
  return svgIcon('m8 10 4 4 4-4');
}

function directionIcon(direction) {
  return svgIcon(direction === 'left' ? 'm15 18-6-6 6-6' : 'm9 18 6-6-6-6');
}

function svgIcon(pathData) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.8');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', pathData);
  svg.appendChild(path);
  return svg;
}

export function cleanupSummary(container) {
  const state = container?._summaryState;
  state?.cardsRoot?._cleanup?.();
  if (state?.handlers?.onOutside) document.removeEventListener('pointerdown', state.handlers.onOutside);
  if (state?.handlers?.onEscape) document.removeEventListener('keydown', state.handlers.onEscape);
  if (container) container._summaryState = null;
}
