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
    .em-kicker { color: var(--em-cyan); font: 600 10px/1.3 "JetBrains Mono",monospace; letter-spacing: .14em; text-transform: uppercase; }
    .em-episode-view { position: absolute; inset: 0; overflow: hidden; color: var(--em-text); }
    .em-episode-timeline-shell { height: 100%; display: grid; grid-template-columns: minmax(0,1fr) minmax(330px,29%); background: rgba(255,255,255,.28); transition: grid-template-columns .28s cubic-bezier(.2,.7,.2,1); }
    .em-episode-timeline-shell.is-detail-closed { grid-template-columns: minmax(0,1fr) 0; }
    .em-timeline-main { min-width: 0; overflow: auto; background: linear-gradient(150deg,rgba(255,255,255,.72),rgba(254,247,255,.82)); }
    .em-timeline-toolbar { position: sticky; z-index: 8; top: 0; display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; padding: 24px 28px 19px; border-bottom: 1px solid var(--em-line); background: rgba(255,255,255,.94); backdrop-filter: blur(12px); }
    .em-timeline-title-line { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; margin-top: 6px; }
    .em-timeline-title-line h1 { margin: 0; color: var(--em-text); font-size: clamp(21px,2.1vw,29px); font-weight: 570; letter-spacing: -.03em; }
    .em-timeline-toolbar p { margin: 7px 0 0; color: var(--em-text-3); font-size: 11px; }
    .em-timeline-legend { display: flex; align-items: center; justify-content: flex-end; flex-wrap: wrap; gap: 12px; color: var(--em-text-3); font-size: 10px; }
    .em-legend-item { display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; }
    .em-legend-item i { display: inline-grid; place-items: center; width: 9px; height: 9px; border-radius: 50%; background: var(--em-blue); }
    .em-legend-item .em-legend-cluster { width: 14px; height: 14px; border: 2px solid #fff; box-shadow: 0 0 0 1px rgba(103,80,164,.34); background: var(--em-purple); }
    .em-legend-item .em-legend-decision { border-radius: 2px; background: var(--em-amber); transform: rotate(45deg); }
    .em-timeline-chart { min-width: 630px; padding: 10px 28px 20px; }
    .em-timeline-axis, .em-timeline-row { display: grid; grid-template-columns: minmax(160px,210px) minmax(300px,1fr) 52px; gap: 14px; align-items: center; }
    .em-timeline-axis { min-height: 42px; color: var(--em-text-3); font: 600 9px/1.2 "JetBrains Mono",monospace; }
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
    .em-row-title { width: 100%; overflow: hidden; font-size: 13px; font-weight: 650; line-height: 1.42; text-overflow: ellipsis; white-space: nowrap; }
    .em-row-meta { color: var(--em-text-3); font-size: 10px; }
    .em-timeline-track { height: 42px; }
    .em-timeline-track::before { content: ''; position: absolute; left: 0; right: 0; top: 50%; height: 1px; background: rgba(73,50,115,.13); transform: translateY(-50%); }
    .em-timeline-gridline { position: absolute; top: -26px; bottom: -26px; width: 1px; background: rgba(73,50,115,.07); pointer-events: none; }
    .em-episode-span { position: absolute; z-index: 1; top: 50%; min-width: 18px; height: 18px; border: 1px solid rgba(103,80,164,.4); border-radius: 999px; background: linear-gradient(90deg,rgba(103,80,164,.2),rgba(103,80,164,.32)); cursor: pointer; transform: translateY(-50%); transition: box-shadow .16s ease,background .16s ease,transform .16s ease; }
    .em-episode-span.is-beginning { border-color: rgba(82,120,197,.42); background: linear-gradient(90deg,rgba(82,120,197,.16),rgba(82,120,197,.3)); }
    .em-episode-span.is-end { border-color: rgba(173,85,126,.4); background: linear-gradient(90deg,rgba(173,85,126,.15),rgba(173,85,126,.28)); }
    .em-episode-span.is-ongoing { border-color: rgba(59,143,108,.42); background: linear-gradient(90deg,rgba(59,143,108,.15),rgba(59,143,108,.3)); }
    .em-timeline-row.is-selected .em-episode-span { box-shadow: 0 0 0 3px rgba(103,80,164,.1),0 7px 18px rgba(73,50,115,.13); transform: translateY(-50%) scaleY(1.08); }
    .em-timeline-event-mark { position: absolute; z-index: 3; top: 50%; width: 13px; height: 13px; padding: 0; border: 2px solid #fff; border-radius: 50%; color: #fff; background: var(--em-blue); font: 650 8px/1 "JetBrains Mono",monospace; cursor: pointer; box-shadow: 0 0 0 1px rgba(82,120,197,.42),0 4px 10px rgba(36,48,74,.15); transform: translate(-50%,-50%); transition: transform .15s ease,box-shadow .15s ease; }
    .em-timeline-event-mark:hover, .em-timeline-event-mark:focus-visible { transform: translate(-50%,-50%) scale(1.18); box-shadow: 0 0 0 3px rgba(82,120,197,.15),0 5px 12px rgba(36,48,74,.18); }
    .em-timeline-event-mark.is-cluster { width: 21px; height: 21px; background: var(--em-purple); box-shadow: 0 0 0 1px rgba(103,80,164,.42),0 4px 10px rgba(73,50,115,.18); }
    .em-timeline-event-mark.has-decision { border-radius: 5px; background: var(--em-amber); }
    .em-timeline-row-tail { display: flex; flex-direction: column; align-items: center; gap: 3px; color: var(--em-text-3); font-size: 9px; }
    .em-timeline-row-tail strong { color: var(--em-text-2); font: 650 13px/1 "JetBrains Mono",monospace; }
    .em-timeline-footnote { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 8px 22px; padding: 0 28px 26px; color: var(--em-text-3); font-size: 9px; }
    .em-episode-detail-panel { min-width: 0; overflow: auto; padding: 23px 24px 28px; border-left: 1px solid rgba(73,50,115,.13); color: var(--em-text); background: rgba(255,255,255,.93); box-shadow: -18px 0 52px rgba(67,45,86,.08); backdrop-filter: blur(24px); transform: translateX(0); transition: opacity .22s ease,transform .28s cubic-bezier(.2,.7,.2,1); }
    .em-episode-timeline-shell.is-detail-closed .em-episode-detail-panel { overflow: hidden; padding-left: 0; padding-right: 0; border-left: 0; opacity: 0; transform: translateX(32px); pointer-events: none; }
    .em-detail-panel-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; }
    .em-detail-overline { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; color: var(--em-text-3); font-size: 10px; }
    .em-status-pill { color: #3b6f5a; border-color: rgba(59,143,108,.22); background: rgba(59,143,108,.07); }
    .em-detail-close { flex: 0 0 auto; width: 31px; height: 31px; border: 1px solid var(--em-line); border-radius: 9px; color: var(--em-text-3); background: rgba(255,255,255,.64); font-size: 19px; line-height: 1; cursor: pointer; }
    .em-detail-close:hover { color: #493273; border-color: rgba(103,80,164,.28); background: rgba(103,80,164,.06); }
    .em-episode-detail-panel > h2 { margin: 17px 0 0; color: var(--em-text); font-size: clamp(20px,2vw,27px); font-weight: 570; line-height: 1.4; letter-spacing: -.025em; }
    .em-detail-stage-line { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
    .em-detail-datum { display: inline-flex; align-items: center; gap: 6px; color: var(--em-text-3); font-size: 10px; }
    .em-detail-datum strong { color: var(--em-text-2); font-weight: 650; }
    .em-detail-section { margin-top: 23px; }
    .em-detail-section-title { margin: 0 0 9px; color: var(--em-text-3); font: 650 9px/1.3 "JetBrains Mono",monospace; letter-spacing: .1em; text-transform: uppercase; }
    .em-detail-summary { margin: 0; color: var(--em-text-2); font-size: 13px; line-height: 1.75; }
    .em-detail-stats { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 1px; margin: 21px 0 0; overflow: hidden; border: 1px solid var(--em-line); border-radius: 11px; background: var(--em-line); }
    .em-detail-stats > * { min-width: 0; display: flex; flex-direction: column; margin: 0; padding: 11px 12px; background: rgba(255,255,255,.94); }
    .em-detail-stat-value { order: -1; margin: 0; color: var(--em-text); font: 650 14px/1.2 "JetBrains Mono",monospace; }
    .em-detail-stats dt { color: var(--em-text-3); font-size: 9px; }
    .em-card-tags { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
    .em-detail-section .em-card-tags { margin-top: 0; }
    .em-detail-events-section { padding-top: 21px; border-top: 1px solid var(--em-line); }
    .em-detail-event-chain { position: relative; display: flex; flex-direction: column; gap: 0; margin: 0; padding: 1px 0 0; list-style: none; }
    .em-detail-event-chain::before { content: ''; position: absolute; left: 6px; top: 14px; bottom: 14px; width: 1px; background: linear-gradient(rgba(103,80,164,.32),rgba(103,80,164,.08)); }
    .em-detail-event { position: relative; display: grid; grid-template-columns: 20px minmax(0,1fr); gap: 10px; padding: 0 0 17px; transition: background .16s ease; }
    .em-detail-event:last-child { padding-bottom: 0; }
    .em-detail-event.is-selected { margin: -7px -8px 10px; padding: 7px 8px 10px; border-radius: 9px; background: rgba(103,80,164,.06); }
    .em-detail-event-node { position: relative; z-index: 1; width: 13px; height: 13px; margin-top: 3px; border: 3px solid #fff; border-radius: 50%; background: var(--event-color,var(--em-blue)); box-shadow: 0 0 0 1px var(--event-color,var(--em-blue)); }
    .em-detail-event-node.is-decision { border-radius: 3px; transform: rotate(45deg) scale(.9); }
    .em-detail-event-node.is-state_change { clip-path: polygon(50% 0,100% 100%,0 100%); border-radius: 0; }
    .em-detail-event-meta { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 7px; color: var(--em-text-3); font-size: 9px; }
    .em-detail-event-type { color: var(--event-color,var(--em-blue)); font-weight: 650; }
    .em-detail-event-copy { margin: 5px 0 0; color: var(--em-text-2); font-size: 12px; line-height: 1.6; }
    .em-detail-memory-meta { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; margin-top: 22px; padding-top: 14px; border-top: 1px solid var(--em-line); color: var(--em-text-3); font-size: 9px; }
    .em-source-note { margin: 16px 0 0; color: var(--em-text-3); font-size: 13px; line-height: 1.7; }
    @media (prefers-reduced-motion: reduce) {
      .em-episode-timeline-shell, .em-episode-detail-panel, .em-episode-span, .em-timeline-event-mark { transition: none !important; }
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
      .em-episode-timeline-shell.is-detail-closed .em-episode-detail-panel { overflow: auto; padding: 23px 24px 28px; opacity: 0; transform: translateY(105%); }
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
      .em-episode-detail-panel, .em-episode-timeline-shell.is-detail-closed .em-episode-detail-panel { padding: 20px 18px 24px; }
    }
  `;
  container.appendChild(style);
}
