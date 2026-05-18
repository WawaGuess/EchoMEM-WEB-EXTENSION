// OpenViking 连接配置面板

import {
  getOpenVikingConfig,
  setOpenVikingConfig,
} from '../../services/config.js';
import { createClient } from '../../services/openviking-client.js';
import { resetClient } from '../../core/input-tracker.js';

export function getOpenVikingConfigContent() {
  return `
    <div style="display: flex; flex-direction: column; gap: 14px; color: #333;">
      <div style="padding: 10px 12px; background: #f0f7ff; border-radius: 6px; border-left: 3px solid #667eea; font-size: 12px; color: #666;">
        💡 此配置同时影响资源管理、输入联想等功能
      </div>

      <div>
        <label style="display: block; font-size: 12px; margin-bottom: 4px; color: #888;">服务地址</label>
        <input id="cfg-base-url" type="text"
          style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px; box-sizing: border-box;"
        />
      </div>

      <div>
        <label style="display: block; font-size: 12px; margin-bottom: 4px; color: #888;">Agent ID</label>
        <input id="cfg-agent-id" type="text"
          style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px; box-sizing: border-box;"
        />
      </div>

      <div>
        <label style="display: flex; align-items: center; gap: 8px; font-size: 13px; color: #333; cursor: pointer;">
          <input id="cfg-auth-enabled" type="checkbox" style="cursor: pointer;" />
          <span>启用认证模式（API Key / Account / User）</span>
        </label>
      </div>

      <div id="cfg-auth-fields" style="display: none; display: flex; flex-direction: column; gap: 10px;">
        <div>
          <label style="display: block; font-size: 12px; margin-bottom: 4px; color: #888;">API Key</label>
          <input id="cfg-api-key" type="password"
            style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px; box-sizing: border-box;"
          />
        </div>
        <div>
          <label style="display: block; font-size: 12px; margin-bottom: 4px; color: #888;">Account ID</label>
          <input id="cfg-account-id" type="text"
            style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px; box-sizing: border-box;"
          />
        </div>
        <div>
          <label style="display: block; font-size: 12px; margin-bottom: 4px; color: #888;">User ID</label>
          <input id="cfg-user-id" type="text"
            style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px; box-sizing: border-box;"
          />
        </div>
      </div>

      <div style="display: flex; gap: 10px; margin-top: 4px;">
        <button id="cfg-test-btn" style="flex: 1; padding: 10px; background: #f0f7ff; color: #667eea; border: 1px solid #c7d8f5; border-radius: 6px; font-size: 13px; cursor: pointer;"
        >🔄 测试连接</button>
        <button id="cfg-save-btn" style="flex: 1; padding: 10px; background: #667eea; color: #fff; border: none; border-radius: 6px; font-size: 13px; cursor: pointer;"
        >💾 保存配置</button>
      </div>

      <div id="cfg-status" style="display: none; padding: 10px 12px; border-radius: 6px; font-size: 13px;"></div>
    </div>
  `;
}

export async function initConfigPanel(bodyElement) {
  if (!bodyElement) return;

  const baseUrlInput = bodyElement.querySelector('#cfg-base-url');
  const agentIdInput = bodyElement.querySelector('#cfg-agent-id');
  const authCheckbox = bodyElement.querySelector('#cfg-auth-enabled');
  const authFields = bodyElement.querySelector('#cfg-auth-fields');
  const apiKeyInput = bodyElement.querySelector('#cfg-api-key');
  const accountIdInput = bodyElement.querySelector('#cfg-account-id');
  const userIdInput = bodyElement.querySelector('#cfg-user-id');
  const testBtn = bodyElement.querySelector('#cfg-test-btn');
  const saveBtn = bodyElement.querySelector('#cfg-save-btn');
  const statusEl = bodyElement.querySelector('#cfg-status');

  function showStatus(msg, type = 'info') {
    if (!statusEl) return;
    statusEl.style.display = 'block';
    const colors = {
      info: { bg: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8' },
      success: { bg: '#f0fdf4', border: '#bbf7d0', text: '#15803d' },
      error: { bg: '#fef2f2', border: '#fecaca', text: '#b91c1c' }
    };
    const c = colors[type] || colors.info;
    statusEl.style.background = c.bg;
    statusEl.style.border = `1px solid ${c.border}`;
    statusEl.style.color = c.text;
    statusEl.textContent = msg;
  }

  // Load existing config
  try {
    const cfg = await getOpenVikingConfig();
    if (baseUrlInput) baseUrlInput.value = cfg.baseUrl || '';
    if (agentIdInput) agentIdInput.value = cfg.agentId || '';
    if (authCheckbox) authCheckbox.checked = cfg.authEnabled || false;
    if (apiKeyInput) apiKeyInput.value = cfg.apiKey || '';
    if (accountIdInput) accountIdInput.value = cfg.accountId || '';
    if (userIdInput) userIdInput.value = cfg.userId || '';
    if (authFields) authFields.style.display = cfg.authEnabled ? 'flex' : 'none';
  } catch (err) {
    console.warn('EchoMem: failed to load config', err);
  }

  // Auth toggle
  if (authCheckbox && authFields) {
    authCheckbox.addEventListener('change', () => {
      authFields.style.display = authCheckbox.checked ? 'flex' : 'none';
    });
  }

  // Test connection
  if (testBtn) {
    testBtn.addEventListener('click', async () => {
      showStatus('正在测试连接...', 'info');
      try {
        const config = {
          baseUrl: baseUrlInput?.value?.trim() || 'http://127.0.0.1:1933',
          agentId: agentIdInput?.value?.trim() || 'echomem-extension',
          authEnabled: authCheckbox?.checked || false,
          apiKey: apiKeyInput?.value?.trim() || '',
          accountId: accountIdInput?.value?.trim() || 'default',
          userId: userIdInput?.value?.trim() || 'default',
        };
        const client = createClient(config);
        const ok = await client.healthCheck();
        if (ok) {
          showStatus('✅ 连接成功', 'success');
        } else {
          showStatus('❌ 连接失败：后端返回非 200 状态码', 'error');
        }
      } catch (err) {
        if (err.name === 'AbortError' || err.message?.includes('aborted')) {
          showStatus('❌ 连接超时，请检查服务地址是否正确', 'error');
        } else if (err.message?.includes('Failed to fetch')) {
          showStatus('❌ 无法连接到后端，请检查服务是否启动', 'error');
        } else {
          showStatus(`❌ 连接失败: ${err.message}`, 'error');
        }
      }
    });
  }

  // Save config
  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      const config = {
        baseUrl: baseUrlInput?.value?.trim() || 'http://127.0.0.1:1933',
        agentId: agentIdInput?.value?.trim() || 'echomem-extension',
        authEnabled: authCheckbox?.checked || false,
        apiKey: apiKeyInput?.value?.trim() || '',
        accountId: accountIdInput?.value?.trim() || 'default',
        userId: userIdInput?.value?.trim() || 'default',
      };
      try {
        await setOpenVikingConfig(config);
        resetClient();
        showStatus('✅ 配置已保存', 'success');
      } catch (err) {
        showStatus(`❌ 保存失败: ${err.message}`, 'error');
      }
    });
  }
}
