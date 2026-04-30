// 资源管理面板内容

export function getResourceContent() {
  return `
    <div style="color: #666;">
      <p style="margin-bottom: 12px;">📁 资源管理面板</p>
      <div style="
        border: 1px dashed #ccc;
        border-radius: 8px;
        padding: 24px;
        text-align: center;
        color: #999;
      ">
        <p>拖拽文件到此处上传</p>
        <p style="font-size: 12px; margin-top: 8px;">支持 PDF, DOC, TXT, MD 等格式</p>
      </div>
      <div style="margin-top: 16px;">
        <p style="font-weight: 500; margin-bottom: 8px; color: #333;">已上传资源</p>
        <div style="
          padding: 12px;
          background: #f5f5f5;
          border-radius: 6px;
          font-size: 13px;
          color: #999;
        ">暂无资源</div>
      </div>
    </div>
  `;
}
