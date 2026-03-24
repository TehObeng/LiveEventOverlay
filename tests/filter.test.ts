import assert from 'node:assert/strict';
import test from 'node:test';
import { basicFilterIntelligence } from '../src/lib/filter.ts';

test('basicFilterIntelligence blocks links', () => {
  const result = basicFilterIntelligence('visit https://example.com now');
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'link');
});

test('basicFilterIntelligence flags risky short messages', () => {
  const result = basicFilterIntelligence('ok');
  assert.equal(result.ok, true);
  assert.equal(result.riskLevel, 'risky');
});

test('basicFilterIntelligence accepts clean messages', () => {
  const result = basicFilterIntelligence('Selamat datang di event ini!');
  assert.equal(result.ok, true);
  assert.equal(result.riskLevel, 'safe');
  assert.equal(result.cleanedText, 'Selamat datang di event ini!');
});
