// 输入联想面板内容

let inputAssociationEnabled = false;

export function getInputAssociationContent() {
  const btnText = inputAssociationEnabled ? '关闭联想' : '确认开启';
  const btnBg = inputAssociationEnabled ? '#ffebee' : '#667eea';
  const btnColor = inputAssociationEnabled ? '#c62828' : '#fff';
  const statusText = inputAssociationEnabled ? '✅ 输入联想已开启' : '❌ 输入联想未开启';
  const statusColor = inputAssociationEnabled ? '#2e7d32' : '#888';

  return `
    <div style="color: #666;">
      <div style="margin-bottom: 20px;">
        <button id="claw-toggle-association" style="
          width: 100%;
          padding: 12px;
          background: ${btnBg};
          color: ${btnColor};
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        "
        >${btnText}</button>
      </div>
      <div style="
        padding: 12px;
        background: #f8f9fa;
        border-radius: 8px;
        margin-bottom: 20px;
        text-align: center;
      ">
        <p id="claw-association-status" style="
          margin: 0;
          font-size: 14px;
          font-weight: 500;
          color: ${statusColor};
        ">${statusText}</p>
      </div>
      <div style="margin-bottom: 16px;">
        <p style="font-weight: 600; color: #333; margin-bottom: 10px; font-size: 14px;">💡 功能说明</p>
        <ul style="font-size: 13px; color: #666; padding-left: 18px; line-height: 1.8; margin: 0;">
          <li>智能补全：根据上下文自动补全代码和文本</li>
          <li>代码片段联想：快速插入常用代码片段</li>
          <li>历史记录联想：基于历史输入提供建议</li>
        </ul>
      </div>
      <div style="
        padding: 12px;
        background: #f0f7ff;
        border-radius: 6px;
        font-size: 13px;
        border-left: 3px solid #667eea;
        color: #666;
      ">
        💡 提示：输入时按 Tab 键快速接受联想建议
      </div>
    </div>
  `;
}

export function toggleInputAssociation() {
  inputAssociationEnabled = !inputAssociationEnabled;
  return inputAssociationEnabled;
}

export function getAssociationStatus() {
  return inputAssociationEnabled;
}

export function bindToggleButton(callback) {
  const toggleBtn = document.getElementById('claw-toggle-association');
  if (toggleBtn && !toggleBtn.dataset.clawBound) {
    toggleBtn.dataset.clawBound = 'true';
    toggleBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (callback) callback();
    });
  }
}
