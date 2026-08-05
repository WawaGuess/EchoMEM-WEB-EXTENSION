export const MAX_SINGLE_SKILL_BYTES = 10 * 1024 * 1024;
export const MAX_SKILL_PACKAGE_BYTES = 50 * 1024 * 1024;

const SUPPORTED_EXTENSIONS = new Set(['md', 'txt', 'zip']);

export function getSkillUploadExtension(fileName) {
  const name = String(fileName || '').trim();
  const dotIndex = name.lastIndexOf('.');
  const extension = dotIndex >= 0 ? name.slice(dotIndex + 1).toLowerCase() : '';
  if (!SUPPORTED_EXTENSIONS.has(extension)) {
    throw new Error('当前版本仅支持 .md / .txt / .zip 格式 Skill');
  }
  return extension;
}

export function getSkillUploadMaxBytes(extension) {
  return extension === 'zip' ? MAX_SKILL_PACKAGE_BYTES : MAX_SINGLE_SKILL_BYTES;
}

export function validateSkillUploadFile(file) {
  const extension = getSkillUploadExtension(file?.name);
  const maxBytes = getSkillUploadMaxBytes(extension);
  if (!Number.isFinite(file?.size) || file.size < 0) {
    throw new Error('无法读取文件大小');
  }
  if (file.size > maxBytes) {
    const maxMb = Math.round(maxBytes / (1024 * 1024));
    throw new Error(`文件过大，${extension === 'zip' ? 'Skill Package' : '单文件 Skill'}不能超过 ${maxMb} MB`);
  }
  return { extension, maxBytes };
}

export function normalizeSkillUploadName(name, fileName) {
  const fallback = String(fileName || '').replace(/\.(md|txt|zip)$/i, '');
  return String(typeof name === 'string' && name.trim() ? name : fallback)
    .replace(/\.(md|txt|zip)$/i, '')
    .trim();
}

export function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}
