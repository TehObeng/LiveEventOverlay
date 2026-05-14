import { buildModerationFingerprint } from '@/lib/filter';
import { ServiceRoleSupabaseClientLike } from '@/lib/supabase-like';

const MODERATION_ALLOWLIST_KEY = 'moderation_allowlist';
const MODERATION_BLOCKLIST_KEY = 'moderation_blocklist';
const MAX_MEMORY_ENTRIES = 500;

type ModerationDecision = 'approved' | 'rejected';

type ModerationMemoryEntry = {
  fingerprint: string;
  text: string;
  decided_at: string;
  decided_by: string | null;
};

type ModerationMemoryContent = {
  entries: ModerationMemoryEntry[];
  updatedAt: string | null;
};

function normalizeDecisionEntry(
  value: unknown,
  decision: ModerationDecision,
): ModerationMemoryEntry | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const entry = value as Record<string, unknown>;
  const decidedAtKey = decision === 'approved' ? 'approved_at' : 'rejected_at';
  const decidedByKey = decision === 'approved' ? 'approved_by' : 'rejected_by';
  const decidedAt = entry[decidedAtKey];
  const decidedBy = entry[decidedByKey];

  if (
    typeof entry.fingerprint !== 'string' ||
    typeof entry.text !== 'string' ||
    typeof decidedAt !== 'string'
  ) {
    return null;
  }

  return {
    fingerprint: entry.fingerprint,
    text: entry.text,
    decided_at: decidedAt,
    decided_by: typeof decidedBy === 'string' ? decidedBy : null,
  };
}

function normalizeMemoryContent(
  content: unknown,
  decision: ModerationDecision,
): ModerationMemoryContent {
  if (!content || typeof content !== 'object') {
    return { entries: [], updatedAt: null };
  }

  const row = content as Record<string, unknown>;
  return {
    entries: Array.isArray(row.entries)
      ? row.entries
          .map((entry) => normalizeDecisionEntry(entry, decision))
          .filter((entry): entry is ModerationMemoryEntry => entry !== null)
      : [],
    updatedAt: typeof row.updatedAt === 'string' ? row.updatedAt : null,
  };
}

function getModerationKey(decision: ModerationDecision) {
  return decision === 'approved' ? MODERATION_ALLOWLIST_KEY : MODERATION_BLOCKLIST_KEY;
}

async function readMemoryContent(
  client: ServiceRoleSupabaseClientLike,
  decision: ModerationDecision,
) {
  const { data, error } = await client
    .from('site_content')
    .select('content')
    .eq('key', getModerationKey(decision))
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  const row = data as { content?: unknown } | null;
  return normalizeMemoryContent(row?.content, decision);
}

function createStoredEntry(entry: ModerationMemoryEntry, decision: ModerationDecision) {
  if (decision === 'approved') {
    return {
      fingerprint: entry.fingerprint,
      text: entry.text,
      approved_at: entry.decided_at,
      approved_by: entry.decided_by,
    };
  }

  return {
    fingerprint: entry.fingerprint,
    text: entry.text,
    rejected_at: entry.decided_at,
    rejected_by: entry.decided_by,
  };
}

async function writeMemoryContent(
  client: ServiceRoleSupabaseClientLike,
  decision: ModerationDecision,
  entries: ModerationMemoryEntry[],
  updatedBy: string | null,
  updatedAt: string,
) {
  const { error } = await client
    .from('site_content')
    .upsert(
      {
        key: getModerationKey(decision),
        content: {
          entries: entries.map((entry) => createStoredEntry(entry, decision)),
          updatedAt,
        },
        updated_by: updatedBy,
      },
      { onConflict: 'key' },
    );

  if (error) {
    throw new Error(error.message);
  }
}

function upsertMemoryEntry(
  entries: ModerationMemoryEntry[],
  nextEntry: ModerationMemoryEntry,
) {
  return [nextEntry, ...entries.filter((entry) => entry.fingerprint !== nextEntry.fingerprint)].slice(
    0,
    MAX_MEMORY_ENTRIES,
  );
}

async function rememberPhrase(
  client: ServiceRoleSupabaseClientLike,
  decision: ModerationDecision,
  text: string,
  decidedBy: string | null,
) {
  const cleanedText = text.trim();
  const fingerprint = buildModerationFingerprint(cleanedText);

  if (!cleanedText || !fingerprint) {
    return;
  }

  const now = new Date().toISOString();
  const [approvedMemory, rejectedMemory] = await Promise.all([
    readMemoryContent(client, 'approved').catch(() => ({
      entries: [],
      updatedAt: null,
    })),
    readMemoryContent(client, 'rejected').catch(() => ({
      entries: [],
      updatedAt: null,
    })),
  ]);

  const nextEntry: ModerationMemoryEntry = {
    fingerprint,
    text: cleanedText,
    decided_at: now,
    decided_by: decidedBy,
  };

  const nextApprovedEntries =
    decision === 'approved'
      ? upsertMemoryEntry(approvedMemory.entries, nextEntry)
      : approvedMemory.entries.filter((entry) => entry.fingerprint !== fingerprint);

  const nextRejectedEntries =
    decision === 'rejected'
      ? upsertMemoryEntry(rejectedMemory.entries, nextEntry)
      : rejectedMemory.entries.filter((entry) => entry.fingerprint !== fingerprint);

  await Promise.all([
    writeMemoryContent(client, 'approved', nextApprovedEntries, decidedBy, now),
    writeMemoryContent(client, 'rejected', nextRejectedEntries, decidedBy, now),
  ]);
}

export async function isRememberedSafePhrase(
  client: ServiceRoleSupabaseClientLike,
  text: string,
) {
  return (await getRememberedModerationDecision(client, text)) === 'approved';
}

export async function getRememberedModerationDecision(
  client: ServiceRoleSupabaseClientLike,
  text: string,
): Promise<ModerationDecision | null> {
  const fingerprint = buildModerationFingerprint(text);
  if (!fingerprint) {
    return null;
  }

  try {
    const [allowlist, blocklist] = await Promise.all([
      readMemoryContent(client, 'approved'),
      readMemoryContent(client, 'rejected'),
    ]);

    if (blocklist.entries.some((entry) => entry.fingerprint === fingerprint)) {
      return 'rejected';
    }

    if (allowlist.entries.some((entry) => entry.fingerprint === fingerprint)) {
      return 'approved';
    }

    return null;
  } catch {
    return null;
  }
}

export async function rememberApprovedSafePhrase(
  client: ServiceRoleSupabaseClientLike,
  text: string,
  approvedBy: string | null,
) {
  await rememberPhrase(client, 'approved', text, approvedBy);
}

export async function rememberRejectedPhrase(
  client: ServiceRoleSupabaseClientLike,
  text: string,
  rejectedBy: string | null,
) {
  await rememberPhrase(client, 'rejected', text, rejectedBy);
}
