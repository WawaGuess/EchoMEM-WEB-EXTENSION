// Summary-only visual language. The shared shell remains in feedback-theme.js.

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
    .em-summary-stage { flex: 1 1 auto; min-height: 0; overflow: auto; padding: clamp(14px,2.2vw,28px); }
    .em-toolbar {
      min-height: 58px; display: flex; align-items: center; gap: 12px; padding: 10px 18px;
      border-bottom: 1px solid var(--em-line); background: rgba(255,255,255,.94); backdrop-filter: blur(12px); z-index: 10;
    }
    .em-segmented { display: inline-flex; gap: 3px; padding: 3px; border: 1px solid var(--em-line); border-radius: 12px; background: #fef7ff; }
    .em-segmented button { padding: 6px 11px; border: 0; border-radius: 9px; color: var(--em-text-3); background: transparent; cursor: pointer; }
    .em-segmented button[aria-selected="true"] { color: #21005d; background: #eaddff; box-shadow: none; }
    .em-summary-toolbar { position: relative; min-height: 78px; overflow: visible; gap: 18px; padding: 12px clamp(18px,2.2vw,28px); }
    .em-summary-heading { min-width: 185px; display: flex; flex-direction: column; gap: 5px; }
    .em-summary-heading h1 { margin: 0; color: var(--em-text); font-size: 18px; font-weight: 670; letter-spacing: -.02em; }
    .em-summary-heading span { width: fit-content; min-height: 22px; display: inline-flex; align-items: center; padding: 3px 8px; border-radius: 999px; color: #6750a4; background: #f2eaff; font-size: 9px; font-weight: 600; }
    .em-summary-mode-tabs { margin-left: auto; }
    .em-summary-mode-tabs button { min-height: 42px; padding: 8px 16px; font-size: 12px; font-weight: 600; }
    .em-summary-mode-tabs button[aria-selected="true"] { color: #21005d; background: #eaddff; }
    .em-summary-date-control { margin-left: 0; }
    .em-date-control { position: relative; }
    .em-calendar-trigger { min-width: 250px; height: 54px; display: flex; align-items: center; gap: 11px; padding: 6px 12px 6px 9px; border: 1px solid rgba(103,80,164,.18); border-radius: 15px; color: var(--em-text-2); background: #fff; cursor: pointer; box-shadow: 0 3px 12px rgba(73,50,115,.055); transition: color .18s ease,border-color .18s ease,background .18s ease,box-shadow .18s ease; }
    .em-calendar-trigger:hover, .em-calendar-trigger.is-open { color: #21005d; border-color: rgba(103,80,164,.38); background: #fef7ff; box-shadow: 0 7px 20px rgba(73,50,115,.09); }
    .em-calendar-icon { flex: 0 0 auto; display: grid; place-items: center; width: 36px; height: 36px; border-radius: 11px; color: #6750a4; background: #f2eaff; }
    .em-calendar-icon svg { width: 19px; height: 19px; }
    .em-summary-period-label { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 3px; text-align: left; }
    .em-summary-period-label strong { color: var(--em-text); font-size: 12px; font-weight: 650; font-variant-numeric: tabular-nums; }
    .em-summary-period-label span { overflow: hidden; color: var(--em-text-3); font-size: 9px; text-overflow: ellipsis; white-space: nowrap; }
    .em-date-popover { position: absolute; z-index: 50; top: calc(100% + 10px); right: 0; width: 360px; padding: 18px; visibility: hidden; opacity: 0; transform: translateY(-6px) scale(.985); transform-origin: top right; border: 1px solid rgba(103,80,164,.18); border-radius: 18px; background: #fff; box-shadow: 0 22px 56px rgba(47,35,70,.18); transition: opacity .18s ease,transform .18s ease,visibility .18s; }
    .em-date-popover.is-open { visibility: visible; opacity: 1; transform: translateY(0) scale(1); }
    .em-calendar-head { display: grid; grid-template-columns: 40px 1fr 40px; align-items: center; gap: 8px; }
    .em-calendar-head strong { color: var(--em-text); font-size: 13px; font-weight: 650; text-align: center; }
    .em-calendar-head button { width: 40px; height: 40px; display: grid; place-items: center; border: 1px solid transparent; border-radius: 11px; color: var(--em-text-2); background: transparent; cursor: pointer; }
    .em-calendar-head button svg { width: 18px; height: 18px; }
    .em-calendar-head button:hover:not(:disabled) { color: #6750a4; border-color: rgba(103,80,164,.14); background: #f2eaff; }
    .em-calendar-head button:disabled { opacity: .22; cursor: default; }
    .em-calendar-weekdays, .em-calendar-grid { display: grid; grid-template-columns: repeat(7,1fr); gap: 4px; }
    .em-calendar-weekdays { margin: 16px 0 8px; }
    .em-calendar-weekdays span { color: var(--em-text-3); font-size: 10px; font-weight: 600; text-align: center; }
    .em-calendar-grid > span, .em-calendar-grid button { aspect-ratio: 1; }
    .em-calendar-grid button { position: relative; min-width: 0; border: 1px solid transparent; border-radius: 11px; color: var(--em-text-2); background: #faf7fc; font-size: 11px; cursor: pointer; transition: color .15s ease,border-color .15s ease,background .15s ease,box-shadow .15s ease; }
    .em-calendar-grid button:hover:not(:disabled) { color: #21005d; border-color: rgba(103,80,164,.28); background: #f2eaff; }
    .em-calendar-grid button:disabled { color: rgba(121,116,126,.28); background: transparent; cursor: default; }
    .em-calendar-grid button:not(:disabled)::after { content: ''; position: absolute; left: 50%; bottom: 5px; width: 3px; height: 3px; border-radius: 50%; background: #6750a4; transform: translateX(-50%); }
    .em-calendar-grid button.is-selected { color: #ffffff; border-color: #6750a4; background: #6750a4; font-weight: 700; box-shadow: 0 7px 18px rgba(103,80,164,.22); }
    .em-calendar-grid button.is-selected::after { background: #ffffff; }
    .em-calendar-hint { margin: 14px 0 0; color: var(--em-text-3); font-size: 10px; text-align: center; }
    .em-week-picker-title { color: var(--em-text); font-size: 13px; font-weight: 650; }
    .em-week-picker { max-height: 310px; margin-top: 12px; overflow: auto; display: flex; flex-direction: column; gap: 7px; }
    .em-week-picker button { min-height: 54px; display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 11px 13px; border: 1px solid rgba(103,80,164,.13); border-radius: 12px; color: var(--em-text-2); background: #faf7fc; cursor: pointer; text-align: left; transition: border-color .15s ease,background .15s ease; }
    .em-week-picker button:hover { border-color: rgba(103,80,164,.3); background: #f2eaff; }
    .em-week-picker button.is-selected { border-color: rgba(103,80,164,.34); background: #f2eaff; }
    .em-week-picker strong { font-size: 12px; font-weight: 650; }
    .em-week-picker span { color: var(--em-text-3); font-size: 10px; }
    .em-periodic-review { width: min(1140px,100%); height: 100%; min-height: 0; display: grid; grid-template-columns: minmax(230px,270px) minmax(0,1fr); margin: 0 auto; overflow: hidden; border: 1px solid rgba(103,80,164,.14); border-radius: 22px; color: var(--em-text); background: rgba(255,255,255,.96); box-shadow: 0 18px 48px rgba(73,50,115,.085),0 2px 8px rgba(73,50,115,.045); }
    .em-periodic-review:focus { outline: none; }
    .em-periodic-review:focus-visible { outline: 2px solid #6750a4; outline-offset: 2px; }
    .em-periodic-rail { min-width: 0; display: flex; flex-direction: column; padding: clamp(24px,3vw,36px); border-right: 1px solid rgba(103,80,164,.1); background: linear-gradient(160deg,#fff 0%,#fbf7ff 100%); }
    .em-periodic-rail-kicker, .em-periodic-card-kicker { color: #6750a4; font-size: 10px; font-weight: 700; letter-spacing: .12em; }
    .em-periodic-rail-heading h2 { margin: 10px 0 0; color: #21005d; font-size: clamp(21px,2.2vw,28px); font-weight: 570; line-height: 1.35; letter-spacing: -.03em; }
    .em-periodic-steps { display: flex; flex-direction: column; gap: 5px; margin-top: clamp(28px,5vh,48px); padding-top: 0; }
    .em-periodic-step { min-height: 48px; display: grid; grid-template-columns: 28px minmax(0,1fr); align-items: center; gap: 8px; padding: 8px 10px; border: 1px solid transparent; border-radius: 11px; color: var(--em-text-3); background: transparent; cursor: pointer; text-align: left; transition: color .16s ease,background .16s ease,border-color .16s ease; }
    .em-periodic-step:hover { color: #493273; background: rgba(103,80,164,.055); }
    .em-periodic-step.is-active { color: #21005d; border-color: rgba(103,80,164,.14); background: #f2eaff; box-shadow: inset 3px 0 #6750a4; }
    .em-periodic-step-index { font-size: 10px; font-weight: 700; font-variant-numeric: tabular-nums; }
    .em-periodic-step-label { overflow: hidden; font-size: 12px; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
    .em-periodic-stage { min-width: 0; min-height: 0; display: grid; grid-template-rows: minmax(0,1fr) auto; gap: 16px; padding: clamp(24px,3.4vw,42px); background: #fff; }
    .em-periodic-card-stack { min-width: 0; min-height: 0; }
    .em-periodic-card { height: 100%; overflow-y: auto; padding: 2px 4px 8px; scrollbar-gutter: stable; animation: em-periodic-card-in .2s ease-out; }
    .em-periodic-card[hidden] { display: none; }
    .em-periodic-card-title { max-width: 760px; margin: 12px 0 0; color: var(--em-text); font-size: clamp(23px,3.2vw,36px); font-weight: 570; line-height: 1.32; letter-spacing: -.035em; white-space: pre-line; }
    .em-periodic-hero-title { color: #21005d; font-size: clamp(27px,3.8vw,43px); }
    .em-periodic-subtitle { max-width: 740px; margin: 18px 0 0; color: var(--em-text-2); font-size: clamp(14px,1.55vw,17px); line-height: 1.8; }
    .em-periodic-agent-line { display: grid; grid-template-columns: 38px minmax(0,1fr); align-items: start; gap: 12px; margin-top: 24px; padding-top: 18px; border-top: 1px solid rgba(103,80,164,.12); }
    .em-periodic-agent-avatar { display: grid; place-items: center; width: 38px; height: 38px; border: 1px solid rgba(103,80,164,.2); border-radius: 11px; color: #6750a4; background: #f2eaff; font-size: 14px; font-weight: 750; }
    .em-periodic-agent-line > div { min-width: 0; color: var(--em-text-2); font-size: 13px; line-height: 1.7; }
    .em-periodic-agent-line small { display: block; margin-bottom: 4px; color: #6750a4; font-size: 10px; font-weight: 750; letter-spacing: .06em; }
    .em-periodic-agent-text { display: block; }
    .em-periodic-attention-layout { display: grid; grid-template-columns: minmax(210px,.76fr) minmax(290px,1.24fr); align-items: center; gap: clamp(24px,4vw,48px); margin-top: 22px; }
    .em-periodic-donut-wrap { display: grid; justify-items: center; }
    .em-periodic-donut { width: min(220px,72%); aspect-ratio: 1; display: grid; place-items: center; border-radius: 50%; box-shadow: inset 0 0 0 1px rgba(103,80,164,.08),0 12px 30px rgba(73,50,115,.1); }
    .em-periodic-donut-center { width: 66%; aspect-ratio: 1; display: grid; place-content: center; justify-items: center; padding: 12px; border-radius: 50%; background: #fff; box-shadow: 0 5px 18px rgba(73,50,115,.08); text-align: center; }
    .em-periodic-donut-value { color: #21005d; font-size: clamp(28px,3.4vw,42px); font-weight: 570; font-variant-numeric: tabular-nums; line-height: 1; }
    .em-periodic-donut-topic { margin-top: 7px; color: var(--em-text-3); font-size: 10px; line-height: 1.35; }
    .em-periodic-chart-note { max-width: 260px; margin: 13px 0 0; color: var(--em-text-3); font-size: 10px; line-height: 1.5; text-align: center; }
    .em-periodic-topic-legend { display: flex; flex-direction: column; gap: 7px; }
    .em-periodic-topic-button { min-height: 58px; display: grid; grid-template-columns: 10px minmax(0,1fr) auto; align-items: center; gap: 11px; padding: 10px 12px; border: 1px solid rgba(103,80,164,.1); border-radius: 12px; color: var(--em-text-2); background: rgba(255,255,255,.78); cursor: pointer; text-align: left; transition: border-color .16s ease,background .16s ease,box-shadow .16s ease; }
    .em-periodic-topic-button:hover, .em-periodic-topic-button[aria-pressed="true"] { border-color: rgba(103,80,164,.28); background: #fff; box-shadow: 0 5px 18px rgba(73,50,115,.07); }
    .em-periodic-topic-dot { width: 9px; height: 9px; border-radius: 50%; }
    .em-periodic-topic-copy { min-width: 0; display: flex; flex-direction: column; gap: 3px; }
    .em-periodic-topic-copy strong { color: var(--em-text); font-size: 12px; font-weight: 650; }
    .em-periodic-topic-copy span { color: var(--em-text-3); font-size: 10px; }
    .em-periodic-topic-value { color: #6750a4; font-size: 12px; font-weight: 750; font-variant-numeric: tabular-nums; }
    .em-periodic-topic-detail .em-periodic-agent-line { margin-top: 15px; padding-top: 15px; }
    .em-periodic-memory-grid { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 10px; margin-top: 22px; }
    .em-periodic-memory-item { min-width: 0; padding: 15px 16px; border: 1px solid rgba(103,80,164,.12); border-radius: 13px; background: linear-gradient(145deg,rgba(103,80,164,.045),rgba(255,255,255,.92)); }
    .em-periodic-memory-tag { display: inline-flex; min-height: 23px; align-items: center; padding: 3px 8px; border-radius: 999px; color: #493273; background: #f2eaff; font-size: 9px; font-weight: 750; letter-spacing: .04em; }
    .em-periodic-memory-item p { margin: 11px 0 0; color: var(--em-text-2); font-size: 13px; line-height: 1.65; }
    .em-periodic-memory-item small { display: block; margin-top: 11px; color: var(--em-text-3); font-size: 9px; line-height: 1.45; }
    .em-periodic-action-list { display: flex; flex-direction: column; gap: 8px; margin-top: 22px; }
    .em-periodic-action-item { display: grid; grid-template-columns: 34px minmax(0,1fr) auto; align-items: center; gap: 12px; padding: 12px 13px; border: 1px solid rgba(103,80,164,.11); border-radius: 12px; background: rgba(255,255,255,.82); }
    .em-periodic-action-mark { display: grid; place-items: center; width: 32px; height: 32px; border-radius: 10px; color: #6750a4; background: #f2eaff; }
    .em-periodic-action-mark svg { width: 16px; height: 16px; }
    .em-periodic-action-copy { min-width: 0; display: flex; flex-direction: column; gap: 4px; }
    .em-periodic-action-copy strong { color: var(--em-text); font-size: 12px; font-weight: 650; }
    .em-periodic-action-copy > span { color: var(--em-text-3); font-size: 10px; line-height: 1.5; }
    .em-periodic-status { min-height: 24px; display: inline-flex; align-items: center; padding: 3px 8px; border: 1px solid rgba(184,122,36,.16); border-radius: 999px; color: #8a5b1e; background: rgba(184,122,36,.07); font-size: 9px; white-space: nowrap; }
    .em-periodic-highlight-list { display: flex; flex-direction: column; margin-top: 20px; }
    .em-periodic-highlight { display: grid; grid-template-columns: 66px minmax(0,1fr); gap: 15px; padding: 16px 0; border-bottom: 1px solid rgba(103,80,164,.12); }
    .em-periodic-highlight:last-child { border-bottom: 0; }
    .em-periodic-highlight-date { color: #8a5b1e; font-size: 11px; font-weight: 750; font-variant-numeric: tabular-nums; }
    .em-periodic-highlight strong { color: var(--em-text); font-size: 14px; font-weight: 650; }
    .em-periodic-highlight p { margin: 6px 0 0; color: var(--em-text-3); font-size: 11px; line-height: 1.62; }
    .em-periodic-trend { margin-top: 20px; padding: 16px; border: 1px solid rgba(103,80,164,.11); border-radius: 14px; background: rgba(255,255,255,.82); }
    .em-periodic-trend-row { display: grid; grid-template-columns: 40px minmax(0,1fr); align-items: center; gap: 10px; margin: 8px 0; }
    .em-periodic-trend-row > span { color: var(--em-text-3); font-size: 10px; }
    .em-periodic-trend-bar { height: 14px; display: flex; overflow: hidden; border-radius: 999px; background: #ede7f3; }
    .em-periodic-trend-bar span { height: 100%; }
    .em-periodic-trend-legend { display: flex; flex-wrap: wrap; gap: 10px 16px; margin-top: 14px; color: var(--em-text-3); font-size: 10px; }
    .em-periodic-trend-legend span { display: inline-flex; align-items: center; gap: 6px; }
    .em-periodic-trend-legend i { width: 7px; height: 7px; border-radius: 50%; }
    .em-periodic-nav-row { display: flex; align-items: center; justify-content: space-between; min-height: 46px; padding-top: 12px; border-top: 1px solid rgba(103,80,164,.1); }
    .em-periodic-page-count { color: var(--em-text-3); font-size: 10px; font-weight: 700; font-variant-numeric: tabular-nums; letter-spacing: .08em; }
    .em-periodic-nav-buttons { display: flex; gap: 8px; }
    .em-periodic-nav-button { width: 44px; height: 44px; display: grid; place-items: center; border: 1px solid rgba(103,80,164,.16); border-radius: 12px; color: #493273; background: #fff; cursor: pointer; transition: color .16s ease,background .16s ease,border-color .16s ease; }
    .em-periodic-nav-button:hover:not(:disabled) { color: #21005d; border-color: rgba(103,80,164,.34); background: #f2eaff; }
    .em-periodic-nav-button:disabled { opacity: .35; cursor: default; }
    .em-periodic-nav-button svg { width: 20px; height: 20px; }
    .em-sr-only { position: absolute !important; width: 1px !important; height: 1px !important; padding: 0 !important; margin: -1px !important; overflow: hidden !important; clip: rect(0,0,0,0) !important; white-space: nowrap !important; border: 0 !important; }
    @keyframes em-periodic-card-in { from { opacity: .45; transform: translateX(10px); } to { opacity: 1; transform: translateX(0); } }
    @media (prefers-reduced-motion: reduce) {
      .em-date-popover, .em-calendar-trigger, .em-periodic-card { transition: none !important; }
      .em-periodic-step, .em-periodic-topic-button, .em-periodic-nav-button { transition: none !important; }
      .em-periodic-card { animation: none !important; }
    }
    @media (max-width: 820px) {
      .em-summary-toolbar { min-height: 0; flex-wrap: wrap; gap: 10px 14px; }
      .em-summary-heading { flex: 1 1 180px; }
      .em-summary-mode-tabs { margin-left: 0; }
      .em-summary-date-control { margin-left: auto; }
      .em-summary-stage { padding: 14px 10px; }
      .em-periodic-review { grid-template-columns: 1fr; grid-template-rows: auto minmax(0,1fr); }
      .em-periodic-rail { padding: 12px 16px; border-right: 0; border-bottom: 1px solid rgba(103,80,164,.12); }
      .em-periodic-rail-heading { display: none; }
      .em-periodic-steps { flex-direction: row; gap: 6px; margin: 0; padding: 0; overflow-x: auto; }
      .em-periodic-step { flex: 0 0 auto; min-height: 44px; grid-template-columns: 24px auto; padding: 6px 9px; }
      .em-periodic-stage { padding: 20px; }
      .em-periodic-attention-layout { grid-template-columns: minmax(180px,.7fr) minmax(260px,1.3fr); gap: 22px; }
    }
    @media (max-width: 560px) {
      .em-summary-toolbar { align-items: flex-start; padding: 12px 14px; }
      .em-summary-heading { width: 100%; }
      .em-summary-mode-tabs { margin-left: 0; }
      .em-summary-date-control { flex: 1 1 100%; width: 100%; margin-left: 0; }
      .em-summary-period-trigger { width: 100%; min-width: 0; }
      .em-date-popover { width: min(360px,calc(100vw - 28px)); }
      .em-summary-stage { padding: 8px; }
      .em-periodic-review { border-radius: 16px; }
      .em-periodic-stage { gap: 10px; padding: 17px 15px; }
      .em-periodic-step-label { display: none; }
      .em-periodic-step { grid-template-columns: 1fr; min-width: 44px; min-height: 44px; text-align: center; }
      .em-periodic-card-title { font-size: 24px; }
      .em-periodic-hero-title { font-size: 28px; }
      .em-periodic-subtitle { font-size: 14px; }
      .em-periodic-attention-layout { grid-template-columns: 1fr; }
      .em-periodic-donut { width: 180px; }
      .em-periodic-memory-grid { grid-template-columns: 1fr; }
      .em-periodic-action-item { grid-template-columns: 32px minmax(0,1fr); }
      .em-periodic-status { grid-column: 2; width: fit-content; }
      .em-periodic-agent-line { grid-template-columns: 34px minmax(0,1fr); }
      .em-periodic-agent-avatar { width: 34px; height: 34px; }
    }
  `;
  container.prepend(style);
}
