// 记忆后端引擎连接配置面板
// 文档：docs/flows/backend-migration/实施计划.md

import {
  getEchoMemConfig,
  setEchoMemConfig,
  getOpenViewConfig,
  setOpenViewConfig,
} from '../../services/config.js';
import { createClient } from '../../services/echomem-client.js';
import { login, getOpenViewAuth } from '../../services/openview-client.js';
import { resetClient } from '../../core/input-tracker.js';
import { getCurrentPlatform } from '../../core/detection.js';
import {
  DEFAULT_ECHOMEM_BASE_URL,
  DEPLOYMENT_PROFILE_LABEL,
} from '../../config/deployment.js';
import {
  getConfigSaveErrorFeedback,
  getConfigStatusMarkup,
  getConfigStatusStyles,
  getConnectionTestErrorFeedback,
  getEchoAgentLoginErrorFeedback,
  updateConfigActionFeedback,
} from '../config-feedback.js';

function isHigoPlatform() {
  const platform = getCurrentPlatform();
  return platform?.config?.id === 'higo' || platform?.key === 'higo';
}

export function getEchoMemConfigContent() {
  const showOpenView = isHigoPlatform();
  const deploymentNotice = DEFAULT_ECHOMEM_BASE_URL
    ? `当前为${DEPLOYMENT_PROFILE_LABEL}，已预置对应服务地址。`
    : `当前为${DEPLOYMENT_PROFILE_LABEL}，请填写服务地址。`;
  const openViewSection = showOpenView ? `
      <div class="config-card config-service-card">
        <div class="config-card-heading">
          <span class="config-card-icon config-card-icon-secondary" aria-hidden="true">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/></svg>
          </span>
          <div>
            <p>EchoAgent 连接</p>
            <span>当前用于 HIGO 会话身份认证</span>
          </div>
        </div>

        <div class="config-field">
          <label for="cfg-openview-url">服务地址</label>
          <input id="cfg-openview-url" class="config-input" type="text" />
        </div>

        <div class="config-field">
          <label for="cfg-openview-username">用户名</label>
          <input id="cfg-openview-username" class="config-input" type="text" />
        </div>

        <div class="config-field">
          <label for="cfg-openview-password">密码</label>
          <input id="cfg-openview-password" class="config-input" type="password" />
        </div>

        <button id="cfg-openview-login-btn" class="config-button config-button-secondary" style="width: 100%;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="10" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          <span id="cfg-openview-login-btn-label">登录 EchoAgent</span>
        </button>

        ${getConfigStatusMarkup('cfg-openview')}
      </div>
  ` : '';

  return `
    <style>
      .echomem-config-root {
        display: flex;
        flex-direction: column;
        gap: 12px;
        color: #1D1B20;
        font-family: Roboto, "Noto Sans SC", sans-serif;
      }
      .echomem-config-root, .echomem-config-root * { box-sizing: border-box; }
      .echomem-config-root .config-note {
        display: flex;
        align-items: flex-start;
        gap: 9px;
        padding: 12px 14px;
        border: 1px solid #E7E0EC;
        border-radius: 14px;
        background: #F3EDF7;
        color: #49454F;
        font-size: 12px;
        line-height: 1.55;
      }
      .echomem-config-root .config-note svg {
        margin-top: 1px;
        color: #6750A4;
        flex: 0 0 auto;
      }
      .echomem-config-root .config-card {
        padding: 16px;
        border: 1px solid #E7E0EC;
        border-radius: 18px;
        background: #FFFFFF;
        box-shadow: 0 1px 2px rgba(29, 27, 32, 0.04);
      }
      .echomem-config-root .config-service-card { background: #FEF7FF; }
      .echomem-config-root .config-card-heading {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 14px;
      }
      .echomem-config-root .config-card-heading p {
        margin: 0;
        color: #1D1B20;
        font-size: 14px;
        font-weight: 600;
        line-height: 1.4;
      }
      .echomem-config-root .config-card-heading span:not(.config-card-icon) {
        display: block;
        margin-top: 2px;
        color: #79747E;
        font-size: 11px;
        line-height: 1.4;
      }
      .echomem-config-root .config-card-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 36px;
        border-radius: 12px;
        background: #EADDFF;
        color: #6750A4;
        flex: 0 0 auto;
      }
      .echomem-config-root .config-card-icon-secondary {
        background: #E8DEF8;
        color: #625B71;
      }
      .echomem-config-root .config-field { margin-bottom: 12px; }
      .echomem-config-root .config-field label {
        display: block;
        margin: 0 0 6px;
        color: #49454F;
        font-size: 12px;
        font-weight: 500;
        line-height: 1.4;
      }
      .echomem-config-root .config-input {
        width: 100%;
        min-height: 42px;
        padding: 9px 12px;
        border: 1px solid #CAC4D0;
        border-radius: 12px;
        background: #FFFBFE;
        color: #1D1B20;
        font-family: inherit;
        font-size: 13px;
        font-weight: 400;
        line-height: 1.45;
        transition: border-color 0.16s ease, box-shadow 0.16s ease, background 0.16s ease;
      }
      .echomem-config-root .config-input:hover { border-color: #79747E; }
      .echomem-config-root .config-input:focus {
        border-color: #6750A4;
        background: #FFFFFF;
        box-shadow: 0 0 0 3px rgba(103, 80, 164, 0.14);
        outline: none;
      }
      .echomem-config-root .config-actions {
        display: flex;
        gap: 10px;
        margin-top: 4px;
      }
      .echomem-config-root .config-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 7px;
        min-height: 42px;
        padding: 10px 16px;
        border-radius: 999px;
        font-family: inherit;
        font-size: 13px;
        font-weight: 600;
        line-height: 1.3;
        cursor: pointer;
        transition: transform 0.16s ease, box-shadow 0.16s ease, filter 0.16s ease;
      }
      .echomem-config-root .config-button-primary {
        border: 1px solid #6750A4;
        background: #6750A4;
        color: #FFFFFF;
      }
      .echomem-config-root .config-button-tonal {
        border: 1px solid #E0D4F1;
        background: #F3EDF7;
        color: #6750A4;
      }
      .echomem-config-root .config-button-secondary {
        border: 1px solid #D8CCE7;
        background: #E8DEF8;
        color: #1D192B;
      }
      .echomem-config-root .config-button:hover {
        filter: brightness(0.97);
        box-shadow: 0 4px 12px rgba(103, 80, 164, 0.16);
      }
      .echomem-config-root .config-button:active { transform: scale(0.985); }
      .echomem-config-root .config-button:focus-visible {
        outline: 3px solid rgba(103, 80, 164, 0.22);
        outline-offset: 2px;
      }
      .echomem-config-root .config-button:disabled {
        cursor: wait;
        filter: none;
        opacity: 0.72;
        box-shadow: none;
        transform: none;
      }
      .echomem-config-root .config-button.is-loading svg {
        animation: config-status-spin 0.9s linear infinite;
      }
      ${getConfigStatusStyles('.echomem-config-root')}
      .claw-overlay-panel--narrow .echomem-config-root .config-card { padding: 14px; border-radius: 16px; }
      .claw-overlay-panel--narrow .echomem-config-root .config-actions { flex-direction: column; }
      .claw-overlay-panel--narrow .echomem-config-root .config-actions .config-button { width: 100%; flex: none !important; }
      @media (prefers-reduced-motion: reduce) {
        .echomem-config-root .config-input,
        .echomem-config-root .config-button { transition: none !important; }
        .echomem-config-root .config-button.is-loading svg {
          animation: none !important;
        }
      }
    </style>
    <div class="echomem-config-root">
      <div class="config-note">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>
        <span>${deploymentNotice}此配置同时影响资源管理、输入联想等功能。</span>
      </div>

      <div class="config-card">
        <div class="config-card-heading">
          <span class="config-card-icon" aria-hidden="true">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M7 4v6M4 17h16M17 14v6"/></svg>
          </span>
          <div>
            <p>记忆后端引擎</p>
            <span>连接地址与身份认证</span>
          </div>
        </div>

        <div class="config-field">
          <label for="cfg-base-url">服务地址</label>
          <input id="cfg-base-url" class="config-input" type="text" />
        </div>

        <div class="config-field">
          <label for="cfg-auth-key">认证密钥</label>
          <input id="cfg-auth-key" class="config-input" type="password" />
        </div>

        <div class="config-field">
          <label for="cfg-agent-id">Agent ID <span style="color: #79747E; font-weight: 400;">· 留空使用平台默认值</span></label>
          <input id="cfg-agent-id" class="config-input" type="text" />
        </div>

        <div class="config-actions">
          <button id="cfg-test-btn" class="config-button config-button-tonal" style="flex: 1;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 11a8 8 0 1 0-2.34 5.66L20 14"/><path d="M20 8v6h-6"/></svg>
            <span id="cfg-test-btn-label">测试连接</span>
          </button>
          <button id="cfg-save-btn" class="config-button config-button-primary" style="flex: 1;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z"/><path d="M17 21v-8H7v8M7 3v5h8"/></svg>
            <span id="cfg-save-btn-label">保存配置</span>
          </button>
        </div>

        ${getConfigStatusMarkup('cfg-engine')}
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
  const testBtnLabel = bodyElement.querySelector('#cfg-test-btn-label');
  const engineStatus = bodyElement.querySelector('#cfg-engine-status');
  const engineStatusTitle = bodyElement.querySelector('#cfg-engine-status-title');
  const engineStatusDetail = bodyElement.querySelector('#cfg-engine-status-detail');
  const saveBtn = bodyElement.querySelector('#cfg-save-btn');
  const saveBtnLabel = bodyElement.querySelector('#cfg-save-btn-label');
  const openviewUrlInput = bodyElement.querySelector('#cfg-openview-url');
  const openviewUsernameInput = bodyElement.querySelector('#cfg-openview-username');
  const openviewPasswordInput = bodyElement.querySelector('#cfg-openview-password');
  const openviewLoginBtn = bodyElement.querySelector('#cfg-openview-login-btn');
  const openviewLoginBtnLabel = bodyElement.querySelector('#cfg-openview-login-btn-label');
  const openviewStatus = bodyElement.querySelector('#cfg-openview-status');
  const openviewStatusTitle = bodyElement.querySelector('#cfg-openview-status-title');
  const openviewStatusDetail = bodyElement.querySelector('#cfg-openview-status-detail');

  function normalizeBaseUrl(url) {
    const trimmed = (url || '').trim();
    if (!trimmed) return DEFAULT_ECHOMEM_BASE_URL;
    return trimmed.replace(/\/$/, '');
  }

  function normalizeOpenViewUrl(url) {
    const trimmed = (url || '').trim();
    if (!trimmed) return 'http://127.0.0.1:31020';
    return trimmed.replace(/\/$/, '');
  }

  const showOpenView = isHigoPlatform();
  let hasEngineFeedback = false;
  let engineActionRevision = 0;
  let hasOpenViewFeedback = false;
  let openViewActionRevision = 0;

  const engineActions = {
    test: {
      button: testBtn,
      labelElement: testBtnLabel,
      idleLabel: '测试连接',
      busyLabel: '正在连接…',
      spinIcon: true,
    },
    save: {
      button: saveBtn,
      labelElement: saveBtnLabel,
      idleLabel: '保存配置',
      busyLabel: '正在保存…',
    },
  };
  const engineFeedbackElements = {
    statusElement: engineStatus,
    titleElement: engineStatusTitle,
    detailElement: engineStatusDetail,
    actions: engineActions,
  };
  const openViewActions = {
    login: {
      button: openviewLoginBtn,
      labelElement: openviewLoginBtnLabel,
      idleLabel: '登录 EchoAgent',
      busyLabel: '正在登录…',
    },
  };
  const openViewFeedbackElements = {
    statusElement: openviewStatus,
    titleElement: openviewStatusTitle,
    detailElement: openviewStatusDetail,
    actions: openViewActions,
  };

  function setEngineState(state, feedback = null) {
    if (state !== 'idle') hasEngineFeedback = true;
    updateConfigActionFeedback(engineFeedbackElements, state, feedback);
  }

  function invalidateEngineFeedback() {
    engineActionRevision += 1;
    if (hasEngineFeedback) setEngineState('dirty');
  }

  function setOpenViewState(state, feedback = null) {
    if (state !== 'idle') hasOpenViewFeedback = true;
    updateConfigActionFeedback(openViewFeedbackElements, state, feedback);
  }

  function invalidateOpenViewFeedback() {
    openViewActionRevision += 1;
    openViewActions.login.idleLabel = '登录 EchoAgent';
    if (hasOpenViewFeedback) setOpenViewState('loginDirty');
  }

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
      if (openviewAuth?.user && openviewAuth?.csrfToken && openviewLoginBtnLabel) {
        hasOpenViewFeedback = true;
        openViewActions.login.idleLabel = '已登录 EchoAgent';
        openviewLoginBtnLabel.textContent = openViewActions.login.idleLabel;
      }
    }
  } catch (err) {
    console.warn('EchoMem: failed to load config', err);
  }

  [baseUrlInput, authKeyInput, agentIdInput].forEach((input) => {
    input?.addEventListener('input', invalidateEngineFeedback);
  });
  [openviewUrlInput, openviewUsernameInput, openviewPasswordInput].forEach((input) => {
    input?.addEventListener('input', invalidateOpenViewFeedback);
  });

  // Test connection
  if (testBtn) {
    testBtn.addEventListener('click', async () => {
      const revision = ++engineActionRevision;
      setEngineState('testing');

      const canApplyResult = () => (
        revision === engineActionRevision && bodyElement.isConnected !== false
      );

      try {
        const config = {
          baseUrl: normalizeBaseUrl(baseUrlInput?.value),
          authKey: authKeyInput?.value?.trim() || '',
          agentId: agentIdInput?.value?.trim() || '',
        };
        const client = createClient(config);
        const ok = await client.healthCheck();
        if (!canApplyResult()) return;

        if (ok) {
          setEngineState('connectionSuccess');
        } else {
          setEngineState('connectionError', {
            title: '连接失败',
            detail: '服务返回了异常状态，请检查服务运行状态后重试。',
          });
        }
      } catch (err) {
        if (!canApplyResult()) return;
        setEngineState('connectionError', getConnectionTestErrorFeedback(err));
      }
    });
  }

  // Save config
  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      const revision = ++engineActionRevision;
      setEngineState('saving');

      const canApplyResult = () => (
        revision === engineActionRevision && bodyElement.isConnected !== false
      );
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

        if (!canApplyResult()) return;
        setEngineState('saved');
      } catch (err) {
        if (!canApplyResult()) return;
        setEngineState('saveError', getConfigSaveErrorFeedback(err));
      }
    });
  }

  // Login OpenView
  if (showOpenView && openviewLoginBtn) {
    openviewLoginBtn.addEventListener('click', async () => {
      const revision = ++openViewActionRevision;
      openViewActions.login.idleLabel = '登录 EchoAgent';
      setOpenViewState('loggingIn');

      const canApplyResult = () => (
        revision === openViewActionRevision && bodyElement.isConnected !== false
      );
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
        }, {
          shouldPersistAuth: canApplyResult,
        });

        if (!canApplyResult()) return;
        openViewActions.login.idleLabel = '已登录 EchoAgent';
        const username = auth.user?.username?.trim();
        setOpenViewState('loginSuccess', username ? {
          title: 'EchoAgent 登录成功',
          detail: `已使用账号 ${username} 完成身份认证。`,
        } : null);
      } catch (err) {
        if (!canApplyResult()) return;
        openViewActions.login.idleLabel = '登录 EchoAgent';
        setOpenViewState('loginError', getEchoAgentLoginErrorFeedback(err));
      }
    });
  }
}
