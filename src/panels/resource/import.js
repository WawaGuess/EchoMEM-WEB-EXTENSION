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
    <style>
      #claw-resource-import-root {
        display: flex;
        flex-direction: column;
        gap: 12px;
        color: #1D1B20;
        font-family: Roboto, "Noto Sans SC", sans-serif;
      }
      #claw-resource-import-root, #claw-resource-import-root * { box-sizing: border-box; }
      #claw-resource-import-root .resource-import-card {
        padding: 15px;
        border: 1px solid #E7E0EC;
        border-radius: 18px;
        background: #FFFFFF;
      }
      #claw-resource-import-root .resource-section-heading {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 0 0 10px;
        color: #1D1B20;
        font-size: 14px;
        font-weight: 600;
        line-height: 1.45;
      }
      #claw-resource-import-root .resource-section-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 30px;
        height: 30px;
        border-radius: 10px;
        background: #F3EDF7;
        color: #6750A4;
        flex: 0 0 auto;
      }
      #claw-resource-import-root #claw-resource-dropzone {
        min-height: 118px;
        padding: 18px 14px;
        border-color: #B9AFC2;
        border-radius: 16px;
        background: #FEF7FF;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 5px;
      }
      #claw-resource-import-root #claw-resource-dropzone:hover {
        border-color: #6750A4;
        background: #F3EDF7;
        box-shadow: 0 0 0 3px rgba(103, 80, 164, 0.08);
      }
      #claw-resource-import-root #claw-resource-dropzone:focus-visible,
      #claw-resource-import-root button:focus-visible {
        outline: 3px solid rgba(103, 80, 164, 0.22);
        outline-offset: 2px;
      }
      #claw-resource-import-root .resource-drop-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 40px;
        height: 40px;
        border-radius: 14px;
        background: #EADDFF;
        color: #6750A4;
      }
      #claw-resource-import-root .resource-drop-title {
        margin: 1px 0 0;
        color: #1D1B20;
        font-size: 12px;
        font-weight: 600;
        line-height: 1.45;
      }
      #claw-resource-import-root .resource-drop-meta {
        margin: 0;
        color: #79747E;
        font-size: 10px;
        line-height: 1.45;
      }
      #claw-resource-import-root #claw-resource-import-status {
        padding: 11px 13px !important;
        border-radius: 12px !important;
        font-size: 12px !important;
        line-height: 1.5;
      }
      #claw-resource-import-root .resource-remote-card { background: #FFFBFE; }
      #claw-resource-import-root .resource-remote-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        margin-bottom: 10px;
      }
      #claw-resource-import-root .resource-remote-header .resource-section-heading { margin: 0; }
      #claw-resource-import-root #claw-remote-path {
        min-width: 0;
        max-width: 54%;
        overflow: hidden;
        padding: 5px 8px;
        border-radius: 8px;
        background: #F3EDF7;
        color: #625B71;
        font: 500 10px/1.35 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      #claw-resource-import-root #claw-remote-back {
        display: inline-flex;
        align-items: center;
        min-height: 34px;
        padding: 6px 12px !important;
        border: 1px solid #E0D4F1 !important;
        border-radius: 999px !important;
        background: #F3EDF7 !important;
        color: #6750A4 !important;
        font-family: inherit !important;
        font-size: 12px !important;
        font-weight: 600 !important;
        line-height: 1.3 !important;
        cursor: pointer;
      }
      #claw-resource-import-root #claw-remote-back:hover { background: #EADDFF !important; }
      #claw-resource-import-root .resource-loading,
      #claw-resource-import-root .resource-empty-state,
      #claw-resource-import-root .resource-error-state {
        padding: 22px 14px !important;
        border: 1px dashed #D8D0DC;
        border-radius: 14px;
        background: #FFFFFF;
        color: #79747E !important;
        text-align: center;
        font-size: 12px;
        line-height: 1.55;
      }
      #claw-resource-import-root .resource-loading-spinner {
        display: inline-block;
        width: 20px;
        height: 20px;
        margin-bottom: 7px;
        border: 2px solid #E7E0EC;
        border-top-color: #6750A4;
        border-radius: 50%;
        animation: resource-import-spin 0.8s linear infinite;
      }
      @keyframes resource-import-spin { to { transform: rotate(360deg); } }
      #claw-resource-import-root .resource-empty-icon,
      #claw-resource-import-root .resource-error-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 42px;
        height: 42px;
        margin-bottom: 8px;
        border-radius: 14px;
        background: #F3EDF7;
        color: #6750A4;
      }
      #claw-resource-import-root .resource-error-state {
        border-color: #F2B8B5;
        background: #FFF8F7;
        color: #B3261E !important;
      }
      #claw-resource-import-root .resource-error-icon {
        background: #F9DEDC;
        color: #B3261E;
      }
      #claw-resource-import-root .resource-file-list {
        display: flex;
        flex-direction: column;
        gap: 7px;
      }
      #claw-resource-import-root .claw-remote-folder,
      #claw-resource-import-root .claw-remote-file {
        min-width: 0;
        padding: 10px 11px !important;
        border: 1px solid #E7E0EC !important;
        border-radius: 13px !important;
        background: #FFFFFF !important;
        gap: 8px !important;
        transition: border-color 0.16s ease, background 0.16s ease, box-shadow 0.16s ease;
      }
      #claw-resource-import-root .claw-remote-folder:hover {
        border-color: #C9B8DE !important;
        background: #FEF7FF !important;
        box-shadow: 0 3px 10px rgba(103, 80, 164, 0.08);
      }
      #claw-resource-import-root .resource-entry-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        border-radius: 9px;
        background: #F3EDF7;
        font-size: 14px !important;
        flex: 0 0 auto;
      }
      #claw-resource-import-root .resource-entry-name {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        color: #1D1B20 !important;
        font-weight: 500 !important;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      #claw-resource-import-root .resource-entry-size,
      #claw-resource-import-root .resource-entry-date {
        color: #79747E !important;
        font-size: 10px;
      }
      #claw-resource-import-root .claw-remote-btn-view,
      #claw-resource-import-root .claw-remote-btn-delete {
        min-height: 30px;
        padding: 5px 10px !important;
        border-radius: 999px !important;
        font-family: inherit !important;
        font-size: 11px !important;
        font-weight: 600 !important;
        line-height: 1.25 !important;
      }
      #claw-resource-import-root .claw-remote-btn-view {
        border: 1px solid #E0D4F1 !important;
        background: #F3EDF7 !important;
        color: #6750A4 !important;
      }
      #claw-resource-import-root .claw-remote-btn-delete {
        border: 1px solid #F2B8B5 !important;
        background: #F9DEDC !important;
        color: #B3261E !important;
      }
      #claw-resource-import-root button:disabled { cursor: wait !important; opacity: 0.58; }
      .claw-overlay-panel--narrow #claw-resource-import-root .resource-import-card { padding: 13px; border-radius: 16px; }
      .claw-overlay-panel--narrow #claw-resource-import-root .resource-remote-header { align-items: flex-start; flex-direction: column; }
      .claw-overlay-panel--narrow #claw-resource-import-root #claw-remote-path { max-width: 100%; width: 100%; }
      .claw-overlay-panel--narrow #claw-resource-import-root .resource-entry-date { display: none; }
      .claw-overlay-panel--narrow #claw-resource-import-root .claw-remote-folder,
      .claw-overlay-panel--narrow #claw-resource-import-root .claw-remote-file { padding: 9px !important; }
      @media (prefers-reduced-motion: reduce) {
        #claw-resource-import-root .resource-loading-spinner { animation: none; }
        #claw-resource-import-root .claw-remote-folder,
        #claw-resource-import-root .claw-remote-file { transition: none; }
      }
    </style>
    <div id="claw-resource-import-root">
      <!-- 本地文件上传 -->
      <div class="resource-import-card">
        <p class="resource-section-heading">
          <span class="resource-section-icon" aria-hidden="true">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4"/></svg>
          </span>
          本地文件上传
        </p>
        <div id="claw-resource-dropzone" style="
          border: 1.5px dashed #B9AFC2;
          border-radius: 16px;
          padding: 18px 14px;
          text-align: center;
          cursor: pointer;
          transition: all 0.2s;
          background: #FEF7FF;
        " onmouseenter="this.style.borderColor='#6750A4';this.style.background='#F3EDF7'"
           onmouseleave="this.style.borderColor='#B9AFC2';this.style.background='#FEF7FF'">
          <span class="resource-drop-icon" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4"/></svg>
          </span>
          <p class="resource-drop-title">点击或拖拽文件到此处</p>
          <p class="resource-drop-meta">支持 PDF、DOC、TXT 与 MD</p>
          <input type="file" id="claw-resource-file-input" style="display: none;" />
        </div>
      </div>

      <!-- 状态提示 -->
      <div id="claw-resource-import-status" style="display: none; padding: 10px 12px; border-radius: 6px; font-size: 13px;"></div>

      <!-- 处理结果区 -->
      <div id="claw-resource-import-result" style="display: none;"></div>

      <!-- 远程文件列表 -->
      <div class="resource-import-card resource-remote-card">
        <div class="resource-remote-header">
          <p class="resource-section-heading">
            <span class="resource-section-icon" aria-hidden="true">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6.5h6l2 2h10v9A2.5 2.5 0 0 1 18.5 20h-13A2.5 2.5 0 0 1 3 17.5v-11Z"/></svg>
            </span>
            远程文件
          </p>
          <p id="claw-remote-path" style="margin: 0;">echo://resources</p>
        </div>
        <div style="display: flex; gap: 8px; margin-bottom: 8px;">
          <div id="claw-remote-back-btn" style="display: none;">
            <button id="claw-remote-back" style="
              padding: 4px 10px;
              background: #F3EDF7;
              border: 1px solid #E0D4F1;
              border-radius: 4px;
              font-size: 12px;
              cursor: pointer;
              color: #6750A4;
            ">← 返回上级</button>
          </div>
        </div>
        <div id="claw-backup-list-loading" class="resource-loading">
          <span class="resource-loading-spinner" aria-hidden="true"></span>
          <div>正在加载远程文件…</div>
        </div>
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
          <div class="resource-empty-state">
            <span class="resource-empty-icon" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6.5h6l2 2h10v9A2.5 2.5 0 0 1 18.5 20h-13A2.5 2.5 0 0 1 3 17.5v-11Z"/></svg>
            </span>
            <p style="margin: 0; color: #49454F; font-weight: 500;">暂无文件</p>
            <p style="margin: 3px 0 0; font-size: 11px;">上传文件后将在此处显示</p>
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
        const icon = isDir
          ? '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#6750A4" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6.5h6l2 2h10v9A2.5 2.5 0 0 1 18.5 20h-13A2.5 2.5 0 0 1 3 17.5v-11Z"/></svg>'
          : '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#6750A4" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h5M9 13h6M9 17h6"/></svg>';
        const size = isDir ? '' : formatSize(getEntrySize(entry));
        const date = formatDate(getEntryUpdatedAt(entry));
        const atRoot = isRootDir(currentDirUri);

        if (isDir) {
          const deleteBtn = atRoot
            ? `<button class="claw-remote-btn-delete" data-resource-id="${name}" style="
                padding: 3px 8px;
                background: #F9DEDC;
                color: #B3261E;
                border: 1px solid #F2B8B5;
                border-radius: 999px;
                font-size: 11px;
                cursor: pointer;
                white-space: nowrap;
                margin-left: 8px;
              ">删除</button>`
            : '';
          return `
            <div class="claw-remote-folder" data-uri="${entry.uri}" style="
              padding: 8px 10px;
              background: #FFFFFF;
              border: 1px solid #E7E0EC;
              border-radius: 13px;
              display: flex;
              align-items: center;
              gap: 8px;
              font-size: 12px;
              cursor: pointer;
            " title="点击进入文件夹">
              <span class="resource-entry-icon">${icon}</span>
              <span class="resource-entry-name" style="flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #1D1B20; font-weight: 500;"
                >${name}</span>
              <span class="resource-entry-date" style="color: #79747E; white-space: nowrap; width: 80px; text-align: right;">${date}</span>
              ${deleteBtn}
            </div>
          `;
        }

        // File: view button
        return `
          <div class="claw-remote-file" data-uri="${entry.uri}" style="
            padding: 8px 10px;
            background: #FFFFFF;
            border: 1px solid #E7E0EC;
            border-radius: 13px;
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 12px;
          ">
            <span class="resource-entry-icon">${icon}</span>
            <span class="resource-entry-name" style="flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #1D1B20;"
              title="${name}">${name}</span>
            <span class="resource-entry-size" style="color: #79747E; white-space: nowrap; width: 60px; text-align: right;">${size}</span>
            <span class="resource-entry-date" style="color: #79747E; white-space: nowrap; width: 80px; text-align: right;">${date}</span>
            <button class="claw-remote-btn-view" data-uri="${entry.uri}" style="
              padding: 3px 8px;
              background: #F3EDF7;
              color: #6750A4;
              border: 1px solid #E0D4F1;
              border-radius: 999px;
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
        <div class="resource-file-list">
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
            const previewHtml = `<div style="padding: 18px; border-radius: 14px; background: #FFFBFE; color: #49454F; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 12px; line-height: 1.72; white-space: pre-wrap; word-break: break-word;">${text.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>`;
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
            <div class="echomem-confirm-dialog" style="padding: 18px 16px; display: flex; flex-direction: column; gap: 14px; color: #1D1B20; font-family: Roboto, 'Noto Sans SC', sans-serif;">
              <div style="text-align: center;">
                <span style="display: inline-flex; align-items: center; justify-content: center; width: 46px; height: 46px; border-radius: 16px; background: #F9DEDC; color: #B3261E;" aria-hidden="true">
                  <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 10v6M14 10v6"/></svg>
                </span>
                <p style="font-size: 15px; color: #1D1B20; font-weight: 600; margin: 8px 0 4px;">确认删除资源</p>
                <p style="font-size: 12px; color: #625F66; line-height: 1.55; margin: 0;">确定删除资源「<strong style="color: #1D1B20; word-break: break-all;">${resourceId}</strong>」？此操作不可恢复。</p>
              </div>
              <div style="display: flex; flex-wrap: wrap; gap: 10px; justify-content: center;">
                <button id="claw-resource-del-cancel" style="
                  min-width: 104px;
                  min-height: 40px;
                  padding: 8px 18px;
                  background: #F3EDF7;
                  color: #6750A4;
                  border: 1px solid #E0D4F1;
                  border-radius: 999px;
                  font-size: 13px;
                  cursor: pointer;
                  font-weight: 600;
                ">取消</button>
                <button id="claw-resource-del-ok" style="
                  min-width: 104px;
                  min-height: 40px;
                  padding: 8px 18px;
                  background: #B3261E;
                  color: #FFFFFF;
                  border: 1px solid #B3261E;
                  border-radius: 999px;
                  font-size: 13px;
                  cursor: pointer;
                  font-weight: 600;
                ">确认删除</button>
              </div>
            </div>
          `;

          openCenterOverlay('删除确认', dialogHtml, {
            width: 'min(360px, calc(100vw - 24px))',
            maxWidth: 'calc(100vw - 24px)',
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
        <div class="resource-error-state">
          <span class="resource-error-icon" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 17h.01"/></svg>
          </span>
          <p style="margin: 0; font-weight: 600;">加载文件列表失败</p>
          <p style="margin: 4px 0 0; color: #79747E; word-break: break-word;">${err.message}</p>
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
      info: { bg: '#F3EDF7', border: '#E0D4F1', text: '#6750A4' },
      success: { bg: '#E8F5E9', border: '#B7DDB9', text: '#1B5E20' },
      error: { bg: '#F9DEDC', border: '#F2B8B5', text: '#B3261E' }
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
    dropzone.style.borderColor = '#6750A4';
    dropzone.style.background = '#F3EDF7';
  });
  dropzone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dropzone.style.borderColor = '#B9AFC2';
    dropzone.style.background = '#FEF7FF';
  });
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.style.borderColor = '#B9AFC2';
    dropzone.style.background = '#FEF7FF';
    const file = e.dataTransfer?.files?.[0];
    if (file) doUpload(file);
  });
}
