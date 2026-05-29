// 输入联想面板内容

import { getAssociationEnabled, toggleAssociationEnabled } from '../../core/state.js';
import {
  getCompletionConfig,
  setCompletionConfig,
} from '../../services/config.js';

export function getInputAssociationContent() {
  const inputAssociationEnabled = getAssociationEnabled();
  const btnText = inputAssociationEnabled ? '关闭联想' : '确认开启';
  const btnBg = inputAssociationEnabled ? '#ffebee' : '#667eea';
  const btnColor = inputAssociationEnabled ? '#c62828' : '#fff';
  const statusText = inputAssociationEnabled ? '✅ 输入联想已开启' : '❌ 输入联想未开启';
  const statusColor = inputAssociationEnabled ? '#2e7d32' : '#888';

  return `
    <div style="color: #666;">
      <div style="margin-bottom: 20px;">
        <button id="claw-toggle-association" style="
          width: 100%;
          padding: 12px;
          background: ${btnBg};
          color: ${btnColor};
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        "
        >${btnText}</button>
      </div>
      <div style="
        padding: 12px;
        background: #f8f9fa;
        border-radius: 8px;
        margin-bottom: 20px;
        text-align: center;
      ">
        <p id="claw-association-status" style="
          margin: 0;
          font-size: 14px;
          font-weight: 500;
          color: ${statusColor};
        ">${statusText}</p>
      </div>
      <div style="margin-bottom: 16px;">
        <p style="font-weight: 600; color: #333; margin-bottom: 10px; font-size: 14px;">💡 功能说明</p>
        <ul style="font-size: 13px; color: #666; padding-left: 18px; line-height: 1.8; margin: 0;">
          <li>历史记忆召回：根据输入实时召回记忆后端引擎中的相关记忆</li>
          <li>语义搜索：支持近义词和语义相关内容的召回</li>
          <li>点击插入：点击建议快速插入到输入框</li>
        </ul>
      </div>
      <div id="echomem-ov-config" style="display: none;">
        <p style="font-weight: 600; color: #333; margin-bottom: 10px; font-size: 14px;">🧠 补全算法配置</p>
        <div style="margin-bottom: 10px;">
          <label style="display: block; font-size: 12px; margin-bottom: 4px; color: #888;">
            短语过滤阈值
            <span style="color: #bbb; font-size: 11px;">（越小显示越多，越大越严格）</span>
          </label>
          <div style="display: flex; align-items: center; gap: 10px;">
            <input id="completion-threshold" type="range" min="0.2" max="0.8" step="0.01" value="0.2"
              style="flex: 1; cursor: pointer;"
            />
            <input id="completion-threshold-number" type="number" min="0.2" max="0.8" step="0.01" value="0.2"
              style="width: 60px; padding: 6px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px; text-align: center;"
            />
          </div>
        </div>

        <button id="ov-save-config" style="
          width: 100%;
          padding: 10px;
          background: #667eea;
          color: #fff;
          border: none;
          border-radius: 6px;
          font-size: 13px;
          cursor: pointer;
        ">保存配置</button>
      </div>
      <div style="margin-top: 12px; text-align: center;">
        <a id="echomem-toggle-config" href="#" style="font-size: 12px; color: #667eea; text-decoration: none;">显示高级配置</a>
      </div>
      <div style="
        padding: 12px;
        background: #f0f7ff;
        border-radius: 6px;
        font-size: 13px;
        border-left: 3px solid #667eea;
        color: #666;
        margin-top: 12px;
      ">
        💡 提示：输入时自动召回相关记忆，点击建议即可插入
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
      await setCompletionConfig({ phraseScoreThreshold });
      alert('配置已保存');
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
