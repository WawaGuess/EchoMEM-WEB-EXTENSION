// 输入联想面板内容

import { getAssociationEnabled, toggleAssociationEnabled } from '../../core/state.js';
import {
  getCompletionConfig,
  setCompletionConfig,
} from '../../services/config.js';
import { showFloatingToast } from '../../services/toast.js';

export function getInputAssociationContent() {
  const inputAssociationEnabled = getAssociationEnabled();
  const btnText = inputAssociationEnabled ? '关闭联想' : '确认开启';
  const btnBg = inputAssociationEnabled ? '#F9DEDC' : '#6750A4';
  const btnColor = inputAssociationEnabled ? '#B3261E' : '#FFFFFF';
  const statusText = inputAssociationEnabled ? '✅ 输入联想已开启' : '❌ 输入联想未开启';
  const statusColor = inputAssociationEnabled ? '#1B5E20' : '#625B71';
  const statusBg = inputAssociationEnabled ? '#E8F5E9' : '#F3EDF7';
  const statusBorder = inputAssociationEnabled ? '#B7DDB9' : '#E7E0EC';

  return `
    <style>
      .echomem-association {
        color: #1D1B20;
        display: flex;
        flex-direction: column;
        gap: 12px;
        font-family: Roboto, "Noto Sans SC", sans-serif;
      }
      .echomem-association, .echomem-association * { box-sizing: border-box; }
      .echomem-association .association-action,
      .echomem-association .association-card,
      .echomem-association .association-config {
        border: 1px solid #E7E0EC;
        border-radius: 16px;
        background: #FFFFFF;
      }
      .echomem-association .association-action { padding: 14px; }
      .echomem-association .association-status {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 42px;
        padding: 10px 12px;
        border: 1px solid ${statusBorder};
        border-radius: 12px;
        background: ${statusBg};
        text-align: center;
      }
      .echomem-association .association-toggle,
      .echomem-association .association-primary-button {
        min-height: 42px;
        border-radius: 999px;
        font-family: inherit;
        letter-spacing: 0.01em;
        transition: transform 0.16s ease, box-shadow 0.16s ease, filter 0.16s ease;
      }
      .echomem-association .association-toggle:hover,
      .echomem-association .association-primary-button:hover {
        filter: brightness(0.97);
        box-shadow: 0 4px 12px rgba(103, 80, 164, 0.18);
      }
      .echomem-association button:active { transform: scale(0.985); }
      .echomem-association button:focus-visible,
      .echomem-association a:focus-visible,
      .echomem-association input:focus-visible {
        outline: 3px solid rgba(103, 80, 164, 0.22);
        outline-offset: 2px;
      }
      .echomem-association .association-card { padding: 15px 16px; }
      .echomem-association .association-heading {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 0 0 10px;
        color: #1D1B20;
        font-size: 14px;
        font-weight: 600;
        line-height: 1.45;
      }
      .echomem-association .association-heading-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        border-radius: 10px;
        background: #F3EDF7;
        color: #6750A4;
        flex: 0 0 auto;
      }
      .echomem-association .association-feature-list {
        list-style: none;
        margin: 0;
        padding: 0;
        color: #49454F;
        font-size: 12px;
        line-height: 1.65;
      }
      .echomem-association .association-feature-list li {
        position: relative;
        padding: 7px 0 7px 18px;
        border-top: 1px solid #F1ECF4;
      }
      .echomem-association .association-feature-list li:first-child {
        padding-top: 2px;
        border-top: 0;
      }
      .echomem-association .association-feature-list li::before {
        content: '';
        position: absolute;
        top: 14px;
        left: 2px;
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: #6750A4;
      }
      .echomem-association .association-feature-list li:first-child::before { top: 9px; }
      .echomem-association .association-config {
        padding: 15px 16px;
        background: #FEF7FF;
      }
      .echomem-association .association-label {
        display: block;
        margin-bottom: 8px;
        color: #49454F;
        font-size: 12px;
        font-weight: 500;
        line-height: 1.5;
      }
      .echomem-association .association-label span {
        display: block;
        margin-top: 2px;
        color: #79747E;
        font-size: 11px;
        font-weight: 400;
      }
      .echomem-association .association-range { accent-color: #6750A4; }
      .echomem-association .association-number {
        width: 68px;
        min-height: 36px;
        padding: 6px 8px;
        border: 1px solid #CAC4D0;
        border-radius: 10px;
        background: #FFFFFF;
        color: #1D1B20;
        font-family: inherit;
        font-size: 13px;
        font-weight: 500;
        line-height: 1.4;
        text-align: center;
      }
      .echomem-association .association-number:hover { border-color: #79747E; }
      .echomem-association .association-config-toggle {
        display: inline-flex;
        align-items: center;
        min-height: 32px;
        padding: 0 12px;
        border-radius: 999px;
        color: #6750A4;
        font-size: 12px;
        font-weight: 600;
        text-decoration: none;
      }
      .echomem-association .association-config-toggle:hover { background: #F3EDF7; }
      .echomem-association .association-tip {
        padding: 12px 14px;
        border: 1px solid #E7E0EC;
        border-radius: 14px;
        background: #F3EDF7;
        color: #49454F;
        font-size: 12px;
        line-height: 1.6;
      }
      @media (max-width: 360px) {
        .echomem-association .association-action,
        .echomem-association .association-card,
        .echomem-association .association-config { padding: 13px; }
        .echomem-association .association-threshold-row { gap: 8px !important; }
        .echomem-association .association-number { width: 62px; }
      }
      @media (prefers-reduced-motion: reduce) {
        .echomem-association button { transition: none !important; }
      }
    </style>
    <div class="echomem-association">
      <div class="association-action">
        <div class="association-status">
          <p id="claw-association-status" style="
            margin: 0;
            color: ${statusColor};
            font-size: 13px;
            font-weight: 600;
            line-height: 1.5;
          ">${statusText}</p>
        </div>
        <button id="claw-toggle-association" class="association-toggle" style="
          width: 100%;
          margin-top: 10px;
          padding: 10px 18px;
          background: ${btnBg};
          color: ${btnColor};
          border: 1px solid ${inputAssociationEnabled ? '#F2B8B5' : '#6750A4'};
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
        "
        >${btnText}</button>
      </div>

      <div class="association-card">
        <p class="association-heading">
          <span class="association-heading-icon" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6M10 22h4M8.4 15.5A7 7 0 1 1 15.6 15.5C14.6 16.2 14 17 14 18h-4c0-1-.6-1.8-1.6-2.5Z"/></svg>
          </span>
          功能说明
        </p>
        <ul class="association-feature-list">
          <li>历史记忆召回：根据输入实时召回记忆后端引擎中的相关记忆</li>
          <li>语义搜索：支持近义词和语义相关内容的召回</li>
          <li>点击插入：点击建议快速插入到输入框</li>
        </ul>
      </div>

      <div id="echomem-ov-config" class="association-config" style="display: none;">
        <p class="association-heading">
          <span class="association-heading-icon" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21h-4v-.09A1.7 1.7 0 0 0 8.6 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3v-4h.09A1.7 1.7 0 0 0 4.6 8.6a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3h4v.09A1.7 1.7 0 0 0 15.4 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.14.36.35.7.6 1 .3.28.7.42 1.1.4H21v4h-.09A1.7 1.7 0 0 0 19.4 15Z"/></svg>
          </span>
          补全算法配置
        </p>
        <div style="margin-bottom: 12px;">
          <label class="association-label">
            短语过滤阈值
            <span>越小显示越多，越大越严格</span>
          </label>
          <div class="association-threshold-row" style="display: flex; align-items: center; gap: 12px;">
            <input id="completion-threshold" class="association-range" type="range" min="0.2" max="0.8" step="0.01" value="0.2"
              style="flex: 1; cursor: pointer;"
            />
            <input id="completion-threshold-number" class="association-number" type="number" min="0.2" max="0.8" step="0.01" value="0.2" />
          </div>
        </div>

        <button id="ov-save-config" class="association-primary-button" style="
          width: 100%;
          padding: 10px 18px;
          background: #6750A4;
          color: #FFFFFF;
          border: none;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
        ">保存配置</button>
      </div>

      <div style="text-align: center;">
        <a id="echomem-toggle-config" class="association-config-toggle" href="#">显示高级配置</a>
      </div>

      <div class="association-tip">
        <strong style="color: #6750A4; font-weight: 600;">使用提示</strong>：输入时会自动召回相关记忆，点击建议即可插入。
      </div>
    </div>
  `;
}

export function toggleInputAssociation() {
  return toggleAssociationEnabled();
}

export function getAssociationStatus() {
  return getAssociationEnabled();
}

export function bindToggleButton(callback) {
  const toggleBtn = document.getElementById('claw-toggle-association');
  if (toggleBtn && !toggleBtn.dataset.clawBound) {
    toggleBtn.dataset.clawBound = 'true';
    toggleBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (callback) callback();
    });
  }
}

export function bindConfigUI() {
  // 切换配置显示
  const toggleLink = document.getElementById('echomem-toggle-config');
  const configDiv = document.getElementById('echomem-ov-config');
  if (toggleLink && configDiv && !toggleLink.dataset.bound) {
    toggleLink.dataset.bound = 'true';
    toggleLink.addEventListener('click', (e) => {
      e.preventDefault();
      const isHidden = configDiv.style.display === 'none';
      configDiv.style.display = isHidden ? 'block' : 'none';
      toggleLink.textContent = isHidden ? '隐藏高级配置' : '显示高级配置';
    });
  }

  // 阈值滑块与数字输入框双向同步
  const thresholdInput = document.getElementById('completion-threshold');
  const thresholdNumber = document.getElementById('completion-threshold-number');
  if (thresholdInput && thresholdNumber && !thresholdInput.dataset.bound) {
    thresholdInput.dataset.bound = 'true';
    thresholdInput.addEventListener('input', () => {
      thresholdNumber.value = thresholdInput.value;
    });
    thresholdNumber.addEventListener('input', () => {
      let val = parseFloat(thresholdNumber.value);
      if (isNaN(val)) return;
      if (val < 0.2) val = 0.2;
      if (val > 0.8) val = 0.8;
      thresholdInput.value = val;
    });
  }

  // 保存配置
  const saveBtn = document.getElementById('ov-save-config');
  if (saveBtn && !saveBtn.dataset.bound) {
    saveBtn.dataset.bound = 'true';
    saveBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const phraseScoreThreshold = parseFloat(document.getElementById('completion-threshold')?.value || '0.2');
      try {
        await setCompletionConfig({ phraseScoreThreshold });
        showFloatingToast('配置已保存', 'success');
      } catch (err) {
        showFloatingToast(`保存失败: ${err.message}`, 'error');
      }
    });
  }
}

export async function loadConfigValues() {
  const completionConfig = await getCompletionConfig();

  const thresholdInput = document.getElementById('completion-threshold');
  const thresholdNumber = document.getElementById('completion-threshold-number');

  if (thresholdInput) thresholdInput.value = completionConfig.phraseScoreThreshold;
  if (thresholdNumber) thresholdNumber.value = completionConfig.phraseScoreThreshold;
}
