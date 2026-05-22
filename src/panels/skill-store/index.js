// Skill 管理面板内容

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
  return `
    <div style="color: #666;">
      <div style="display: flex; flex-direction: column; gap: 8px;">
        <div style="
          padding: 12px;
          background: #f0f7ff;
          border: 1px solid #c7d8f5;
          border-radius: 8px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        ">
          <div>
            <p style="font-weight: 500; color: #333; font-size: 14px;">SQL 查询助手</p>
            <p style="font-size: 12px; color: #888;">上次使用: 2天前 · 使用 15 次</p>
          </div>
          <span style="padding: 3px 10px; background: #667eea; color: white; border-radius: 10px; font-size: 11px;">已启用</span>
        </div>
        <div style="
          padding: 12px;
          background: #f5f5f5;
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        ">
          <div>
            <p style="font-weight: 500; color: #333; font-size: 14px;">JSON 格式化</p>
            <p style="font-size: 12px; color: #888;">上次使用: 1周前 · 使用 8 次</p>
          </div>
          <span style="padding: 3px 10px; background: #999; color: white; border-radius: 10px; font-size: 11px;">已停用</span>
        </div>
        <div style="
          padding: 12px;
          background: #f0f7ff;
          border: 1px solid #c7d8f5;
          border-radius: 8px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        ">
          <div>
            <p style="font-weight: 500; color: #333; font-size: 14px;">正则表达式工具</p>
            <p style="font-size: 12px; color: #888;">上次使用: 3天前 · 使用 23 次</p>
          </div>
          <span style="padding: 3px 10px; background: #667eea; color: white; border-radius: 10px; font-size: 11px;">已启用</span>
        </div>
      </div>
    </div>
  `;
}

export function getSkillUploadContent() {
  return `
    <div style="color: #666;">
      <div style="
        border: 2px dashed #ccc;
        border-radius: 12px;
        padding: 40px 20px;
        text-align: center;
        cursor: pointer;
        transition: all 0.2s;
        margin-bottom: 20px;
      " onmouseenter="this.style.borderColor='#667eea';this.style.background='#f8f9ff'" onmouseleave="this.style.borderColor='#ccc';this.style.background='none'"
      >
        <p style="font-size: 36px; margin-bottom: 8px;">📤</p>
        <p style="font-size: 14px; color: #333; font-weight: 500; margin-bottom: 4px;">点击或拖拽上传 Skill 文件</p>
        <p style="font-size: 12px; color: #999;">支持 .skill .json .yaml 格式，最大 10MB</p>
      </div>
      <div style="margin-bottom: 20px;">
        <p style="font-weight: 600; color: #333; margin-bottom: 10px; font-size: 14px;">上传须知</p>
        <ul style="font-size: 13px; color: #666; padding-left: 18px; line-height: 1.8;">
          <li>Skill 文件需包含完整的配置信息</li>
          <li>上传后直接安装到本地使用</li>
          <li>禁止上传包含恶意代码的 Skill</li>
          <li>同名 Skill 上传将覆盖旧版本</li>
        </ul>
      </div>
      <div>
        <p style="font-weight: 600; color: #333; margin-bottom: 10px; font-size: 14px;">上传记录</p>
        <div style="padding: 12px; background: #f5f5f5; border-radius: 8px; font-size: 13px; color: #888;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <span>代码审查助手</span>
            <span style="color: #66bb6a;">已导入</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <span>API 文档生成器</span>
            <span style="color: #66bb6a;">已导入</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span>日志分析工具</span>
            <span style="color: #66bb6a;">已导入</span>
          </div>
        </div>
      </div>
    </div>
  `;
}

export function getSkillManageContent() {
  return `
    <div style="color: #666;">
      <div style="display: flex; flex-direction: column; gap: 10px;">
        <div style="
          padding: 14px;
          background: #f5f5f5;
          border-radius: 8px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        ">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="width: 40px; height: 40px; background: #e3f2fd; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 18px;">📊</div>
            <div>
              <p style="font-weight: 500; color: #333; font-size: 14px;">数据分析大师</p>
              <p style="font-size: 12px; color: #888;">v2.1.0 · 占用 12MB · 上次更新: 3天前</p>
            </div>
          </div>
          <div style="display: flex; gap: 6px;">
            <button style="padding: 5px 12px; background: #667eea; color: white; border: none; border-radius: 4px; font-size: 12px; cursor: pointer;">更新</button>
            <button style="padding: 5px 12px; background: #ffebee; color: #c62828; border: none; border-radius: 4px; font-size: 12px; cursor: pointer;">卸载</button>
          </div>
        </div>
        <div style="
          padding: 14px;
          background: #f5f5f5;
          border-radius: 8px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        ">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="width: 40px; height: 40px; background: #f3e5f5; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 18px;">📝</div>
            <div>
              <p style="font-weight: 500; color: #333; font-size: 14px;">智能写作助手</p>
              <p style="font-size: 12px; color: #888;">v1.5.2 · 占用 8MB · 已是最新版本</p>
            </div>
          </div>
          <div style="display: flex; gap: 6px;">
            <button style="padding: 5px 12px; background: #e8f5e9; color: #2e7d32; border: none; border-radius: 4px; font-size: 12px; cursor: pointer;">最新</button>
            <button style="padding: 5px 12px; background: #ffebee; color: #c62828; border: none; border-radius: 4px; font-size: 12px; cursor: pointer;">卸载</button>
          </div>
        </div>
        <div style="
          padding: 14px;
          background: #f5f5f5;
          border-radius: 8px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        ">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="width: 40px; height: 40px; background: #fff3e0; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 18px;">🔍</div>
            <div>
              <p style="font-weight: 500; color: #333; font-size: 14px;">正则表达式工具</p>
              <p style="font-size: 12px; color: #888;">v1.0.0 · 占用 3MB · 上次更新: 1周前</p>
            </div>
          </div>
          <div style="display: flex; gap: 6px;">
            <button style="padding: 5px 12px; background: #667eea; color: white; border: none; border-radius: 4px; font-size: 12px; cursor: pointer;">更新</button>
            <button style="padding: 5px 12px; background: #ffebee; color: #c62828; border: none; border-radius: 4px; font-size: 12px; cursor: pointer;">卸载</button>
          </div>
        </div>
      </div>
      <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #e0e0e0;">
        <div style="display: flex; justify-content: space-between; font-size: 13px; color: #666;">
          <span>已安装: 5 个 Skill</span>
          <span>总占用: 45MB</span>
        </div>
        <button style="
          width: 100%;
          margin-top: 12px;
          padding: 10px;
          background: #ffebee;
          color: #c62828;
          border: 1px solid #ef9a9a;
          border-radius: 6px;
          cursor: pointer;
          font-size: 13px;
          font-weight: 500;
        ">一键卸载全部 Skill</button>
      </div>
    </div>
  `;
}
