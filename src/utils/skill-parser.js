// Skill 文件解析工具 —— 解析 SKILL.md 的 YAML frontmatter 和 Markdown 正文

const FRONTMATTER_PATTERN = /^---\s*\n(.*?)\n---\s*\n(.*)$/s;

export function parseSkillMd(content) {
  // 去除 UTF-8 BOM 头
  const cleanContent = content.replace(/^\uFEFF/, '');
  const match = cleanContent.match(FRONTMATTER_PATTERN);
  if (!match) {
    return {
      frontmatter: {},
      body: cleanContent,
    };
  }

  let frontmatter = {};
  try {
    // 使用简单的键值对解析，避免引入 js-yaml 依赖
    frontmatter = parseSimpleYaml(match[1]);
  } catch (err) {
    console.warn('Failed to parse skill frontmatter:', err);
  }

  return {
    frontmatter,
    body: match[2],
  };
}

function parseSimpleYaml(yamlText) {
  const result = {};
  const lines = yamlText.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const colonIndex = trimmed.indexOf(':');
    if (colonIndex === -1) continue;

    const key = trimmed.slice(0, colonIndex).trim();
    let value = trimmed.slice(colonIndex + 1).trim();

    // Remove surrounding quotes
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    if (key) {
      result[key] = value;
    }
  }

  return result;
}

// 辅助函数：安全地从 entry 提取目录名
export function getEntryName(entry) {
  if (entry?.name) return entry.name;
  if (entry?.uri) {
    const parts = entry.uri.split('/').filter(Boolean);
    return parts[parts.length - 1] || '未命名';
  }
  return '未命名';
}
