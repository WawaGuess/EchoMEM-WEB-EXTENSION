// 输入联想面板内容

import { getAssociationEnabled, toggleAssociationEnabled } from '../../core/state.js';
import {
  getOpenVikingConfig,
  setOpenVikingConfig,
  getCompletionConfig,
  setCompletionConfig,
} from '../../services/config.js';
import { resetClient } from '../../core/input-tracker.js';

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
          <li>历史记忆召回：根据输入实时召回 OpenViking 中的相关记忆</li>
          <li>语义搜索：支持近义词和语义相关内容的召回</li>
          <li>点击插入：点击建议快速插入到输入框</li>
        </ul>
      </div>
      <div id="echomem-ov-config" style="display: none;">
        <p style="font-weight: 600; color: #333; margin-bottom: 10px; font-size: 14px;">⚙️ OpenViking 配置</p>
        <div style="margin-bottom: 10px;">
          <label style="display: block; font-size: 12px; margin-bottom: 4px; color: #888;">服务地址</label>
          <input id="ov-base-url" type="text" value="http://127.0.0.1:1933"
            style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px; box-sizing: border-box;"
          />
        </div>
        <div style="margin-bottom: 10px;">
          <label style="display: block; font-size: 12px; margin-bottom: 4px; color: #888;">Agent ID</label>
          <input id="ov-agent-id" type="text" value="echomem-extension"
            style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px; box-sizing: border-box;"
          />
        </div>
        <div style="margin-bottom: 10px;">
          <label style="display: flex; align-items: center; gap: 8px; font-size: 13px; color: #333; cursor: pointer;">
            <input id="ov-auth-enabled" type="checkbox" style="cursor: pointer;"
            />
            <span>启用认证模式（API Key / Account / User）</span>
          </label>
        </div>
        <div id="ov-auth-fields" style="display: none;">
          <div style="margin-bottom: 10px;">
            <label style="display: block; font-size: 12px; margin-bottom: 4px; color: #888;">API Key</label>
            <input id="ov-api-key" type="password" value=""
              style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px; box-sizing: border-box;"
            />
          </div>
          <div style="margin-bottom: 10px;">
            <label style="display: block; font-size: 12px; margin-bottom: 4px; color: #888;">Account</label>
            <input id="ov-account-id" type="text" value="default"
              style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px; box-sizing: border-box;"
            />
          </div>
          <div style="margin-bottom: 10px;">
            <label style="display: block; font-size: 12px; margin-bottom: 4px; color: #888;">User</label>
            <input id="ov-user-id" type="text" value="default"
              style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px; box-sizing: border-box;"
            />
          </div>
        </div>

        <p style="font-weight: 600; color: #333; margin: 16px 0 10px; font-size: 14px;">🧠 补全算法配置</p>
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

  // 认证开关：控制认证字段显示/隐藏
  const authCheckbox = document.getElementById('ov-auth-enabled');
  const authFields = document.getElementById('ov-auth-fields');
  if (authCheckbox && authFields && !authCheckbox.dataset.bound) {
    authCheckbox.dataset.bound = 'true';
    authCheckbox.addEventListener('change', () => {
      authFields.style.display = authCheckbox.checked ? 'block' : 'none';
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
      const baseUrl = document.getElementById('ov-base-url')?.value?.trim();
      const agentId = document.getElementById('ov-agent-id')?.value?.trim();
      const authEnabled = document.getElementById('ov-auth-enabled')?.checked || false;
      const apiKey = document.getElementById('ov-api-key')?.value?.trim();
      const accountId = document.getElementById('ov-account-id')?.value?.trim();
      const userId = document.getElementById('ov-user-id')?.value?.trim();
      const phraseScoreThreshold = parseFloat(document.getElementById('completion-threshold')?.value || '0.2');
      await setOpenVikingConfig({ baseUrl, agentId, authEnabled, apiKey, accountId, userId });
      await setCompletionConfig({ phraseScoreThreshold });
      resetClient();
      alert('配置已保存');
    });
  }
}

export async function loadConfigValues() {
  const ovConfig = await getOpenVikingConfig();
  const completionConfig = await getCompletionConfig();

  const baseUrlInput = document.getElementById('ov-base-url');
  const apiKeyInput = document.getElementById('ov-api-key');
  const agentIdInput = document.getElementById('ov-agent-id');
  const accountIdInput = document.getElementById('ov-account-id');
  const userIdInput = document.getElementById('ov-user-id');
  const authCheckbox = document.getElementById('ov-auth-enabled');
  const authFields = document.getElementById('ov-auth-fields');
  const thresholdInput = document.getElementById('completion-threshold');
  const thresholdNumber = document.getElementById('completion-threshold-number');

  if (baseUrlInput) baseUrlInput.value = ovConfig.baseUrl;
  if (apiKeyInput) apiKeyInput.value = ovConfig.apiKey;
  if (agentIdInput) agentIdInput.value = ovConfig.agentId;
  if (accountIdInput) accountIdInput.value = ovConfig.accountId;
  if (userIdInput) userIdInput.value = ovConfig.userId;
  if (authCheckbox) authCheckbox.checked = ovConfig.authEnabled;
  if (authFields) authFields.style.display = ovConfig.authEnabled ? 'block' : 'none';
  if (thresholdInput) thresholdInput.value = completionConfig.phraseScoreThreshold;
  if (thresholdNumber) thresholdNumber.value = completionConfig.phraseScoreThreshold;
}
