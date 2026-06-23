// 记忆后端引擎连接配置面板
// 文档：docs/flows/backend-migration/实施计划.md

import {
  getEchoMemConfig,
  setEchoMemConfig,
} from '../../services/config.js';
import { createClient } from '../../services/echomem-client.js';
import { resetClient } from '../../core/input-tracker.js';

export function getEchoMemConfigContent() {
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
        <label style="display: block; font-size: 12px; margin-bottom: 4px; color: #888;">认证密钥</label>
        <input id="cfg-auth-key" type="password"
          style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px; box-sizing: border-box;"
        />
      </div>

      <div>
        <label style="display: block; font-size: 12px; margin-bottom: 4px; color: #888;">Agent ID（留空使用平台默认值）</label>
        <input id="cfg-agent-id" type="text"
          style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px; box-sizing: border-box;"
        />
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
  const authKeyInput = bodyElement.querySelector('#cfg-auth-key');
  const agentIdInput = bodyElement.querySelector('#cfg-agent-id');
  const testBtn = bodyElement.querySelector('#cfg-test-btn');
  const saveBtn = bodyElement.querySelector('#cfg-save-btn');
  const statusEl = bodyElement.querySelector('#cfg-status');

  function normalizeBaseUrl(url) {
    const trimmed = (url || '').trim();
    if (!trimmed) return 'http://127.0.0.1:8010';
    return trimmed.replace(/\/$/, '');
  }

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
    const cfg = await getEchoMemConfig();
    if (baseUrlInput) baseUrlInput.value = cfg.baseUrl || '';
    if (authKeyInput) authKeyInput.value = cfg.authKey || '';
    if (agentIdInput) agentIdInput.value = cfg.agentId || '';
  } catch (err) {
    console.warn('EchoMem: failed to load config', err);
  }

  // Test connection
  if (testBtn) {
    testBtn.addEventListener('click', async () => {
      showStatus('正在测试连接...', 'info');
      try {
        const config = {
          baseUrl: normalizeBaseUrl(baseUrlInput?.value),
          authKey: authKeyInput?.value?.trim() || '',
          agentId: agentIdInput?.value?.trim() || '',
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
        baseUrl: normalizeBaseUrl(baseUrlInput?.value),
        authKey: authKeyInput?.value?.trim() || '',
        agentId: agentIdInput?.value?.trim() || '',
      };
      try {
        await setEchoMemConfig(config);
        resetClient();
        showStatus('✅ 配置已保存', 'success');
      } catch (err) {
        showStatus(`❌ 保存失败: ${err.message}`, 'error');
      }
    });
  }
}
