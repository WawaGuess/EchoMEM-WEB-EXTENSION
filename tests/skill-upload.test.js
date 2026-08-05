import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MAX_SINGLE_SKILL_BYTES,
  MAX_SKILL_PACKAGE_BYTES,
  arrayBufferToBase64,
  normalizeSkillUploadName,
  validateSkillUploadFile,
} from '../src/panels/skill-store/upload.js';

test('Skill upload accepts single files up to 10 MB and ZIP packages up to 50 MB', () => {
  assert.deepEqual(validateSkillUploadFile({ name: 'SKILL.md', size: MAX_SINGLE_SKILL_BYTES }), {
    extension: 'md',
    maxBytes: MAX_SINGLE_SKILL_BYTES,
  });
  assert.deepEqual(validateSkillUploadFile({ name: 'skill.zip', size: MAX_SKILL_PACKAGE_BYTES }), {
    extension: 'zip',
    maxBytes: MAX_SKILL_PACKAGE_BYTES,
  });
  assert.throws(
    () => validateSkillUploadFile({ name: 'skill.zip', size: MAX_SKILL_PACKAGE_BYTES + 1 }),
    /不能超过 50 MB/,
  );
  assert.throws(
    () => validateSkillUploadFile({ name: 'skill.tar', size: 1 }),
    /仅支持 .md \/ .txt \/ .zip/,
  );
});

test('Skill upload names remove supported extensions without overriding package frontmatter', () => {
  assert.equal(normalizeSkillUploadName('frontmatter-name', 'fallback.zip'), 'frontmatter-name');
  assert.equal(normalizeSkillUploadName('', 'fallback.zip'), 'fallback');
});

test('arrayBufferToBase64 encodes package bytes', () => {
  const bytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);
  assert.equal(arrayBufferToBase64(bytes.buffer), 'UEsDBA==');
});
