import assert from 'node:assert/strict';
import test from 'node:test';
import { fromDatetimeLocalValue, toDatetimeLocalValue } from '../src/lib/datetime.ts';

test('toDatetimeLocalValue formats ISO strings for datetime-local inputs', () => {
  const value = toDatetimeLocalValue('2026-03-25T10:30:00.000Z');
  assert.match(value, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
});

test('fromDatetimeLocalValue converts local datetime strings to ISO', () => {
  const value = fromDatetimeLocalValue('2026-03-25T17:30');
  assert.ok(value);
  assert.match(value || '', /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
});

test('fromDatetimeLocalValue returns null for empty values', () => {
  assert.equal(fromDatetimeLocalValue(''), null);
});
