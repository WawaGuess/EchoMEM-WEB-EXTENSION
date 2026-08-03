import test from 'node:test';
import assert from 'node:assert/strict';

import { composePlainTextInsertion } from '../src/core/text-insertion.js';

test('composePlainTextInsertion inserts a Skill command with a trailing space', () => {
  assert.deepEqual(composePlainTextInsertion('', '/actual-skill', 0, 0), {
    value: '/actual-skill ',
    cursor: 14,
  });
});

test('composePlainTextInsertion preserves existing text and selection', () => {
  assert.deepEqual(composePlainTextInsertion('请 review 代码', '/actual-skill', 2, 8), {
    value: '请 /actual-skill 代码',
    cursor: 15,
  });

  assert.deepEqual(composePlainTextInsertion('已有内容', '/actual-skill'), {
    value: '已有内容 /actual-skill ',
    cursor: 19,
  });
});

test('composePlainTextInsertion rejects empty content', () => {
  assert.equal(composePlainTextInsertion('已有内容', '   ', 0, 0), null);
});
