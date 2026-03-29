import assert from 'node:assert/strict';
import test from 'node:test';
import { buildAllowedDevOrigins } from '../src/lib/dev-origins.ts';

test('buildAllowedDevOrigins includes the default tunnel host patterns used in VPS development', () => {
  assert.deepEqual(buildAllowedDevOrigins({}), ['*.lhr.life', '*.localhost.run']);
});

test('buildAllowedDevOrigins adds configured hosts and removes duplicates', () => {
  assert.deepEqual(
    buildAllowedDevOrigins({
      NEXT_PUBLIC_APP_URL: 'https://180fb9b2f4596a.lhr.life',
      ALLOWED_DEV_ORIGINS: 'preview.example.com,*.lhr.life,admin.example.com',
    }),
    ['*.lhr.life', '*.localhost.run', '180fb9b2f4596a.lhr.life', 'preview.example.com', 'admin.example.com'],
  );
});
