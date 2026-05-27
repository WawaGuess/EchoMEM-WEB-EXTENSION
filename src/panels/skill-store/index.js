// Skill 管理面板内容 —— 真实数据驱动

import { getOpenVikingConfig } from '../../services/config.js';
import { createClient } from '../../services/openviking-client.js';
import { parseSkillMd, getEntryName } from '../../utils/skill-parser.js';
import { openCenterOverlay, closeOverlayPanel } from '../../core/panel-host.js';

const SKILL_ROOT_URI = 'viking://agent/skills';

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
        <p style="font-size: 12px; color: #888;">支持 .md / .txt（内容须符合 SKILL.md 格式）/ .zip，单个文件不超过 10MB</p>
        <input type="file" id="claw-skill-file-input" accept=".md,.txt,.zip" style="display: none;" />
      </div>

      <!-- 状态提示 -->
      <div id="claw-skill-upload-status" style="display: none; padding: 10px 12px; border-radius: 6px; font-size: 13px;"></div>

      <!-- 上传须知 -->
      <div style="padding: 12px; background: #f8f9fa; border-radius: 8px;">
        <p style="font-weight: 600; color: #333; margin-bottom: 10px; font-size: 13px;">📋 上传须知</p>
        <ul style="font-size: 12px; color: #666; padding-left: 18px; line-height: 1.8; margin: 0;">
          <li>SKILL.md 必须以 <code style="background: #eee; padding: 1px 4px; border-radius: 3px; font-size: 11px;">---</code> 开头，frontmatter 中必须包含 <code style="background: #eee; padding: 1px 4px; border-radius: 3px; font-size: 11px;">name</code> 字段</li>
          <li>zip 根目录下必须直接包含 SKILL.md，不能套在子文件夹里</li>
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
      return '无法连接到 OpenViking 后端，请检查服务地址和认证配置';
    }
    if (err.message?.includes('401') || err.message?.includes('403')) {
      return '认证失败，请在 EchoMem 主页的「OpenViking 连接配置」中检查 API Key';
    }
    return err.message;
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
      if (!frontmatter.name) {
        throw new Error('frontmatter 中必须包含 name 字段');
      }
    }

    return true;
  }

  async function executeUpload(file, skillName) {
    showStatus('正在上传...', 'info');

    try {
      const config = await getOpenVikingConfig();
      const client = createClient(config);

      // Step 1: temp upload
      const uploadResult = await client.tempUpload(file);
      const tempFileId = uploadResult?.temp_file_id;
      if (!tempFileId) throw new Error('上传失败：未返回临时文件 ID');

      // Step 2: add skill
      showStatus('文件已上传，正在创建 Skill...', 'info');
      const skillResult = await client.addSkill({
        tempFileId,
        wait: false,
      });

      showStatus(`✅ Skill「${skillResult.name || skillName}」上传成功`, 'success');
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

    // 提取 skillName
    const ext = file.name.split('.').pop().toLowerCase();
    let skillName = file.name;
    if (ext === 'md' || ext === 'txt') {
      try {
        const text = await file.text();
        const { frontmatter } = parseSkillMd(text);
        skillName = frontmatter.name || file.name;
      } catch { /* ignore */ }
    }

    // 使用居中浮层替代原生 confirm
    const safeName = skillName.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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
        executeUpload(file, skillName);
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
  return initSkillListPanel(bodyElement, { showDelete: false });
}

export async function initSkillManagePanel(bodyElement) {
  return initSkillListPanel(bodyElement, { showDelete: true });
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
      const version = skill.version ? `v${skill.version}` : '';
      const author = skill.author || '';
      const metaParts = [version, author, formatDate(skill.modifiedAt)].filter(Boolean);
      const meta = metaParts.join(' · ') || '-';

      const deleteBtnHtml = options.showDelete
        ? `<button class="claw-skill-btn-delete" data-uri="${skill.uri}" data-name="${skill.name}" style="
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
              <p style="font-weight: 600; font-size: 13px; color: #111827; margin-bottom: 2px; word-break: break-all;">${skill.name}</p>
              <p style="font-size: 12px; color: #6b7280; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; margin-bottom: 4px;">${desc}</p>
              <p style="font-size: 11px; color: #9ca3af;">${meta}</p>
            </div>
            <div style="display: flex; align-items: flex-start; gap: 6px; flex-shrink: 0;">
              ${deleteBtnHtml}
              <svg class="claw-skill-toggle-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-top: 4px; transition: transform 0.2s;">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </div>
          </div>
          <div class="claw-skill-detail" style="display: none; margin-top: 12px; padding-top: 12px; border-top: 1px solid #e5e7eb;">
            ${renderDetail(skill)}
          </div>
        </div>
      `;
    }).join('');

    contentEl.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 8px;">
        ${itemsHtml}
      </div>
    `;

    // Bind click to toggle detail
    contentEl.querySelectorAll('.claw-skill-item').forEach(item => {
      item.addEventListener('click', (e) => {
        // Don't toggle if clicking delete button
        if (e.target.closest('.claw-skill-btn-delete')) return;

        const detail = item.querySelector('.claw-skill-detail');
        const icon = item.querySelector('.claw-skill-toggle-icon');
        if (!detail) return;

        const isOpen = detail.style.display === 'block';
        // Close all others
        contentEl.querySelectorAll('.claw-skill-detail').forEach(d => d.style.display = 'none');
        contentEl.querySelectorAll('.claw-skill-toggle-icon').forEach(i => i.style.transform = 'none');

        if (!isOpen) {
          detail.style.display = 'block';
          if (icon) icon.style.transform = 'rotate(180deg)';
        }
      });
    });

    // Bind delete buttons
    if (options.showDelete) {
      contentEl.querySelectorAll('.claw-skill-btn-delete').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const uri = btn.dataset.uri;
          const name = btn.dataset.name;
          if (!uri) return;
          // 使用居中浮层替代原生 confirm
          const safeDelName = (name || uri).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
          const delDialogId = 'claw-skill-del-confirm-' + Date.now();
          const delDialogHtml = `
            <div id="${delDialogId}" style="padding: 12px 16px; display: flex; flex-direction: column; gap: 10px;">
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
                const config = await getOpenVikingConfig();
                const client = createClient(config);
                await client.fsRm(uri, true);
                showToast(`✅ Skill「${name || '未命名'}」已删除`, 'success');
                skillCache = null;
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
  }

  function renderDetail(skill) {
    const descHtml = skill.description
      ? `<div style="font-size: 12px; color: #4b5563; line-height: 1.6; margin-bottom: 12px; padding: 8px; background: #eff6ff; border-radius: 6px; border: 1px solid #bfdbfe;">${skill.description.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>`
      : '';

    const bodyPreview = skill.rawContent
      ? `<div style="font-size: 12px; color: #4b5563; line-height: 1.6; max-height: 200px; overflow-y: auto; padding: 8px; background: #f3f4f6; border-radius: 6px; white-space: pre-wrap; word-break: break-word;">${skill.rawContent.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>`
      : '';

    return `
      ${descHtml}
      ${bodyPreview}
      <div style="margin-top: 8px;">
        <span style="font-size: 11px; color: #9ca3af; font-family: monospace; word-break: break-all;">${skill.uri}</span>
      </div>
    `;
  }

  function filterSkills(keyword) {
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
      const config = await getOpenVikingConfig();
      const client = createClient(config);

      // Ensure directory exists (ignore exists error)
      try {
        await client.fsMkdir(SKILL_ROOT_URI, 'Agent skills');
      } catch (mkdirErr) {
        if (!mkdirErr.message?.toLowerCase().includes('exist')) {
          console.warn('EchoMem: mkdir warning', mkdirErr.message);
        }
      }

      const lsResult = await client.fsLs(SKILL_ROOT_URI, {
        output: 'agent',
        absLimit: 128,
        showAllHidden: false,
      });
      console.log('[EchoMem:skill] fsLs result:', lsResult);

      let entries = Array.isArray(lsResult) ? lsResult : (lsResult?.entries || []);
      entries = entries.filter(e => e.isDir || e.stat?.isDir);
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
            const readResult = await client.contentRead(skillUri);
            console.log('[EchoMem:skill] readResult type:', typeof readResult, 'preview:', String(readResult).slice(0, 60));
            const content = typeof readResult === 'string'
              ? readResult
              : (readResult?.content || '');
            const { frontmatter, body } = parseSkillMd(content);
            console.log('[EchoMem:skill] parsed frontmatter:', JSON.stringify(frontmatter));

            return {
              name: dirName,
              dirName,
              description: entry.abstract || '',
              uri: baseUri,
              rawContent: content.slice(0, 1000),
              modifiedAt: entry.modTime || entry.mtime || entry.modifiedAt,
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
          <p style="font-size: 12px;">${err.message}</p>
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
      if (searchInput) searchInput.value = '';
      await loadSkills();
    });
  }

  await loadSkills();
}
