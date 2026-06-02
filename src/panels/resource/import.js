// 文档：docs/flows/resource/导入流程.md
// 资源导入页面 —— 异步轮询模式，不阻塞等待后端语义提取
// V2: 支持文件夹浏览、点击进入、返回上级

import { getOpenVikingConfig } from '../../services/config.js';
import { createClient } from '../../services/openviking-client.js';
import { injectContent } from '../../core/content-injector.js';
import { openCenterOverlay, closeOverlayPanel } from '../../core/panel-host.js';

function getRootDirUri() {
  return 'viking://resources/echomem/';
}

function getParentUri(uri) {
  const clean = uri.replace(/\/$/, '');
  const parts = clean.split('/');
  if (parts.length <= 3) return null;
  return parts.slice(0, -1).join('/') + '/';
}

export function getResourceImportContent() {
  return `
    <div style="display: flex; flex-direction: column; gap: 12px; color: #333;">
      <!-- 本地文件上传 -->
      <div>
        <p style="font-weight: 600; font-size: 14px; margin-bottom: 8px;">📁 本地文件上传</p>
        <div id="claw-resource-dropzone" style="
          border: 1.5px dashed #ccc;
          border-radius: 8px;
          padding: 0px 16px;
          text-align: center;
          cursor: pointer;
          transition: all 0.2s;
          background: #fafafa;
        " onmouseenter="this.style.borderColor='#2563eb';this.style.background='#f0f7ff'"
           onmouseleave="this.style.borderColor='#ccc';this.style.background='#fafafa'">
          <p style="font-size: 14px; margin: 0;">📤</p>
          <p style="font-size: 11px; font-weight: 500; margin: 0;">点击或拖拽文件到此处</p>
          <p style="font-size: 9px; color: #888; margin: 0;">支持 PDF, DOC, TXT, MD</p>
          <input type="file" id="claw-resource-file-input" style="display: none;" />
        </div>
      </div>

      <!-- 状态提示 -->
      <div id="claw-resource-import-status" style="display: none; padding: 10px 12px; border-radius: 6px; font-size: 13px;"></div>

      <!-- 处理结果区 -->
      <div id="claw-resource-import-result" style="display: none;"></div>

      <!-- 远程文件列表 -->
      <div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <p style="font-weight: 600; font-size: 14px; margin: 0;">📂 远程文件</p>
          <p id="claw-remote-path" style="font-size: 10px; color: #888; margin: 0; font-family: monospace;">viking://resources/echomem/</p>
        </div>
        <div style="display: flex; gap: 8px; margin-bottom: 8px;">
          <div id="claw-remote-back-btn" style="display: none;">
            <button id="claw-remote-back" style="
              padding: 4px 10px;
              background: #f3f4f6;
              border: 1px solid #d1d5db;
              border-radius: 4px;
              font-size: 12px;
              cursor: pointer;
              color: #374151;
            ">← 返回上级</button>
          </div>
          <button id="claw-remote-mkdir" style="
            padding: 4px 10px;
            background: #eff6ff;
            border: 1px solid #bfdbfe;
            border-radius: 4px;
            font-size: 12px;
            cursor: pointer;
            color: #1d4ed8;
          ">+ 新建文件夹</button>
        </div>
        <div id="claw-backup-list-loading" style="text-align: center; padding: 16px; color: #888; font-size: 12px;">⏳ 正在加载...</div>
        <div id="claw-backup-list-content" style="display: none;"></div>
      </div>
    </div>
  `;
}

let activePollTimer = null;

export async function initImportPanel(bodyElement) {
  if (!bodyElement) return;

  const dropzone = bodyElement.querySelector('#claw-resource-dropzone');
  const fileInput = bodyElement.querySelector('#claw-resource-file-input');
  const statusEl = bodyElement.querySelector('#claw-resource-import-status');
  const resultEl = bodyElement.querySelector('#claw-resource-import-result');
  const backupLoadingEl = bodyElement.querySelector('#claw-backup-list-loading');
  const backupContentEl = bodyElement.querySelector('#claw-backup-list-content');
  const pathEl = bodyElement.querySelector('#claw-remote-path');
  const backBtnContainer = bodyElement.querySelector('#claw-remote-back-btn');
  const backBtn = bodyElement.querySelector('#claw-remote-back');
  const mkdirBtn = bodyElement.querySelector('#claw-remote-mkdir');

  if (!dropzone || !fileInput) return;

  // ── 当前浏览目录状态 ──
  let currentDirUri = getRootDirUri();

  // ── Remote file list helpers ──
  function formatSize(bytes) {
    if (!bytes || bytes < 0) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function formatDate(ts) {
    if (!ts) return '-';
    const d = typeof ts === 'string' ? new Date(ts) : new Date(ts * 1000);
    if (isNaN(d.getTime())) return '-';
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  async function loadRemoteFileList(dirUri = currentDirUri) {
    if (!backupLoadingEl || !backupContentEl) return;
    backupLoadingEl.style.display = 'block';
    backupContentEl.style.display = 'none';

    // 更新当前目录状态
    currentDirUri = dirUri;
    if (pathEl) pathEl.textContent = dirUri;
    if (backBtnContainer) {
      backBtnContainer.style.display = dirUri === getRootDirUri() ? 'none' : 'flex';
    }

    try {
      const client = createClient(await getOpenVikingConfig());

      // Ensure directory exists
      try {
        await client.fsMkdir(dirUri, 'EchoMem directory');
      } catch (mkdirErr) {
        if (!mkdirErr.message?.toLowerCase().includes('exist')) {
          console.warn('EchoMem: mkdir warning', mkdirErr.message);
        }
      }

      const lsResult = await client.fsLs(dirUri, { output: 'agent', absLimit: 128, showAllHidden: true });
      let entries = Array.isArray(lsResult) ? lsResult : (lsResult?.entries || []);
      entries = entries.filter((e) => (e.name || e.uri?.split('/').pop() || '') !== '.DS_Store');

      if (entries.length === 0) {
        backupLoadingEl.style.display = 'none';
        backupContentEl.style.display = 'block';
        backupContentEl.innerHTML = `
          <div style="text-align: center; padding: 24px 16px; color: #999; font-size: 12px;">
            <p style="font-size: 24px; margin-bottom: 8px;">📂</p>
            <p>暂无文件</p>
          </div>
        `;
        return;
      }

      // Stat each entry for richer info
      const enrichedEntries = await Promise.all(
        entries.map(async (entry) => {
          try {
            const stat = await client.fsStat(entry.uri);
            return { ...entry, stat };
          } catch {
            return { ...entry, stat: null };
          }
        })
      );

      // Separate dirs and files, sort each by modTime descending
      const dirs = enrichedEntries.filter((e) => e.isDir || e.stat?.isDir);
      const files = enrichedEntries.filter((e) => !(e.isDir || e.stat?.isDir));

      const sortByModTime = (a, b) => {
        const ta = a.stat?.modTime ? new Date(a.stat.modTime).getTime() : 0;
        const tb = b.stat?.modTime ? new Date(b.stat.modTime).getTime() : 0;
        return tb - ta;
      };
      dirs.sort(sortByModTime);
      files.sort(sortByModTime);

      const allEntries = [...dirs, ...files];

      // Render list
      const itemsHtml = allEntries.map((entry) => {
        const name = entry.name || entry.uri?.split('/').pop() || '未命名';
        const isDir = entry.isDir || entry.stat?.isDir;
        const icon = isDir ? '📁' : '📄';
        const size = isDir ? '' : formatSize(entry.stat?.size);
        const date = formatDate(entry.stat?.modTime);

        if (isDir) {
          // Folder: clickable to enter
          return `
            <div class="claw-remote-folder" data-uri="${entry.uri}" style="
              padding: 8px 10px;
              background: #f0f9ff;
              border: 1px solid #bae6fd;
              border-radius: 6px;
              display: flex;
              align-items: center;
              gap: 8px;
              font-size: 12px;
              cursor: pointer;
            " title="点击进入文件夹">
              <span style="font-size: 14px;">${icon}</span>
              <span style="flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #0369a1; font-weight: 500;"
                >${name}</span>
              <span style="color: #9ca3af; white-space: nowrap; width: 80px; text-align: right;">${date}</span>
            </div>
          `;
        }

        // File: with delete button
        return `
          <div class="claw-remote-file" data-uri="${entry.uri}" style="
            padding: 8px 10px;
            background: #f9fafb;
            border: 1px solid #e5e7eb;
            border-radius: 6px;
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 12px;
          ">
            <span style="font-size: 14px;">${icon}</span>
            <span style="flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #111827;"
              title="${name}">${name}</span>
            <span style="color: #6b7280; white-space: nowrap; width: 60px; text-align: right;">${size}</span>
            <span style="color: #9ca3af; white-space: nowrap; width: 80px; text-align: right;">${date}</span>
            <button class="claw-remote-btn-delete" data-uri="${entry.uri}" style="
              padding: 3px 8px;
              background: #fef2f2;
              color: #dc2626;
              border: 1px solid #fecaca;
              border-radius: 4px;
              font-size: 11px;
              cursor: pointer;
              white-space: nowrap;
            ">删除</button>
          </div>
        `;
      }).join('');

      backupLoadingEl.style.display = 'none';
      backupContentEl.style.display = 'block';
      backupContentEl.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 4px;">
          ${itemsHtml}
        </div>
      `;

      // Bind folder click events
      backupContentEl.querySelectorAll('.claw-remote-folder').forEach((folder) => {
        folder.addEventListener('click', () => {
          const uri = folder.dataset.uri;
          if (uri) loadRemoteFileList(uri + '/');
        });
      });

      // Bind delete events
      backupContentEl.querySelectorAll('.claw-remote-btn-delete').forEach((btn) => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const uri = btn.dataset.uri;
          if (!uri) return;
          if (!confirm(`确定删除文件「${uri.split('/').pop()}」？`)) return;
          btn.textContent = '删除中...';
          btn.disabled = true;
          try {
            const client = createClient(await getOpenVikingConfig());
            await client.fsRm(uri, false);
            await loadRemoteFileList();
          } catch (err) {
            alert(`删除失败: ${err.message}`);
            btn.textContent = '删除';
            btn.disabled = false;
          }
        });
      });
    } catch (err) {
      backupLoadingEl.style.display = 'none';
      backupContentEl.style.display = 'block';
      backupContentEl.innerHTML = `
        <div style="text-align: center; padding: 16px; color: #b91c1c; font-size: 12px;">
          <p>❌ 加载文件列表失败</p>
          <p style="color: #888;">${err.message}</p>
        </div>
      `;
    }
  }

  // Bind back button
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      const parent = getParentUri(currentDirUri);
      if (parent) loadRemoteFileList(parent);
    });
  }

  // Bind mkdir button
  if (mkdirBtn) {
    mkdirBtn.addEventListener('click', () => {
      const dialogId = 'claw-mkdir-dialog-' + Date.now();
      const dialogHtml = `
        <div id="${dialogId}" style="padding: 24px; display: flex; flex-direction: column; gap: 16px;">
          <div style="display: flex; flex-direction: column; gap: 6px;">
            <label style="font-size: 13px; color: #374151; font-weight: 500;">文件夹名称</label>
            <input type="text" id="claw-mkdir-input" placeholder="请输入文件夹名称" style="
              padding: 10px 12px;
              border: 1px solid #d1d5db;
              border-radius: 6px;
              font-size: 14px;
              outline: none;
              transition: border-color 0.2s;
            " onfocus="this.style.borderColor='#2563eb'" onblur="this.style.borderColor='#d1d5db'">
            <p id="claw-mkdir-error" style="font-size: 12px; color: #dc2626; margin: 0; display: none;"></p>
          </div>
          <div style="display: flex; gap: 10px; justify-content: flex-end;">
            <button id="claw-mkdir-cancel" style="
              padding: 8px 16px;
              background: #f3f4f6;
              color: #374151;
              border: 1px solid #d1d5db;
              border-radius: 6px;
              font-size: 13px;
              cursor: pointer;
            ">取消</button>
            <button id="claw-mkdir-confirm" style="
              padding: 8px 16px;
              background: #2563eb;
              color: white;
              border: none;
              border-radius: 6px;
              font-size: 13px;
              cursor: pointer;
              font-weight: 500;
            ">确定</button>
          </div>
        </div>
      `;

      openCenterOverlay('新建文件夹', dialogHtml, {
        showBack: false,
        width: '360px',
        maxWidth: '360px',
        height: 'auto',
        maxHeight: '240px'
      });

      setTimeout(() => {
        const input = document.getElementById('claw-mkdir-input');
        const confirmBtn = document.getElementById('claw-mkdir-confirm');
        const cancelBtn = document.getElementById('claw-mkdir-cancel');
        const errorEl = document.getElementById('claw-mkdir-error');

        if (input) input.focus();

        const doCreate = async () => {
          const folderName = input?.value?.trim();
          if (!folderName) {
            if (errorEl) { errorEl.textContent = '请输入文件夹名称'; errorEl.style.display = 'block'; }
            return;
          }
          if (folderName.includes('/') || folderName.includes('\\')) {
            if (errorEl) { errorEl.textContent = '文件夹名称不能包含斜杠'; errorEl.style.display = 'block'; }
            return;
          }
          if (errorEl) errorEl.style.display = 'none';
          if (confirmBtn) { confirmBtn.textContent = '创建中...'; confirmBtn.disabled = true; }
          try {
            const client = createClient(await getOpenVikingConfig());
            const targetUri = `${currentDirUri}${folderName}`;
            await client.fsMkdir(targetUri, 'EchoMem folder');
            closeOverlayPanel();
            await loadRemoteFileList();
          } catch (err) {
            if (errorEl) { errorEl.textContent = `创建失败: ${err.message}`; errorEl.style.display = 'block'; }
            if (confirmBtn) { confirmBtn.textContent = '确定'; confirmBtn.disabled = false; }
          }
        };

        confirmBtn?.addEventListener('click', doCreate);
        cancelBtn?.addEventListener('click', closeOverlayPanel);
        input?.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') doCreate();
          if (e.key === 'Escape') closeOverlayPanel();
        });
      }, 50);
    });
  }

  // Initial load
  loadRemoteFileList();

  function clearActivePoll() {
    if (activePollTimer) {
      clearTimeout(activePollTimer);
      activePollTimer = null;
    }
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

  function showResult(html) {
    if (!resultEl) return;
    resultEl.style.display = 'block';
    resultEl.innerHTML = html;
  }

  function hideResult() {
    if (!resultEl) return;
    resultEl.style.display = 'none';
    resultEl.innerHTML = '';
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

  /**
   * 轮询资源处理状态
   */
  async function pollResourceStatus(resourceUri, fileName, sharedClient = null, attempt = 0, maxAttempts = 120) {
    if (attempt >= maxAttempts) {
      showStatus(`⏳ 「${fileName}」已提交后台处理，请到「查看资源」页面查看进度`, 'info');
      showResult(`
        <div style="padding: 12px; background: #f0f7ff; border: 1px solid #c7d8f5; border-radius: 8px; font-size: 13px; color: #333;">
          <p style="margin-bottom: 6px;">📄 <strong>${fileName}</strong></p>
          <p style="color: #667eea; margin: 0;">正在后台处理中，请稍后到「查看资源」页面查看结果</p>
        </div>
      `);
      return;
    }

    try {
      const client = sharedClient || createClient(await getOpenVikingConfig());

      const abstract = await client.contentAbstract(resourceUri);
      const isNotReady = typeof abstract === 'string' && abstract.includes('not ready');
      console.log('[EchoMem] poll abstract', attempt, isNotReady, abstract?.slice(0, 60));

      if (!isNotReady) {
        showStatus(`✅ 「${fileName}」处理完成`, 'success');
        return;
      }

      showStatus(`⏳ 「${fileName}」正在处理中（第 ${attempt + 1} 次检查）...`, 'info');
      activePollTimer = setTimeout(() => {
        pollResourceStatus(resourceUri, fileName, sharedClient, attempt + 1, maxAttempts);
      }, 5000);
    } catch (err) {
      console.warn('[EchoMem] poll failed', err);
      const msg = err.message || '';

      if (msg.includes('401') || msg.includes('Unauthorized') || msg.includes('API Key')) {
        showStatus('❌ 认证失败，请在「记忆后端引擎连接配置」中检查 API Key', 'error');
        showResult(`
          <div style="padding: 12px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; font-size: 13px; color: #b91c1c;">
            <p style="margin-bottom: 6px;">❌ 认证失败</p>
            <p style="margin: 0;">轮询过程中 API Key 验证失败，请到 EchoMem 主页的「记忆后端引擎连接配置」中检查并重新保存配置。</p>
          </div>
        `);
        return;
      }

      if (msg.includes('404') || msg.includes('not found') || msg.includes('Not Found')) {
        showStatus(`⏳ 「${fileName}」正在处理中（第 ${attempt + 1} 次检查）...`, 'info');
        activePollTimer = setTimeout(() => {
          pollResourceStatus(resourceUri, fileName, sharedClient, attempt + 1, maxAttempts);
        }, 5000);
        return;
      }

      activePollTimer = setTimeout(() => {
        pollResourceStatus(resourceUri, fileName, sharedClient, attempt + 1, maxAttempts);
      }, 5000);
    }
  }

  async function doUpload(file) {
    clearActivePoll();
    hideResult();
    showStatus('正在上传...', 'info');

    try {
      const config = await getOpenVikingConfig();
      const client = createClient(config);

      // Step 1: temp upload
      const uploadResult = await client.tempUpload(file);
      const tempFileId = uploadResult?.temp_file_id;
      if (!tempFileId) throw new Error('上传失败：未返回临时文件 ID');

      // Step 2: add resource（异步，不等待处理完成）
      showStatus('文件已上传，正在提交处理...', 'info');
      const addResult = await client.addResource({
        tempFileId,
        parent: currentDirUri,
        wait: false,
        sourceName: file.name,
        keepOriginal: true,
      });

      const resourceUri = addResult?.root_uri || `${currentDirUri}${file.name}`;
      showStatus(`✅ 「${file.name}」已提交，开始轮询处理状态...`, 'success');

      // 刷新当前目录列表
      await loadRemoteFileList();

      // 开始轮询处理状态
      pollResourceStatus(resourceUri, file.name);
    } catch (err) {
      showStatus(`❌ 上传失败: ${formatError(err)}`, 'error');
    }
  }

  // Dropzone click -> open file picker
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
    dropzone.style.borderColor = '#2563eb';
    dropzone.style.background = '#f0f7ff';
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
