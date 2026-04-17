import { buildModerationFingerprint } from '@/lib/filter';
import { ServiceRoleSupabaseClientLike } from '@/lib/supabase-like';

const MODERATION_ALLOWLIST_KEY = 'moderation_allowlist';
const MAX_ALLOWLIST_ENTRIES = 500;

type ModerationAllowEntry = {
  fingerprint: string;
  text: string;
  approved_at: string;
  approved_by: string | null;
};

type ModerationAllowlistContent = {
  entries: ModerationAllowEntry[];
  updatedAt: string | null;
};

function normalizeAllowlistEntry(value: unknown): ModerationAllowEntry | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const entry = value as Record<string, unknown>;
  if (
    typeof entry.fingerprint !== 'string' ||
    typeof entry.text !== 'string' ||
    typeof entry.approved_at !== 'string'
  ) {
    return null;
  }

  return {
    fingerprint: entry.fingerprint,
    text: entry.text,
    approved_at: entry.approved_at,
    approved_by: typeof entry.approved_by === 'string' ? entry.approved_by : null,
  };
}

function normalizeAllowlistContent(content: unknown): ModerationAllowlistContent {
  if (!content || typeof content !== 'object') {
    return { entries: [], updatedAt: null };
  }

  const row = content as Record<string, unknown>;
  return {
    entries: Array.isArray(row.entries)
      ? row.entries
          .map(normalizeAllowlistEntry)
          .filter((entry): entry is ModerationAllowEntry => entry !== null)
      : [],
    updatedAt: typeof row.updatedAt === 'string' ? row.updatedAt : null,
  };
}

async function readAllowlistContent(client: ServiceRoleSupabaseClientLike) {
  const { data, error } = await client
    .from('site_content')
    .select('content')
    .eq('key', MODERATION_ALLOWLIST_KEY)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  const row = data as { content?: unknown } | null;
  return normalizeAllowlistContent(row?.content);
}

export async function isRememberedSafePhrase(
  client: ServiceRoleSupabaseClientLike,
  text: string,
) {
  const fingerprint = buildModerationFingerprint(text);
  if (!fingerprint) {
    return false;
  }

  try {
    const allowlist = await readAllowlistContent(client);
    return allowlist.entries.some((entry) => entry.fingerprint === fingerprint);
  } catch {
    return false;
  }
}

export async function rememberApprovedSafePhrase(
  client: ServiceRoleSupabaseClientLike,
  text: string,
  approvedBy: string | null,
) {
  const cleanedText = text.trim();
  const fingerprint = buildModerationFingerprint(cleanedText);

  if (!cleanedText || !fingerprint) {
    return;
  }

  const now = new Date().toISOString();
  const allowlist = await readAllowlistContent(client).catch(() => ({
    entries: [],
    updatedAt: null,
  }));

  const nextEntries = [
    {
      fingerprint,
      text: cleanedText,
      approved_at: now,
      approved_by: approvedBy,
    },
    ...allowlist.entries.filter((entry) => entry.fingerprint !== fingerprint),
  ].slice(0, MAX_ALLOWLIST_ENTRIES);

  const { error } = await client
    .from('site_content')
    .upsert(
      {
        key: MODERATION_ALLOWLIST_KEY,
        content: {
          entries: nextEntries,
          updatedAt: now,
        },
        updated_by: approvedBy,
      },
      { onConflict: 'key' },
    );

  if (error) {
    throw new Error(error.message);
  }
}
