// Skill 商店面板内容

export function getSkillStoreHomeContent() {
  const sections = [
    { id: 'history', title: '📜 用户历史 Skill', desc: '查看和管理你使用过的 Skill', color: '#667eea' },
    { id: 'upload', title: '⬆️ 上传 Skill 到商店', desc: '上传你的自定义 Skill 到商店', color: '#42a5f5' },
    { id: 'purchase', title: '🛒 商店 Skill 购买', desc: '浏览和购买商店中的 Skill', color: '#66bb6a' },
    { id: 'merchant', title: '🏪 商家提供的 Skill', desc: '官方和认证商家的 Skill', color: '#ffa726' },
    { id: 'manage', title: '⚙️ Skill 安装管理', desc: '管理已安装的 Skill', color: '#ef5350' }
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
          <li>上传后需要经过审核才能上架</li>
          <li>禁止上传包含恶意代码的 Skill</li>
          <li>审核通常需要 1-3 个工作日</li>
        </ul>
      </div>
      <div>
        <p style="font-weight: 600; color: #333; margin-bottom: 10px; font-size: 14px;">我的上传记录</p>
        <div style="padding: 12px; background: #f5f5f5; border-radius: 8px; font-size: 13px; color: #888;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <span>代码审查助手</span>
            <span style="color: #ffa726;">审核中</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <span>API 文档生成器</span>
            <span style="color: #ffa726;">审核中</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span>日志分析工具</span>
            <span style="color: #66bb6a;">已通过</span>
          </div>
        </div>
      </div>
    </div>
  `;
}

export function getSkillPurchaseContent() {
  return `
    <div style="color: #666;">
      <div style="display: flex; flex-direction: column; gap: 10px;">
        <div style="
          padding: 14px;
          border: 1px solid #e0e0e0;
          border-radius: 10px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          cursor: pointer;
          transition: all 0.2s;
        " onmouseenter="this.style.borderColor='#667eea';this.style.background='#f8f9ff'" onmouseleave="this.style.borderColor='#e0e0e0';this.style.background='none'"
        >
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="width: 40px; height: 40px; background: #e3f2fd; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 18px;">📊</div>
            <div>
              <p style="font-weight: 500; color: #333; font-size: 14px;">数据分析大师</p>
              <p style="font-size: 11px; color: #888;">⭐ 4.8 · 已售 1.2k · 开发者: DataLab</p>
            </div>
          </div>
          <span style="padding: 5px 12px; background: #667eea; color: white; border-radius: 6px; font-size: 13px; font-weight: 600;">¥ 9.9</span>
        </div>
        <div style="
          padding: 14px;
          border: 1px solid #e0e0e0;
          border-radius: 10px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          cursor: pointer;
          transition: all 0.2s;
        " onmouseenter="this.style.borderColor='#667eea';this.style.background='#f8f9ff'" onmouseleave="this.style.borderColor='#e0e0e0';this.style.background='none'"
        >
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="width: 40px; height: 40px; background: #f3e5f5; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 18px;">📝</div>
            <div>
              <p style="font-weight: 500; color: #333; font-size: 14px;">智能写作助手</p>
              <p style="font-size: 11px; color: #888;">⭐ 4.6 · 已售 856 · 开发者: WriteAI</p>
            </div>
          </div>
          <span style="padding: 5px 12px; background: #667eea; color: white; border-radius: 6px; font-size: 13px; font-weight: 600;">¥ 19.9</span>
        </div>
        <div style="
          padding: 14px;
          border: 1px solid #e0e0e0;
          border-radius: 10px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          cursor: pointer;
          transition: all 0.2s;
        " onmouseenter="this.style.borderColor='#667eea';this.style.background='#f8f9ff'" onmouseleave="this.style.borderColor='#e0e0e0';this.style.background='none'"
        >
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="width: 40px; height: 40px; background: #e8f5e9; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 18px;">🎨</div>
            <div>
              <p style="font-weight: 500; color: #333; font-size: 14px;">图像生成器</p>
              <p style="font-size: 11px; color: #888;">⭐ 4.9 · 已售 2.3k · 开发者: ArtGen</p>
            </div>
          </div>
          <span style="padding: 5px 12px; background: #667eea; color: white; border-radius: 6px; font-size: 13px; font-weight: 600;">¥ 29.9</span>
        </div>
      </div>
    </div>
  `;
}

export function getSkillMerchantContent() {
  return `
    <div style="color: #666;">
      <div style="display: flex; flex-direction: column; gap: 10px;">
        <div style="
          padding: 16px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 10px;
          color: white;
          cursor: pointer;
        ">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <div style="width: 36px; height: 36px; background: rgba(255,255,255,0.2); border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 16px;">🏢</div>
              <p style="font-weight: 600; font-size: 15px;">企业级知识库</p>
            </div>
            <span style="padding: 3px 10px; background: rgba(255,255,255,0.2); border-radius: 10px; font-size: 11px;">官方</span>
          </div>
          <p style="font-size: 13px; opacity: 0.9; line-height: 1.5;">集成企业内部文档、流程、规范的智能助手，支持多部门协作和权限管理。</p>
        </div>
        <div style="
          padding: 16px;
          background: #f8f9fa;
          border: 1px solid #e0e0e0;
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.2s;
        " onmouseenter="this.style.borderColor='#667eea';this.style.background='#f0f7ff'" onmouseleave="this.style.borderColor='#e0e0e0';this.style.background='#f8f9fa'"
        >
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <div style="width: 36px; height: 36px; background: #e3f2fd; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 16px;">📋</div>
              <p style="font-weight: 600; color: #333; font-size: 15px;">项目管理助手</p>
            </div>
            <span style="padding: 3px 10px; background: #e3f2fd; color: #1976d2; border-radius: 10px; font-size: 11px;">认证商家</span>
          </div>
          <p style="font-size: 13px; color: #888; line-height: 1.5;">支持 Jira、Trello、Notion 等项目管理工具，自动生成项目报告和进度跟踪。</p>
        </div>
        <div style="
          padding: 16px;
          background: #f8f9fa;
          border: 1px solid #e0e0e0;
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.2s;
        " onmouseenter="this.style.borderColor='#667eea';this.style.background='#f0f7ff'" onmouseleave="this.style.borderColor='#e0e0e0';this.style.background='#f8f9fa'"
        >
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <div style="width: 36px; height: 36px; background: #fff3e0; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 16px;">🔒</div>
              <p style="font-weight: 600; color: #333; font-size: 15px;">安全审计助手</p>
            </div>
            <span style="padding: 3px 10px; background: #e3f2fd; color: #1976d2; border-radius: 10px; font-size: 11px;">认证商家</span>
          </div>
          <p style="font-size: 13px; color: #888; line-height: 1.5;">自动化安全漏洞扫描和代码审计，支持多种编程语言和框架。</p>
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
