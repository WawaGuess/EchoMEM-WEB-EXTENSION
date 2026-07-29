// 文档：docs/flows/skill-store/上传流程.md
// Skill 管理面板内容 —— 真实数据驱动

import { getEchoMemConfig } from '../../services/config.js';
import { createClient } from '../../services/echomem-client.js';
import { parseSkillMd, getEntryName } from '../../utils/skill-parser.js';
import { openCenterOverlay, closeOverlayPanel } from '../../core/panel-host.js';

const SKILL_ROOT_URI = 'echo://skills';

const SKILL_STORE_STYLES = `
  <style>
    .claw-skill-surface,
    .claw-skill-dialog,
    .claw-skill-preview-overlay {
      --skill-primary: #6750a4;
      --skill-on-primary: #ffffff;
      --skill-primary-container: #eaddff;
      --skill-on-primary-container: #21005d;
      --skill-secondary-container: #e8def8;
      --skill-surface: #fffbfe;
      --skill-surface-soft: #fef7ff;
      --skill-surface-strong: #f3edf7;
      --skill-outline: #79747e;
      --skill-outline-soft: #e7e0ec;
      --skill-text: #1d1b20;
      --skill-text-muted: #49454f;
      --skill-error: #b3261e;
      --skill-error-container: #f9dedc;
      --skill-success: #2e7d32;
      --skill-success-container: #e8f5e9;
      box-sizing: border-box;
      color: var(--skill-text);
      font-family: Roboto, "Noto Sans SC", sans-serif;
    }

    .claw-skill-surface *,
    .claw-skill-dialog *,
    .claw-skill-preview-overlay * {
      box-sizing: border-box;
    }

    .claw-skill-surface {
      width: 100%;
    }

    .claw-skill-home,
    .claw-skill-list,
    .claw-skill-upload {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .claw-skill-intro {
      position: relative;
      overflow: hidden;
      padding: 16px;
      border: 1px solid #d0bcff;
      border-radius: 20px;
      background: linear-gradient(135deg, #fef7ff 0%, #f3edff 58%, #eaddff 100%);
    }

    .claw-skill-intro::after {
      content: "";
      position: absolute;
      top: -34px;
      right: -26px;
      width: 104px;
      height: 104px;
      border: 18px solid rgba(103, 80, 164, 0.08);
      border-radius: 50%;
      pointer-events: none;
    }

    .claw-skill-eyebrow {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 7px;
      color: var(--skill-primary);
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }

    .claw-skill-intro-title {
      position: relative;
      z-index: 1;
      margin: 0;
      color: var(--skill-on-primary-container);
      font-size: 16px;
      font-weight: 600;
      line-height: 1.4;
    }

    .claw-skill-intro-copy {
      position: relative;
      z-index: 1;
      max-width: 270px;
      margin: 4px 0 0;
      color: var(--skill-text-muted);
      font-size: 12px;
      line-height: 1.55;
    }

    .claw-skill-home-list {
      display: flex;
      flex-direction: column;
      gap: 9px;
    }

    button.claw-skill-section {
      width: 100%;
      min-height: 74px;
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 13px 14px;
      border: 1px solid var(--skill-outline-soft);
      border-radius: 18px;
      background: rgba(255, 255, 255, 0.88);
      color: var(--skill-text);
      font: inherit;
      text-align: left;
      cursor: pointer;
      box-shadow: 0 1px 2px rgba(29, 27, 32, 0.04);
      transition: transform 180ms ease, border-color 180ms ease, background 180ms ease, box-shadow 180ms ease;
    }

    button.claw-skill-section:hover {
      transform: translateY(-2px);
      border-color: #d0bcff;
      background: var(--skill-surface-soft);
      box-shadow: 0 8px 20px rgba(33, 0, 93, 0.08);
    }

    button.claw-skill-section:focus-visible,
    .claw-skill-search-input:focus-visible,
    .claw-skill-refresh:focus-visible,
    .claw-skill-action:focus-visible,
    .claw-skill-dialog-button:focus-visible,
    .claw-skill-btn-delete:focus-visible,
    .claw-skill-btn-view-full:focus-visible {
      outline: 3px solid rgba(103, 80, 164, 0.22);
      outline-offset: 2px;
    }

    .claw-skill-section-icon,
    .claw-skill-upload-icon,
    .claw-skill-dialog-icon,
    .claw-skill-state-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex: 0 0 auto;
      color: var(--skill-primary);
      background: var(--skill-primary-container);
    }

    .claw-skill-section-icon {
      width: 44px;
      height: 44px;
      border-radius: 14px;
    }

    .claw-skill-section-copy {
      min-width: 0;
      flex: 1;
    }

    .claw-skill-section-title {
      display: block;
      margin: 0 0 3px;
      color: var(--skill-text);
      font-size: 14px;
      font-weight: 600;
      line-height: 1.35;
    }

    .claw-skill-section-desc {
      display: block;
      margin: 0;
      color: var(--skill-text-muted);
      font-size: 12px;
      line-height: 1.45;
    }

    .claw-skill-chevron {
      flex: 0 0 auto;
      color: var(--skill-outline);
      transition: transform 180ms ease, color 180ms ease;
    }

    button.claw-skill-section:hover .claw-skill-chevron {
      color: var(--skill-primary);
      transform: translateX(2px);
    }

    .claw-skill-page-note {
      margin: 0;
      color: var(--skill-text-muted);
      font-size: 12px;
      line-height: 1.5;
    }

    .claw-skill-toolbar {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .claw-skill-search-shell {
      position: relative;
      min-width: 0;
      flex: 1;
    }

    .claw-skill-search-shell > svg {
      position: absolute;
      top: 50%;
      left: 13px;
      color: var(--skill-text-muted);
      pointer-events: none;
      transform: translateY(-50%);
    }

    .claw-skill-search-input {
      width: 100%;
      height: 42px;
      padding: 0 13px 0 39px;
      border: 1px solid var(--skill-outline-soft);
      border-radius: 14px;
      outline: none;
      background: rgba(255, 255, 255, 0.9);
      color: var(--skill-text);
      font: inherit;
      font-size: 13px;
      transition: border-color 180ms ease, background 180ms ease, box-shadow 180ms ease;
    }

    .claw-skill-search-input::placeholder {
      color: #79747e;
    }

    .claw-skill-search-input:hover {
      border-color: #c4bdc8;
    }

    .claw-skill-search-input:focus {
      border-color: var(--skill-primary);
      background: #ffffff;
      box-shadow: 0 0 0 3px rgba(103, 80, 164, 0.1);
    }

    .claw-skill-refresh,
    .claw-skill-action,
    .claw-skill-dialog-button,
    .claw-skill-btn-view-full,
    .claw-skill-btn-delete {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      border-radius: 999px;
      font-family: inherit;
      font-weight: 600;
      cursor: pointer;
      transition: background 180ms ease, border-color 180ms ease, color 180ms ease, box-shadow 180ms ease, transform 180ms ease;
    }

    .claw-skill-refresh {
      height: 42px;
      flex: 0 0 auto;
      padding: 0 14px;
      border: 1px solid #d0bcff;
      background: var(--skill-surface);
      color: var(--skill-primary);
      font-size: 12px;
    }

    .claw-skill-refresh:hover,
    .claw-skill-btn-view-full:hover {
      background: var(--skill-primary-container);
      border-color: #b69df8;
    }

    .claw-skill-notice {
      align-items: flex-start;
      gap: 9px;
      padding: 11px 12px;
      border: 1px solid #d0bcff;
      border-radius: 14px;
      font-size: 12px;
      font-weight: 500;
      line-height: 1.5;
      box-shadow: 0 4px 12px rgba(29, 27, 32, 0.05);
    }

    .claw-skill-notice > svg {
      flex: 0 0 auto;
      margin-top: 1px;
    }

    .claw-skill-state {
      min-height: 164px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 28px 18px;
      border: 1px solid var(--skill-outline-soft);
      border-radius: 18px;
      background: rgba(255, 255, 255, 0.72);
      text-align: center;
    }

    .claw-skill-state-icon {
      width: 46px;
      height: 46px;
      margin-bottom: 12px;
      border-radius: 15px;
    }

    .claw-skill-state-title {
      margin: 0;
      color: var(--skill-text);
      font-size: 14px;
      font-weight: 600;
      line-height: 1.4;
    }

    .claw-skill-state-copy {
      max-width: 250px;
      margin: 5px 0 0;
      color: var(--skill-text-muted);
      font-size: 12px;
      line-height: 1.5;
    }

    .claw-skill-spinner {
      animation: claw-skill-spin 900ms linear infinite;
    }

    .claw-skill-items {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .claw-skill-item {
      padding: 13px 14px;
      border: 1px solid var(--skill-outline-soft);
      border-radius: 16px;
      background: rgba(255, 255, 255, 0.82);
      cursor: pointer;
      box-shadow: 0 1px 2px rgba(29, 27, 32, 0.035);
      transition: border-color 180ms ease, background 180ms ease, box-shadow 180ms ease;
    }

    .claw-skill-item:hover {
      border-color: #d0bcff;
      background: var(--skill-surface-soft);
      box-shadow: 0 5px 15px rgba(33, 0, 93, 0.06);
    }

    .claw-skill-item-head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 10px;
    }

    .claw-skill-item-copy {
      min-width: 0;
      flex: 1;
    }

    .claw-skill-item-title {
      margin: 0 0 3px;
      color: var(--skill-text);
      font-size: 13px;
      font-weight: 600;
      line-height: 1.4;
      word-break: break-all;
    }

    .claw-skill-item-desc {
      display: -webkit-box;
      overflow: hidden;
      margin: 0 0 6px;
      color: var(--skill-text-muted);
      font-size: 12px;
      line-height: 1.5;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;
    }

    .claw-skill-item-meta {
      display: inline-flex;
      align-items: center;
      min-height: 22px;
      margin: 0;
      padding: 2px 8px;
      border-radius: 999px;
      background: var(--skill-surface-strong);
      color: var(--skill-text-muted);
      font-size: 10px;
      line-height: 1.4;
    }

    .claw-skill-item-actions {
      display: flex;
      align-items: center;
      gap: 7px;
      flex: 0 0 auto;
    }

    .claw-skill-btn-delete {
      min-height: 30px;
      padding: 0 10px;
      border: 1px solid #f2b8b5;
      background: #fff8f7;
      color: var(--skill-error);
      font-size: 11px;
    }

    .claw-skill-btn-delete:hover {
      background: var(--skill-error-container);
      border-color: #e49b97;
    }

    .claw-skill-btn-delete:disabled {
      cursor: wait;
      opacity: 0.65;
    }

    .claw-skill-toggle-icon {
      margin-top: 7px;
      color: var(--skill-outline);
      transition: transform 180ms ease, color 180ms ease;
    }

    .claw-skill-item:hover .claw-skill-toggle-icon {
      color: var(--skill-primary);
    }

    .claw-skill-detail {
      margin-top: 13px;
      padding-top: 13px;
      border-top: 1px solid var(--skill-outline-soft);
    }

    .claw-skill-detail-description,
    .claw-skill-detail-empty,
    .claw-skill-code-preview {
      padding: 10px 11px;
      border-radius: 12px;
      font-size: 12px;
      line-height: 1.6;
    }

    .claw-skill-detail-description {
      margin-bottom: 9px;
      border: 1px solid #d0bcff;
      background: var(--skill-surface-soft);
      color: var(--skill-text-muted);
    }

    .claw-skill-detail-empty {
      margin-bottom: 9px;
      border: 1px solid var(--skill-outline-soft);
      background: var(--skill-surface-strong);
      color: var(--skill-outline);
    }

    .claw-skill-code-preview {
      max-height: 200px;
      overflow-y: auto;
      border: 1px solid var(--skill-outline-soft);
      background: #f7f2fa;
      color: #363139;
      font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
      white-space: pre-wrap;
      word-break: break-word;
    }

    .claw-skill-detail-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin-top: 9px;
    }

    .claw-skill-uri {
      min-width: 0;
      overflow: hidden;
      color: var(--skill-outline);
      font-family: "SFMono-Regular", Consolas, monospace;
      font-size: 10px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .claw-skill-btn-view-full {
      min-height: 32px;
      flex: 0 0 auto;
      padding: 0 11px;
      border: 1px solid #d0bcff;
      background: var(--skill-surface);
      color: var(--skill-primary);
      font-size: 11px;
    }

    .claw-skill-dropzone {
      position: relative;
      overflow: hidden;
      padding: 30px 20px;
      border: 1.5px dashed #a99db3;
      border-radius: 20px;
      background: linear-gradient(145deg, rgba(255, 255, 255, 0.86), rgba(243, 237, 247, 0.94));
      text-align: center;
      cursor: pointer;
      transition: border-color 180ms ease, background 180ms ease, box-shadow 180ms ease, transform 180ms ease;
    }

    .claw-skill-dropzone:hover {
      transform: translateY(-1px);
      border-color: var(--skill-primary);
      background: #f3edf7;
      box-shadow: 0 8px 22px rgba(33, 0, 93, 0.08);
    }

    .claw-skill-upload-icon {
      width: 52px;
      height: 52px;
      margin: 0 auto 12px;
      border-radius: 18px;
      box-shadow: 0 6px 16px rgba(103, 80, 164, 0.12);
    }

    .claw-skill-dropzone-title {
      margin: 0;
      color: var(--skill-text);
      font-size: 14px;
      font-weight: 600;
      line-height: 1.45;
    }

    .claw-skill-dropzone-copy {
      max-width: 290px;
      margin: 5px auto 0;
      color: var(--skill-text-muted);
      font-size: 11px;
      line-height: 1.55;
    }

    .claw-skill-format-row {
      display: flex;
      justify-content: center;
      gap: 6px;
      margin-top: 12px;
    }

    .claw-skill-format-chip {
      padding: 3px 8px;
      border: 1px solid #d0bcff;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.72);
      color: var(--skill-primary);
      font-size: 10px;
      font-weight: 600;
    }

    .claw-skill-guide {
      padding: 14px 15px;
      border: 1px solid var(--skill-outline-soft);
      border-radius: 18px;
      background: rgba(255, 255, 255, 0.76);
    }

    .claw-skill-guide-title {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0 0 9px;
      color: var(--skill-on-primary-container);
      font-size: 13px;
      font-weight: 600;
    }

    .claw-skill-guide-title > span {
      width: 28px;
      height: 28px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 9px;
      background: var(--skill-primary-container);
      color: var(--skill-primary);
    }

    .claw-skill-guide-list {
      margin: 0;
      padding-left: 20px;
      color: var(--skill-text-muted);
      font-size: 11px;
      line-height: 1.75;
    }

    .claw-skill-guide-list li::marker {
      color: var(--skill-primary);
    }

    .claw-skill-guide-list code {
      padding: 2px 5px;
      border: 1px solid var(--skill-outline-soft);
      border-radius: 5px;
      background: var(--skill-surface-strong);
      color: var(--skill-on-primary-container);
      font-family: "SFMono-Regular", Consolas, monospace;
      font-size: 10px;
    }

    .claw-skill-dialog {
      min-height: 172px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 17px;
      padding: 18px 22px 22px;
      text-align: center;
    }

    .claw-skill-dialog-icon {
      width: 48px;
      height: 48px;
      margin: 0 auto 10px;
      border-radius: 16px;
    }

    .claw-skill-dialog-icon.is-danger {
      color: var(--skill-error);
      background: var(--skill-error-container);
    }

    .claw-skill-dialog-title {
      margin: 0;
      color: var(--skill-text);
      font-size: 15px;
      font-weight: 600;
      line-height: 1.4;
    }

    .claw-skill-dialog-copy {
      margin: 5px auto 0;
      color: var(--skill-text-muted);
      font-size: 12px;
      line-height: 1.55;
    }

    .claw-skill-dialog-copy strong {
      color: var(--skill-text);
      font-weight: 600;
    }

    .claw-skill-dialog-actions {
      display: flex;
      justify-content: center;
      gap: 9px;
    }

    .claw-skill-dialog-button {
      min-width: 108px;
      min-height: 38px;
      padding: 0 17px;
      border: 1px solid #d0bcff;
      background: var(--skill-surface);
      color: var(--skill-primary);
      font-size: 12px;
    }

    .claw-skill-dialog-button:hover {
      background: var(--skill-primary-container);
    }

    .claw-skill-dialog-button.is-primary {
      border-color: transparent;
      background: linear-gradient(135deg, #6750a4 0%, #21005d 100%);
      color: var(--skill-on-primary);
      box-shadow: 0 5px 14px rgba(33, 0, 93, 0.2);
    }

    .claw-skill-dialog-button.is-primary:hover {
      background: linear-gradient(135deg, #7b61b5 0%, #3a1860 100%);
      box-shadow: 0 7px 18px rgba(33, 0, 93, 0.24);
    }

    .claw-skill-dialog-button.is-danger {
      border-color: transparent;
      background: var(--skill-error);
      color: #ffffff;
      box-shadow: 0 5px 14px rgba(179, 38, 30, 0.18);
    }

    .claw-skill-dialog-button.is-danger:hover {
      background: #8c1d18;
    }

    .claw-skill-preview-overlay {
      min-height: 100%;
      padding: 18px 20px 24px;
      background: var(--skill-surface);
      color: #363139;
      font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
      font-size: 12px;
      line-height: 1.75;
      white-space: pre-wrap;
      word-break: break-word;
    }

    .claw-skill-state.is-error {
      border-color: #f2b8b5;
      background: #fff8f7;
    }

    .claw-skill-state.is-error .claw-skill-state-icon {
      color: var(--skill-error);
      background: var(--skill-error-container);
    }

    .claw-skill-state.is-error .claw-skill-state-title {
      color: var(--skill-error);
    }

    @keyframes claw-skill-spin {
      to { transform: rotate(360deg); }
    }

    @media (prefers-reduced-motion: reduce) {
      .claw-skill-surface *,
      .claw-skill-dialog *,
      .claw-skill-preview-overlay * {
        scroll-behavior: auto !important;
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
      }
    }
  </style>
`;

function getSkillIcon(name, size = 20, className = '') {
  const paths = {
    sparkles: '<path d="M12 3l1.2 3.3L16.5 7.5l-3.3 1.2L12 12l-1.2-3.3-3.3-1.2 3.3-1.2L12 3Z"/><path d="M18 13l.8 2.2L21 16l-2.2.8L18 19l-.8-2.2L15 16l2.2-.8L18 13Z"/><path d="M6 14l.9 2.6L9.5 17.5l-2.6.9L6 21l-.9-2.6-2.6-.9 2.6-.9L6 14Z"/>',
    history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 2"/>',
    upload: '<path d="M12 16V4"/><path d="m7 9 5-5 5 5"/><path d="M5 14v5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-5"/>',
    settings: '<path d="M4 7h10"/><path d="M18 7h2"/><circle cx="16" cy="7" r="2"/><path d="M4 17h2"/><path d="M10 17h10"/><circle cx="8" cy="17" r="2"/>',
    chevronRight: '<path d="m9 18 6-6-6-6"/>',
    chevronDown: '<path d="m6 9 6 6 6-6"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
    refresh: '<path d="M20 6v5h-5"/><path d="M4 18v-5h5"/><path d="M18.4 9A7 7 0 0 0 6.2 6.2L4 8"/><path d="M5.6 15A7 7 0 0 0 17.8 17.8L20 16"/>',
    spinner: '<circle cx="12" cy="12" r="8" opacity=".22"/><path d="M20 12a8 8 0 0 0-8-8"/>',
    folder: '<path d="M3 6.5A1.5 1.5 0 0 1 4.5 5H9l2 2h8.5A1.5 1.5 0 0 1 21 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5v-11Z"/><path d="M3 10h18"/>',
    trash: '<path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="m6 7 1 13h10l1-13"/><path d="M10 11v5M14 11v5"/>',
    file: '<path d="M6 3h8l4 4v14H6V3Z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h6"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 8h.01"/>',
    check: '<circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9"/>',
    alert: '<path d="M10.3 4.2 2.8 17a2 2 0 0 0 1.7 3h15a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4"/><path d="M12 16.5h.01"/>',
    clipboard: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4.5V3h6v1.5"/><path d="M9 10h6M9 14h6M9 18h4"/>'
  };
  const iconPaths = paths[name] || paths.info;
  return `<svg${className ? ` class="${className}"` : ''} width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconPaths}</svg>`;
}

function setSkillNoticeContent(element, message, type) {
  const iconName = type === 'success' ? 'check' : type === 'error' ? 'alert' : 'info';
  const iconWrapper = document.createElement('span');
  iconWrapper.innerHTML = getSkillIcon(iconName, 17);
  const icon = iconWrapper.firstElementChild;
  const text = document.createElement('span');
  text.textContent = message;
  element.replaceChildren(...(icon ? [icon, text] : [text]));
}

function isDirectory(entry) {
  if (entry.kind) return entry.kind === 'directory';
  return entry.isDir || entry.is_dir || entry.stat?.isDir || entry.stat?.is_dir || false;
}

function getEntryUpdatedAt(entry) {
  return entry.updated_at || entry.modTime || entry.mtime || entry.modifiedAt;
}

// ═══════════════════════════════════════════════════════════
//  HTML 生成
// ═══════════════════════════════════════════════════════════

export function getSkillStoreHomeContent() {
  const sections = [
    { id: 'history', title: '我的 Skill', desc: '浏览已使用的能力与内容详情', icon: 'history' },
    { id: 'upload', title: '上传 Skill', desc: '导入符合 SKILL.md 格式的自定义能力', icon: 'upload' },
    { id: 'manage', title: '安装管理', desc: '查看并维护当前已安装的 Skill', icon: 'settings' }
  ];

  const cards = sections.map(s => `
    <button type="button" class="claw-skill-section" data-section="${s.id}">
      <span class="claw-skill-section-icon">${getSkillIcon(s.icon, 22)}</span>
      <span class="claw-skill-section-copy">
        <span class="claw-skill-section-title">${s.title}</span>
        <span class="claw-skill-section-desc">${s.desc}</span>
      </span>
      ${getSkillIcon('chevronRight', 18, 'claw-skill-chevron')}
    </button>
  `).join('');

  return `
    ${SKILL_STORE_STYLES}
    <div class="claw-skill-surface claw-skill-home">
      <section class="claw-skill-intro">
        <span class="claw-skill-eyebrow">${getSkillIcon('sparkles', 13)} Skill Library</span>
        <p class="claw-skill-intro-title">让常用能力保持有序</p>
        <p class="claw-skill-intro-copy">从这里浏览、导入和维护你的 Skill，所有操作都集中在同一处。</p>
      </section>
      <div class="claw-skill-home-list">
        ${cards}
      </div>
    </div>
  `;
}

export function getSkillHistoryContent() {
  return getSkillListContent('我的 Skill');
}

export function getSkillManageContent() {
  return getSkillListContent('安装管理', { showDelete: true });
}

function getSkillListContent(title, options = {}) {
  const pageNote = options.showDelete
    ? '展开条目查看内容，或移除不再需要的 Skill。'
    : '按名称或描述搜索，展开条目即可查看内容摘要。';
  return `
    ${SKILL_STORE_STYLES}
    <div class="claw-skill-surface claw-skill-list">
      <p class="claw-skill-page-note">${pageNote}</p>
      <!-- 搜索框 -->
      <div class="claw-skill-toolbar">
        <div class="claw-skill-search-shell">
          ${getSkillIcon('search', 17)}
          <input class="claw-skill-search-input" type="text" id="claw-skill-search" placeholder="搜索 Skill 名称或描述..." aria-label="搜索 ${title}">
        </div>
        <button type="button" id="claw-skill-btn-refresh" class="claw-skill-refresh">
          ${getSkillIcon('refresh', 15)}
          刷新
        </button>
      </div>

      <!-- Toast -->
      <div id="claw-skill-toast" class="claw-skill-notice claw-skill-toast" role="status" aria-live="polite" style="display: none;"></div>

      <!-- 加载中 -->
      <div id="claw-skill-list-loading" class="claw-skill-state" role="status" aria-live="polite">
        <span class="claw-skill-state-icon">${getSkillIcon('spinner', 23, 'claw-skill-spinner')}</span>
        <p class="claw-skill-state-title">正在加载 Skill</p>
        <p class="claw-skill-state-copy">正在同步你的能力列表，请稍候。</p>
      </div>

      <!-- 列表内容 -->
      <div id="claw-skill-list-content" style="display: none;"></div>
    </div>
  `;
}

export function getSkillUploadContent() {
  return `
    ${SKILL_STORE_STYLES}
    <div class="claw-skill-surface claw-skill-upload">
      <p class="claw-skill-page-note">上传前会先校验文件；若存在同名 Skill，确认后将覆盖原内容。</p>
      <!-- 上传区域 -->
      <div id="claw-skill-dropzone" class="claw-skill-dropzone" aria-label="选择或拖放 Skill 文件">
        <span class="claw-skill-upload-icon">${getSkillIcon('upload', 25)}</span>
        <p class="claw-skill-dropzone-title">点击选择或拖拽文件到这里</p>
        <p class="claw-skill-dropzone-copy">内容需符合 SKILL.md 格式，单个文件不超过 10MB。</p>
        <div class="claw-skill-format-row" aria-hidden="true">
          <span class="claw-skill-format-chip">.MD</span>
          <span class="claw-skill-format-chip">.TXT</span>
        </div>
        <input type="file" id="claw-skill-file-input" accept=".md,.txt" style="display: none;" />
      </div>

      <!-- 状态提示 -->
      <div id="claw-skill-upload-status" class="claw-skill-notice claw-skill-upload-status" role="status" aria-live="polite" style="display: none;"></div>

      <!-- 上传须知 -->
      <div class="claw-skill-guide">
        <p class="claw-skill-guide-title"><span>${getSkillIcon('clipboard', 16)}</span>上传须知</p>
        <ul class="claw-skill-guide-list">
          <li>SKILL.md 必须以 <code>---</code> 开头</li>
          <li>Skill 名称优先取 frontmatter 中的 <code>name</code>；未填写时取文件名（去掉 <code>.md</code> / <code>.txt</code>）</li>
          <li>Skill 名称仅支持字母、数字、下划线、短横线（正则 <code>^[\\w-]+$</code>）</li>
          <li>如存在同名 Skill，将直接覆盖</li>
          <li>前端校验仅供参考，最终格式以服务端解析为准</li>
          <li>上传成功后可在「我的 Skill」中查看</li>
        </ul>
      </div>
    </div>
  `;
}

// ═══════════════════════════════════════════════════════════
//  初始化函数
// ═══════════════════════════════════════════════════════════

export async function initSkillUploadPanel(bodyElement) {
  if (!bodyElement) return;

  const dropzone = bodyElement.querySelector('#claw-skill-dropzone');
  const fileInput = bodyElement.querySelector('#claw-skill-file-input');
  const statusEl = bodyElement.querySelector('#claw-skill-upload-status');

  if (!dropzone || !fileInput) return;

  function showStatus(msg, type = 'info') {
    if (!statusEl) return;
    statusEl.style.display = 'flex';
    const colors = {
      info: { bg: '#f3edf7', border: '#d0bcff', text: '#4f378b' },
      success: { bg: '#e8f5e9', border: '#a5d6a7', text: '#1b5e20' },
      error: { bg: '#f9dedc', border: '#f2b8b5', text: '#8c1d18' }
    };
    const c = colors[type] || colors.info;
    statusEl.style.background = c.bg;
    statusEl.style.border = `1px solid ${c.border}`;
    statusEl.style.color = c.text;
    setSkillNoticeContent(statusEl, msg, type);
  }

  function formatError(err) {
    if (err.name === 'AbortError' || err.message?.includes('aborted')) {
      return '请求超时，请检查后端是否正常运行或网络连接';
    }
    if (err.message?.includes('Failed to fetch')) {
      return '无法连接到记忆后端引擎，请检查服务地址和认证配置';
    }
    if (err.message?.includes('401') || err.message?.includes('403')) {
      return '认证失败，请在 EchoMem 主页的「记忆后端引擎连接配置」中检查 API Key';
    }
    return err.message;
  }

  function normalizeSkillName(name, fileName) {
    let raw = '';
    if (typeof name === 'string' && name.trim()) {
      raw = name.trim();
    } else {
      raw = fileName.replace(/\.(md|txt)$/i, '');
    }
    raw = raw.replace(/\.(md|txt)$/i, '').trim();
    return raw;
  }

  async function validateFile(file) {
    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      throw new Error('文件过大，请压缩附件后重试');
    }

    const ext = file.name.split('.').pop().toLowerCase();
    if (ext === 'md' || ext === 'txt') {
      const text = await file.text();
      if (!text.trim().startsWith('---')) {
        throw new Error('SKILL.md 必须以 --- 开头');
      }
      const { frontmatter } = parseSkillMd(text);
      const skillName = normalizeSkillName(frontmatter.name, file.name);
      if (!skillName) {
        throw new Error('frontmatter 中必须包含 name 字段');
      }
    }

    return true;
  }

  async function executeUpload(file, skillName, skillText) {
    showStatus('正在上传...', 'info');

    try {
      const config = await getEchoMemConfig();
      const client = createClient(config);

      const { frontmatter } = parseSkillMd(skillText);
      const description = frontmatter.description || '';
      const tags = frontmatter.tags || [];
      const allowedTools = frontmatter.allowed_tools || [];
      const finalName = normalizeSkillName(frontmatter.name, file.name);

      const skillResult = await client.addSkill({
        data: skillText,
        name: finalName || skillName,
        description,
        tags,
        allowedTools,
      });

      showStatus(`Skill「${skillResult.name || finalName || skillName}」上传成功`, 'success');
    } catch (err) {
      showStatus(`上传失败：${formatError(err)}`, 'error');
    }
  }

  async function doUpload(file) {
    showStatus('正在校验文件...', 'info');

    try {
      await validateFile(file);
    } catch (err) {
      showStatus(err.message, 'error');
      return;
    }

    // 提取 skillName 与文本内容
    const ext = file.name.split('.').pop().toLowerCase();
    let skillName = '';
    let skillText = '';
    if (ext === 'md' || ext === 'txt') {
      try {
        skillText = await file.text();
        const { frontmatter } = parseSkillMd(skillText);
        skillName = normalizeSkillName(frontmatter.name, file.name);
      } catch { /* ignore */ }
    } else {
      showStatus('当前版本仅支持 .md / .txt 格式 Skill', 'error');
      return;
    }

    if (!skillText) {
      showStatus('无法读取 Skill 内容', 'error');
      return;
    }

    // 使用居中浮层替代原生 confirm
    const safeName = skillName.replace(/\u0026/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const dialogId = 'claw-skill-confirm-' + Date.now();
    const dialogHtml = `
      <div id="${dialogId}" class="claw-skill-dialog">
        <div>
          <span class="claw-skill-dialog-icon">${getSkillIcon('upload', 23)}</span>
          <p class="claw-skill-dialog-title">确认上传 Skill</p>
          <p class="claw-skill-dialog-copy">如存在同名 Skill「<strong>${safeName}</strong>」，将直接覆盖。</p>
        </div>
        <div class="claw-skill-dialog-actions">
          <button type="button" id="claw-skill-confirm-cancel" class="claw-skill-dialog-button">取消</button>
          <button type="button" id="claw-skill-confirm-ok" class="claw-skill-dialog-button is-primary">确认上传</button>
        </div>
      </div>
    `;

    openCenterOverlay('上传确认', dialogHtml, {
      width: '360px',
      maxWidth: '360px',
      height: '240px',
      maxHeight: '280px'
    });

    setTimeout(() => {
      const cancelBtn = document.getElementById('claw-skill-confirm-cancel');
      const okBtn = document.getElementById('claw-skill-confirm-ok');

      cancelBtn?.addEventListener('click', () => {
        closeOverlayPanel();
        statusEl.style.display = 'none';
      });

      okBtn?.addEventListener('click', () => {
        closeOverlayPanel();
        executeUpload(file, skillName, skillText);
      });
    }, 50);
  }

  // Click dropzone -> open file picker
  dropzone.addEventListener('click', (e) => {
    if (e.target !== fileInput) {
      fileInput.click();
    }
  });

  // File selected
  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (file) doUpload(file);
    fileInput.value = '';
  });

  // Drag & drop
  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.style.borderColor = '#6750a4';
    dropzone.style.background = '#f3edf7';
  });
  dropzone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dropzone.style.borderColor = '#a99db3';
    dropzone.style.background = '';
  });
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.style.borderColor = '#a99db3';
    dropzone.style.background = '';
    const file = e.dataTransfer?.files?.[0];
    if (file) doUpload(file);
  });
}

// ═══════════════════════════════════════════════════════════
//  Skill 列表（history / manage 共用）
// ═══════════════════════════════════════════════════════════

let skillCache = null;

export async function initSkillHistoryPanel(bodyElement) {
  return initSkillListPanel(bodyElement, { showDelete: false });
}

export async function initSkillManagePanel(bodyElement) {
  return initSkillListPanel(bodyElement, { showDelete: true });
}

async function initSkillListPanel(bodyElement, options = {}) {
  if (!bodyElement) return;

  const searchInput = bodyElement.querySelector('#claw-skill-search');
  const refreshBtn = bodyElement.querySelector('#claw-skill-btn-refresh');
  const toastEl = bodyElement.querySelector('#claw-skill-toast');
  const loadingEl = bodyElement.querySelector('#claw-skill-list-loading');
  const contentEl = bodyElement.querySelector('#claw-skill-list-content');

  if (!loadingEl || !contentEl) return;

  let allSkills = [];
  let filteredSkills = [];

  function showToast(msg, type = 'info') {
    if (!toastEl) return;
    const colors = {
      info: { bg: '#f3edf7', border: '#d0bcff', text: '#4f378b' },
      success: { bg: '#e8f5e9', border: '#a5d6a7', text: '#1b5e20' },
      error: { bg: '#f9dedc', border: '#f2b8b5', text: '#8c1d18' }
    };
    const c = colors[type] || colors.info;
    toastEl.style.display = 'flex';
    toastEl.style.background = c.bg;
    toastEl.style.border = `1px solid ${c.border}`;
    toastEl.style.color = c.text;
    setSkillNoticeContent(toastEl, msg, type);
    setTimeout(() => {
      if (toastEl) {
        toastEl.style.display = 'none';
        toastEl.textContent = '';
      }
    }, 4000);
  }

  function formatDate(ts) {
    if (!ts) return '-';
    const d = typeof ts === 'string' ? new Date(ts) : new Date(ts * 1000);
    if (isNaN(d.getTime())) return '-';
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function renderSkills(skills) {
    if (skills.length === 0) {
      const hasSearchKeyword = Boolean(searchInput?.value.trim());
      const emptyTitle = hasSearchKeyword ? '没有匹配结果' : '暂无 Skill';
      const emptyCopy = hasSearchKeyword
        ? '试试更短的关键词，或检查名称与描述。'
        : '上传一个 Skill 文件后，它会显示在这里。';
      contentEl.innerHTML = `
        <div class="claw-skill-state">
          <span class="claw-skill-state-icon">${getSkillIcon(hasSearchKeyword ? 'search' : 'folder', 23)}</span>
          <p class="claw-skill-state-title">${emptyTitle}</p>
          <p class="claw-skill-state-copy">${emptyCopy}</p>
        </div>
      `;
      return;
    }

    const itemsHtml = skills.map((skill, index) => {
      const desc = skill.description || '暂无描述';
      const version = skill.version ? `v${skill.version}` : '';
      const author = skill.author || '';
      const metaParts = [version, author, formatDate(skill.modifiedAt)].filter(Boolean);
      const meta = metaParts.join(' · ') || '-';

      const deleteBtnHtml = options.showDelete
        ? `<button type="button" class="claw-skill-btn-delete" data-name="${skill.name}" aria-label="删除 ${skill.name}">
            ${getSkillIcon('trash', 13)}
            删除
          </button>`
        : '';

      return `
        <div class="claw-skill-item" data-index="${index}">
          <div class="claw-skill-item-head">
            <div class="claw-skill-item-copy">
              <p class="claw-skill-item-title">${skill.name}</p>
              <p class="claw-skill-item-desc">${desc}</p>
              <p class="claw-skill-item-meta">${meta}</p>
            </div>
            <div class="claw-skill-item-actions">
              ${deleteBtnHtml}
              ${getSkillIcon('chevronDown', 17, 'claw-skill-toggle-icon')}
            </div>
          </div>
          <div class="claw-skill-detail" style="display: none;">
            ${renderDetail(skill)}
          </div>
        </div>
      `;
    }).join('');

    contentEl.innerHTML = `
      <div class="claw-skill-items">
        ${itemsHtml}
      </div>
    `;

    // Bind click to toggle detail
    contentEl.querySelectorAll('.claw-skill-item').forEach(item => {
      item.addEventListener('click', (e) => {
        // Don't toggle if clicking delete button
        if (e.target.closest('.claw-skill-btn-delete')) return;

        const detail = item.querySelector('.claw-skill-detail');
        const icon = item.querySelector('.claw-skill-toggle-icon');
        if (!detail) return;

        const isOpen = detail.style.display === 'block';
        // Close all others
        contentEl.querySelectorAll('.claw-skill-detail').forEach(d => d.style.display = 'none');
        contentEl.querySelectorAll('.claw-skill-toggle-icon').forEach(i => i.style.transform = 'none');

        if (!isOpen) {
          detail.style.display = 'block';
          if (icon) icon.style.transform = 'rotate(180deg)';
        }
      });
    });

    // Bind delete buttons
    if (options.showDelete) {
      contentEl.querySelectorAll('.claw-skill-btn-delete').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const name = btn.dataset.name;
          if (!name) return;
          const safeDelName = name.replace(/\u0026/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
          const delDialogHtml = `
            <div class="claw-skill-dialog">
              <div>
                <span class="claw-skill-dialog-icon is-danger">${getSkillIcon('trash', 22)}</span>
                <p class="claw-skill-dialog-title">确认删除 Skill</p>
                <p class="claw-skill-dialog-copy">确定删除 Skill「<strong>${safeDelName}</strong>」？此操作不可恢复。</p>
              </div>
              <div class="claw-skill-dialog-actions">
                <button type="button" id="claw-skill-del-cancel" class="claw-skill-dialog-button">取消</button>
                <button type="button" id="claw-skill-del-ok" class="claw-skill-dialog-button is-danger">确认删除</button>
              </div>
            </div>
          `;

          openCenterOverlay('删除确认', delDialogHtml, {
            width: '360px',
            maxWidth: '360px',
            height: '240px',
            maxHeight: '280px'
          });

          setTimeout(() => {
            const cancelBtn = document.getElementById('claw-skill-del-cancel');
            const okBtn = document.getElementById('claw-skill-del-ok');

            cancelBtn?.addEventListener('click', () => {
              closeOverlayPanel();
            });

            okBtn?.addEventListener('click', async () => {
              closeOverlayPanel();
              btn.textContent = '删除中...';
              btn.disabled = true;
              try {
                const config = await getEchoMemConfig();
                const client = createClient(config);
                await client.deleteSkill(name);
                showToast(`Skill「${name || '未命名'}」已删除`, 'success');
                skillCache = null;
                await loadSkills();
              } catch (err) {
                showToast(`删除失败：${err.message}`, 'error');
                btn.textContent = '删除';
                btn.disabled = false;
              }
            });
          }, 50);
          return;
        });
      });
    }

    // Bind view full content buttons
    contentEl.querySelectorAll('.claw-skill-btn-view-full').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const name = btn.dataset.name;
        const skill = allSkills.find(s => s.name === name);
        if (!skill) return;
        const text = skill.fullContent || skill.rawContent || '无内容';
        const previewHtml = `<div class="claw-skill-preview-overlay">${text.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>`;
        openCenterOverlay(skill.name, previewHtml, {
          showBack: true,
          onBack: () => closeOverlayPanel()
        });
      });
    });
  }

  function renderDetail(skill) {
    const descHtml = skill.description
      ? `<div class="claw-skill-detail-description">${skill.description.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>`
      : `<div class="claw-skill-detail-empty">暂无描述</div>`;

    const previewText = skill.rawContent || skill.fullContent || '';
    const bodyPreview = previewText
      ? `<div class="claw-skill-code-preview">${previewText.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>`
      : `<div class="claw-skill-detail-empty">暂无正文</div>`;

    return `
      ${descHtml}
      ${bodyPreview}
      <div class="claw-skill-detail-footer">
        <span class="claw-skill-uri">${skill.uri}</span>
        <button type="button" class="claw-skill-btn-view-full" data-name="${skill.name}">
          ${getSkillIcon('file', 13)}
          查看完整内容
        </button>
      </div>
    `;
  }

  function filterSkills(keyword) {
    if (!keyword.trim()) {
      filteredSkills = allSkills;
    } else {
      const k = keyword.toLowerCase();
      filteredSkills = allSkills.filter(s =>
        s.name.toLowerCase().includes(k) ||
        (s.description && s.description.toLowerCase().includes(k))
      );
    }
    renderSkills(filteredSkills);
  }

  async function loadSkills() {
    if (skillCache) {
      allSkills = skillCache;
      filteredSkills = allSkills;
      loadingEl.style.display = 'none';
      contentEl.style.display = 'block';
      renderSkills(filteredSkills);
      return;
    }

    loadingEl.style.display = 'flex';
    contentEl.style.display = 'none';

    try {
      const config = await getEchoMemConfig();
      const client = createClient(config);

      const lsResult = await client.fsLs(SKILL_ROOT_URI, {
        output: 'agent',
        absLimit: 128,
        showAllHidden: false,
      });
      console.log('[EchoMem:skill] fsLs result:', lsResult);

      let entries = Array.isArray(lsResult) ? lsResult : (lsResult?.entries || []);
      entries = entries.filter(e => isDirectory(e));
      console.log('[EchoMem:skill] filtered entries:', entries);

      if (entries.length === 0) {
        allSkills = [];
        skillCache = allSkills;
        loadingEl.style.display = 'none';
        contentEl.style.display = 'block';
        renderSkills([]);
        return;
      }

      // Parallel read each skill's SKILL.md
      const skills = await Promise.all(
        entries.map(async (entry) => {
          const dirName = getEntryName(entry);
          try {
            const baseUri = entry.uri.replace(/\/$/, '');
            const skillUri = `${baseUri}/SKILL.md`;
            console.log('[EchoMem:skill] reading:', skillUri, 'dirName:', dirName);
            const readResult = await client.fsRead(skillUri);
            console.log('[EchoMem:skill] readResult type:', typeof readResult, 'preview:', String(readResult).slice(0, 60));
            const content = typeof readResult === 'string'
              ? readResult
              : (readResult?.content || '');
            const { frontmatter, body } = parseSkillMd(content);
            console.log('[EchoMem:skill] parsed frontmatter:', JSON.stringify(frontmatter));

            return {
              name: frontmatter.name || dirName,
              dirName,
              description: frontmatter.description || entry.abstract || '',
              uri: baseUri,
              rawContent: body.slice(0, 1000),
              fullContent: content,
              modifiedAt: getEntryUpdatedAt(entry) || entry.mtime || entry.modifiedAt,
              version: frontmatter.version,
              author: frontmatter.author,
            };
          } catch (err) {
            console.warn(`Failed to read skill ${dirName}:`, err);
            return {
              name: dirName,
              dirName,
              description: '读取失败',
              uri: entry.uri,
              error: true,
            };
          }
        })
      );
      console.log('[EchoMem:skill] final skills:', skills.map(s => ({ name: s.name, dirName: s.dirName })));

      allSkills = skills.filter(s => !s.error);
      // Sort by modified time descending
      allSkills.sort((a, b) => {
        const ta = a.modifiedAt ? new Date(a.modifiedAt).getTime() : 0;
        const tb = b.modifiedAt ? new Date(b.modifiedAt).getTime() : 0;
        return tb - ta;
      });

      skillCache = allSkills;
      filteredSkills = allSkills;

      loadingEl.style.display = 'none';
      contentEl.style.display = 'block';
      renderSkills(filteredSkills);
    } catch (err) {
      loadingEl.style.display = 'none';
      contentEl.style.display = 'block';
      contentEl.innerHTML = `
        <div class="claw-skill-state is-error" role="alert">
          <span class="claw-skill-state-icon">${getSkillIcon('alert', 22)}</span>
          <p class="claw-skill-state-title">加载失败</p>
          <p class="claw-skill-state-copy">${err.message}</p>
        </div>
      `;
    }
  }

  // Search with debounce
  let searchTimer = null;
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        filterSkills(searchInput.value);
      }, 300);
    });
  }

  // Refresh button
  if (refreshBtn) {
    refreshBtn.addEventListener('click', async () => {
      skillCache = null;
      if (searchInput) searchInput.value = '';
      await loadSkills();
    });
  }

  await loadSkills();
}
