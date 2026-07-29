// 文档：docs/flows/skill-store/上传流程.md
// Skill 管理面板内容 —— 真实数据驱动

import { getEchoMemConfig } from '../../services/config.js';
import { createClient } from '../../services/echomem-client.js';
import { parseSkillMd, getEntryName } from '../../utils/skill-parser.js';
import { insertPlainText } from '../../core/content-injector.js';
import { openCenterOverlay, closeOverlayPanel } from '../../core/panel-host.js';
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
    { id: 'history', title: '📜 我的 Skill', desc: '查看和管理你使用过的 Skill', color: '#667eea' },
    { id: 'upload', title: '⬆️ 上传 Skill', desc: '上传你的自定义 Skill', color: '#42a5f5' },
    { id: 'manage', title: '⚙️ 安装管理', desc: '管理已安装的 Skill', color: '#ef5350' }
  ];

  const cards = sections.map(s => `
    <div class="claw-skill-section" data-section="${s.id}" style="
      padding: 16px;
      border: 1px solid #e0e0e0;
      border-radius: 10px;
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      gap: 12px;
    " onmouseenter="this.style.borderColor='${s.color}';this.style.background='#fafafa';this.style.transform='translateX(4px)'" onmouseleave="this.style.borderColor='#e0e0e0';this.style.background='none';this.style.transform='none'"
    >
      <div style="
        width: 40px;
        height: 40px;
        border-radius: 10px;
        background: ${s.color}15;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 20px;
        flex-shrink: 0;
      ">${s.title.split(' ')[0]}</div>
      <div style="flex: 1;">
        <p style="font-weight: 600; color: #333; font-size: 14px; margin-bottom: 2px;">${s.title.split(' ').slice(1).join(' ')}</p>
        <p style="font-size: 12px; color: #888;">${s.desc}</p>
      </div>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ccc" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="9 18 15 12 9 6"></polyline>
      </svg>
    </div>
  `).join('');

  return `
    <div style="display: flex; flex-direction: column; gap: 10px;">
      ${cards}
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
  return `
    <div style="display: flex; flex-direction: column; gap: 12px; color: #333;">
      <!-- 搜索框 -->
      <div style="display: flex; gap: 8px; align-items: center;">
        <input type="text" id="claw-skill-search" placeholder="搜索 Skill 名称或描述..." style="
          flex: 1;
          padding: 8px 12px;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-size: 13px;
          outline: none;
          transition: border-color 0.2s;
        " onfocus="this.style.borderColor='#667eea'" onblur="this.style.borderColor='#d1d5db'">
        <button id="claw-skill-btn-refresh" style="
          padding: 8px 12px;
          background: white;
          color: #374151;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-size: 12px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 4px;
          white-space: nowrap;
        ">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
          刷新
        </button>
      </div>

      <!-- Toast -->
      <div id="claw-skill-toast" style="display: none;"></div>

      <!-- 加载中 -->
      <div id="claw-skill-list-loading" style="text-align: center; padding: 40px 20px; color: #888;">
        <p style="font-size: 14px;">⏳ 正在加载 Skill 列表...</p>
      </div>

      <!-- 列表内容 -->
      <div id="claw-skill-list-content" style="display: none;"></div>
    </div>
  `;
}

export function getSkillUploadContent() {
  return `
    <div style="display: flex; flex-direction: column; gap: 12px; color: #333;">
      <!-- 上传区域 -->
      <div id="claw-skill-dropzone" style="
        border: 2px dashed #ccc;
        border-radius: 12px;
        padding: 32px 20px;
        text-align: center;
        cursor: pointer;
        transition: all 0.2s;
        background: #fafafa;
      " onmouseenter="this.style.borderColor='#667eea';this.style.background='#f8f9ff'" onmouseleave="this.style.borderColor='#ccc';this.style.background='#fafafa'"
      >
        <p style="font-size: 32px; margin-bottom: 8px;">📤</p>
        <p style="font-size: 14px; color: #333; font-weight: 500; margin-bottom: 4px;">点击或拖拽上传 Skill 文件</p>
        <p style="font-size: 12px; color: #888;">支持 .md / .txt（内容须符合 SKILL.md 格式），单个文件不超过 10MB</p>
        <input type="file" id="claw-skill-file-input" accept=".md,.txt" style="display: none;" />
      </div>

      <!-- 状态提示 -->
      <div id="claw-skill-upload-status" style="display: none; padding: 10px 12px; border-radius: 6px; font-size: 13px;"></div>

      <!-- 上传须知 -->
      <div style="padding: 12px; background: #f8f9fa; border-radius: 8px;">
        <p style="font-weight: 600; color: #333; margin-bottom: 10px; font-size: 13px;">📋 上传须知</p>
        <ul style="font-size: 12px; color: #666; padding-left: 18px; line-height: 1.8; margin: 0;">
          <li>SKILL.md 必须以 <code style="background: #eee; padding: 1px 4px; border-radius: 3px; font-size: 11px;">---</code> 开头</li>
          <li>Skill 名称优先取 frontmatter 中的 <code style="background: #eee; padding: 1px 4px; border-radius: 3px; font-size: 11px;">name</code>；未填写时取文件名（去掉 <code style="background: #eee; padding: 1px 4px; border-radius: 3px; font-size: 11px;">.md</code> / <code style="background: #eee; padding: 1px 4px; border-radius: 3px; font-size: 11px;">.txt</code>）</li>
          <li>Skill 名称仅支持字母、数字、下划线、短横线（正则 <code style="background: #eee; padding: 1px 4px; border-radius: 3px; font-size: 11px;">^[\w\-]+$</code>）</li>
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
      showStatus(`✅ Skill「${skillResult.name || finalName || skillName}」上传成功`, 'success');
    } catch (err) {
      showStatus(`❌ 上传失败: ${formatError(err)}`, 'error');
    }
  }

  async function doUpload(file) {
    showStatus('正在校验文件...', 'info');

    try {
      await validateFile(file);
    } catch (err) {
      showStatus(`❌ ${err.message}`, 'error');
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
      showStatus('❌ 当前版本仅支持 .md / .txt 格式 Skill', 'error');
      return;
    }

    if (!skillText) {
      showStatus('❌ 无法读取 Skill 内容', 'error');
      return;
    }

    // 使用居中浮层替代原生 confirm
    const safeName = escapeHtml(skillName);
    const dialogId = 'claw-skill-confirm-' + Date.now();
    const dialogHtml = `
      <div id="${dialogId}" style="padding: 12px 16px; display: flex; flex-direction: column; gap: 10px;">
        <div style="text-align: center;">
          <p style="font-size: 24px; margin: 0; line-height: 1;">⚠️</p>
          <p style="font-size: 15px; color: #333; font-weight: 500; margin: 4px 0 2px;">确认上传 Skill</p>
          <p style="font-size: 12px; color: #666; line-height: 1.4; margin: 0;">如存在同名 Skill「<strong style="color: #111;">${safeName}</strong>」，将直接覆盖。</p>
        </div>
        <div style="display: flex; gap: 10px; justify-content: center;">
          <button id="claw-skill-confirm-cancel" style="
            padding: 8px 20px;
            background: #f3f4f6;
            color: #374151;
            border: 1px solid #d1d5db;
            border-radius: 8px;
            font-size: 13px;
            cursor: pointer;
            font-weight: 500;
          ">取消</button>
          <button id="claw-skill-confirm-ok" style="
            padding: 8px 20px;
            background: #667eea;
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 13px;
            cursor: pointer;
            font-weight: 500;
          ">确认上传</button>
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
    dropzone.style.borderColor = '#667eea';
    dropzone.style.background = '#f8f9ff';
  });
  dropzone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dropzone.style.borderColor = '#ccc';
    dropzone.style.background = '#fafafa';
  });
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.style.borderColor = '#ccc';
    dropzone.style.background = '#fafafa';
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

  if (!loadingEl || !contentEl) return;

  let allSkills = [];
  let filteredSkills = [];
  const skillVersionCache = new Map();
  const skillVersionRequests = new Map();
  const skillVersionContentCache = new Map();
  const skillVersionContentRequests = new Map();
  const rollbackInFlight = new Set();
  let expandedSkillKey = null;

  function showToast(msg, type = 'info') {
    if (!toastEl) return;
    const colors = {
      info: { bg: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8' },
      success: { bg: '#f0fdf4', border: '#bbf7d0', text: '#15803d' },
      error: { bg: '#fef2f2', border: '#fecaca', text: '#b91c1c' }
    };
    const c = colors[type] || colors.info;
    toastEl.style.display = 'block';
    toastEl.style.padding = '10px 12px';
    toastEl.style.borderRadius = '6px';
    toastEl.style.fontSize = '13px';
    toastEl.style.marginBottom = '8px';
    toastEl.style.background = c.bg;
    toastEl.style.border = `1px solid ${c.border}`;
    toastEl.style.color = c.text;
    toastEl.textContent = msg;
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
          await loadSkills();
          showToast(`✅ Skill「${skill.name}」已恢复为 ${targetLabel}`, 'success');
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

  function renderSkills(skills) {
    if (skills.length === 0) {
      contentEl.innerHTML = `
        <div style="text-align: center; padding: 40px 20px; color: #999;">
          <p style="font-size: 36px; margin-bottom: 12px;">📂</p>
          <p style="font-size: 14px;">暂无 Skill</p>
          <p style="font-size: 12px; margin-top: 6px;">请先上传 Skill 文件</p>
        </div>
      `;
      return;
    }

    const itemsHtml = skills.map((skill, index) => {
      const desc = skill.description || '暂无描述';
      const version = skill.version ? formatVersionLabel(skill.version) : '';
      const author = skill.author || '';
      const metaParts = [version, author, formatDate(skill.modifiedAt)].filter(Boolean);
      const meta = metaParts.join(' · ') || '-';

      const deleteBtnHtml = options.showDelete
        ? `<button class="claw-skill-btn-delete" data-index="${index}" style="
            padding: 4px 10px;
            background: #fef2f2;
            color: #dc2626;
            border: 1px solid #fecaca;
            border-radius: 5px;
            font-size: 11px;
            cursor: pointer;
            flex-shrink: 0;
          ">删除</button>`
        : '';

      const detailControlHtml = options.useOnCardClick
        ? `<button class="claw-skill-btn-detail" data-index="${index}" style="
            padding: 4px 10px;
            background: #eff6ff;
            color: #2563eb;
            border: 1px solid #bfdbfe;
            border-radius: 5px;
            font-size: 11px;
            cursor: pointer;
            flex-shrink: 0;
          ">详情</button>`
        : `<svg class="claw-skill-toggle-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-top: 4px; transition: transform 0.2s;">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>`;

      const useHintHtml = options.useOnCardClick
        ? `<span style="font-size: 11px; color: #15803d; white-space: nowrap; margin-top: 5px;">点击使用</span>`
        : '';

      return `
        <div class="claw-skill-item" data-index="${index}" style="
          padding: 12px;
          background: #f9fafb;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
        " onmouseenter="this.style.background='#f0f7ff';this.style.borderColor='#c7d8f5'" onmouseleave="this.style.background='#f9fafb';this.style.borderColor='#e5e7eb'"
        >
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
            <div style="flex: 1; min-width: 0;">
              <p style="font-weight: 600; font-size: 13px; color: #111827; margin-bottom: 2px; word-break: break-all;">${escapeHtml(skill.name)}</p>
              <p style="font-size: 12px; color: #6b7280; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; margin-bottom: 4px;">${escapeHtml(desc)}</p>
              <p style="font-size: 11px; color: #9ca3af;">${escapeHtml(meta)}</p>
            </div>
            <div style="display: flex; align-items: flex-start; gap: 6px; flex-shrink: 0;">
              ${useHintHtml}
              ${deleteBtnHtml}
              ${detailControlHtml}
            </div>
          </div>
          <div class="claw-skill-detail" style="display: none; margin-top: 12px; padding-top: 12px; border-top: 1px solid #e5e7eb;">
            ${renderDetail(skill, index)}
          </div>
        </div>
      `;
    }).join('');

    contentEl.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 8px;">
        ${itemsHtml}
      </div>
    `;

    function openSkillItem(item, skill) {
      const detail = item.querySelector('.claw-skill-detail');
      const icon = item.querySelector('.claw-skill-toggle-icon');
      const detailButton = item.querySelector('.claw-skill-btn-detail');
      if (!detail) return;

      contentEl.querySelectorAll('.claw-skill-detail').forEach(element => element.style.display = 'none');
      contentEl.querySelectorAll('.claw-skill-toggle-icon').forEach(element => element.style.transform = 'none');
      contentEl.querySelectorAll('.claw-skill-btn-detail').forEach(element => element.textContent = '详情');
      detail.style.display = 'block';
      if (icon) icon.style.transform = 'rotate(180deg)';
      if (detailButton) detailButton.textContent = '收起';
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
        const item = btn.closest('.claw-skill-item');
        const skill = skills[Number(btn.dataset.index)];
        const detail = item?.querySelector('.claw-skill-detail');
        if (!item || !skill || !detail) return;

        if (detail.style.display === 'block') {
          detail.style.display = 'none';
          btn.textContent = '详情';
          expandedSkillKey = null;
          return;
        }

        openSkillItem(item, skill);
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
            <div style="padding: 12px 16px; display: flex; flex-direction: column; gap: 10px;">
              <div style="text-align: center;">
                <p style="font-size: 24px; margin: 0; line-height: 1;">🗑️</p>
                <p style="font-size: 15px; color: #333; font-weight: 500; margin: 4px 0 2px;">确认删除 Skill</p>
                <p style="font-size: 12px; color: #666; line-height: 1.4; margin: 0;">确定删除 Skill「<strong style="color: #111;">${safeDelName}</strong>」？此操作不可恢复。</p>
              </div>
              <div style="display: flex; gap: 10px; justify-content: center;">
                <button id="claw-skill-del-cancel" style="
                  padding: 8px 20px;
                  background: #f3f4f6;
                  color: #374151;
                  border: 1px solid #d1d5db;
                  border-radius: 8px;
                  font-size: 13px;
                  cursor: pointer;
                  font-weight: 500;
                ">取消</button>
                <button id="claw-skill-del-ok" style="
                  padding: 8px 20px;
                  background: #ef5350;
                  color: white;
                  border: none;
                  border-radius: 8px;
                  font-size: 13px;
                  cursor: pointer;
                  font-weight: 500;
                ">确认删除</button>
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
                showToast(`✅ Skill「${displayName || '未命名'}」已删除`, 'success');
                skillCache = null;
                invalidateVersionCaches(apiName);
                await loadSkills();
              } catch (err) {
                showToast(`❌ 删除失败: ${err.message}`, 'error');
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
        const skill = skills[Number(btn.dataset.index)];
        if (!skill) return;
        const text = skill.fullContent || skill.rawContent || '无内容';
        const previewHtml = `<div style="padding: 16px 18px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 12px; line-height: 1.7; color: #374151; white-space: pre-wrap; word-break: break-word;">${escapeHtml(text)}</div>`;
        openCenterOverlay(escapeHtml(skill.name), previewHtml, {
          showBack: true,
          onBack: () => closeOverlayPanel()
        });
      });
    });

    if (expandedSkillKey) {
      const expandedIndex = skills.findIndex(skill => getSkillApiName(skill) === expandedSkillKey);
      const expandedItem = expandedIndex >= 0
        ? contentEl.querySelector(`.claw-skill-item[data-index="${expandedIndex}"]`)
        : null;
      if (expandedItem) {
        openSkillItem(expandedItem, skills[expandedIndex]);
      }
    }
  }

  function renderDetail(skill, index) {
    const descHtml = skill.description
      ? `<div style="font-size: 12px; color: #4b5563; line-height: 1.6; margin-bottom: 12px; padding: 8px; background: #eff6ff; border-radius: 6px; border: 1px solid #bfdbfe;">${escapeHtml(skill.description)}</div>`
      : `<div style="font-size: 12px; color: #9ca3af; line-height: 1.6; margin-bottom: 12px; padding: 8px; background: #f3f4f6; border-radius: 6px;">暂无描述</div>`;

    const previewText = skill.rawContent || skill.fullContent || '';
    const bodyPreview = previewText
      ? `<div style="font-size: 12px; color: #4b5563; line-height: 1.6; max-height: 200px; overflow-y: auto; padding: 8px; background: #f3f4f6; border-radius: 6px; white-space: pre-wrap; word-break: break-word;">${escapeHtml(previewText)}</div>`
      : `<div style="font-size: 12px; color: #9ca3af; padding: 8px; background: #f3f4f6; border-radius: 6px;">暂无正文</div>`;

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
      <div style="display: flex; justify-content: flex-end; margin-top: 8px;">
        <button class="claw-skill-btn-view-full" data-index="${index}" style="
          padding: 5px 10px;
          background: #eff6ff;
          color: #2563eb;
          border: 1px solid #bfdbfe;
          border-radius: 5px;
          font-size: 12px;
          cursor: pointer;
        ">查看完整内容</button>
      </div>
      ${versionHistoryHtml}
      <div style="margin-top: 8px;">
        <span style="font-size: 11px; color: #9ca3af; font-family: monospace; word-break: break-all;">${escapeHtml(skill.uri)}</span>
      </div>
    `;
  }

  function filterSkills(keyword) {
    expandedSkillKey = null;
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

    loadingEl.style.display = 'block';
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
        <div style="text-align: center; padding: 40px 20px; color: #b91c1c; background: #fef2f2; border-radius: 8px;">
          <p style="font-size: 14px; margin-bottom: 6px;">❌ 加载失败</p>
          <p style="font-size: 12px;">${escapeHtml(err.message)}</p>
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
      expandedSkillKey = null;
      invalidateVersionCaches();
      if (searchInput) searchInput.value = '';
      await loadSkills();
    });
  }

  await loadSkills();
}
