const SVGNS = 'http://www.w3.org/2000/svg';

const MS_PER_SEC = 1000;
const MS_PER_MIN = 60 * MS_PER_SEC;
const MS_PER_HOUR = 60 * MS_PER_MIN;
const MS_PER_DAY = 24 * MS_PER_HOUR;
const MS_PER_WEEK = 7 * MS_PER_DAY;
const MS_PER_MONTH = 30 * MS_PER_DAY;
const MS_PER_YEAR = 365 * MS_PER_DAY;

const STEP_PRESETS = [
  { ms: MS_PER_SEC, label: '秒' },
  { ms: 5 * MS_PER_SEC, label: '5秒' },
  { ms: 15 * MS_PER_SEC, label: '15秒' },
  { ms: MS_PER_MIN, label: '分' },
  { ms: 5 * MS_PER_MIN, label: '5分' },
  { ms: 15 * MS_PER_MIN, label: '15分' },
  { ms: MS_PER_HOUR, label: '时' },
  { ms: 6 * MS_PER_HOUR, label: '6时' },
  { ms: MS_PER_DAY, label: '日' },
  { ms: MS_PER_WEEK, label: '周' },
  { ms: MS_PER_MONTH, label: '月' },
  { ms: 3 * MS_PER_MONTH, label: '季' },
  { ms: MS_PER_YEAR, label: '年' },
  { ms: 5 * MS_PER_YEAR, label: '5年' },
  { ms: 10 * MS_PER_YEAR, label: '10年' },
  { ms: 50 * MS_PER_YEAR, label: '50年' },
  { ms: 100 * MS_PER_YEAR, label: '世纪' },
];

export function createTimeScale({ min, max, width, padding = 40 }) {
  const baseWidth = Math.max(1, width);
  const innerWidth = Math.max(1, baseWidth - padding * 2);

  let domainMin = min;
  let domainMax = max;
  if (domainMin == null || domainMax == null || domainMin === domainMax) {
    const center = domainMin ?? Date.now();
    domainMin = center - 30 * MS_PER_MIN;
    domainMax = center + 30 * MS_PER_MIN;
  }

  const fullSpan = Math.max(1, domainMax - domainMin);

  // 初始 scale：完整时间范围正好放进容器
  let scale = innerWidth / fullSpan;
  let offset = padding;

  // 缩放边界：最小让完整域占满容器，最大单秒 300px（足够看细节）
  const MIN_SCALE = innerWidth / Math.max(fullSpan, MS_PER_MIN * 10);
  const MAX_SCALE = Math.max(innerWidth / 1000, 300 / MS_PER_SEC);

  function toX(t) {
    if (t == null) return null;
    return offset + (t - domainMin) * scale;
  }

  function fromX(px) {
    return domainMin + (px - offset) / scale;
  }

  function zoom(factor, centerPx) {
    const anchorTime = fromX(centerPx);
    const nextScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale * factor));
    if (nextScale === scale) return false;
    scale = nextScale;
    offset = centerPx - (anchorTime - domainMin) * scale;
    return true;
  }

  function pan(dxPx) {
    offset += dxPx;
  }

  function fit() {
    scale = innerWidth / fullSpan;
    offset = padding;
  }

  function domain() {
    return { min: domainMin, max: domainMax };
  }

  // 当前缩放级别下，完整时间轴需要的总像素宽度
  function contentWidth() {
    return Math.max(baseWidth, Math.round(offset + fullSpan * scale + padding));
  }

  function zoomPercent() {
    return Math.round(((scale * fullSpan) / innerWidth) * 100);
  }

  // 根据可见窗口的 step 选合适的刻度间隔
  function ticks(targetCount = 6) {
    const visibleMin = fromX(offset - padding);
    const visibleMax = fromX(offset + innerWidth + padding);
    const visibleSpan = Math.max(1, visibleMax - visibleMin);
    const rawStep = visibleSpan / targetCount;
    const step = niceStep(rawStep);

    const startT = Math.floor(visibleMin / step) * step;
    const endT = visibleMax;
    const out = [];
    for (let t = startT; t <= endT; t += step) {
      const x = toX(t);
      if (x != null) out.push({ t, x, isMajor: step >= MS_PER_DAY });
    }
    return out;
  }

  function niceStep(rawMs) {
    for (let i = 0; i < STEP_PRESETS.length; i++) {
      if (rawMs <= STEP_PRESETS[i].ms) return STEP_PRESETS[i].ms;
    }
    return STEP_PRESETS[STEP_PRESETS.length - 1].ms;
  }

  return { toX, fromX, zoom, pan, fit, domain, ticks, contentWidth, zoomPercent };
}

export function formatTick(t, stepMs) {
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');

  if (stepMs == null || stepMs >= MS_PER_YEAR) {
    return `${d.getFullYear()}`;
  }
  if (stepMs >= MS_PER_MONTH) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  }
  if (stepMs >= MS_PER_DAY) {
    return `${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  if (stepMs >= MS_PER_HOUR) {
    return `${pad(d.getDate())} ${pad(d.getHours())}:00`;
  }
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function formatFull(t) {
  if (t == null) return '—';
  const d = new Date(t);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
