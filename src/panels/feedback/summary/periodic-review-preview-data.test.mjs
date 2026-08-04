import assert from 'node:assert/strict';
import { PERIODIC_REVIEW_PREVIEW } from './periodic-review-preview-data.js';

const { daily, weekly } = PERIODIC_REVIEW_PREVIEW;
const dailyKeys = Object.keys(daily.items);
const weeklyKeys = Object.keys(weekly.items);
const defaultDaily = daily.items[daily.defaultKey];
const defaultWeekly = weekly.items[weekly.defaultKey];

assert.deepEqual(dailyKeys, [
  '2026-07-06',
  '2026-07-07',
  '2026-07-08',
  '2026-07-09',
  '2026-07-10',
  '2026-07-11',
  '2026-07-12',
]);
assert.deepEqual(weeklyKeys, ['2026-W28']);
assert.equal(defaultDaily.period, '2026 年 7 月 9 日');
assert.match(defaultDaily.evidenceLabel, /5 条原子/);
assert.equal(Object.keys(defaultDaily.cards).length, 4);
assert.equal(Object.keys(defaultWeekly.cards).length, 5);

Object.values(daily.items).forEach((review) => {
  assert.equal(review.cards.topics.items.reduce((sum, item) => sum + item.percent, 0), 100);
  assert.ok(review.cards.facts.items.length >= 3);
  assert.ok(review.cards.next.items.length >= 3);
});

defaultWeekly.cards.trend.rows.forEach((row) => {
  assert.equal(row.values.length, defaultWeekly.cards.trend.series.length);
  assert.equal(row.values.reduce((sum, value) => sum + value, 0), 100);
});

assert.doesNotMatch(JSON.stringify(PERIODIC_REVIEW_PREVIEW), /用户/);
console.log('periodic review preview data tests passed');
