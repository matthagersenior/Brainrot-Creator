import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MONETIZATION,
  localDayKey,
  normalizeUsage,
  freeRemaining,
  consumeGeneration,
  isValidOffer,
} from '../monetization-core.mjs';

const day = new Date(2026, 9, 6, 12, 0, 0);

test('free tier resets by local calendar day', () => {
  assert.equal(localDayKey(day), '2026-10-06');
  assert.deepEqual(normalizeUsage({ day: '2026-10-05', count: 3 }, day), { day: '2026-10-06', count: 0 });
  assert.equal(freeRemaining({ day: '2026-10-06', count: 2 }, day), 1);
});

test('generation allowance uses free quota before purchased credits', () => {
  const first = consumeGeneration({ usage: { day: '2026-10-06', count: 2 }, credits: 5 }, day);
  assert.equal(first.allowed, true);
  assert.equal(first.source, 'free');
  assert.equal(first.usage.count, 3);
  assert.equal(first.credits, 5);

  const second = consumeGeneration({ usage: first.usage, credits: first.credits }, day);
  assert.equal(second.source, 'credit');
  assert.equal(second.credits, 4);
});

test('creator bypasses quota without spending credits', () => {
  const result = consumeGeneration({ usage: { day: '2026-10-06', count: 3 }, credits: 2, creatorActive: true }, day);
  assert.equal(result.allowed, true);
  assert.equal(result.source, 'creator');
  assert.equal(result.credits, 2);
});

test('offers match the launch monetization model', () => {
  assert.equal(MONETIZATION.freeDailyLimit, 3);
  assert.equal(MONETIZATION.creatorMonthlyUsd, 5.99);
  assert.equal(isValidOffer('creator_monthly'), true);
  assert.equal(isValidOffer('pack_15'), true);
  assert.equal(isValidOffer('fake'), false);
});
