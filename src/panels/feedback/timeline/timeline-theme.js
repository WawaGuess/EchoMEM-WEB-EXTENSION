// Episode-only visual language. The shared shell remains in feedback-theme.js.

const STYLE_ID = 'echomem-episode-theme';

export function injectTimelineTheme(container) {
  if (!container || container.querySelector(`#${STYLE_ID}`)) return;

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .em-view-stage[data-em-view="timeline"] {
      --em-bg: #fffbfe; --em-panel: rgba(255,255,255,.96); --em-panel-strong: #ffffff;
      --em-line: rgba(121,116,126,.24); --em-line-strong: rgba(103,80,164,.42);
      --em-text: #1d1b20; --em-text-2: #49454f; --em-text-3: #79747e;
      --em-cyan: #6750a4; --em-blue: #5278c5; --em-green: #3b8f6c;
      --em-amber: #b87a24; --em-pink: #ad557e; --em-purple: #6750a4;
      color: var(--em-text); color-scheme: light;
      background:
        radial-gradient(circle at 8% -12%, rgba(234,221,255,.56), transparent 32%),
        linear-gradient(145deg, #fffbfe 0%, #fef7ff 55%, #f6f1fa 100%);
    }
    .em-pill { display: inline-flex; align-items: center; gap: 6px; min-height: 24px; padding: 3px 9px; border: 1px solid var(--em-line); border-radius: 999px; color: var(--em-text-2); background: rgba(255,255,255,.72); font-size: 11px; }
    .em-kicker { color: var(--em-cyan); font: 600 10px/1.3 var(--em-font-sans); letter-spacing: .08em; }
    .em-episode-view { position: absolute; inset: 0; overflow: hidden; color: var(--em-text); }
    .em-view-stage[data-em-view="timeline"] .em-pill { min-height: 26px; font-size: 12px; }
    .em-view-stage[data-em-view="timeline"] .em-kicker { font-size: 12px; }
    .em-episode-timeline-shell { height: 100%; display: grid; grid-template-columns: minmax(0,1fr) minmax(330px,29%); background: rgba(255,255,255,.28); transition: grid-template-columns .28s cubic-bezier(.2,.7,.2,1); }
    .em-episode-timeline-shell.is-detail-closed { grid-template-columns: minmax(0,1fr) 0; }
    .em-timeline-main { min-width: 0; overflow: auto; background: linear-gradient(150deg,rgba(255,255,255,.72),rgba(254,247,255,.82)); }
    .em-timeline-toolbar { position: sticky; z-index: 8; top: 0; display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; padding: 24px 28px 19px; border-bottom: 1px solid var(--em-line); background: rgba(255,255,255,.94); backdrop-filter: blur(12px); }
    .em-timeline-title-line { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; margin-top: 6px; }
    .em-timeline-title-line h1 { margin: 0; color: var(--em-text); font-size: clamp(21px,2.1vw,29px); font-weight: 570; letter-spacing: -.03em; }
    .em-timeline-toolbar p { margin: 7px 0 0; color: var(--em-text-3); font-size: 13px; line-height: 1.55; }
    .em-timeline-legend { display: flex; align-items: center; justify-content: flex-end; flex-wrap: wrap; gap: 12px; color: var(--em-text-3); font-size: 12px; }
    .em-legend-item { display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; }
    .em-legend-item i { position: relative; display: inline-grid; place-items: center; width: 9px; height: 9px; border-radius: 50%; color: #fff; background: var(--em-blue); font: 700 8px/1 var(--em-font-sans); }
    .em-legend-item .em-legend-single-day { width: 24px; height: 10px; border: 1px solid rgba(103,80,164,.42); border-radius: 999px; background: rgba(103,80,164,.2); }
    .em-legend-item .em-legend-cluster { width: 14px; height: 14px; border: 2px solid #fff; box-shadow: 0 0 0 1px rgba(103,80,164,.34); background: var(--em-purple); }
    .em-legend-item .em-legend-decision { width: 9px; height: 9px; border-radius: 2px; background: var(--em-amber); box-shadow: 0 0 0 1px rgba(184,122,36,.18); transform: rotate(45deg); }
    .em-timeline-chart { min-width: 630px; padding: 10px 28px 20px; }
    .em-timeline-axis, .em-timeline-row { display: grid; grid-template-columns: minmax(160px,210px) minmax(300px,1fr) 52px; gap: 14px; align-items: center; }
    .em-timeline-axis { min-height: 42px; color: var(--em-text-3); font: 600 12px/1.2 var(--em-font-sans); font-variant-numeric: tabular-nums; }
    .em-axis-track, .em-timeline-track { position: relative; min-width: 0; }
    .em-axis-track { height: 100%; }
    .em-axis-tick { position: absolute; top: 50%; white-space: nowrap; transform: translate(-50%,-50%); }
    .em-axis-tick:first-child { transform: translate(0,-50%); }
    .em-axis-tick:last-child { transform: translate(-100%,-50%); }
    .em-axis-tail { text-align: center; }
    .em-timeline-row { position: relative; min-height: 94px; border-top: 1px solid rgba(73,50,115,.085); transition: background .16s ease; }
    .em-timeline-row:last-child { border-bottom: 1px solid rgba(73,50,115,.085); }
    .em-timeline-row:hover { background: rgba(103,80,164,.035); }
    .em-timeline-row.is-selected { background: linear-gradient(90deg,rgba(103,80,164,.075),rgba(103,80,164,.018)); }
    .em-timeline-row-label { min-width: 0; display: flex; flex-direction: column; align-items: flex-start; gap: 7px; padding: 13px 8px 13px 0; border: 0; color: var(--em-text); background: transparent; text-align: left; cursor: pointer; }
    .em-row-title { width: 100%; overflow: hidden; font-size: 15px; font-weight: 650; line-height: 1.42; text-overflow: ellipsis; white-space: nowrap; }
    .em-row-meta { color: var(--em-text-3); font-size: 12px; }
    .em-timeline-track { height: 42px; }
    .em-timeline-track::before { content: ''; position: absolute; left: 0; right: 0; top: 50%; height: 1px; background: rgba(73,50,115,.13); transform: translateY(-50%); }
    .em-timeline-gridline { position: absolute; top: -26px; bottom: -26px; width: 1px; background: rgba(73,50,115,.07); pointer-events: none; }
    .em-episode-span { position: absolute; z-index: 1; top: 50%; min-width: 0; height: 20px; padding: 0; border: 1px solid rgba(103,80,164,.4); border-radius: 999px; background: linear-gradient(90deg,rgba(103,80,164,.2),rgba(103,80,164,.32)); cursor: pointer; transform: translate(var(--em-span-shift,0%),-50%); transform-origin: center; transition: box-shadow .16s ease,background .16s ease; }
    .em-episode-span.is-point { width: 44px; box-shadow: inset 0 0 0 1px rgba(255,255,255,.38),0 3px 9px rgba(73,50,115,.1); }
    .em-episode-span.is-beginning { border-color: rgba(82,120,197,.42); background: linear-gradient(90deg,rgba(82,120,197,.16),rgba(82,120,197,.3)); }
    .em-episode-span.is-end { border-color: rgba(173,85,126,.4); background: linear-gradient(90deg,rgba(173,85,126,.15),rgba(173,85,126,.28)); }
    .em-episode-span.is-ongoing { border-color: rgba(59,143,108,.42); background: linear-gradient(90deg,rgba(59,143,108,.15),rgba(59,143,108,.3)); }
    .em-timeline-row.is-selected .em-episode-span { border-color: rgba(103,80,164,.72); background: linear-gradient(90deg,rgba(103,80,164,.26),rgba(103,80,164,.38)); box-shadow: inset 0 0 0 1px rgba(103,80,164,.16); transform: translate(var(--em-span-shift,0%),-50%); }
    .em-timeline-event-mark { --em-event-mark-color: var(--em-blue); position: absolute; z-index: 3; top: 50%; display: grid; place-items: center; width: 12px; height: 12px; margin: 0; padding: 0; appearance: none; border: 2px solid #fff; border-radius: 50%; color: #fff; background: var(--em-event-mark-color); font-family: var(--em-font-sans); font-variant-numeric: tabular-nums; line-height: 1; cursor: pointer; box-shadow: 0 0 0 1px rgba(82,120,197,.42),0 2px 5px rgba(36,48,74,.14); transform: translate(-50%,-50%); transition: background .16s ease,box-shadow .16s ease; }
    .em-timeline-event-mark.is-cluster { --em-event-mark-color: var(--em-purple); width: 16px; height: 16px; box-shadow: 0 0 0 1px rgba(103,80,164,.42),0 2px 5px rgba(73,50,115,.14); }
    .em-timeline-event-mark.is-cluster.contains-decision { border-color: var(--em-amber); box-shadow: 0 0 0 1px rgba(184,122,36,.42),0 2px 5px rgba(73,50,115,.14); }
    .em-timeline-event-count { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; margin: 0; padding: 0; color: #fff; font-family: var(--em-font-sans); font-size: 10px; font-weight: 700; font-variant-numeric: tabular-nums; font-feature-settings: "tnum" 1; line-height: 1; text-align: center; transform: none; pointer-events: none; }
    .em-timeline-event-mark.is-decision { --em-event-mark-color: var(--em-amber); border-radius: 2px; transform: translate(-50%,-50%) rotate(45deg); }
    .em-timeline-event-mark:hover, .em-timeline-event-mark:focus-visible { background: linear-gradient(rgba(255,255,255,.16),rgba(255,255,255,.16)),var(--em-event-mark-color); box-shadow: 0 0 0 2px rgba(103,80,164,.2),0 4px 9px rgba(73,50,115,.2); transform: translate(-50%,-50%); }
    .em-timeline-event-mark.is-decision:hover, .em-timeline-event-mark.is-decision:focus-visible { transform: translate(-50%,-50%) rotate(45deg); }
    .em-timeline-row-tail { display: flex; flex-direction: column; align-items: center; gap: 4px; color: var(--em-text-3); font-size: 11px; }
    .em-timeline-row-tail strong { color: var(--em-text-2); font: 650 15px/1 var(--em-font-sans); font-variant-numeric: tabular-nums; }
    .em-timeline-footnote { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 8px 22px; padding: 0 28px 26px; color: var(--em-text-3); font-size: 11px; line-height: 1.5; }
    .em-episode-detail-panel { min-width: 0; overflow: hidden; padding: 0; border-left: 1px solid rgba(73,50,115,.13); color: var(--em-text); background: rgba(255,255,255,.96); box-shadow: -18px 0 52px rgba(67,45,86,.08); transform: translateX(0); transition: opacity .22s ease,transform .28s cubic-bezier(.2,.7,.2,1); }
    .em-episode-timeline-shell.is-detail-closed .em-episode-detail-panel { border-left: 0; opacity: 0; transform: translateX(32px); pointer-events: none; }
    .em-detail-page { height: 100%; overflow-y: auto; padding: 23px 24px 28px; scrollbar-gutter: stable; }
    .em-detail-page.is-forward { animation: em-detail-forward .2s ease-out; }
    .em-detail-page.is-back { animation: em-detail-back .2s ease-out; }
    .em-detail-panel-top { position: sticky; z-index: 5; top: -23px; display: flex; align-items: center; justify-content: space-between; gap: 14px; min-height: 54px; margin: -23px -24px 0; padding: 13px 24px 9px; background: linear-gradient(180deg,#fff 72%,rgba(255,255,255,.9)); }
    .em-detail-overline { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; color: var(--em-text-3); font-size: 12px; }
    .em-status-pill { color: #3b6f5a; border-color: rgba(59,143,108,.22); background: rgba(59,143,108,.07); }
    .em-detail-close { flex: 0 0 auto; width: 36px; height: 36px; border: 1px solid var(--em-line); border-radius: 10px; color: var(--em-text-3); background: rgba(255,255,255,.82); font-size: 19px; line-height: 1; cursor: pointer; }
    .em-detail-close:hover { color: #493273; border-color: rgba(103,80,164,.28); background: rgba(103,80,164,.06); }
    .em-detail-back { min-height: 36px; display: inline-flex; align-items: center; gap: 7px; padding: 7px 8px 7px 4px; border: 0; border-radius: 9px; color: #493273; background: transparent; font: 600 13px/1 var(--em-font-sans); cursor: pointer; }
    .em-detail-back:hover, .em-detail-back:focus-visible { background: rgba(103,80,164,.07); }
    .em-detail-back-arrow { font-size: 22px; font-weight: 400; line-height: .7; }
    .em-detail-page-title { margin: 16px 0 0; color: var(--em-text); font-size: clamp(20px,2vw,27px); font-weight: 570; line-height: 1.4; letter-spacing: -.025em; }
    .em-detail-page-title:focus { outline: none; }
    .em-detail-page-kicker { margin-top: 14px; color: var(--em-text-3); font-size: 12px; font-weight: 600; letter-spacing: .04em; }
    .em-detail-page-intro { margin: 10px 0 0; color: var(--em-text-3); font-size: 14px; line-height: 1.65; }
    .em-detail-context-title { margin: 7px 0 0; color: var(--em-text-3); font-size: 13px; line-height: 1.55; }
    .em-detail-section { margin-top: 22px; }
    .em-detail-section-title { margin: 0 0 9px; color: var(--em-text-3); font: 650 12px/1.3 var(--em-font-sans); letter-spacing: .05em; }
    .em-detail-summary-card { padding: 15px 16px 16px; border: 1px solid rgba(103,80,164,.12); border-radius: 13px; background: linear-gradient(145deg,rgba(103,80,164,.055),rgba(255,255,255,.8)); }
    .em-detail-summary { margin: 0; color: var(--em-text-2); font-size: 15px; line-height: 1.7; }
    .em-card-tags { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
    .em-detail-section .em-card-tags { margin-top: 0; }
    .em-detail-routes { display: flex; flex-direction: column; gap: 10px; margin-top: 23px; }
    .em-detail-route { display: grid; grid-template-columns: minmax(0,1fr) auto 14px; align-items: center; gap: 10px; width: 100%; min-height: 76px; padding: 13px 14px; border: 1px solid rgba(103,80,164,.14); border-radius: 13px; color: var(--em-text); background: rgba(255,255,255,.82); cursor: pointer; text-align: left; transition: border-color .16s ease,background .16s ease,box-shadow .16s ease; }
    .em-detail-route:hover, .em-detail-route:focus-visible { border-color: rgba(103,80,164,.34); background: rgba(103,80,164,.055); box-shadow: 0 5px 16px rgba(73,50,115,.08); }
    .em-detail-route-body { min-width: 0; display: flex; flex-direction: column; gap: 5px; }
    .em-detail-route-body strong { font-size: 15px; font-weight: 650; }
    .em-detail-route-copy { color: var(--em-text-3); font-size: 12px; line-height: 1.5; }
    .em-detail-route-meta { color: #6750a4; font-size: 12px; white-space: nowrap; }
    .em-detail-route-arrow, .em-detail-event-arrow { color: #8069ae; font-size: 20px; line-height: 1; transition: transform .16s ease; }
    .em-detail-route:hover .em-detail-route-arrow, .em-detail-route:focus-visible .em-detail-route-arrow { transform: translateX(2px); }
    .em-detail-date-groups { display: flex; flex-direction: column; gap: 10px; margin-top: 22px; }
    .em-detail-date-group { overflow: hidden; border: 1px solid rgba(103,80,164,.12); border-radius: 13px; background: rgba(255,255,255,.76); }
    .em-detail-date-group.is-selected { border-color: rgba(103,80,164,.36); box-shadow: 0 0 0 2px rgba(103,80,164,.06); }
    .em-detail-date-toggle { display: grid; grid-template-columns: minmax(0,1fr) auto 14px; align-items: center; gap: 9px; width: 100%; min-height: 48px; padding: 11px 13px; border: 0; color: var(--em-text); background: transparent; cursor: pointer; text-align: left; }
    .em-detail-date-toggle:hover, .em-detail-date-toggle:focus-visible { background: rgba(103,80,164,.055); }
    .em-detail-date-label { font-size: 14px; font-weight: 650; }
    .em-detail-date-count { color: var(--em-text-3); font-size: 12px; white-space: nowrap; }
    .em-detail-date-group.is-expanded .em-detail-route-arrow { transform: rotate(90deg); }
    .em-detail-event-chain { position: relative; display: flex; flex-direction: column; gap: 0; margin: 0; padding: 3px 10px 10px; border-top: 1px solid rgba(103,80,164,.09); list-style: none; }
    .em-detail-event-chain::before { content: ''; position: absolute; left: 22px; top: 20px; bottom: 24px; width: 1px; background: linear-gradient(rgba(103,80,164,.32),rgba(103,80,164,.08)); }
    .em-detail-event { position: relative; margin: 0; padding: 0; }
    .em-detail-event-button { position: relative; z-index: 1; display: grid; grid-template-columns: 20px minmax(0,1fr) 12px; gap: 9px; align-items: start; width: 100%; min-height: 52px; padding: 10px 6px; border: 0; border-radius: 9px; color: inherit; background: transparent; cursor: pointer; text-align: left; }
    .em-detail-event-button:hover, .em-detail-event-button:focus-visible { background: rgba(103,80,164,.055); }
    .em-detail-event-node { position: relative; z-index: 1; width: 13px; height: 13px; margin: 3px 0 0 1px; border: 3px solid #fff; border-radius: 50%; background: var(--event-color,var(--em-blue)); box-shadow: 0 0 0 1px var(--event-color,var(--em-blue)); }
    .em-detail-event-node.is-decision { border-radius: 3px; transform: rotate(45deg) scale(.9); }
    .em-detail-event-node.is-state_change { clip-path: polygon(50% 0,100% 100%,0 100%); border-radius: 0; }
    .em-detail-event-meta { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 7px; color: var(--em-text-3); font-size: 11px; }
    .em-detail-event-type { color: var(--event-color,var(--em-blue)); font-weight: 650; }
    .em-detail-event-copy { margin: 5px 0 0; color: var(--em-text-2); font-size: 14px; line-height: 1.6; }
    .em-detail-event-arrow { align-self: center; }
    .em-detail-event-context { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 15px; color: var(--em-text-3); font-size: 12px; }
    .em-detail-info-card { display: flex; flex-direction: column; gap: 5px; margin-top: 18px; padding: 13px 14px; border: 1px solid rgba(103,80,164,.12); border-radius: 12px; background: rgba(103,80,164,.045); }
    .em-detail-info-card strong { color: var(--em-text-2); font-size: 14px; font-weight: 650; line-height: 1.5; }
    .em-detail-info-card span { color: var(--em-text-3); font-size: 12px; line-height: 1.55; overflow-wrap: anywhere; }
    .em-detail-evidence-summary { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 1px; margin: 21px 0 0; overflow: hidden; border: 1px solid var(--em-line); border-radius: 12px; background: var(--em-line); }
    .em-detail-measure { min-width: 0; display: flex; flex-direction: column; gap: 6px; padding: 13px 14px; background: rgba(255,255,255,.96); }
    .em-detail-measure dt { color: var(--em-text-3); font-size: 11px; }
    .em-detail-measure dd { order: -1; margin: 0; color: var(--em-text); font: 650 16px/1.2 var(--em-font-sans); font-variant-numeric: tabular-nums; }
    .em-detail-fact-list { display: flex; flex-direction: column; margin: 0; overflow: hidden; border: 1px solid rgba(103,80,164,.12); border-radius: 12px; background: rgba(255,255,255,.8); }
    .em-detail-page > .em-detail-fact-list { margin-top: 20px; }
    .em-detail-fact { display: flex; align-items: baseline; justify-content: space-between; gap: 16px; min-height: 41px; padding: 10px 12px; border-bottom: 1px solid rgba(103,80,164,.09); }
    .em-detail-fact:last-child { border-bottom: 0; }
    .em-detail-fact dt { color: var(--em-text-3); font-size: 12px; }
    .em-detail-fact dd { margin: 0; color: var(--em-text-2); font-size: 13px; font-weight: 600; text-align: right; overflow-wrap: anywhere; }
    .em-detail-source-list { display: flex; flex-direction: column; gap: 8px; }
    .em-detail-source-list .em-detail-info-card { margin-top: 0; }
    .em-source-note { margin: 16px 0 0; color: var(--em-text-3); font-size: 14px; line-height: 1.7; }
    @keyframes em-detail-forward { from { opacity: .45; transform: translateX(18px); } to { opacity: 1; transform: translateX(0); } }
    @keyframes em-detail-back { from { opacity: .45; transform: translateX(-18px); } to { opacity: 1; transform: translateX(0); } }
    @media (prefers-reduced-motion: reduce) {
      .em-episode-timeline-shell, .em-episode-detail-panel, .em-episode-span, .em-timeline-event-mark { transition: none !important; }
      .em-detail-page { animation: none !important; }
    }
    @media (max-width: 820px) {
      .em-episode-view { overflow: hidden; }
      .em-episode-timeline-shell, .em-episode-timeline-shell.is-detail-closed { position: relative; display: block; }
      .em-timeline-main { height: 100%; }
      .em-episode-detail-panel {
        position: absolute; z-index: 30; left: 0; right: 0; bottom: 0; max-height: 78%;
        border-top: 1px solid rgba(73,50,115,.14); border-left: 0; border-radius: 20px 20px 0 0;
        opacity: 0; transform: translateY(105%); pointer-events: none;
        box-shadow: 0 -20px 60px rgba(67,45,86,.16);
      }
      .em-episode-detail-panel.is-open { opacity: 1; transform: translateY(0); pointer-events: auto; }
      .em-episode-detail-panel[data-detail-page="story"], .em-episode-detail-panel[data-detail-page="evidence"], .em-episode-detail-panel[data-detail-page="event"] { max-height: 92%; }
      .em-episode-timeline-shell.is-detail-closed .em-episode-detail-panel { opacity: 0; transform: translateY(105%); }
    }
    @media (max-width: 560px) {
      .em-timeline-toolbar { position: relative; align-items: flex-start; flex-direction: column; padding: 18px 16px 14px; }
      .em-timeline-legend { justify-content: flex-start; }
      .em-timeline-chart { min-width: 0; padding: 2px 16px 18px; }
      .em-timeline-axis { display: none; }
      .em-timeline-row { grid-template-columns: minmax(0,1fr) auto; gap: 4px 12px; min-height: 116px; padding: 10px 0 14px; }
      .em-timeline-row-label { grid-column: 1; grid-row: 1; padding: 5px 0; }
      .em-timeline-row-tail { grid-column: 2; grid-row: 1; }
      .em-timeline-track { grid-column: 1/-1; grid-row: 2; height: 38px; }
      .em-timeline-gridline { top: -4px; bottom: -4px; }
      .em-timeline-footnote { padding: 0 16px 22px; }
      .em-detail-page { padding: 20px 18px 24px; }
      .em-detail-panel-top { top: -20px; margin: -20px -18px 0; padding: 10px 18px 8px; }
      .em-detail-route { grid-template-columns: minmax(0,1fr) 14px; }
      .em-detail-route-meta { grid-column: 1; grid-row: 2; }
      .em-detail-route-arrow { grid-column: 2; grid-row: 1/3; }
    }
  `;
  container.appendChild(style);
}
