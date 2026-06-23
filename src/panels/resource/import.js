// 文档：docs/flows/resource/导入流程.md
// 资源导入页面 —— 客户端读取内容后直接调用 EchoMem /api/resources
// V3: 移除 temp_upload 与 contentAbstract 轮询，URI 改为 echo://

import { getEchoMemConfig } from '../../services/config.js';
import { createClient } from '../../services/echomem-client.js';
import { injectContent } from '../../core/content-injector.js';
import { openCenterOverlay, closeOverlayPanel } from '../../core/panel-host.js';

function normalizeUri(uri) {
  return uri.replace(/\/$/, '');
}

function getRootDirUri() {
  return 'echo://resources';
}

function getParentUri(uri) {
  const clean = normalizeUri(uri);
  const parts = clean.split('/');
  if (parts.length <= 3) return null;
  return parts.slice(0, -1).join('/');
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
          <p id="claw-remote-path" style="font-size: 10px; color: #888; margin: 0; font-family: monospace;">echo://resources</p>
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
        </div>
        <div id="claw-backup-list-loading" style="text-align: center; padding: 16px; color: #888; font-size: 12px;">⏳ 正在加载...</div>
        <div id="claw-backup-list-content" style="display: none;"></div>
      </div>
    </div>
  `;
}

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

  function isDirectory(entry) {
    if (entry.kind) return entry.kind === 'directory';
    return entry.isDir || entry.is_dir || entry.stat?.isDir || entry.stat?.is_dir || false;
  }

  function isFile(entry) {
    if (entry.kind) return entry.kind === 'file';
    return !isDirectory(entry);
  }

  function getEntryName(entry) {
    return entry.name || entry.uri?.split('/').pop() || '未命名';
  }

  function getEntryUpdatedAt(entry) {
    return entry.updated_at || entry.modTime || entry.mtime || entry.modifiedAt;
  }

  function getEntrySize(entry) {
    return entry.size ?? entry.stat?.size;
  }

  function isRootDir(uri) {
    return normalizeUri(uri) === getRootDirUri();
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
      const client = createClient(await getEchoMemConfig());

      const lsResult = await client.fsLs(dirUri, { output: 'agent', absLimit: 128, showAllHidden: true });
      let entries = Array.isArray(lsResult) ? lsResult : (lsResult?.entries || []);
      entries = entries.filter((e) => getEntryName(e) !== '.DS_Store');

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

      // Sort by modTime descending using metadata already returned by fsLs
      const dirs = entries.filter((e) => isDirectory(e));
      const files = entries.filter((e) => isFile(e));

      const sortByModTime = (a, b) => {
        const ta = getEntryUpdatedAt(a) ? new Date(getEntryUpdatedAt(a)).getTime() : 0;
        const tb = getEntryUpdatedAt(b) ? new Date(getEntryUpdatedAt(b)).getTime() : 0;
        return tb - ta;
      };
      dirs.sort(sortByModTime);
      files.sort(sortByModTime);

      const allEntries = [...dirs, ...files];

      // Render list
      const itemsHtml = allEntries.map((entry) => {
        const name = getEntryName(entry);
        const isDir = isDirectory(entry);
        const icon = isDir ? '📁' : '📄';
        const size = isDir ? '' : formatSize(getEntrySize(entry));
        const date = formatDate(getEntryUpdatedAt(entry));
        const atRoot = isRootDir(currentDirUri);

        if (isDir) {
          const deleteBtn = atRoot
            ? `<button class="claw-remote-btn-delete" data-resource-id="${name}" style="
                padding: 3px 8px;
                background: #fef2f2;
                color: #dc2626;
                border: 1px solid #fecaca;
                border-radius: 4px;
                font-size: 11px;
                cursor: pointer;
                white-space: nowrap;
                margin-left: 8px;
              ">删除</button>`
            : '';
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
              ${deleteBtn}
            </div>
          `;
        }

        // File: view button
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
            <button class="claw-remote-btn-view" data-uri="${entry.uri}" style="
              padding: 3px 8px;
              background: #eff6ff;
              color: #2563eb;
              border: 1px solid #bfdbfe;
              border-radius: 4px;
              font-size: 11px;
              cursor: pointer;
              white-space: nowrap;
            ">查看</button>
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
        folder.addEventListener('click', (e) => {
          if (e.target.closest('.claw-remote-btn-delete')) return;
          const uri = folder.dataset.uri;
          if (uri) loadRemoteFileList(normalizeUri(uri));
        });
      });

      // Bind view events for files
      backupContentEl.querySelectorAll('.claw-remote-btn-view').forEach((btn) => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const uri = btn.dataset.uri;
          if (!uri) return;
          btn.textContent = '加载中...';
          try {
            const client = createClient(await getEchoMemConfig());
            const result = await client.fsRead(uri);
            const text = typeof result === 'string' ? result : (result?.content || JSON.stringify(result, null, 2));
            const name = uri.split('/').pop() || uri;
            const previewHtml = `<div style="padding: 16px 18px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 12px; line-height: 1.7; color: #374151; white-space: pre-wrap; word-break: break-word;">${text.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>`;
            openCenterOverlay(name, previewHtml, {
              showBack: true,
              onBack: () => closeOverlayPanel()
            });
          } catch (err) {
            alert(`查看失败: ${err.message}`);
          }
          btn.textContent = '查看';
        });
      });

      // Bind delete events (resource directories at root)
      backupContentEl.querySelectorAll('.claw-remote-btn-delete').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const resourceId = btn.dataset.resourceId;
          if (!resourceId) {
            alert('无法删除：缺少资源 ID');
            return;
          }

          const dialogHtml = `
            <div style="padding: 12px 16px; display: flex; flex-direction: column; gap: 10px;">
              <div style="text-align: center;">
                <p style="font-size: 24px; margin: 0; line-height: 1;">🗑️</p>
                <p style="font-size: 15px; color: #333; font-weight: 500; margin: 4px 0 2px;">确认删除资源</p>
                <p style="font-size: 12px; color: #666; line-height: 1.4; margin: 0;">确定删除资源「<strong style="color: #111;">${resourceId}</strong>」？此操作不可恢复。</p>
              </div>
              <div style="display: flex; gap: 10px; justify-content: center;">
                <button id="claw-resource-del-cancel" style="
                  padding: 8px 20px;
                  background: #f3f4f6;
                  color: #374151;
                  border: 1px solid #d1d5db;
                  border-radius: 8px;
                  font-size: 13px;
                  cursor: pointer;
                  font-weight: 500;
                ">取消</button>
                <button id="claw-resource-del-ok" style="
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

          openCenterOverlay('删除确认', dialogHtml, {
            width: '360px',
            maxWidth: '360px',
            height: '240px',
            maxHeight: '280px'
          });

          setTimeout(() => {
            const cancelBtn = document.getElementById('claw-resource-del-cancel');
            const okBtn = document.getElementById('claw-resource-del-ok');

            cancelBtn?.addEventListener('click', () => {
              closeOverlayPanel();
            });

            okBtn?.addEventListener('click', async () => {
              closeOverlayPanel();
              btn.textContent = '删除中...';
              btn.disabled = true;
              try {
                const client = createClient(await getEchoMemConfig());
                await client.deleteResource(resourceId);
                await loadRemoteFileList();
              } catch (err) {
                alert(`删除失败: ${err.message}`);
                btn.textContent = '删除';
                btn.disabled = false;
              }
            });
          }, 50);
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

  // Initial load
  loadRemoteFileList();

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

  function isTextFile(file) {
    if (file.type?.startsWith('text/')) return true;
    const ext = file.name.split('.').pop().toLowerCase();
    return ['md', 'txt', 'json', 'csv'].includes(ext);
  }

  function readFileContent(file) {
    return new Promise((resolve, reject) => {
      if (isTextFile(file)) {
        file.text().then((text) => resolve({
          content: text,
          contentType: file.type || 'text/plain',
        })).catch(reject);
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result;
        const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
        resolve({
          content: base64,
          contentType: file.type || 'application/octet-stream',
          encoding: 'base64',
        });
      };
      reader.onerror = () => reject(new Error('读取文件失败'));
      reader.readAsDataURL(file);
    });
  }

  async function doUpload(file) {
    hideResult();
    showStatus('正在读取文件...', 'info');

    try {
      const { content, contentType, encoding } = await readFileContent(file);
      const metadata = encoding ? { encoding, source: 'EchoMem extension' } : { source: 'EchoMem extension' };

      showStatus('正在上传...', 'info');
      const config = await getEchoMemConfig();
      const client = createClient(config);

      const result = await client.addResource({
        content,
        name: file.name,
        contentType,
        tags: [],
        metadata,
      });

      showStatus(`✅ 「${file.name}」上传成功`, 'success');
      await loadRemoteFileList();
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
