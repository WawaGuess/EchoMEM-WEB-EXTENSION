// 文档：docs/flows/skill-store/上传流程.md
// Skill 管理面板内容 —— 真实数据驱动

import { getEchoMemConfig } from '../../services/config.js';
import { createClient } from '../../services/echomem-client.js';
import { parseSkillMd } from '../../utils/skill-parser.js';
import { insertPlainText } from '../../core/content-injector.js';
import { openCenterOverlay, closeOverlayPanel } from '../../core/panel-host.js';
import { readSkillEntries } from './skill-list.js';
import {
  classifyVersionError,
  escapeHtml,
  formatSkillCommand,
  formatVersionDate,
  formatVersionLabel,
  getSkillApiName,
  getVersionSourceLabel,
  normalizeSkillVersionHistory,
} from './version-history.js';

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

    .claw-skill-list-page {
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
    .claw-skill-btn-detail:focus-visible,
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
    .claw-skill-btn-detail,
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

    .claw-skill-refresh:disabled {
      cursor: wait;
      opacity: 0.65;
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
      padding: 14px;
      border: 1px solid var(--skill-outline-soft);
      border-radius: 16px;
      background: rgba(255, 255, 255, 0.9);
      cursor: pointer;
      box-shadow: 0 1px 2px rgba(29, 27, 32, 0.035);
      transition: transform 180ms ease, border-color 180ms ease, background 180ms ease, box-shadow 180ms ease;
    }

    .claw-skill-item:hover {
      transform: translateY(-1px);
      border-color: #d0bcff;
      background: var(--skill-surface-soft);
      box-shadow: 0 7px 18px rgba(33, 0, 93, 0.08);
    }

    .claw-skill-item-head {
      display: block;
    }

    .claw-skill-item-copy {
      min-width: 0;
    }

    .claw-skill-item-title {
      display: -webkit-box;
      overflow: hidden;
      margin: 0 0 6px;
      color: var(--skill-text);
      font-size: 14px;
      font-weight: 600;
      line-height: 1.42;
      overflow-wrap: anywhere;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;
    }

    .claw-skill-item-desc {
      display: -webkit-box;
      overflow: hidden;
      margin: 0;
      color: var(--skill-text-muted);
      font-size: 12px;
      line-height: 1.5;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;
    }

    .claw-skill-item-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 11px;
      padding-top: 10px;
      border-top: 1px solid var(--skill-outline-soft);
    }

    .claw-skill-item-meta {
      display: inline-flex;
      align-items: center;
      max-width: 100%;
      min-height: 22px;
      margin: 0;
      padding: 2px 8px;
      overflow: hidden;
      border-radius: 999px;
      background: var(--skill-surface-strong);
      color: var(--skill-text-muted);
      font-size: 10px;
      line-height: 1.4;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .claw-skill-item-actions {
      display: flex;
      align-items: center;
      gap: 7px;
      margin-left: auto;
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

    .claw-skill-btn-detail {
      min-height: 28px;
      padding: 0 11px;
      border: 1px solid #d0bcff;
      background: #ffffff;
      color: var(--skill-primary);
      font-size: 11px;
    }

    .claw-skill-btn-detail:hover {
      background: var(--skill-primary-container);
    }

    .claw-skill-use-hint {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      min-height: 28px;
      padding: 0 8px;
      border: 1px solid #c8e6c9;
      border-radius: 999px;
      background: var(--skill-success-container);
      color: var(--skill-success);
      font-size: 10px;
      font-weight: 600;
      white-space: nowrap;
    }

    .claw-skill-toggle-icon {
      margin-top: 0;
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

    .claw-skill-detail-page {
      display: flex;
      flex-direction: column;
      gap: 12px;
      outline: none;
    }

    .claw-skill-detail-hero,
    .claw-skill-detail-sheet {
      border: 1px solid var(--skill-outline-soft);
      background: rgba(255, 255, 255, 0.86);
      box-shadow: 0 1px 2px rgba(29, 27, 32, 0.035);
    }

    .claw-skill-detail-hero {
      padding: 16px;
      border-radius: 18px;
      background: linear-gradient(135deg, #fef7ff 0%, #f3edff 100%);
    }

    .claw-skill-detail-title {
      margin: 0;
      color: var(--skill-on-primary-container);
      font-size: 16px;
      font-weight: 600;
      line-height: 1.45;
      word-break: break-word;
    }

    .claw-skill-detail-command {
      display: inline-flex;
      margin-top: 7px;
      padding: 4px 9px;
      border-radius: 999px;
      background: var(--skill-primary-container);
      color: var(--skill-on-primary-container);
      font-family: "SFMono-Regular", Consolas, monospace;
      font-size: 11px;
    }

    .claw-skill-detail-meta {
      margin: 8px 0 0;
      color: var(--skill-text-muted);
      font-size: 11px;
      line-height: 1.5;
    }

    .claw-skill-detail-sheet {
      padding: 14px;
      border-radius: 16px;
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
    : '点击卡片直接使用；点击「详情」进入完整信息与版本历史。';
  return `
    ${SKILL_STORE_STYLES}
    <div class="claw-skill-surface claw-skill-list">
      <div id="claw-skill-list-page" class="claw-skill-list-page">
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

      <!-- 独立详情页 -->
      <div id="claw-skill-detail-page" class="claw-skill-detail-page" tabindex="-1" style="display: none;"></div>
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

      skillCache = null;
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
    const safeName = escapeHtml(skillName);
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
  return initSkillListPanel(bodyElement, {
    showDelete: false,
    showVersionHistory: true,
    useOnCardClick: true,
  });
}

export async function initSkillManagePanel(bodyElement) {
  return initSkillListPanel(bodyElement, { showDelete: true, showVersionHistory: false });
}

async function initSkillListPanel(bodyElement, options = {}) {
  if (!bodyElement) return;

  const searchInput = bodyElement.querySelector('#claw-skill-search');
  const refreshBtn = bodyElement.querySelector('#claw-skill-btn-refresh');
  const toastEl = bodyElement.querySelector('#claw-skill-toast');
  const loadingEl = bodyElement.querySelector('#claw-skill-list-loading');
  const contentEl = bodyElement.querySelector('#claw-skill-list-content');
  const listPage = bodyElement.querySelector('#claw-skill-list-page');
  const detailPage = bodyElement.querySelector('#claw-skill-detail-page');
  const panel = bodyElement.closest('.claw-custom-panel');
  const panelTitle = panel?.querySelector('.claw-panel-title');
  const panelBackButton = panel?.querySelector('.claw-back-btn');
  const panelBody = bodyElement.closest('.claw-custom-panel-body');

  if (!loadingEl || !contentEl || !listPage || !detailPage) return;

  let allSkills = [];
  let filteredSkills = [];
  const skillVersionCache = new Map();
  const skillVersionRequests = new Map();
  const skillVersionContentCache = new Map();
  const skillVersionContentRequests = new Map();
  const rollbackInFlight = new Set();
  let expandedSkillKey = null;
  let isDetailPageOpen = false;
  let listScrollTop = 0;
  let loadGeneration = 0;
  const listPageTitle = panelTitle?.textContent || '我的 Skill';

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

  function getVersionErrorMessage(error) {
    const kind = classifyVersionError(error);
    const messages = {
      unsupported: '当前 EchoMem 版本暂不支持版本管理',
      auth: '认证失败，请检查记忆后端引擎的 API Key',
      timeout: '请求超时，请检查后端状态或网络连接',
      network: '无法连接到记忆后端引擎，请检查服务地址和网络连接',
    };
    return messages[kind] || error?.message || '加载版本信息失败';
  }

  function getNestedCache(cache, skillKey, version) {
    return cache.get(skillKey)?.get(version);
  }

  function setNestedCache(cache, skillKey, version, value) {
    let bucket = cache.get(skillKey);
    if (!bucket) {
      bucket = new Map();
      cache.set(skillKey, bucket);
    }
    bucket.set(version, value);
  }

  function invalidateVersionCaches(skillKey = null) {
    if (!skillKey) {
      skillVersionCache.clear();
      skillVersionRequests.clear();
      skillVersionContentCache.clear();
      skillVersionContentRequests.clear();
      return;
    }

    skillVersionCache.delete(skillKey);
    skillVersionRequests.delete(skillKey);
    skillVersionContentCache.delete(skillKey);
    skillVersionContentRequests.delete(skillKey);
  }

  function renderVersionLoading(container) {
    if (!container) return;
    container.innerHTML = `
      <div style="padding: 12px; text-align: center; color: #6b7280; font-size: 12px; background: #f9fafb; border-radius: 6px;">
        正在加载版本历史...
      </div>
    `;
  }

  function renderVersionError(container, skill, error) {
    if (!container) return;
    const kind = classifyVersionError(error);
    const retryable = !['unsupported', 'auth'].includes(kind);
    container.innerHTML = `
      <div style="padding: 12px; color: #b91c1c; background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; font-size: 12px; line-height: 1.5;">
        <p style="margin: 0;">${escapeHtml(getVersionErrorMessage(error))}</p>
        ${retryable ? `
          <button class="claw-skill-version-retry" style="margin-top: 8px; padding: 4px 10px; background: white; color: #b91c1c; border: 1px solid #fecaca; border-radius: 5px; font-size: 11px; cursor: pointer;">重试</button>
        ` : ''}
      </div>
    `;

    container.querySelector('.claw-skill-version-retry')?.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      loadSkillVersions(skill, container, { force: true });
    });
  }

  function renderVersionHistory(container, skill, history) {
    if (!container) return;
    if (history.versions.length === 0) {
      container.innerHTML = `
        <div style="padding: 12px; text-align: center; color: #9ca3af; font-size: 12px; background: #f9fafb; border-radius: 6px;">
          暂无版本历史
        </div>
      `;
      return;
    }

    const rows = history.versions.map(item => {
      const details = [];
      if (item.parentVersion) details.push(`基于 ${formatVersionLabel(item.parentVersion)}`);
      if (item.runId) details.push(item.runId);
      if (!item.exists) details.push('内容缺失');

      const viewDisabled = item.exists ? '' : 'disabled';
      const viewStyle = item.exists
        ? 'background: #eff6ff; color: #2563eb; border-color: #bfdbfe; cursor: pointer;'
        : 'background: #f3f4f6; color: #9ca3af; border-color: #e5e7eb; cursor: not-allowed;';
      const rollbackButton = !item.current
        ? `<button class="claw-skill-version-rollback" data-version="${item.version}" ${viewDisabled} style="padding: 4px 9px; border: 1px solid ${item.exists ? '#fed7aa' : '#e5e7eb'}; border-radius: 5px; font-size: 11px; ${item.exists ? 'background: #fff7ed; color: #c2410c; cursor: pointer;' : 'background: #f3f4f6; color: #9ca3af; cursor: not-allowed;'}">恢复为此版本</button>`
        : '';

      return `
        <div style="padding: 10px; border: 1px solid ${item.current ? '#a5b4fc' : '#e5e7eb'}; background: ${item.current ? '#f5f3ff' : '#fff'}; border-radius: 7px;">
          <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 8px;">
            <div style="min-width: 0; flex: 1;">
              <div style="display: flex; align-items: center; flex-wrap: wrap; gap: 6px;">
                ${item.current ? '<span style="padding: 2px 6px; border-radius: 999px; background: #667eea; color: white; font-size: 10px;">当前</span>' : ''}
                <strong style="font-size: 12px; color: #111827;">${escapeHtml(formatVersionLabel(item.version))}</strong>
                <span style="font-size: 11px; color: #6b7280;">${escapeHtml(getVersionSourceLabel(item.source))}</span>
                <span style="font-size: 11px; color: #9ca3af;">${escapeHtml(formatVersionDate(item.createdAt))}</span>
              </div>
              ${details.length ? `<p style="margin: 5px 0 0; color: #9ca3af; font-size: 10px; line-height: 1.4; word-break: break-all;">${details.map(escapeHtml).join(' · ')}</p>` : ''}
            </div>
            <div style="display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 5px;">
              <button class="claw-skill-version-view" data-version="${item.version}" ${viewDisabled} style="padding: 4px 9px; border: 1px solid; border-radius: 5px; font-size: 11px; ${viewStyle}">查看内容</button>
              ${rollbackButton}
            </div>
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = `<div style="display: flex; flex-direction: column; gap: 7px;">${rows}</div>`;

    container.querySelectorAll('.claw-skill-version-view').forEach(button => {
      button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (button.disabled) return;
        const version = Number(button.dataset.version);
        openVersionContent(skill, version, history);
      });
    });

    container.querySelectorAll('.claw-skill-version-rollback').forEach(button => {
      button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (button.disabled) return;
        const version = Number(button.dataset.version);
        openRollbackDialog(skill, version, history);
      });
    });
  }

  async function loadSkillVersions(skill, container, requestOptions = {}) {
    if (!options.showVersionHistory || !container) return null;
    const skillKey = getSkillApiName(skill);
    const force = requestOptions.force === true;
    if (force) {
      skillVersionCache.delete(skillKey);
      skillVersionRequests.delete(skillKey);
    }

    const cached = skillVersionCache.get(skillKey);
    if (cached) {
      renderVersionHistory(container, skill, cached);
      return cached;
    }

    renderVersionLoading(container);
    let request = skillVersionRequests.get(skillKey);
    if (!request) {
      request = (async () => {
        const config = await getEchoMemConfig();
        const client = createClient(config);
        const payload = await client.listSkillVersions(skillKey);
        return normalizeSkillVersionHistory(payload);
      })();
      skillVersionRequests.set(skillKey, request);
    }

    try {
      const history = await request;
      const isCurrentRequest = skillVersionRequests.get(skillKey) === request;
      if (isCurrentRequest) {
        skillVersionCache.set(skillKey, history);
        if (container?.isConnected) {
          renderVersionHistory(container, skill, history);
        }
      }
      return history;
    } catch (error) {
      if (skillVersionRequests.get(skillKey) === request && container?.isConnected) {
        renderVersionError(container, skill, error);
      }
      return null;
    } finally {
      if (skillVersionRequests.get(skillKey) === request) {
        skillVersionRequests.delete(skillKey);
      }
    }
  }

  async function getSkillVersionContent(skill, version, history) {
    const skillKey = getSkillApiName(skill);
    const cached = getNestedCache(skillVersionContentCache, skillKey, version);
    if (cached !== undefined) return cached;

    if (version === history.currentVersion && skill.fullContent) {
      setNestedCache(skillVersionContentCache, skillKey, version, skill.fullContent);
      return skill.fullContent;
    }

    let request = getNestedCache(skillVersionContentRequests, skillKey, version);
    if (!request) {
      request = (async () => {
        const config = await getEchoMemConfig();
        const client = createClient(config);
        const payload = await client.readSkillVersion(skillKey, version);
        if (typeof payload?.text !== 'string') {
          throw new Error('历史版本内容为空');
        }
        return payload.text;
      })();
      setNestedCache(skillVersionContentRequests, skillKey, version, request);
    }

    try {
      const text = await request;
      if (getNestedCache(skillVersionContentRequests, skillKey, version) === request) {
        setNestedCache(skillVersionContentCache, skillKey, version, text);
      }
      return text;
    } finally {
      const requests = skillVersionContentRequests.get(skillKey);
      if (requests?.get(version) === request) {
        requests.delete(version);
        if (requests.size === 0) skillVersionContentRequests.delete(skillKey);
      }
    }
  }

  async function openVersionContent(skill, version, history) {
    const contentId = `claw-skill-version-content-${Date.now()}-${version}`;
    const title = `${skill.name} · ${formatVersionLabel(version)}`;
    openCenterOverlay(escapeHtml(title), `
      <div id="${contentId}" style="padding: 16px 18px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 12px; line-height: 1.7; color: #6b7280; white-space: pre-wrap; word-break: break-word;">正在加载版本内容...</div>
    `, {
      showBack: true,
      onBack: () => closeOverlayPanel()
    });

    const contentElement = document.getElementById(contentId);
    try {
      const text = await getSkillVersionContent(skill, version, history);
      if (contentElement?.isConnected) {
        contentElement.style.color = '#374151';
        contentElement.textContent = text || '无内容';
      }
    } catch (error) {
      if (contentElement?.isConnected) {
        contentElement.style.color = '#b91c1c';
        contentElement.textContent = `加载失败：${getVersionErrorMessage(error)}`;
      }
    }
  }

  function openRollbackDialog(skill, version, history) {
    const skillKey = getSkillApiName(skill);
    if (rollbackInFlight.has(skillKey)) return;
    const dialogId = `claw-skill-rollback-${Date.now()}`;
    const currentLabel = formatVersionLabel(history.currentVersion || skill.version);
    const targetLabel = formatVersionLabel(version);
    const dialogHtml = `
      <div id="${dialogId}" style="padding: 12px 16px; display: flex; flex-direction: column; gap: 12px;">
        <div style="text-align: center;">
          <p style="font-size: 24px; margin: 0; line-height: 1;">↩️</p>
          <p style="font-size: 15px; color: #333; font-weight: 600; margin: 6px 0 4px;">确认恢复 Skill</p>
          <p style="font-size: 12px; color: #666; line-height: 1.5; margin: 0;">将 Skill「<strong style="color: #111;">${escapeHtml(skill.name)}</strong>」从 ${escapeHtml(currentLabel)} 恢复为 ${escapeHtml(targetLabel)}。<br>恢复后，当前 SKILL.md 会切换到该历史内容。</p>
        </div>
        <div class="claw-skill-rollback-status" style="display: none; padding: 8px; border-radius: 6px; font-size: 12px;"></div>
        <div style="display: flex; gap: 10px; justify-content: center;">
          <button class="claw-skill-rollback-cancel" style="padding: 8px 20px; background: #f3f4f6; color: #374151; border: 1px solid #d1d5db; border-radius: 8px; font-size: 13px; cursor: pointer; font-weight: 500;">取消</button>
          <button class="claw-skill-rollback-confirm" style="padding: 8px 20px; background: #ea580c; color: white; border: none; border-radius: 8px; font-size: 13px; cursor: pointer; font-weight: 500;">确认恢复</button>
        </div>
      </div>
    `;

    openCenterOverlay('恢复版本', dialogHtml, {
      width: '380px',
      maxWidth: '380px',
      height: '270px',
      maxHeight: '320px'
    });

    setTimeout(() => {
      const dialog = document.getElementById(dialogId);
      const cancelButton = dialog?.querySelector('.claw-skill-rollback-cancel');
      const confirmButton = dialog?.querySelector('.claw-skill-rollback-confirm');
      const statusElement = dialog?.querySelector('.claw-skill-rollback-status');
      if (!dialog || !cancelButton || !confirmButton || !statusElement) return;

      cancelButton.addEventListener('click', () => closeOverlayPanel());
      confirmButton.addEventListener('click', async () => {
        if (rollbackInFlight.has(skillKey)) return;
        rollbackInFlight.add(skillKey);
        confirmButton.disabled = true;
        cancelButton.disabled = true;
        confirmButton.textContent = '恢复中...';
        statusElement.style.display = 'block';
        statusElement.style.background = '#fff7ed';
        statusElement.style.color = '#c2410c';
        statusElement.textContent = '正在恢复历史版本...';

        try {
          const config = await getEchoMemConfig();
          const client = createClient(config);
          const result = await client.rollbackSkillVersion(skillKey, version);
          if (result?.rolled_back !== true) {
            throw new Error('后端未确认版本恢复成功');
          }

          closeOverlayPanel();
          invalidateVersionCaches(skillKey);
          skillCache = null;
          expandedSkillKey = skillKey;
          if (searchInput) searchInput.value = '';
          const reloadResult = await loadSkills({ force: true, preserveExisting: true });
          if (reloadResult.ok) {
            showToast(`✅ Skill「${skill.name}」已恢复为 ${targetLabel}`, 'success');
          }
        } catch (error) {
          if (statusElement.isConnected) {
            statusElement.style.background = '#fef2f2';
            statusElement.style.color = '#b91c1c';
            statusElement.textContent = `恢复失败：${getVersionErrorMessage(error)}`;
            confirmButton.disabled = false;
            cancelButton.disabled = false;
            confirmButton.textContent = '重新恢复';
          }
        } finally {
          rollbackInFlight.delete(skillKey);
        }
      });
    }, 50);
  }

  function useSkill(skill) {
    const command = formatSkillCommand(skill);
    if (!command) {
      showToast('无法识别该 Skill 的调用名称', 'error');
      return;
    }

    if (!insertPlainText(command)) {
      showToast('未找到当前页面的聊天输入框', 'error');
      return;
    }

    closeOverlayPanel();
  }

  function openFullSkillContent(skill) {
    if (!skill) return;
    const text = skill.fullContent || skill.rawContent || '无内容';
    const previewHtml = `<div class="claw-skill-preview-overlay">${escapeHtml(text)}</div>`;
    openCenterOverlay(escapeHtml(skill.name), previewHtml, {
      showBack: true,
      onBack: () => closeOverlayPanel()
    });
  }

  function bindFullContentButtons(container, resolveSkill) {
    container?.querySelectorAll('.claw-skill-btn-view-full').forEach(button => {
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        openFullSkillContent(resolveSkill(button));
      });
    });
  }

  function closeSkillDetailPage() {
    if (!isDetailPageOpen) return;
    const skillKey = expandedSkillKey;
    isDetailPageOpen = false;
    expandedSkillKey = null;
    detailPage.style.display = 'none';
    listPage.style.display = 'flex';
    if (panelTitle) panelTitle.textContent = listPageTitle;
    if (panelBody) panelBody.scrollTop = listScrollTop;
    const returnIndex = filteredSkills.findIndex(skill => getSkillApiName(skill) === skillKey);
    contentEl.querySelector(`.claw-skill-btn-detail[data-index="${returnIndex}"]`)?.focus({ preventScroll: true });
  }

  function openSkillDetailPage(skill, index) {
    if (!skill) return;
    const skillKey = getSkillApiName(skill);
    if (!isDetailPageOpen) {
      listScrollTop = panelBody?.scrollTop || 0;
    }

    const meta = [
      skill.version ? formatVersionLabel(skill.version) : '',
      skill.author || '',
      skill.modifiedAt ? formatDate(skill.modifiedAt) : '',
    ].filter(Boolean).join(' · ');

    detailPage.innerHTML = `
      <section class="claw-skill-detail-hero">
        <p class="claw-skill-detail-title">${escapeHtml(skill.name || skillKey)}</p>
        <code class="claw-skill-detail-command">/${escapeHtml(skillKey)}</code>
        <p class="claw-skill-detail-meta">${escapeHtml(meta || '暂无版本信息')}</p>
      </section>
      <section class="claw-skill-detail-sheet">
        ${renderDetail(skill, index)}
      </section>
    `;

    listPage.style.display = 'none';
    detailPage.style.display = 'flex';
    isDetailPageOpen = true;
    expandedSkillKey = skillKey;
    if (panelTitle) panelTitle.textContent = skill.name || 'Skill 详情';
    if (panelBody) panelBody.scrollTop = 0;
    detailPage.focus({ preventScroll: true });

    bindFullContentButtons(detailPage, () => skill);
    if (options.showVersionHistory) {
      loadSkillVersions(skill, detailPage.querySelector('.claw-skill-version-history'));
    }
  }

  panelBackButton?.addEventListener('click', (event) => {
    if (!isDetailPageOpen) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    closeSkillDetailPage();
  }, true);

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
      const version = skill.version ? formatVersionLabel(skill.version) : '';
      const author = skill.author || '';
      const metaParts = [
        version,
        author,
        formatDate(skill.modifiedAt),
        skill.contentUnavailable ? '正文待重试' : '',
      ].filter(Boolean);
      const meta = metaParts.join(' · ') || '-';

      const deleteBtnHtml = options.showDelete
        ? `<button type="button" class="claw-skill-btn-delete" data-index="${index}" aria-label="删除 ${escapeHtml(skill.name)}">
            ${getSkillIcon('trash', 13)}
            删除
          </button>`
        : '';

      const detailControlHtml = options.useOnCardClick
        ? `<button type="button" class="claw-skill-btn-detail" data-index="${index}">
            ${getSkillIcon('info', 13)}
            <span>详情</span>
          </button>`
        : getSkillIcon('chevronDown', 17, 'claw-skill-toggle-icon');

      const useHintHtml = options.useOnCardClick
        ? `<span class="claw-skill-use-hint">点击使用 ${getSkillIcon('chevronRight', 12)}</span>`
        : '';

      return `
        <div class="claw-skill-item" data-index="${index}">
          <div class="claw-skill-item-head">
            <div class="claw-skill-item-copy">
              <p class="claw-skill-item-title" title="${escapeHtml(skill.name)}">${escapeHtml(skill.name)}</p>
              <p class="claw-skill-item-desc">${escapeHtml(desc)}</p>
            </div>
          </div>
          <div class="claw-skill-item-footer">
            <p class="claw-skill-item-meta" title="${escapeHtml(meta)}">${escapeHtml(meta)}</p>
            <div class="claw-skill-item-actions">
              ${useHintHtml}
              ${deleteBtnHtml}
              ${detailControlHtml}
            </div>
          </div>
          ${options.useOnCardClick ? '' : `
            <div class="claw-skill-detail" style="display: none;">
              ${renderDetail(skill, index)}
            </div>
          `}
        </div>
      `;
    }).join('');

    contentEl.innerHTML = `
      <div class="claw-skill-items">
        ${itemsHtml}
      </div>
    `;

    function openSkillItem(item, skill) {
      const detail = item.querySelector('.claw-skill-detail');
      const icon = item.querySelector('.claw-skill-toggle-icon');
      if (!detail) return;

      contentEl.querySelectorAll('.claw-skill-detail').forEach(element => element.style.display = 'none');
      contentEl.querySelectorAll('.claw-skill-toggle-icon').forEach(element => element.style.transform = 'none');
      detail.style.display = 'block';
      if (icon) icon.style.transform = 'rotate(180deg)';
      expandedSkillKey = getSkillApiName(skill);

      if (options.showVersionHistory) {
        const versionContainer = detail.querySelector('.claw-skill-version-history');
        loadSkillVersions(skill, versionContainer);
      }
    }

    // 「我的 Skill」点击卡片直接使用；管理页继续沿用卡片展开详情。
    contentEl.querySelectorAll('.claw-skill-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        if (e.target.closest('.claw-skill-detail')) return;

        const index = Number(item.dataset.index);
        const skill = skills[index];
        if (!skill) return;

        if (options.useOnCardClick) {
          useSkill(skill);
          return;
        }

        const detail = item.querySelector('.claw-skill-detail');
        const icon = item.querySelector('.claw-skill-toggle-icon');
        if (!detail) return;

        const isOpen = detail.style.display === 'block';
        if (isOpen) {
          detail.style.display = 'none';
          if (icon) icon.style.transform = 'none';
          expandedSkillKey = null;
          return;
        }

        openSkillItem(item, skill);
      });
    });

    contentEl.querySelectorAll('.claw-skill-btn-detail').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const index = Number(btn.dataset.index);
        openSkillDetailPage(skills[index], index);
      });
    });

    // Bind delete buttons
    if (options.showDelete) {
      contentEl.querySelectorAll('.claw-skill-btn-delete').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const skill = skills[Number(btn.dataset.index)];
          const apiName = getSkillApiName(skill);
          const displayName = skill?.name || apiName;
          if (!apiName) return;
          const safeDelName = escapeHtml(displayName);
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
                await client.deleteSkill(apiName);
                showToast(`Skill「${displayName || '未命名'}」已删除`, 'success');
                skillCache = null;
                invalidateVersionCaches(apiName);
                await loadSkills({ force: true, preserveExisting: true });
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

    bindFullContentButtons(contentEl, button => skills[Number(button.dataset.index)]);

    if (expandedSkillKey) {
      const expandedIndex = skills.findIndex(skill => getSkillApiName(skill) === expandedSkillKey);
      const expandedItem = expandedIndex >= 0
        ? contentEl.querySelector(`.claw-skill-item[data-index="${expandedIndex}"]`)
        : null;
      if (expandedItem) {
        if (options.useOnCardClick) {
          openSkillDetailPage(skills[expandedIndex], expandedIndex);
        } else {
          openSkillItem(expandedItem, skills[expandedIndex]);
        }
      }
    }
  }

  function renderDetail(skill, index) {
    const descHtml = skill.description
      ? `<div class="claw-skill-detail-description">${escapeHtml(skill.description)}</div>`
      : `<div class="claw-skill-detail-empty">暂无描述</div>`;

    const previewText = skill.rawContent || skill.fullContent || '';
    const bodyPreview = previewText
      ? `<div class="claw-skill-code-preview">${escapeHtml(previewText)}</div>`
      : `<div class="claw-skill-detail-empty">暂无正文</div>`;

    const versionHistoryHtml = options.showVersionHistory
      ? `
        <div style="margin-top: 14px; padding-top: 12px; border-top: 1px solid #e5e7eb;">
          <p style="font-size: 12px; color: #374151; font-weight: 600; margin: 0 0 8px;">版本历史</p>
          <div class="claw-skill-version-history" data-index="${index}">
            <div style="padding: 10px; color: #9ca3af; font-size: 12px; background: #f9fafb; border-radius: 6px;">打开详情后加载版本历史</div>
          </div>
        </div>
      `
      : '';

    return `
      ${descHtml}
      ${bodyPreview}
      ${versionHistoryHtml}
      <div class="claw-skill-detail-footer">
        <span class="claw-skill-uri">${escapeHtml(skill.uri)}</span>
        <button type="button" class="claw-skill-btn-view-full" data-index="${index}">
          ${getSkillIcon('file', 13)}
          查看完整内容
        </button>
      </div>
    `;
  }

  function getFilteredSkills(skills, keyword) {
    if (!keyword.trim()) {
      return skills;
    }
    const normalizedKeyword = keyword.toLowerCase();
    return skills.filter(skill =>
      skill.name.toLowerCase().includes(normalizedKeyword) ||
      (skill.description && skill.description.toLowerCase().includes(normalizedKeyword))
    );
  }

  function filterSkills(keyword) {
    expandedSkillKey = null;
    filteredSkills = getFilteredSkills(allSkills, keyword);
    renderSkills(filteredSkills);
  }

  async function listSkillDirectories(client) {
    const lsResult = await client.fsLs(SKILL_ROOT_URI, {
      output: 'agent',
      absLimit: 128,
      showAllHidden: false,
    });
    console.log('[EchoMem:skill] fsLs result:', lsResult);
    const entries = Array.isArray(lsResult) ? lsResult : (lsResult?.entries || []);
    return entries.filter(entry => isDirectory(entry));
  }

  async function loadSkills(loadOptions = {}) {
    const force = loadOptions.force === true;
    const preserveExisting = loadOptions.preserveExisting === true;
    if (!force && skillCache !== null) {
      allSkills = skillCache;
      filteredSkills = getFilteredSkills(allSkills, searchInput?.value || '');
      loadingEl.style.display = 'none';
      contentEl.style.display = 'block';
      renderSkills(filteredSkills);
      return { ok: true, cached: true, partialCount: 0 };
    }

    const requestGeneration = ++loadGeneration;
    const previousSkills = allSkills;
    if (!preserveExisting || previousSkills.length === 0) {
      loadingEl.style.display = 'flex';
      contentEl.style.display = 'none';
    }

    try {
      const config = await getEchoMemConfig();
      const client = createClient(config);
      let entries = await listSkillDirectories(client);
      if (force && previousSkills.length > 0 && entries.length === 0) {
        entries = await listSkillDirectories(client);
      }
      if (requestGeneration !== loadGeneration) return { ok: false, stale: true };
      console.log('[EchoMem:skill] filtered entries:', entries);

      if (entries.length === 0) {
        allSkills = [];
        skillCache = allSkills;
        filteredSkills = [];
        loadingEl.style.display = 'none';
        contentEl.style.display = 'block';
        renderSkills([]);
        return { ok: true, partialCount: 0 };
      }

      const skills = await readSkillEntries(entries, uri => client.fsRead(uri), {
        skillRootUri: SKILL_ROOT_URI,
        concurrency: 6,
        onReadError: (error, dirName) => {
          console.warn(`Failed to read skill ${dirName}:`, error);
        },
      });
      if (requestGeneration !== loadGeneration) return { ok: false, stale: true };
      console.log('[EchoMem:skill] final skills:', skills.map(s => ({ name: s.name, dirName: s.dirName })));

      allSkills = skills;
      // Sort by modified time descending
      allSkills.sort((a, b) => {
        const ta = a.modifiedAt ? new Date(a.modifiedAt).getTime() : 0;
        const tb = b.modifiedAt ? new Date(b.modifiedAt).getTime() : 0;
        return tb - ta;
      });

      skillCache = allSkills;
      filteredSkills = getFilteredSkills(allSkills, searchInput?.value || '');

      loadingEl.style.display = 'none';
      contentEl.style.display = 'block';
      renderSkills(filteredSkills);
      const partialCount = allSkills.filter(skill => skill.contentUnavailable).length;
      if (partialCount > 0) {
        showToast(`${partialCount} 个 Skill 的正文暂时无法读取，已保留目录条目`, 'info');
      }
      return { ok: true, partialCount };
    } catch (err) {
      if (requestGeneration !== loadGeneration) return { ok: false, stale: true };
      if (preserveExisting && previousSkills.length > 0) {
        showToast(`刷新失败，已保留上次列表：${err.message}`, 'error');
        return { ok: false, preserved: true, error: err };
      }
      loadingEl.style.display = 'none';
      contentEl.style.display = 'block';
      contentEl.innerHTML = `
        <div class="claw-skill-state is-error" role="alert">
          <span class="claw-skill-state-icon">${getSkillIcon('alert', 22)}</span>
          <p class="claw-skill-state-title">加载失败</p>
          <p class="claw-skill-state-copy">${escapeHtml(err.message)}</p>
        </div>
      `;
      return { ok: false, error: err };
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
      if (refreshBtn.disabled) return;
      refreshBtn.disabled = true;
      refreshBtn.setAttribute('aria-busy', 'true');
      expandedSkillKey = null;
      invalidateVersionCaches();
      if (searchInput?.value) {
        searchInput.value = '';
        filteredSkills = allSkills;
        renderSkills(filteredSkills);
      }
      try {
        const result = await loadSkills({ force: true, preserveExisting: true });
        if (result.ok && result.partialCount === 0) {
          showToast('Skill 列表已刷新', 'success');
        }
      } finally {
        refreshBtn.disabled = false;
        refreshBtn.removeAttribute('aria-busy');
      }
    });
  }

  if (refreshBtn) {
    refreshBtn.disabled = true;
    refreshBtn.setAttribute('aria-busy', 'true');
  }
  try {
    await loadSkills();
  } finally {
    if (refreshBtn) {
      refreshBtn.disabled = false;
      refreshBtn.removeAttribute('aria-busy');
    }
  }
}
