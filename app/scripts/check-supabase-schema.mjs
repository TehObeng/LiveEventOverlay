import nextEnv from '@next/env';
import { createClient } from '@supabase/supabase-js';

const { loadEnvConfig } = nextEnv;

loadEnvConfig(process.cwd());

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const checks = [
  {
    table: 'events',
    label: 'events.overlay_cleared_at',
    select: 'overlay_cleared_at',
  },
  {
    table: 'events',
    label: 'events.auto_approve',
    select: 'auto_approve',
  },
  {
    table: 'events',
    label: 'events.is_active',
    select: 'is_active',
  },
  {
    table: 'messages',
    label: 'messages.risk_level',
    select: 'risk_level',
  },
  {
    table: 'messages',
    label: 'messages.ip_hash',
    select: 'ip_hash',
  },
  {
    table: 'messages',
    label: 'messages.is_banned',
    select: 'is_banned',
  },
  {
    table: 'messages',
    label: 'messages.approved_by',
    select: 'approved_by',
  },
  {
    table: 'admin_users',
    label: 'admin_users.is_active',
    select: 'is_active',
  },
  {
    table: 'site_content',
    label: 'site_content.content',
    select: 'content',
  },
];

async function runCheck(check) {
  const result = await supabase.from(check.table).select(check.select).limit(1);

  if (result.error) {
    const missing = result.error.code === '42703';
    return {
      ...check,
      ok: false,
      missing,
      message: result.error.message,
    };
  }

  return {
    ...check,
    ok: true,
    missing: false,
    message: 'OK',
  };
}

const results = await Promise.all(checks.map(runCheck));
const failures = results.filter((result) => !result.ok);

for (const result of results) {
  const status = result.ok ? 'OK' : result.missing ? 'MISSING' : 'ERROR';
  console.log(`[${status}] ${result.label} -> ${result.message}`);
}

if (failures.length > 0) {
  console.error('\nSchema check failed. Run supabase/schema-repair.sql in the Supabase SQL Editor, then rerun this command.');
  process.exitCode = 1;
} else {
  console.log('\nSchema check passed. Supabase looks compatible with this app.');
}
