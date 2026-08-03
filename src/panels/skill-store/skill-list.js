import { getEntryName, parseSkillMd } from '../../utils/skill-parser.js';
import { getSkillApiName } from './version-history.js';

function getEntryUpdatedAt(entry) {
  return entry?.updated_at || entry?.modTime || entry?.mtime || entry?.modifiedAt;
}

function getEntryBaseUri(entry, dirName, skillRootUri) {
  if (typeof entry?.uri === 'string' && entry.uri.trim()) {
    return entry.uri.replace(/\/$/, '');
  }
  return `${skillRootUri}/${dirName}`;
}

async function readSkillEntry(entry, readSkill, options) {
  const dirName = getEntryName(entry);
  const baseUri = getEntryBaseUri(entry, dirName, options.skillRootUri);

  try {
    const readResult = await readSkill(`${baseUri}/SKILL.md`);
    const content = typeof readResult === 'string'
      ? readResult
      : (readResult?.content ?? readResult?.text ?? '');
    const { frontmatter, body } = parseSkillMd(content);

    return {
      name: frontmatter.name || dirName,
      dirName,
      description: frontmatter.description || entry?.abstract || '',
      uri: baseUri,
      rawContent: body.slice(0, 1000),
      fullContent: content,
      modifiedAt: getEntryUpdatedAt(entry),
      version: frontmatter.version,
      author: frontmatter.author,
    };
  } catch (error) {
    try {
      options.onReadError?.(error, dirName);
    } catch {
      // Diagnostics must not hide an otherwise usable directory entry.
    }
    return {
      name: dirName,
      dirName,
      description: entry?.abstract || '内容暂时无法读取',
      uri: baseUri,
      rawContent: '',
      fullContent: '',
      modifiedAt: getEntryUpdatedAt(entry),
      contentUnavailable: true,
    };
  }
}

export async function readSkillEntries(entries, readSkill, options = {}) {
  const sourceEntries = Array.isArray(entries) ? entries : [];
  if (sourceEntries.length === 0) return [];
  if (typeof readSkill !== 'function') throw new TypeError('readSkill must be a function');

  const requestedConcurrency = Number(options.concurrency);
  const concurrency = Number.isInteger(requestedConcurrency) && requestedConcurrency > 0
    ? requestedConcurrency
    : 6;
  const settings = {
    skillRootUri: options.skillRootUri || 'echo://skills',
    onReadError: options.onReadError,
  };
  const results = new Array(sourceEntries.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < sourceEntries.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await readSkillEntry(sourceEntries[index], readSkill, settings);
    }
  }

  const workerCount = Math.min(concurrency, sourceEntries.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

export function removeSkillByApiName(skills, apiName) {
  const target = String(apiName || '').trim();
  if (!Array.isArray(skills) || !target) return Array.isArray(skills) ? [...skills] : [];
  return skills.filter(skill => getSkillApiName(skill) !== target);
}

export function isSkillUseActivationKey(key) {
  return key === 'Enter' || key === ' ';
}
