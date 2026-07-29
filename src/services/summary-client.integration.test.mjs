import { parseSummary } from './summary-client.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturePath = path.resolve(__dirname, '../../test/fixtures/memory_digest_test.json');

const raw = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
const daily = raw.result.daily[0];
const parsed = parseSummary(daily);

console.log('date:', parsed.date);
console.log('keyFacts count:', parsed.keyFacts.length);
console.log('first keyFact statement:', parsed.keyFacts[0]?.statement);
console.log('decisions count:', parsed.decisions.length);
console.log('first decision description:', parsed.decisions[0]?.description);
console.log('actionItems count:', parsed.actionItems.length);
console.log('first actionItem description:', parsed.actionItems[0]?.description);

if (parsed.keyFacts.length && parsed.keyFacts[0]?.statement && parsed.decisions.length && parsed.decisions[0]?.description && parsed.actionItems.length && parsed.actionItems[0]?.description) {
  console.log('✅ integration test passed');
} else {
  throw new Error('integration test failed');
}
