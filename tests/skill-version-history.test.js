import test from 'node:test';
import assert from 'node:assert/strict';

import {
  classifyVersionError,
  escapeHtml,
  formatSkillCommand,
  formatVersionDate,
  formatVersionLabel,
  getSkillApiName,
  getVersionSourceLabel,
  normalizeSkillVersionHistory,
} from '../src/panels/skill-store/version-history.js';

test('normalizeSkillVersionHistory filters, deduplicates, sorts, and marks one current version', () => {
  const result = normalizeSkillVersionHistory({
    name: 'demo',
    current_version: '2',
    versions: [
      { version: 1, source: 'generated', current: true, exists: true },
      { version: 2, source: 'generated', parent_version: 1, exists: true },
      { version: '2', source: 'optimized', parent_version: '1', run_id: 'run-2' },
      { version: 0, source: 'invalid' },
      { version: 'v3', source: 'invalid' },
    ],
  });

  assert.equal(result.name, 'demo');
  assert.equal(result.currentVersion, 2);
  assert.deepEqual(result.versions.map(item => item.version), [2, 1]);
  assert.equal(result.versions[0].source, 'optimized');
  assert.equal(result.versions[0].parentVersion, 1);
  assert.equal(result.versions[0].runId, 'run-2');
  assert.equal(result.versions[0].current, true);
  assert.equal(result.versions[1].current, false);
  assert.equal(result.versions.filter(item => item.current).length, 1);
});

test('normalizeSkillVersionHistory falls back to the flagged current version and safe defaults', () => {
  const result = normalizeSkillVersionHistory({
    versions: [
      { version: 3, current: true, exists: false },
      { version: 1 },
    ],
  });

  assert.equal(result.currentVersion, 3);
  assert.equal(result.versions[0].current, true);
  assert.equal(result.versions[0].exists, false);
  assert.equal(result.versions[1].exists, true);
  assert.equal(result.versions[1].parentVersion, null);
});

test('version labels, source labels, dates, and HTML escaping are stable', () => {
  assert.equal(formatVersionLabel(2), 'v2');
  assert.equal(formatVersionLabel('v002'), 'v2');
  assert.equal(formatVersionLabel('custom'), 'custom');
  assert.equal(formatVersionLabel(null), '—');
  assert.equal(getVersionSourceLabel('manual_upload'), '手动上传');
  assert.equal(getVersionSourceLabel('optimized'), '自动优化');
  assert.equal(getVersionSourceLabel('unknown'), '未知来源');
  assert.equal(getVersionSourceLabel(), '未知来源');
  assert.equal(formatVersionDate('2026-07-28T12:00:00Z'), '2026-07-28');
  assert.equal(formatVersionDate('invalid'), '—');
  assert.equal(escapeHtml(`<tag a="1">Tom & 'Jerry'</tag>`), '&lt;tag a=&quot;1&quot;&gt;Tom &amp; &#39;Jerry&#39;&lt;/tag&gt;');
});

test('classifyVersionError distinguishes unsupported, auth, timeout, network, and generic failures', () => {
  assert.equal(classifyVersionError({ status: 404 }), 'unsupported');
  assert.equal(classifyVersionError({ status: '405' }), 'unsupported');
  assert.equal(classifyVersionError({ status: 401 }), 'auth');
  assert.equal(classifyVersionError({ name: 'AbortError' }), 'timeout');
  assert.equal(classifyVersionError({ message: 'Failed to fetch' }), 'network');
  assert.equal(classifyVersionError({ message: 'boom' }), 'error');
});

test('getSkillApiName prefers the real directory name over the display name', () => {
  assert.equal(getSkillApiName({ dirName: 'actual-skill', name: '展示名称' }), 'actual-skill');
  assert.equal(getSkillApiName({ name: 'fallback-name' }), 'fallback-name');
  assert.equal(getSkillApiName(null), '');
});

test('formatSkillCommand uses the canonical Skill directory name', () => {
  assert.equal(formatSkillCommand({ dirName: 'actual-skill', name: '展示名称' }), '/actual-skill');
  assert.equal(formatSkillCommand({ name: 'fallback-name' }), '/fallback-name');
  assert.equal(formatSkillCommand({ dirName: '/already-prefixed' }), '/already-prefixed');
  assert.equal(formatSkillCommand(null), '');
});
