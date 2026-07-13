// 记忆后端引擎连接配置面板
// 文档：docs/flows/backend-migration/实施计划.md

import {
  getEchoMemConfig,
  setEchoMemConfig,
  getOpenViewConfig,
  setOpenViewConfig,
} from '../../services/config.js';
import { showFloatingToast } from '../../services/toast.js';
import { createClient } from '../../services/echomem-client.js';
import { login, getOpenViewAuth } from '../../services/openview-client.js';
import { resetClient } from '../../core/input-tracker.js';
import { getCurrentPlatform } from '../../core/detection.js';

function isHigoPlatform() {
  const platform = getCurrentPlatform();
  return platform?.config?.id === 'higo' || platform?.key === 'higo';
}

export function getEchoMemConfigContent() {
  const showOpenView = isHigoPlatform();
  const openViewSection = showOpenView ? `
      <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #eee;">
        <div style="font-size: 14px; font-weight: 500; margin-bottom: 10px; color: #333;">EchoAgent 统计服务</div>
        <div style="padding: 10px 12px; background: #f6f8fa; border-radius: 6px; border-left: 3px solid #10b981; font-size: 12px; color: #666; margin-bottom: 12px;">
          用于获取用户会话 Token 统计汇总
        </div>

        <div style="margin-bottom: 10px;">
          <label style="display: block; font-size: 12px; margin-bottom: 4px; color: #888;">服务地址</label>
          <input id="cfg-openview-url" type="text"
            style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px; box-sizing: border-box;"
          />
        </div>

        <div style="margin-bottom: 10px;">
          <label style="display: block; font-size: 12px; margin-bottom: 4px; color: #888;">用户名</label>
          <input id="cfg-openview-username" type="text"
            style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px; box-sizing: border-box;"
          />
        </div>

        <div style="margin-bottom: 12px;">
          <label style="display: block; font-size: 12px; margin-bottom: 4px; color: #888;">密码</label>
          <input id="cfg-openview-password" type="password"
            style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px; box-sizing: border-box;"
          />
        </div>

        <button id="cfg-openview-login-btn" style="width: 100%; padding: 10px; background: #10b981; color: #fff; border: none; border-radius: 6px; font-size: 13px; cursor: pointer;"
        >🔑 登录 EchoAgent</button>
      </div>
  ` : '';

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

      ${openViewSection}
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
  const openviewUrlInput = bodyElement.querySelector('#cfg-openview-url');
  const openviewUsernameInput = bodyElement.querySelector('#cfg-openview-username');
  const openviewPasswordInput = bodyElement.querySelector('#cfg-openview-password');
  const openviewLoginBtn = bodyElement.querySelector('#cfg-openview-login-btn');

  function normalizeBaseUrl(url) {
    const trimmed = (url || '').trim();
    if (!trimmed) return 'http://127.0.0.1:8010';
    return trimmed.replace(/\/$/, '');
  }

  function normalizeOpenViewUrl(url) {
    const trimmed = (url || '').trim();
    if (!trimmed) return 'http://127.0.0.1:31020';
    return trimmed.replace(/\/$/, '');
  }

  const showOpenView = isHigoPlatform();

  // Load existing config
  try {
    const cfg = await getEchoMemConfig();
    if (baseUrlInput) baseUrlInput.value = cfg.baseUrl || '';
    if (authKeyInput) authKeyInput.value = cfg.authKey || '';
    if (agentIdInput) agentIdInput.value = cfg.agentId || '';

    if (showOpenView) {
      const openviewCfg = await getOpenViewConfig();
      if (openviewUrlInput) openviewUrlInput.value = openviewCfg.baseUrl || '';
      if (openviewUsernameInput) openviewUsernameInput.value = openviewCfg.username || '';
      if (openviewPasswordInput) openviewPasswordInput.value = openviewCfg.password || '';

      const openviewAuth = await getOpenViewAuth();
      if (openviewAuth?.user && openviewAuth?.csrfToken && openviewLoginBtn) {
        openviewLoginBtn.textContent = '✅ 已登录 EchoAgent';
      }
    }
  } catch (err) {
    console.warn('EchoMem: failed to load config', err);
  }

  // Test connection
  if (testBtn) {
    testBtn.addEventListener('click', async () => {
      showFloatingToast('正在测试连接...', 'info', 0);
      try {
        const config = {
          baseUrl: normalizeBaseUrl(baseUrlInput?.value),
          authKey: authKeyInput?.value?.trim() || '',
          agentId: agentIdInput?.value?.trim() || '',
        };
        const client = createClient(config);
        const ok = await client.healthCheck();
        if (ok) {
          showFloatingToast('连接成功', 'success');
        } else {
          showFloatingToast('连接失败：后端返回非 200 状态码', 'error');
        }
      } catch (err) {
        if (err.name === 'AbortError' || err.message?.includes('aborted')) {
          showFloatingToast('连接超时，请检查服务地址是否正确', 'error');
        } else if (err.message?.includes('Failed to fetch')) {
          showFloatingToast('无法连接到后端，请检查服务是否启动', 'error');
        } else {
          showFloatingToast(`连接失败: ${err.message}`, 'error');
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

        if (showOpenView) {
          const openviewConfig = {
            baseUrl: normalizeOpenViewUrl(openviewUrlInput?.value),
            username: openviewUsernameInput?.value?.trim() || '',
            password: openviewPasswordInput?.value || '',
          };
          await setOpenViewConfig(openviewConfig);
        }

        showFloatingToast('配置已保存', 'success');
      } catch (err) {
        showFloatingToast(`保存失败: ${err.message}`, 'error');
      }
    });
  }

  // Login OpenView
  if (showOpenView && openviewLoginBtn) {
    openviewLoginBtn.addEventListener('click', async () => {
      showFloatingToast('正在登录 EchoAgent...', 'info', 0);
      try {
        const openviewConfig = {
          baseUrl: normalizeOpenViewUrl(openviewUrlInput?.value),
          username: openviewUsernameInput?.value?.trim() || '',
          password: openviewPasswordInput?.value || '',
        };
        await setOpenViewConfig(openviewConfig);

        const auth = await login({
          baseUrl: openviewConfig.baseUrl,
          username: openviewConfig.username,
          password: openviewConfig.password,
        });

        openviewLoginBtn.textContent = '✅ 已登录 EchoAgent';
        showFloatingToast(`EchoAgent 登录成功: ${auth.user?.username || ''}`, 'success');
      } catch (err) {
        openviewLoginBtn.textContent = '🔑 登录 EchoAgent';
        showFloatingToast(`EchoAgent 登录失败: ${err.message}`, 'error');
      }
    });
  }
}
