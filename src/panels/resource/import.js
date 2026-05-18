// 资源导入页面 —— 异步轮询模式，不阻塞等待后端语义提取

import { getOpenVikingConfig } from '../../services/config.js';
import { createClient } from '../../services/openviking-client.js';
import { getCurrentPlatform } from '../../core/detection.js';
import { injectContent } from '../../core/content-injector.js';

function getPlatformKey() {
  const platform = getCurrentPlatform();
  return platform?.key || 'unknown';
}

function getCurrentMonthDir() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function getResourceDirUri() {
  const platform = getPlatformKey();
  const month = getCurrentMonthDir();
  return `viking://resources/${platform}/${month}`;
}

export function getResourceImportContent() {
  return `
    <div style="display: flex; flex-direction: column; gap: 16px; color: #333;">
      <!-- 本地文件上传 -->
      <div>
        <p style="font-weight: 600; font-size: 14px; margin-bottom: 10px;">📁 本地文件上传</p>
        <div id="claw-resource-dropzone" style="
          border: 2px dashed #ccc;
          border-radius: 10px;
          padding: 32px 20px;
          text-align: center;
          cursor: pointer;
          transition: all 0.2s;
          background: #fafafa;
        " onmouseenter="this.style.borderColor='#2563eb';this.style.background='#f0f7ff'"
           onmouseleave="this.style.borderColor='#ccc';this.style.background='#fafafa'">
          <p style="font-size: 28px; margin-bottom: 8px;">📤</p>
          <p style="font-size: 14px; font-weight: 500; margin-bottom: 4px;">点击或拖拽文件到此处</p>
          <p style="font-size: 12px; color: #888;">支持 PDF, DOC, TXT, MD 等格式</p>
          <input type="file" id="claw-resource-file-input" style="display: none;" />
        </div>
      </div>

      <!-- URL 上传 -->
      <div>
        <p style="font-weight: 600; font-size: 14px; margin-bottom: 10px;">🌐 通过 URL 添加</p>
        <div style="display: flex; gap: 8px;">
          <input type="text" id="claw-resource-url-input" placeholder="输入资源 URL（HTTP/HTTPS）" style="
            flex: 1;
            padding: 10px 12px;
            border: 1px solid #ddd;
            border-radius: 6px;
            font-size: 13px;
            outline: none;
          " />
          <button id="claw-resource-url-btn" style="
            padding: 10px 16px;
            background: #2563eb;
            color: white;
            border: none;
            border-radius: 6px;
            font-size: 13px;
            cursor: pointer;
            white-space: nowrap;
          ">添加</button>
        </div>
      </div>

      <!-- 状态提示 -->
      <div id="claw-resource-import-status" style="display: none; padding: 10px 12px; border-radius: 6px; font-size: 13px;"></div>

      <!-- 处理结果区 -->
      <div id="claw-resource-import-result" style="display: none;"></div>
    </div>
  `;
}

let activePollTimer = null;

export async function initImportPanel(bodyElement) {
  if (!bodyElement) return;

  const dropzone = bodyElement.querySelector('#claw-resource-dropzone');
  const fileInput = bodyElement.querySelector('#claw-resource-file-input');
  const urlInput = bodyElement.querySelector('#claw-resource-url-input');
  const urlBtn = bodyElement.querySelector('#claw-resource-url-btn');
  const statusEl = bodyElement.querySelector('#claw-resource-import-status');
  const resultEl = bodyElement.querySelector('#claw-resource-import-result');

  if (!dropzone || !fileInput) return;

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
      return '无法连接到 OpenViking 后端，请检查服务地址和认证配置';
    }
    if (err.message?.includes('401') || err.message?.includes('403')) {
      return '认证失败，请在 EchoMem 主页的「OpenViking 连接配置」中检查 API Key';
    }
    return err.message;
  }

  /**
   * 轮询资源处理状态
   * @param {string} resourceUri 资源 URI
   * @param {string} fileName 文件名（用于显示）
   * @param {number} attempt 当前轮询次数
   * @param {number} maxAttempts 最大轮询次数（默认 36 = 3 分钟）
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

      // 用 content/abstract 检查 .abstract.md 是否已生成
      // OpenViking 后台处理完成后才会生成 .abstract.md，
      // 未生成时返回占位符 "# {uri}\n\n[Directory abstract is not ready]"
      const abstract = await client.contentAbstract(resourceUri);
      const isNotReady = typeof abstract === 'string' && abstract.includes('not ready');
      console.log('[EchoMem] poll abstract', attempt, isNotReady, abstract?.slice(0, 60));

      if (!isNotReady) {
        showStatus(`✅ 「${fileName}」处理完成`, 'success');
        showResult(`
          <div style="padding: 12px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px;">
            <p style="font-size: 13px; color: #15803d; margin-bottom: 10px;">✅ 「${fileName}」已处理完成</p>
            <div style="display: flex; gap: 8px;">
              <button id="claw-result-save-only" style="flex: 1; padding: 8px; background: white; border: 1px solid #ddd; border-radius: 6px; font-size: 13px; cursor: pointer;">仅保存</button>
              <button id="claw-result-insert" style="flex: 1; padding: 8px; background: #2563eb; color: white; border: none; border-radius: 6px; font-size: 13px; cursor: pointer;">插入对话</button>
            </div>
          </div>
        `);

        // Bind buttons
        const saveBtn = resultEl.querySelector('#claw-result-save-only');
        const insertBtn = resultEl.querySelector('#claw-result-insert');
        saveBtn?.addEventListener('click', hideResult);
        insertBtn?.addEventListener('click', async () => {
          insertBtn.textContent = '插入中...';
          try {
            const contentResult = await client.contentOverview(resourceUri);
            const text = typeof contentResult === 'string' ? contentResult : JSON.stringify(contentResult, null, 2);
            injectContent(text, { replace: false });
            hideResult();
          } catch (err) {
            alert(`插入失败: ${err.message}`);
            insertBtn.textContent = '插入对话';
          }
        });
        return;
      }

      // 继续轮询
      showStatus(`⏳ 「${fileName}」正在处理中（第 ${attempt + 1} 次检查）...`, 'info');
      activePollTimer = setTimeout(() => {
        pollResourceStatus(resourceUri, fileName, sharedClient, attempt + 1, maxAttempts);
      }, 5000);
    } catch (err) {
      console.warn('[EchoMem] poll failed', err);
      const msg = err.message || '';

      // 认证失败：立即停止，提示用户检查配置
      if (msg.includes('401') || msg.includes('Unauthorized') || msg.includes('API Key')) {
        showStatus('❌ 认证失败，请在「OpenViking 连接配置」中检查 API Key', 'error');
        showResult(`
          <div style="padding: 12px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; font-size: 13px; color: #b91c1c;">
            <p style="margin-bottom: 6px;">❌ 认证失败</p>
            <p style="margin: 0;">轮询过程中 API Key 验证失败，请到 EchoMem 主页的「OpenViking 连接配置」中检查并重新保存配置。</p>
          </div>
        `);
        return;
      }

      // 404 文件不存在：继续轮询（后台还在处理）
      if (msg.includes('404') || msg.includes('not found') || msg.includes('Not Found')) {
        showStatus(`⏳ 「${fileName}」正在处理中（第 ${attempt + 1} 次检查）...`, 'info');
        activePollTimer = setTimeout(() => {
          pollResourceStatus(resourceUri, fileName, sharedClient, attempt + 1, maxAttempts);
        }, 5000);
        return;
      }

      // 其他错误：继续轮询，可能是 transient 的
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

      // 确保目标目录存在
      const parentUri = getResourceDirUri();
      try {
        await client.fsMkdir(parentUri, `Resources for ${getPlatformKey()}`);
      } catch (mkdirErr) {
        if (!mkdirErr.message?.toLowerCase().includes('exist')) {
          console.warn('EchoMem: mkdir warning', mkdirErr.message);
        }
      }

      // Step 2: add resource（异步，不等待处理完成）
      showStatus('文件已上传，正在提交处理...', 'info');
      const addResult = await client.addResource({
        tempFileId,
        parent: parentUri,
        wait: false,
        sourceName: file.name,
      });

      const resourceUri = addResult?.root_uri || `${parentUri}/${file.name}`;
      showStatus(`✅ 「${file.name}」已提交，开始轮询处理状态...`, 'success');

      // 开始轮询处理状态
      pollResourceStatus(resourceUri, file.name);
    } catch (err) {
      showStatus(`❌ 上传失败: ${formatError(err)}`, 'error');
    }
  }

  async function doUrlAdd(url) {
    if (!url.trim()) return;
    clearActivePoll();
    hideResult();
    showStatus('正在添加 URL 资源...', 'info');

    try {
      const config = await getOpenVikingConfig();
      const client = createClient(config);
      const parentUri = getResourceDirUri();

      // 确保目标目录存在
      try {
        await client.fsMkdir(parentUri, `Resources for ${getPlatformKey()}`);
      } catch (mkdirErr) {
        if (!mkdirErr.message?.toLowerCase().includes('exist')) {
          console.warn('EchoMem: mkdir warning', mkdirErr.message);
        }
      }

      const addResult = await client.addResource({
        path: url.trim(),
        parent: parentUri,
        wait: false,
      });

      const resourceUri = addResult?.root_uri || `${parentUri}/${url.split('/').pop() || 'resource'}`;
      showStatus(`✅ URL 资源已提交，开始轮询处理状态...`, 'success');
      pollResourceStatus(resourceUri, url.split('/').pop() || 'resource');
    } catch (err) {
      showStatus(`❌ 添加失败: ${formatError(err)}`, 'error');
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

  // URL add
  urlBtn?.addEventListener('click', () => {
    doUrlAdd(urlInput?.value || '');
  });
  urlInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') doUrlAdd(urlInput?.value || '');
  });
}
