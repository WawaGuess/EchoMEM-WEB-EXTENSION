import {
  parseSummary,
  _normalizeFact,
  _normalizeDecision,
  _normalizeActionItem,
  emptyTreeOnNotFound,
} from './summary-client.js';

function assertEqual(actual, expected, msg) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    throw new Error(`${msg}\nexpected: ${e}\nactual:   ${a}`);
  }
}

function assertTrue(cond, msg) {
  if (!cond) throw new Error(msg);
}

// 1. normalize string facts
assertEqual(_normalizeFact('今天完成了融资'), { statement: '今天完成了融资', importance: '', is_update: false, previous_version: '', atom_ids: [], source_turn_ids: [] }, 'string fact');

// 2. normalize object fact
assertEqual(
  _normalizeFact({ statement: '融资完成', importance: 'high', is_update: true, previous_version: '计划融资', atom_ids: ['a1'] }),
  { statement: '融资完成', importance: 'high', is_update: true, previous_version: '计划融资', atom_ids: ['a1'], source_turn_ids: [] },
  'object fact'
);

// 3. normalize string decision
assertEqual(_normalizeDecision('决定推进商业化'), { description: '决定推进商业化', evidence: '' }, 'string decision');

// 4. normalize object decision
assertEqual(_normalizeDecision({ description: '推进商业化', evidence: 'msg_1' }), { description: '推进商业化', evidence: 'msg_1' }, 'object decision');

// 5. normalize string action item
assertEqual(_normalizeActionItem('整理材料'), { description: '整理材料', due: '', source: '' }, 'string action item');

// 6. normalize object action item
assertEqual(_normalizeActionItem({ description: '整理材料', due: '明天', source: 'msg_2' }), { description: '整理材料', due: '明天', source: 'msg_2' }, 'object action item');

// 7. parseSummary converts string arrays to object arrays (real backend format)
const backendDaily = {
  type: 'daily',
  date: '2026-07-15',
  overview: '今日概览',
  key_facts: ['事实一', '事实二'],
  decisions: ['决策一'],
  action_items: ['待办一'],
  highlight: '今天形成了一项重要决定',
};
const parsed = parseSummary(backendDaily);
assertTrue(parsed.keyFacts.length === 2, 'keyFacts length');
assertEqual(parsed.keyFacts[0], { statement: '事实一', importance: '', is_update: false, previous_version: '', atom_ids: [], source_turn_ids: [] }, 'parsed keyFacts[0]');
assertTrue(parsed.decisions.length === 1, 'decisions length');
assertEqual(parsed.decisions[0], { description: '决策一', evidence: '' }, 'parsed decisions[0]');
assertTrue(parsed.actionItems.length === 1, 'actionItems length');
assertEqual(parsed.actionItems[0], { description: '待办一', due: '', source: '' }, 'parsed actionItems[0]');
assertEqual(parsed.highlight, { type: '', description: '今天形成了一项重要决定' }, 'parsed string highlight');

// 8. parseSummary preserves object arrays (design doc format)
const designDaily = {
  type: 'daily',
  date: '2026-07-15',
  key_facts: [{ statement: '融资完成', importance: 'high' }],
  decisions: [{ description: '推进商业化', evidence: 'msg_1' }],
  action_items: [{ description: '整理材料', due: '明天', source: 'msg_2' }],
  memory_updates: [{ statement: '融资阶段已完成', is_update: true, previous_version: '正在准备融资' }],
};
const parsed2 = parseSummary(designDaily);
assertEqual(parsed2.keyFacts[0], { statement: '融资完成', importance: 'high', is_update: false, previous_version: '', atom_ids: [], source_turn_ids: [] }, 'design keyFacts[0]');
assertEqual(parsed2.decisions[0], { description: '推进商业化', evidence: 'msg_1' }, 'design decisions[0]');
assertEqual(parsed2.actionItems[0], { description: '整理材料', due: '明天', source: 'msg_2' }, 'design actionItems[0]');
assertEqual(
  parsed2.memoryUpdates[0],
  { statement: '融资阶段已完成', is_update: true, previous_version: '正在准备融资' },
  'memory update preserves previous_version'
);

// 9. Missing summary directories are treated as empty, but service/auth failures propagate.
const notFound = new Error('HTTP 404');
notFound.status = 404;
assertEqual(
  await emptyTreeOnNotFound(Promise.reject(notFound)),
  { entries: [] },
  '404 summary directory'
);

const unauthorized = new Error('HTTP 401');
unauthorized.status = 401;
let propagated = null;
try {
  await emptyTreeOnNotFound(Promise.reject(unauthorized));
} catch (error) {
  propagated = error;
}
assertTrue(propagated === unauthorized, 'non-404 summary error propagates');

console.log('✅ summary-client tests passed');
