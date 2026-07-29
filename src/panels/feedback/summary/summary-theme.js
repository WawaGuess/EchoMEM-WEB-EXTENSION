// Periodic-review styles are isolated from the Episode theme.
const STYLE_ID = 'echomem-summary-theme';

export function injectSummaryTheme(container) {
  if (!container || container.querySelector(`#${STYLE_ID}`)) return;

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .em-view-stage[data-em-view="summary"] {
      --em-bg: #fffbfe; --em-panel: rgba(255,255,255,.96); --em-panel-strong: #ffffff;
      --em-line: rgba(121,116,126,.24); --em-line-strong: rgba(103,80,164,.42);
      --em-text: #1d1b20; --em-text-2: #49454f; --em-text-3: #79747e;
      --em-cyan: #6750a4; --em-blue: #5278c5; --em-green: #3b8f6c;
      --em-amber: #b87a24; --em-pink: #ad557e; --em-purple: #6750a4;
      color: var(--em-text);
      color-scheme: light;
      background:
        radial-gradient(circle at 8% -12%, rgba(234,221,255,.56), transparent 32%),
        linear-gradient(145deg, #fffbfe 0%, #fef7ff 55%, #f6f1fa 100%);
    }
    .em-summary-view { position: absolute; inset: 0; display: flex; flex-direction: column; min-height: 0; }
    .em-summary-stage { flex: 1 1 auto; min-height: 0; overflow: auto; padding: clamp(18px,2.6vw,34px); background: radial-gradient(circle at 12% 14%,rgba(234,221,255,.52),transparent 30%),linear-gradient(145deg,#fffbfe,#fef7ff 55%,#f6f1fa); }
    .em-summary-board { max-width: 1040px; margin: 0 auto; padding-bottom: 22px; }
    .em-summary-hero {
      position: relative; overflow: hidden; padding: clamp(24px,4vw,44px);
      background: radial-gradient(circle at 88% 0%,rgba(85,214,220,.15),transparent 38%), linear-gradient(135deg,rgba(18,39,53,.94),rgba(10,22,32,.9));
    }
    .em-summary-hero::after { content: ''; position: absolute; right: -54px; bottom: -74px; width: 220px; height: 220px; border: 1px solid rgba(85,214,220,.09); border-radius: 50%; box-shadow: 0 0 0 28px rgba(85,214,220,.025),0 0 0 58px rgba(85,214,220,.018); }
    .em-summary-hero > * { position: relative; z-index: 1; }
    .em-summary-hero h1 { max-width: 820px; margin: 15px 0 0; color: var(--em-text); font-size: clamp(21px,2.7vw,30px); font-weight: 570; line-height: 1.55; letter-spacing: -.02em; }
    .em-summary-hero-sub { margin-top: 13px; color: var(--em-text-3); font-size: 11px; }
    .em-summary-metrics { display: grid; grid-template-columns: repeat(4,minmax(0,1fr)); gap: 1px; margin-top: 12px; overflow: hidden; border: 1px solid var(--em-line); border-radius: 13px; background: var(--em-line); }
    .em-summary-metric { min-height: 82px; padding: 16px 18px; background: rgba(10,22,32,.94); }
    .em-summary-metric-value { color: var(--em-text); font: 650 23px/1.1 "JetBrains Mono",monospace; }
    .em-summary-metric-label { margin-top: 8px; color: var(--em-text-3); font-size: 10px; }
    .em-summary-grid { display: grid; grid-template-columns: repeat(12,minmax(0,1fr)); gap: 12px; margin-top: 12px; }
    .em-summary-section { grid-column: span 6; padding: 20px; }
    .em-summary-section.is-wide { grid-column: 1/-1; }
    .em-summary-section.is-third { grid-column: span 4; }
    .em-summary-section-copy { margin: 0; color: var(--em-text-2); font-size: 13px; line-height: 1.78; }
    .em-summary-list { display: flex; flex-direction: column; gap: 9px; }
    .em-summary-row { display: grid; grid-template-columns: 22px 1fr; gap: 10px; align-items: start; padding: 10px 11px; border-radius: 9px; background: rgba(255,255,255,.025); }
    .em-summary-row-mark { width: 20px; color: var(--row-color,var(--em-cyan)); font: 650 11px/1.6 "JetBrains Mono",monospace; text-align: center; }
    .em-summary-row-copy { color: var(--em-text-2); font-size: 12px; line-height: 1.58; }
    .em-summary-row-meta { margin-top: 4px; color: var(--em-text-3); font-size: 10px; }
    .em-highlight-card { border-color: rgba(239,200,117,.22); background: linear-gradient(135deg,rgba(239,200,117,.09),rgba(14,28,41,.88)); }
    .em-highlight-copy { margin: 4px 0 0; color: #f3dfad; font-size: 17px; line-height: 1.65; }
    .em-theme { padding: 12px 0; border-bottom: 1px solid var(--em-line); }
    .em-theme:first-of-type { padding-top: 0; }
    .em-theme:last-child { padding-bottom: 0; border-bottom: 0; }
    .em-theme-title { color: var(--em-text); font-size: 13px; font-weight: 620; }
    .em-theme-keywords { margin-top: 7px; color: var(--em-text-3); font-size: 10px; line-height: 1.6; }
    .em-memory-update { padding: 12px 13px; border-left: 2px solid var(--em-pink); border-radius: 0 9px 9px 0; background: rgba(233,149,189,.045); }
    .em-memory-update + .em-memory-update { margin-top: 8px; }
    .em-memory-before { color: var(--em-text-3); font-size: 10px; text-decoration: line-through; }
    .em-memory-after { margin-top: 5px; color: var(--em-text-2); font-size: 12px; line-height: 1.55; }
    .em-agent-note { display: flex; gap: 14px; align-items: flex-start; }
    .em-agent-avatar { flex: 0 0 auto; display: grid; place-items: center; width: 34px; height: 34px; border: 1px solid rgba(85,214,220,.25); border-radius: 10px; color: var(--em-cyan); background: rgba(85,214,220,.07); font-weight: 700; }
    .em-agent-quote { margin: 0; color: var(--em-text-2); font-size: 13px; line-height: 1.72; }
    .em-summary-provenance { display: flex; flex-wrap: wrap; gap: 8px 18px; margin-top: 13px; padding: 0 3px; color: var(--em-text-3); font-size: 10px; }
    .em-summary-stage { overflow: hidden; }
    .echomem-feedback-shell .swiper { position: relative; display: block; margin: 0 auto; padding: 0; overflow: hidden; list-style: none; z-index: 1; }
    .echomem-feedback-shell .swiper-wrapper { position: relative; display: flex; width: 100%; height: 100%; z-index: 1; transition-property: transform; transition-timing-function: var(--swiper-wrapper-transition-timing-function, initial); box-sizing: content-box; }
    .echomem-feedback-shell .swiper-slide { position: relative; display: block; flex-shrink: 0; width: 100%; height: 100%; transition-property: transform; }
    .echomem-feedback-shell .swiper-3d { perspective: 1200px; }
    .echomem-feedback-shell .swiper-3d .swiper-wrapper,
    .echomem-feedback-shell .swiper-3d .swiper-slide,
    .echomem-feedback-shell .swiper-3d .swiper-slide-shadow { transform-style: preserve-3d; }
    .echomem-feedback-shell .swiper-slide-transform { width: 100%; height: 100%; }
    .echomem-feedback-shell .swiper-slide-shadow { position: absolute; inset: 0; z-index: 10; border-radius: 24px; pointer-events: none; background: rgba(0,0,0,.18); }
    .em-recap { position: relative; width: 100%; height: 100%; min-height: 390px; display: grid; place-items: center; isolation: isolate; }
    .em-recap.is-initializing .swiper-slide:not(:first-child), .em-recap.is-fallback .swiper-slide:not(:first-child) { display: none; }
    .em-recap.is-fallback .swiper-wrapper { transform: none !important; }
    .em-recap::before, .em-recap::after { content: ''; position: absolute; border-radius: 50%; filter: blur(2px); pointer-events: none; }
    .em-recap::before { width: 280px; height: 280px; left: 6%; top: 8%; background: radial-gradient(circle,rgba(85,214,220,.11),transparent 68%); }
    .em-recap::after { width: 320px; height: 320px; right: 4%; bottom: -10%; background: radial-gradient(circle,rgba(182,154,255,.1),transparent 68%); }
    .em-recap-swiper { width: min(480px, calc(100% - 110px)); height: min(500px, calc(100% - 56px)); min-height: 340px; overflow: hidden; border-radius: 24px; filter: drop-shadow(16px 15px 0 rgba(85,214,220,.055)) drop-shadow(28px 27px 0 rgba(182,154,255,.035)); }
    .em-recap-swiper .swiper-slide { opacity: .18; transform: scale(.965); transition: opacity .34s ease, transform .48s cubic-bezier(.2,.75,.25,1); }
    .em-recap-swiper .swiper-slide-active { opacity: 1; transform: scale(1); }
    .em-recap-card { position: relative; width: 100%; height: 100%; overflow: hidden; padding: clamp(24px,4vh,38px); border: 1px solid rgba(255,255,255,.28); border-radius: 24px; color: #fff; box-shadow: 0 24px 64px rgba(33,0,93,.2); background: linear-gradient(145deg,#6750a4,#21005d); }
    .em-recap-card::before { content: ''; position: absolute; inset: 0; opacity: .62; background-image: radial-gradient(rgba(255,255,255,.12) .7px,transparent .7px); background-size: 17px 17px; mask-image: linear-gradient(to bottom,black,transparent 58%); pointer-events: none; }
    .em-recap-card.is-ocean { background: linear-gradient(150deg,#6750a4 0%,#4f378b 52%,#21005d 100%); }
    .em-recap-card.is-violet { background: linear-gradient(150deg,#7b61b5 0%,#6750a4 52%,#3a1860 100%); }
    .em-recap-card.is-blue { background: linear-gradient(150deg,#5278c5 0%,#6750a4 58%,#21005d 100%); }
    .em-recap-card.is-cyan { background: linear-gradient(150deg,#625b71 0%,#6750a4 58%,#21005d 100%); }
    .em-recap-card.is-amber { background: linear-gradient(150deg,#9a6b27 0%,#75567b 54%,#3a285f 100%); }
    .em-recap-card.is-green { background: linear-gradient(150deg,#47735a 0%,#5f587d 54%,#332255 100%); }
    .em-recap-card.is-rose { background: linear-gradient(150deg,#9a5b78 0%,#785b91 54%,#3a285f 100%); }
    .em-recap-card.is-purple { background: linear-gradient(150deg,#7b61b5 0%,#6750a4 54%,#21005d 100%); }
    .em-recap-card.is-slate { background: linear-gradient(150deg,#625b71 0%,#51485f 54%,#2f2738 100%); }
    .em-recap-glow { position: absolute; width: 230px; height: 230px; right: -90px; top: -100px; border-radius: 50%; background: rgba(255,255,255,.13); filter: blur(10px); }
    .em-recap-card-head { position: relative; z-index: 2; display: flex; align-items: center; justify-content: space-between; gap: 16px; }
    .em-recap-mark { font: 700 9px/1 "JetBrains Mono",monospace; letter-spacing: .18em; opacity: .64; }
    .em-recap-eyebrow { font-size: 10px; letter-spacing: .08em; opacity: .74; }
    .em-recap-title { position: relative; z-index: 2; max-width: 390px; margin: clamp(22px,4vh,34px) 0 0; font-size: clamp(23px,3.4vw,31px); font-weight: 620; line-height: 1.36; letter-spacing: -.025em; }
    .em-recap-card.is-cover { display: flex; flex-direction: column; }
    .em-recap-cover-title { position: relative; z-index: 2; max-width: 410px; margin: auto 0 0; font-size: clamp(26px,4.2vw,38px); font-weight: 570; line-height: 1.42; letter-spacing: -.035em; }
    .em-recap-period { position: relative; z-index: 2; margin-top: 20px; font: 600 12px/1.4 "JetBrains Mono",monospace; letter-spacing: .05em; opacity: .78; }
    .em-recap-cover-note { position: relative; z-index: 2; margin-top: 8px; font-size: 11px; opacity: .58; }
    .em-recap-orb { position: absolute; width: 210px; height: 210px; right: -28px; top: 58px; opacity: .72; }
    .em-recap-orb span { position: absolute; inset: 0; border: 1px solid rgba(255,255,255,.2); border-radius: 48% 52% 62% 38%; animation: em-orbit 13s linear infinite; }
    .em-recap-orb span:nth-child(2) { inset: 24px; animation-duration: 9s; animation-direction: reverse; border-radius: 58% 42% 42% 58%; }
    .em-recap-orb span:nth-child(3) { inset: 53px; animation-duration: 6s; background: rgba(255,255,255,.08); border: 0; }
    .em-recap-progress { position: absolute; z-index: 20; top: 4px; left: 50%; width: min(470px,calc(100% - 120px)); display: flex; gap: 5px; transform: translateX(-50%); }
    .em-recap-progress button { flex: 1 1 0; height: 3px; padding: 0; overflow: hidden; border: 0; border-radius: 999px; background: rgba(36,69,81,.13); cursor: pointer; }
    .em-recap-progress button::after { content: ''; display: block; width: 0; height: 100%; border-radius: inherit; background: linear-gradient(90deg,var(--em-cyan),#c3f4f5); transition: width .35s ease; }
    .em-recap-progress button.is-complete::after, .em-recap-progress button.is-active::after { width: 100%; }
    .em-recap-progress button.is-active::after { box-shadow: 0 0 10px rgba(85,214,220,.7); }
    .em-recap-nav { position: absolute; z-index: 20; top: 50%; width: 42px; height: 42px; display: grid; place-items: center; border: 1px solid var(--em-line); border-radius: 50%; background: rgba(255,255,255,.86); color: var(--em-text-2); font-size: 25px; line-height: 1; cursor: pointer; transform: translateY(-50%); box-shadow: 0 10px 24px rgba(41,72,83,.1); backdrop-filter: blur(12px); transition: .18s ease; }
    .em-recap-nav.is-prev { left: max(10px,calc(50% - 310px)); }
    .em-recap-nav.is-next { right: max(10px,calc(50% - 310px)); }
    .em-recap-nav:hover:not(:disabled) { color: var(--em-cyan); border-color: var(--em-line-strong); transform: translateY(-50%) scale(1.05); }
    .em-recap-nav:disabled { opacity: .22; cursor: default; }
    .em-recap-footer { position: absolute; z-index: 20; bottom: 0; left: 50%; width: min(470px,calc(100% - 120px)); display: flex; align-items: center; justify-content: space-between; color: var(--em-text-3); font-size: 10px; transform: translateX(-50%); }
    .em-recap-count { color: var(--em-text-2); font: 600 10px/1 "JetBrains Mono",monospace; letter-spacing: .08em; }
    .em-recap-metrics { position: relative; z-index: 2; display: grid; grid-template-columns: repeat(2,1fr); gap: 10px; margin-top: clamp(22px,4vh,36px); overflow: auto; }
    .em-recap-metric { padding: 15px; border: 1px solid rgba(255,255,255,.11); border-radius: 14px; background: rgba(255,255,255,.055); backdrop-filter: blur(6px); }
    .em-recap-metric-value { font: 650 clamp(24px,4vw,36px)/1.1 "JetBrains Mono",monospace; }
    .em-recap-metric-label { margin-top: 8px; font-size: 10px; opacity: .64; }
    .em-recap-reading { position: relative; z-index: 2; max-height: calc(100% - 116px); margin: clamp(20px,4vh,34px) 0 0; overflow: auto; font-size: clamp(14px,1.9vw,17px); line-height: 1.9; letter-spacing: .01em; opacity: .91; }
    .em-recap-big-symbol { position: relative; z-index: 2; margin-top: 25px; color: #ffe0a1; font-size: 54px; line-height: 1; text-shadow: 0 0 30px rgba(255,219,145,.4); }
    .em-recap-highlight { position: relative; z-index: 2; margin: 18px 0 0; font-size: clamp(18px,2.6vw,24px); line-height: 1.65; color: #fff1cc; }
    .em-recap-list, .em-recap-action-groups, .em-recap-themes, .em-recap-updates, .em-recap-tag-groups, .em-recap-source { position: relative; z-index: 2; max-height: calc(100% - 118px); margin-top: 22px; overflow: auto; }
    .em-recap-list-row { display: grid; grid-template-columns: 27px 1fr; gap: 10px; padding: 11px 0; border-bottom: 1px solid rgba(255,255,255,.1); font-size: 12px; line-height: 1.58; }
    .em-recap-list-row:last-child { border-bottom: 0; }
    .em-recap-list-number { font: 600 10px/1.8 "JetBrains Mono",monospace; opacity: .5; }
    .em-recap-action-groups { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .em-recap-group-title { margin-bottom: 10px; font-size: 10px; letter-spacing: .08em; opacity: .58; }
    .em-recap-action-row { display: grid; grid-template-columns: 20px 1fr; gap: 8px; padding: 9px 0; border-bottom: 1px solid rgba(255,255,255,.09); font-size: 11px; line-height: 1.55; }
    .em-recap-theme-title { font-size: 13px; font-weight: 650; }
    .em-recap-theme-keywords { margin-top: 5px; font-size: 10px; line-height: 1.5; opacity: .58; }
    .em-recap-themes > div, .em-recap-updates > div { padding: 11px 0; border-bottom: 1px solid rgba(255,255,255,.1); }
    .em-recap-before { font-size: 10px; opacity: .45; text-decoration: line-through; }
    .em-recap-after { margin-top: 5px; font-size: 12px; line-height: 1.55; }
    .em-recap-tag-groups { display: flex; flex-direction: column; gap: 19px; }
    .em-recap-tags { display: flex; flex-wrap: wrap; gap: 7px; }
    .em-recap-tags span { padding: 6px 10px; border: 1px solid rgba(255,255,255,.15); border-radius: 999px; background: rgba(255,255,255,.06); font-size: 11px; }
    .em-recap-agent-mark { position: relative; z-index: 2; display: grid; place-items: center; width: 48px; height: 48px; margin-top: 28px; border: 1px solid rgba(255,255,255,.2); border-radius: 15px; background: rgba(255,255,255,.08); font: 700 18px/1 "JetBrains Mono",monospace; }
    .em-recap-agent-note { position: relative; z-index: 2; margin: 24px 0 0; font-size: clamp(18px,2.6vw,24px); line-height: 1.7; }
    .em-recap-source > div { display: flex; align-items: baseline; justify-content: space-between; gap: 18px; padding: 13px 0; border-bottom: 1px solid rgba(255,255,255,.1); }
    .em-recap-source span { font-size: 10px; opacity: .55; }
    .em-recap-source strong { font-size: 12px; font-weight: 600; text-align: right; }
    .em-summary-toolbar { position: relative; overflow: visible; }
    .em-date-control { position: relative; margin-left: auto; }
    .em-calendar-trigger { min-width: 180px; height: 40px; display: flex; align-items: center; gap: 9px; padding: 0 12px; border: 1px solid var(--em-line); border-radius: 12px; color: var(--em-text-2); background: #fff; cursor: pointer; box-shadow: none; transition: .2s ease; }
    .em-calendar-trigger:hover, .em-calendar-trigger.is-open { color: #21005d; border-color: var(--em-line-strong); background: rgba(103,80,164,.08); }
    .em-calendar-icon { display: grid; place-items: center; width: 20px; height: 20px; border-radius: 5px; color: var(--em-cyan); background: rgba(85,214,220,.1); font-size: 13px; }
    .em-calendar-label { flex: 1; text-align: left; font-size: 11px; }
    .em-calendar-chevron { color: var(--em-text-3); font-size: 13px; transition: transform .18s ease; }
    .em-calendar-trigger.is-open .em-calendar-chevron { transform: rotate(180deg); }
    .em-date-popover { position: absolute; z-index: 50; top: calc(100% + 9px); right: 0; width: 310px; padding: 16px; visibility: hidden; opacity: 0; transform: translateY(-6px) scale(.98); transform-origin: top right; border: 1px solid var(--em-line); border-radius: 16px; background: rgba(255,255,255,.98); box-shadow: 0 18px 48px rgba(33,0,93,.16); backdrop-filter: blur(18px); transition: opacity .2s ease, transform .2s ease, visibility .2s; }
    .em-date-popover.is-open { visibility: visible; opacity: 1; transform: translateY(0) scale(1); }
    .em-calendar-head { display: grid; grid-template-columns: 30px 1fr 30px; align-items: center; gap: 8px; }
    .em-calendar-head strong { color: var(--em-text); font-size: 13px; text-align: center; }
    .em-calendar-head button { width: 30px; height: 30px; border: 1px solid transparent; border-radius: 8px; color: var(--em-text-2); background: transparent; cursor: pointer; }
    .em-calendar-head button:hover:not(:disabled) { color: var(--em-cyan); border-color: var(--em-line); background: rgba(85,214,220,.06); }
    .em-calendar-head button:disabled { opacity: .22; cursor: default; }
    .em-calendar-weekdays, .em-calendar-grid { display: grid; grid-template-columns: repeat(7,1fr); gap: 4px; }
    .em-calendar-weekdays { margin: 15px 0 7px; }
    .em-calendar-weekdays span { color: var(--em-text-3); font-size: 9px; text-align: center; }
    .em-calendar-grid > span, .em-calendar-grid button { aspect-ratio: 1; }
    .em-calendar-grid button { position: relative; border: 1px solid transparent; border-radius: 9px; color: var(--em-text-2); background: rgba(28,66,78,.045); font-size: 11px; cursor: pointer; transition: .15s ease; }
    .em-calendar-grid button:hover:not(:disabled) { color: var(--em-text); border-color: rgba(85,214,220,.3); background: rgba(85,214,220,.1); transform: translateY(-1px); }
    .em-calendar-grid button:disabled { color: rgba(113,137,151,.25); background: transparent; cursor: default; }
    .em-calendar-grid button:not(:disabled)::after { content: ''; position: absolute; left: 50%; bottom: 4px; width: 3px; height: 3px; border-radius: 50%; background: var(--em-cyan); transform: translateX(-50%); }
    .em-calendar-grid button.is-selected { color: #ffffff; border-color: var(--em-cyan); background: var(--em-cyan); font-weight: 700; box-shadow: 0 7px 18px rgba(15,143,149,.2); }
    .em-calendar-grid button.is-selected::after { background: #ffffff; }
    .em-calendar-grid button.is-today:not(.is-selected) { border-color: rgba(239,200,117,.35); }
    .em-calendar-hint { margin: 12px 0 0; color: var(--em-text-3); font-size: 9px; text-align: center; }
    .em-week-picker-title { color: var(--em-text); font-size: 13px; font-weight: 650; }
    .em-week-picker { max-height: 310px; margin-top: 12px; overflow: auto; display: flex; flex-direction: column; gap: 7px; }
    .em-week-picker button { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 11px 12px; border: 1px solid var(--em-line); border-radius: 10px; color: var(--em-text-2); background: rgba(239,245,246,.72); cursor: pointer; text-align: left; }
    .em-week-picker button:hover { border-color: var(--em-line-strong); background: rgba(85,214,220,.06); }
    .em-week-picker button.is-selected { border-color: rgba(85,214,220,.35); background: rgba(85,214,220,.1); }
    .em-week-picker strong { font-size: 11px; font-weight: 620; }
    .em-week-picker span { color: var(--em-text-3); font-size: 9px; }
    @keyframes em-orbit { to { transform: rotate(360deg); } }
    @media (prefers-reduced-motion: reduce) {
      .em-recap-orb span { animation: none !important; }
      .em-recap-nav { transition: none !important; }
    }
    @media (max-width: 820px) {
      .em-summary-section, .em-summary-section.is-third { grid-column: 1/-1; }
      .em-summary-metrics { grid-template-columns: repeat(2,1fr); }
      .em-summary-stage { padding: 14px 10px; }
      .em-recap-swiper { width: min(430px,calc(100% - 38px)); height: min(500px,calc(100% - 50px)); }
      .em-recap-progress, .em-recap-footer { width: min(420px,calc(100% - 48px)); }
      .em-recap-nav { width: 34px; height: 34px; }
      .em-recap-nav.is-prev { left: 0; }
      .em-recap-nav.is-next { right: 0; }
      .em-recap-action-groups { grid-template-columns: 1fr; gap: 18px; }
    }
  `;
  container.prepend(style);
}
