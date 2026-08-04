// Shared visual language for the Cognitive Feedback shell.

const STYLE_ID = 'echomem-feedback-theme';

export function injectFeedbackTheme(container) {
  if (!container || container.querySelector(`#${STYLE_ID}`)) return;

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .echomem-feedback-shell,
    .echomem-feedback-shell * { box-sizing: border-box; }
    .echomem-feedback-shell {
      --em-bg: #05070a; --em-panel: rgba(2,8,20,.92); --em-panel-strong: #07101c;
      --em-line: rgba(0,230,255,.12); --em-line-strong: rgba(0,230,255,.42);
      --em-text: #e7fbff; --em-text-2: #b5d5df; --em-text-3: #7593a1;
      --em-cyan: #00e6ff; --em-blue: #4f8cff; --em-green: #4cd6a1;
      --em-amber: #f2b84b; --em-pink: #e16fa4; --em-purple: #a269ff;
      color: var(--em-text); background: var(--em-bg);
      font-family: Roboto, "Noto Sans SC", sans-serif; color-scheme: dark;
    }
    .em-topbar {
      --em-line: rgba(121,116,126,.24); --em-text: #1d1b20;
      --em-text-2: #49454f; --em-text-3: #79747e; --em-cyan: #6750a4;
      min-height: 64px; display: flex; align-items: center; gap: 24px; padding: 10px 18px;
      border-bottom: 1px solid var(--em-line); color: var(--em-text);
      background: rgba(255,255,255,.96); backdrop-filter: blur(12px); flex: 0 0 auto;
      color-scheme: light;
    }
    .echomem-feedback-shell button,
    .echomem-feedback-shell input { font: inherit; }
    .echomem-feedback-shell button:focus-visible,
    .echomem-feedback-shell input:focus-visible { outline: 2px solid #6750a4; outline-offset: 2px; }
    .em-brand { min-width: 206px; }
    .em-brand-eyebrow { font-size: 10px; font-weight: 500; letter-spacing: .12em; color: #6750a4; text-transform: uppercase; }
    .em-brand-title { margin-top: 4px; font-size: 14px; font-weight: 500; color: #21005d; }
    .em-tabs { display: flex; align-items: center; gap: 5px; margin-left: auto; }
    .em-tab {
      display: inline-flex; align-items: center; gap: 8px; min-height: 36px; padding: 7px 13px;
      color: #79747e; background: transparent; border: 1px solid transparent;
      border-radius: 12px; cursor: pointer; transition: color .2s ease, background .2s ease, border-color .2s ease;
    }
    .em-tab:hover { color: #21005d; background: rgba(103,80,164,.08); }
    .em-tab[aria-selected="true"] { color: #21005d; background: #eaddff; border-color: rgba(103,80,164,.18); }
    .em-tab-mark { width: 7px; height: 7px; border-radius: 50%; background: currentColor; opacity: .75; }
    .em-tab[aria-selected="true"] .em-tab-mark { background: #6750a4; box-shadow: 0 0 12px rgba(103,80,164,.42); }
    .em-view-stage { flex: 1 1 auto; min-height: 0; position: relative; }
    .em-view-stage[data-em-view="relation"] {
      color: var(--em-text); background: #05070a; color-scheme: dark; isolation: isolate;
    }
    .em-empty, .em-error, .em-loading {
      height: 100%; display: flex; align-items: center; justify-content: center;
      flex-direction: column; gap: 10px; padding: 28px; text-align: center;
    }
    .em-state-orb { width: 44px; height: 44px; border: 2px solid rgba(103,80,164,.18); border-radius: 50%; background: #fef7ff; }
    .em-loading .em-state-orb { border-top-color: var(--em-cyan); animation: em-spin .9s linear infinite; }
    .em-state-title { margin: 2px 0 0; font-size: 14px; color: var(--em-text); }
    .em-state-copy { margin: 0; max-width: 390px; color: var(--em-text-3); font-size: 12px; line-height: 1.65; }
    .em-primary-btn { margin-top: 5px; min-height: 38px; padding: 8px 20px; border: 0; border-radius: 20px; background: linear-gradient(135deg,#6750a4,#21005d); color: #fff; cursor: pointer; }
    @keyframes em-spin { to { transform: rotate(360deg); } }
    @media (prefers-reduced-motion: reduce) { .em-loading .em-state-orb { animation: none !important; } }
    @media (max-width: 820px) {
      .em-topbar { align-items: flex-start; flex-direction: column; gap: 8px; }
      .em-brand { min-width: 0; }
      .em-tabs { width: 100%; margin-left: 0; overflow-x: auto; }
      .em-tab { white-space: nowrap; }
    }
  `;
  container.appendChild(style);
}
