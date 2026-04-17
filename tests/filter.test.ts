import assert from 'node:assert/strict';
import test from 'node:test';
import { basicFilterIntelligence, buildModerationFingerprint } from '../src/lib/filter.ts';

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

test('basicFilterIntelligence blocks obfuscated profanity with mixed symbols', () => {
  const result = basicFilterIntelligence('F@xks Y!u!!!');
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'blacklist');
});

test('basicFilterIntelligence blocks profanity split by punctuation', () => {
  const result = basicFilterIntelligence('f.u.c.k y.o.u');
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'blacklist');
});

test('basicFilterIntelligence blocks strong chinese profanity', () => {
  const result = basicFilterIntelligence('你这个傻逼');
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'blacklist');
});

test('buildModerationFingerprint normalizes punctuation and repeated characters', () => {
  assert.equal(
    buildModerationFingerprint('Go!!! Team!!!'),
    buildModerationFingerprint('go team'),
  );
});
