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
import {
  DEFAULT_ECHOMEM_BASE_URL,
  DEPLOYMENT_PROFILE_LABEL,
} from '../../config/deployment.js';
import {
  getConnectionTestErrorFeedback,
  updateConnectionTestFeedback,
} from './config-feedback.js';

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
          登录 EchoAgent
        </button>
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
      .echomem-config-root .config-status {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        margin-top: 12px;
        padding: 11px 12px;
        border: 1px solid #D0BCFF;
        border-radius: 12px;
        background: #F3EDF7;
        color: #49454F;
      }
      .echomem-config-root .config-status[hidden] { display: none; }
      .echomem-config-root .config-status[data-state="success"] {
        border-color: #A8D5BA;
        background: #ECF8F0;
        color: #175C35;
      }
      .echomem-config-root .config-status[data-state="error"] {
        border-color: #F2B8B5;
        background: #FFF1F0;
        color: #8C1D18;
      }
      .echomem-config-root .config-status[data-state="dirty"] {
        border-color: #E8C66A;
        background: #FFF8E1;
        color: #664B00;
      }
      .echomem-config-root .config-status-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 20px;
        height: 20px;
        margin-top: 1px;
        flex: 0 0 auto;
      }
      .echomem-config-root .config-status-symbol { display: none; }
      .echomem-config-root .config-status[data-state="testing"] .config-status-symbol-testing,
      .echomem-config-root .config-status[data-state="success"] .config-status-symbol-success,
      .echomem-config-root .config-status[data-state="error"] .config-status-symbol-error,
      .echomem-config-root .config-status[data-state="dirty"] .config-status-symbol-dirty {
        display: block;
      }
      .echomem-config-root .config-status[data-state="testing"] .config-status-symbol-testing {
        animation: config-status-spin 0.9s linear infinite;
      }
      .echomem-config-root .config-status-copy {
        min-width: 0;
      }
      .echomem-config-root .config-status-title {
        display: block;
        margin: 0;
        font-size: 12px;
        font-weight: 600;
        line-height: 1.45;
      }
      .echomem-config-root .config-status-detail {
        display: block;
        margin-top: 2px;
        color: inherit;
        font-size: 11px;
        line-height: 1.5;
        opacity: 0.86;
      }
      @keyframes config-status-spin {
        to { transform: rotate(360deg); }
      }
      @media (max-width: 360px) {
        .echomem-config-root .config-card { padding: 14px; border-radius: 16px; }
        .echomem-config-root .config-actions { flex-direction: column; }
        .echomem-config-root .config-actions .config-button { width: 100%; flex: none !important; }
      }
      @media (prefers-reduced-motion: reduce) {
        .echomem-config-root .config-input,
        .echomem-config-root .config-button { transition: none !important; }
        .echomem-config-root .config-button.is-loading svg,
        .echomem-config-root .config-status[data-state="testing"] .config-status-symbol-testing {
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
            保存配置
          </button>
        </div>

        <div id="cfg-test-status" class="config-status" data-state="idle" role="status" aria-live="polite" aria-atomic="true" hidden>
          <span class="config-status-icon" aria-hidden="true">
            <svg class="config-status-symbol config-status-symbol-testing" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 12a9 9 0 1 1-3.2-6.9"/></svg>
            <svg class="config-status-symbol config-status-symbol-success" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9"/></svg>
            <svg class="config-status-symbol config-status-symbol-error" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/></svg>
            <svg class="config-status-symbol config-status-symbol-dirty" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 2.5 20h19L12 3Z"/><path d="M12 9v4M12 17h.01"/></svg>
          </span>
          <span class="config-status-copy">
            <strong id="cfg-test-status-title" class="config-status-title"></strong>
            <span id="cfg-test-status-detail" class="config-status-detail"></span>
          </span>
        </div>
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
  const testStatus = bodyElement.querySelector('#cfg-test-status');
  const testStatusTitle = bodyElement.querySelector('#cfg-test-status-title');
  const testStatusDetail = bodyElement.querySelector('#cfg-test-status-detail');
  const saveBtn = bodyElement.querySelector('#cfg-save-btn');
  const openviewUrlInput = bodyElement.querySelector('#cfg-openview-url');
  const openviewUsernameInput = bodyElement.querySelector('#cfg-openview-username');
  const openviewPasswordInput = bodyElement.querySelector('#cfg-openview-password');
  const openviewLoginBtn = bodyElement.querySelector('#cfg-openview-login-btn');

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
  let hasTestedConnection = false;
  let connectionTestRevision = 0;

  const connectionFeedbackElements = {
    statusElement: testStatus,
    titleElement: testStatusTitle,
    detailElement: testStatusDetail,
    testButton: testBtn,
    testButtonLabel: testBtnLabel,
  };

  function setConnectionTestState(state, feedback = null) {
    updateConnectionTestFeedback(connectionFeedbackElements, state, feedback);
  }

  function invalidateConnectionTest() {
    if (!hasTestedConnection) return;
    connectionTestRevision += 1;
    setConnectionTestState('dirty');
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
      if (openviewAuth?.user && openviewAuth?.csrfToken && openviewLoginBtn) {
        openviewLoginBtn.textContent = '✅ 已登录 EchoAgent';
      }
    }
  } catch (err) {
    console.warn('EchoMem: failed to load config', err);
  }

  [baseUrlInput, authKeyInput, agentIdInput].forEach((input) => {
    input?.addEventListener('input', invalidateConnectionTest);
  });

  // Test connection
  if (testBtn) {
    testBtn.addEventListener('click', async () => {
      hasTestedConnection = true;
      const revision = ++connectionTestRevision;
      setConnectionTestState('testing');

      const canApplyResult = () => (
        revision === connectionTestRevision && bodyElement.isConnected !== false
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
          setConnectionTestState('success');
        } else {
          setConnectionTestState('error', {
            title: '连接失败',
            detail: '服务返回了异常状态，请检查服务运行状态后重试。',
          });
        }
      } catch (err) {
        if (!canApplyResult()) return;
        setConnectionTestState('error', getConnectionTestErrorFeedback(err));
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
