import assert from 'node:assert/strict';
import test from 'node:test';

import { readSkillEntries } from '../src/panels/skill-store/skill-list.js';

test('readSkillEntries keeps directory entries whose content read fails', async () => {
  const errors = [];
  const skills = await readSkillEntries([
    { name: 'working', uri: 'echo://skills/working', abstract: 'Working abstract' },
    { name: 'fallback', uri: 'echo://skills/fallback', abstract: 'Fallback abstract' },
  ], async (uri) => {
    if (uri.includes('fallback')) throw new Error('temporary timeout');
    return '---\nname: Display Name\ndescription: Loaded\nversion: 2\n---\nBody';
  }, {
    onReadError: (error, dirName) => errors.push([error.message, dirName]),
  });

  assert.equal(skills.length, 2);
  assert.equal(skills[0].name, 'Display Name');
  assert.equal(skills[0].dirName, 'working');
  assert.equal(skills[1].name, 'fallback');
  assert.equal(skills[1].description, 'Fallback abstract');
  assert.equal(skills[1].contentUnavailable, true);
  assert.deepEqual(errors, [['temporary timeout', 'fallback']]);
});

test('readSkillEntries limits concurrent content reads and preserves order', async () => {
  let active = 0;
  let maxActive = 0;
  const entries = Array.from({ length: 7 }, (_, index) => ({
    name: `skill-${index}`,
    uri: `echo://skills/skill-${index}`,
  }));

  const skills = await readSkillEntries(entries, async (uri) => {
    active += 1;
    maxActive = Math.max(maxActive, active);
    await new Promise(resolve => setTimeout(resolve, 5));
    active -= 1;
    const dirName = uri.split('/').at(-2);
    return `---\nname: ${dirName}\n---\nBody`;
  }, { concurrency: 2 });

  assert.equal(maxActive, 2);
  assert.deepEqual(skills.map(skill => skill.dirName), entries.map(entry => entry.name));
});
