// Wrapped-style tenant memory review cards, powered by Swiper's stable core slider.
import Swiper from 'swiper';
import { A11y, Keyboard } from 'swiper/modules';

export function renderDailyCards(summary) {
  const slides = [];

  slides.push(coverCard({
    eyebrow: '你的每日记忆',
    title: summary.overview || '这一天的记忆已经整理好了',
    period: formatDate(summary.date),
    theme: 'ocean',
  }));

  if (summary.metrics) slides.push(metricsCard(summary.metrics, '这一天，留下了这些记录', 'violet'));
  if (summary.narrative) slides.push(readingCard('这一天发生了什么', summary.narrative, 'blue'));
  if (summary.highlight?.description) slides.push(highlightCard(summary.highlight, 'amber'));
  if (summary.keyFacts?.length) slides.push(listCard('EchoMem 记住了', '从会话里沉淀出的关键事实', summary.keyFacts, factText, 'cyan'));
  if (summary.decisions?.length || summary.actionItems?.length) {
    slides.push(actionCard(summary.decisions || [], summary.actionItems || [], 'green'));
  }
  if (hasTags(summary)) slides.push(tagsCard(summary, 'rose'));
  if (summary.agentNote) slides.push(agentCard(summary.agentNote, 'purple'));
  slides.push(sourceCard(summary.basedOn, summary.generatedAt, 'daily', 'slate'));

  return buildRecap(slides, '每日记忆回顾');
}

export function renderWeeklyCards(summary) {
  const slides = [];
  const period = summary.dateRange
    ? `${formatDate(summary.dateRange.start)} — ${formatDate(summary.dateRange.end)}`
    : `第 ${summary.week || ''} 周`;

  slides.push(coverCard({
    eyebrow: '你的每周记忆',
    title: '这一周，你经历了什么？',
    period,
    theme: 'violet',
    note: summary.metrics ? `${summary.metrics.days || 0} 天 · ${summary.metrics.sessions || 0} 个会话 · ${summary.metrics.turns || 0} 轮对话` : '',
  }));

  if (summary.narrative) slides.push(readingCard('这一周的故事', summary.narrative, 'blue'));
  if (summary.metrics) slides.push(metricsCard(summary.metrics, '这一周，记忆这样生长', 'ocean'));
  if (summary.themeClusters?.length) slides.push(themesCard(summary.themeClusters, 'cyan'));
  if (summary.highlights?.length) slides.push(listCard('本周关键转折', '决定、变化与里程碑', summary.highlights, highlightText, 'amber'));
  if (summary.memoryUpdates?.length) slides.push(updatesCard(summary.memoryUpdates, 'rose'));
  if (summary.suggestions?.length) slides.push(listCard('接下来值得关注', '由本周长期记忆提炼', summary.suggestions, String, 'green'));
  if (hasTags(summary)) slides.push(tagsCard(summary, 'purple'));
  if (summary.agentNote) slides.push(agentCard(summary.agentNote, 'violet'));
  slides.push(sourceCard(summary.basedOn, summary.generatedAt, 'weekly', 'slate'));

  return buildRecap(slides, '每周记忆回顾');
}

function buildRecap(slides, label) {
  const root = node('section', 'em-recap');
  root.classList.add('is-initializing');
  root.setAttribute('aria-label', label);

  const progress = node('div', 'em-recap-progress');
  const progressButtons = slides.map((_, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('aria-label', `查看第 ${index + 1} 张回顾卡片`);
    button.addEventListener('click', () => goTo(index));
    progress.appendChild(button);
    return button;
  });

  const swiperEl = node('div', 'swiper em-recap-swiper');
  const wrapper = node('div', 'swiper-wrapper');
  slides.forEach((slide) => wrapper.appendChild(slide));
  swiperEl.appendChild(wrapper);

  const prev = navButton('‹', '上一张卡片', 'is-prev');
  const next = navButton('›', '下一张卡片', 'is-next');
  const footer = node('div', 'em-recap-footer');
  const count = node('span', 'em-recap-count');
  const hint = document.createElement('span');
  hint.textContent = '滑动卡片或使用方向键';
  footer.append(count, hint);
  root.append(progress, swiperEl, prev, next, footer);

  let swiperInstance = null;
  let initTimer = null;
  let initFrame = null;
  let currentIndex = 0;

  function update(index = 0) {
    currentIndex = index;
    progressButtons.forEach((button, buttonIndex) => {
      button.classList.toggle('is-complete', buttonIndex < index);
      button.classList.toggle('is-active', buttonIndex === index);
      button.setAttribute('aria-current', buttonIndex === index ? 'step' : 'false');
    });
    count.textContent = `${String(index + 1).padStart(2, '0')} / ${String(slides.length).padStart(2, '0')}`;
    prev.disabled = index === 0;
    next.disabled = index === slides.length - 1;
  }

  function goTo(index) {
    const safeIndex = Math.max(0, Math.min(slides.length - 1, index));
    if (swiperInstance) swiperInstance.slideTo(safeIndex);
    else if (root.classList.contains('is-fallback')) enableFallback(safeIndex);
  }

  function enableFallback(index = 0) {
    const safeIndex = Math.max(0, Math.min(slides.length - 1, index));
    if (swiperInstance) {
      swiperInstance.destroy(true, true);
      swiperInstance = null;
    }
    root.classList.remove('is-initializing', 'is-ready');
    root.classList.add('is-fallback');
    wrapper.style.transform = 'none';
    slides.forEach((slide, slideIndex) => {
      slide.style.display = slideIndex === safeIndex ? 'block' : 'none';
      slide.style.width = '100%';
      slide.style.height = '100%';
      slide.style.opacity = slideIndex === safeIndex ? '1' : '0';
      slide.style.transform = 'none';
    });
    update(safeIndex);
  }

  prev.addEventListener('click', () => goTo(currentIndex - 1));
  next.addEventListener('click', () => goTo(currentIndex + 1));
  update(0);

  function initWhenSized(attempt = 0) {
    if (!root.isConnected) return;
    const rect = swiperEl.getBoundingClientRect();
    if ((rect.width < 120 || rect.height < 180) && attempt < 60) {
      initFrame = requestAnimationFrame(() => initWhenSized(attempt + 1));
      return;
    }
    if (rect.width < 120 || rect.height < 180) {
      enableFallback(0);
      return;
    }
    root.classList.remove('is-initializing');
    try {
      swiperInstance = new Swiper(swiperEl, {
        modules: [Keyboard, A11y],
        effect: 'slide',
        slidesPerView: 1,
        spaceBetween: 28,
        roundLengths: true,
        grabCursor: true,
        speed: 480,
        resistanceRatio: 0.68,
        keyboard: { enabled: true, onlyInViewport: true },
        a11y: { enabled: true, prevSlideMessage: '上一张回顾', nextSlideMessage: '下一张回顾' },
        observer: true,
        observeParents: true,
        on: { slideChange: (swiper) => update(swiper.activeIndex) },
      });
      root.classList.add('is-ready');
      requestAnimationFrame(() => swiperInstance?.update());
      setTimeout(() => {
        if (!swiperInstance || !root.isConnected) return;
        const active = swiperEl.querySelector('.swiper-slide-active');
        const activeRect = active?.getBoundingClientRect();
        const hostRect = swiperEl.getBoundingClientRect();
        const intersects = activeRect && activeRect.width > 100 && activeRect.height > 180 &&
          activeRect.right > hostRect.left && activeRect.left < hostRect.right &&
          activeRect.bottom > hostRect.top && activeRect.top < hostRect.bottom;
        if (!intersects) enableFallback(swiperInstance.activeIndex || 0);
      }, 120);
    } catch (err) {
      console.error('EchoMem: 回顾卡片特效初始化失败，已降级为首卡展示', err);
      enableFallback(0);
    }
  }

  initTimer = setTimeout(() => initWhenSized(), 0);

  root._cleanup = () => {
    if (initTimer) clearTimeout(initTimer);
    if (initFrame) cancelAnimationFrame(initFrame);
    swiperInstance?.destroy(true, true);
    swiperInstance = null;
  };
  return root;
}

function cardShell(theme, eyebrow, title) {
  // Cards Effect is most reliable when the visual card is the slide itself.
  // A nested transform target can be shifted out of view when the extension overlay
  // finishes sizing after Swiper's first measurement.
  const slide = node('article', `swiper-slide em-recap-card is-${theme}`);
  const card = slide;
  const glow = node('div', 'em-recap-glow');
  const top = node('header', 'em-recap-card-head');
  const mark = node('span', 'em-recap-mark');
  mark.textContent = 'ECHO';
  const eyebrowEl = node('span', 'em-recap-eyebrow');
  eyebrowEl.textContent = eyebrow;
  top.append(mark, eyebrowEl);
  card.append(glow, top);
  if (title) {
    const heading = document.createElement('h2');
    heading.className = 'em-recap-title';
    heading.textContent = title;
    card.appendChild(heading);
  }
  slide._card = card;
  return slide;
}

function coverCard({ eyebrow, title, period, theme, note = '' }) {
  const slide = cardShell(theme, eyebrow, '');
  const card = slide._card;
  card.classList.add('is-cover');
  const orb = node('div', 'em-recap-orb');
  orb.innerHTML = '<span></span><span></span><span></span>';
  const titleEl = document.createElement('h2');
  titleEl.className = 'em-recap-cover-title';
  titleEl.textContent = title;
  const date = node('div', 'em-recap-period');
  date.textContent = period;
  card.append(orb, titleEl, date);
  if (note) {
    const noteEl = node('div', 'em-recap-cover-note');
    noteEl.textContent = note;
    card.appendChild(noteEl);
  }
  return slide;
}

function metricsCard(metrics, title, theme) {
  const slide = cardShell(theme, '记忆足迹', title);
  const grid = node('div', 'em-recap-metrics');
  const items = [
    ['sessions', '个会话'], ['turns', '轮对话'], ['user_messages', '条用户消息'],
    [metrics.days !== undefined ? 'days' : 'peak_hour', metrics.days !== undefined ? '个记忆日' : '最活跃时段'],
  ];
  items.forEach(([key, label], index) => {
    const cell = node('div', 'em-recap-metric');
    const value = node('div', 'em-recap-metric-value');
    value.textContent = metrics[key] ?? '—';
    const caption = node('div', 'em-recap-metric-label');
    caption.textContent = label;
    cell.append(value, caption);
    grid.appendChild(cell);
  });
  slide._card.appendChild(grid);
  return slide;
}

function readingCard(title, text, theme) {
  const slide = cardShell(theme, '记忆叙事', title);
  const quote = node('p', 'em-recap-reading');
  quote.textContent = text;
  slide._card.appendChild(quote);
  return slide;
}

function highlightCard(highlight, theme) {
  const slide = cardShell(theme, typeLabel(highlight.type) || '今日高光', '这一刻，值得被记住');
  const icon = node('div', 'em-recap-big-symbol');
  icon.textContent = '✦';
  const copy = node('p', 'em-recap-highlight');
  copy.textContent = highlight.description;
  slide._card.append(icon, copy);
  return slide;
}

function listCard(title, eyebrow, items, formatter, theme) {
  const slide = cardShell(theme, eyebrow, title);
  const list = node('div', 'em-recap-list');
  items.forEach((item, index) => {
    const row = node('div', 'em-recap-list-row');
    const number = node('span', 'em-recap-list-number');
    number.textContent = String(index + 1).padStart(2, '0');
    const copy = document.createElement('span');
    copy.textContent = formatter(item);
    row.append(number, copy);
    list.appendChild(row);
  });
  slide._card.appendChild(list);
  return slide;
}

function actionCard(decisions, actions, theme) {
  const slide = cardShell(theme, '从记忆走向下一步', '决定与行动');
  const groups = node('div', 'em-recap-action-groups');
  if (decisions.length) groups.appendChild(actionGroup('已经决定', decisions, (item) => item.description || String(item), '✓'));
  if (actions.length) groups.appendChild(actionGroup('接下来要做', actions, (item) => item.description || String(item), '→'));
  slide._card.appendChild(groups);
  return slide;
}

function actionGroup(title, items, formatter, symbol) {
  const group = document.createElement('section');
  const heading = node('div', 'em-recap-group-title');
  heading.textContent = title;
  group.appendChild(heading);
  items.forEach((item) => {
    const row = node('div', 'em-recap-action-row');
    const icon = document.createElement('span');
    icon.textContent = symbol;
    const copy = document.createElement('span');
    copy.textContent = formatter(item);
    row.append(icon, copy);
    group.appendChild(row);
  });
  return group;
}

function themesCard(clusters, theme) {
  const slide = cardShell(theme, '主题聚类', '这一周，围绕这些事展开');
  const list = node('div', 'em-recap-themes');
  clusters.forEach((cluster) => {
    const item = document.createElement('div');
    const title = node('div', 'em-recap-theme-title');
    title.textContent = cluster.theme;
    const keywords = node('div', 'em-recap-theme-keywords');
    keywords.textContent = cluster.keywords?.join(' · ') || '';
    item.append(title, keywords);
    list.appendChild(item);
  });
  slide._card.appendChild(list);
  return slide;
}

function updatesCard(updates, theme) {
  const slide = cardShell(theme, '记忆演化', '有些理解，已经改变');
  const list = node('div', 'em-recap-updates');
  updates.forEach((update) => {
    const item = document.createElement('div');
    if (update.previous_version) {
      const before = node('div', 'em-recap-before');
      before.textContent = update.previous_version;
      item.appendChild(before);
    }
    const after = node('div', 'em-recap-after');
    after.textContent = `${update.is_update ? '更新为' : '新增'}：${update.statement}`;
    item.appendChild(after);
    list.appendChild(item);
  });
  slide._card.appendChild(list);
  return slide;
}

function tagsCard(summary, theme) {
  const slide = cardShell(theme, '记忆中的线索', '这些人和事，被反复提起');
  const groups = node('div', 'em-recap-tag-groups');
  [
    ['主题', summary.topics || []], ['人物', summary.people || []], ['情绪', summary.emotions || []],
  ].forEach(([label, items]) => {
    if (!items.length) return;
    const group = document.createElement('div');
    const heading = node('div', 'em-recap-group-title');
    heading.textContent = label;
    const wrap = node('div', 'em-recap-tags');
    items.forEach((item) => {
      const tag = document.createElement('span');
      tag.textContent = item;
      wrap.appendChild(tag);
    });
    group.append(heading, wrap);
    groups.appendChild(group);
  });
  slide._card.appendChild(groups);
  return slide;
}

function agentCard(note, theme) {
  const slide = cardShell(theme, 'ECHO 的观察', '最后，想对你说');
  const mark = node('div', 'em-recap-agent-mark');
  mark.textContent = 'E';
  const quote = node('p', 'em-recap-agent-note');
  quote.textContent = note;
  slide._card.append(mark, quote);
  return slide;
}

function sourceCard(basedOn = {}, generatedAt, type, theme) {
  const slide = cardShell(theme, '回顾完成', '每一段记忆，都有来处');
  const sessions = Array.isArray(basedOn.sessions) ? basedOn.sessions.length : 0;
  const days = Array.isArray(basedOn.daily_dates) ? basedOn.daily_dates.length : 0;
  const atoms = basedOn.atom_count ?? basedOn.total_atom_count ?? 0;
  const messages = basedOn.message_count ?? 0;
  const list = node('div', 'em-recap-source');
  [
    ['数据来源', 'EchoMem 租户长期记忆'],
    [type === 'daily' ? '覆盖会话' : '聚合回顾', type === 'daily' ? `${sessions} 个会话` : `${days} 个每日回顾`],
    ['事实记忆', `${atoms} 条${messages ? ` · ${messages} 条消息` : ''}`],
    ['生成时间', generatedAt ? formatDateTime(generatedAt) : '未记录'],
  ].forEach(([label, value]) => {
    const row = document.createElement('div');
    const key = document.createElement('span');
    key.textContent = label;
    const val = document.createElement('strong');
    val.textContent = value;
    row.append(key, val);
    list.appendChild(row);
  });
  slide._card.appendChild(list);
  return slide;
}

function navButton(symbol, label, className) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `em-recap-nav ${className}`;
  button.textContent = symbol;
  button.setAttribute('aria-label', label);
  return button;
}

function factText(item) {
  return typeof item === 'string' ? item : item.statement || '';
}

function highlightText(item) {
  return typeof item === 'string' ? item : item.description || '';
}

function typeLabel(type) {
  return ({ decision: '重要决定', state_change: '状态变化', action: '关键行动', observation: '新的观察', milestone: '里程碑' })[type] || '';
}

function hasTags(summary) {
  return Boolean(summary.emotions?.length || summary.topics?.length || summary.people?.length);
}

function formatDate(value) {
  if (!value) return '日期未记录';
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }).format(date);
}

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date);
}

function node(tag, className) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  return element;
}
