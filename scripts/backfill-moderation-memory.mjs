import fs from 'node:fs';
import path from 'node:path';

const MODERATION_ALLOWLIST_KEY = 'moderation_allowlist';
const MODERATION_BLOCKLIST_KEY = 'moderation_blocklist';
const DEFAULT_INPUT_PATH = path.join(process.cwd(), 'data', 'local-db.json');
const DEFAULT_MAX_ENTRIES = 500;

const ZERO_WIDTH_AND_BIDI = /[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g;
const COMBINING_MARKS = /\p{Mark}+/gu;
const NON_ALPHANUMERIC = /[^\p{Letter}\p{Number}]+/gu;

const CONFUSABLE_CHARACTER_MAP = {
  '@': 'a',
  '$': 's',
  '0': 'o',
  '1': 'i',
  '!': 'i',
  '|': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '6': 'g',
  '7': 't',
  '8': 'b',
  '9': 'g',
  '+': 't',
};

function printUsage() {
  console.log(`Usage:
  node scripts/backfill-moderation-memory.mjs [options]

Options:
  --input <path>         Path to local-db.json
  --event-id <uuid>      Only process one event id
  --event-name <text>    Only process events whose name contains this text
  --max-entries <n>      Cap per memory list (default: ${DEFAULT_MAX_ENTRIES})
  --dry-run              Analyze only, do not write changes
`);
}

function parseArgs(argv) {
  const options = {
    inputPath: DEFAULT_INPUT_PATH,
    eventId: null,
    eventName: null,
    maxEntries: DEFAULT_MAX_ENTRIES,
    dryRun: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    switch (argument) {
      case '--input':
        options.inputPath = path.resolve(argv[++index] || '');
        break;
      case '--event-id':
        options.eventId = argv[++index] || null;
        break;
      case '--event-name':
        options.eventName = argv[++index] || null;
        break;
      case '--max-entries':
        options.maxEntries = Number.parseInt(argv[++index] || '', 10) || DEFAULT_MAX_ENTRIES;
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--help':
      case '-h':
        printUsage();
        process.exit(0);
        break;
      default:
        throw new Error(`Unknown argument: ${argument}`);
    }
  }

  return options;
}

function normalizeFullWidthToAscii(text) {
  return text.replace(/[\uFF01-\uFF5E]/g, (character) =>
    String.fromCharCode(character.charCodeAt(0) - 0xfee0),
  );
}

function canonicalizeCharacters(text) {
  return Array.from(text, (character) => CONFUSABLE_CHARACTER_MAP[character] || character).join('');
}

function normalizeUnicode(text) {
  return canonicalizeCharacters(
    normalizeFullWidthToAscii(text)
      .normalize('NFKD')
      .replace(COMBINING_MARKS, '')
      .replace(ZERO_WIDTH_AND_BIDI, '')
      .toLowerCase(),
  );
}

function collapseRepeatedCharacters(text, maxRun) {
  let previous = '';
  let run = 0;
  let output = '';

  for (const character of text) {
    if (character === previous) {
      run += 1;
    } else {
      previous = character;
      run = 1;
    }

    if (run <= maxRun) {
      output += character;
    }
  }

  return output;
}

function buildModerationFingerprint(text) {
  return collapseRepeatedCharacters(
    normalizeUnicode(text).replace(NON_ALPHANUMERIC, ''),
    1,
  );
}

function readDatabase(inputPath) {
  return JSON.parse(fs.readFileSync(inputPath, 'utf8'));
}

function pickEvents(database, options) {
  return (database.events || []).filter((event) => {
    if (options.eventId && event.id !== options.eventId) {
      return false;
    }

    if (
      options.eventName &&
      !String(event.name || '').toLowerCase().includes(options.eventName.toLowerCase())
    ) {
      return false;
    }

    return true;
  });
}

function upsertSiteContentEntry(siteContent, key, content, updatedBy) {
  const index = siteContent.findIndex((entry) => entry.key === key);
  const nextEntry = {
    key,
    content,
    updated_by: updatedBy,
  };

  if (index >= 0) {
    siteContent[index] = nextEntry;
    return;
  }

  siteContent.push(nextEntry);
}

function buildDecisionTime(message) {
  return message.approved_at || message.created_at || new Date(0).toISOString();
}

function compareDecisionTimes(left, right) {
  return buildDecisionTime(left).localeCompare(buildDecisionTime(right));
}

function buildBackfill(database, options) {
  const events = pickEvents(database, options);
  const selectedEventIds = new Set(events.map((event) => event.id));
  const messages = (database.messages || []).filter((message) => selectedEventIds.has(message.event_id));

  const latestApprovedRisky = new Map();
  const latestRejected = new Map();

  for (const message of messages) {
    if (typeof message.text !== 'string' || !message.text.trim()) {
      continue;
    }

    const fingerprint = buildModerationFingerprint(message.text.trim());
    if (!fingerprint) {
      continue;
    }

    if (message.status === 'approved' && message.risk_level === 'risky') {
      const current = latestApprovedRisky.get(fingerprint);
      if (!current || compareDecisionTimes(current, message) < 0) {
        latestApprovedRisky.set(fingerprint, message);
      }
    }

    if (message.status === 'rejected') {
      const current = latestRejected.get(fingerprint);
      if (!current || compareDecisionTimes(current, message) < 0) {
        latestRejected.set(fingerprint, message);
      }
    }
  }

  const allFingerprints = new Set([
    ...latestApprovedRisky.keys(),
    ...latestRejected.keys(),
  ]);

  const allowlistEntries = [];
  const blocklistEntries = [];
  let conflicts = 0;

  for (const fingerprint of allFingerprints) {
    const approved = latestApprovedRisky.get(fingerprint);
    const rejected = latestRejected.get(fingerprint);

    if (approved && rejected) {
      conflicts += 1;
    }

    if (approved && (!rejected || compareDecisionTimes(rejected, approved) < 0)) {
      allowlistEntries.push({
        fingerprint,
        text: approved.text.trim(),
        approved_at: buildDecisionTime(approved),
        approved_by:
          typeof approved.approved_by === 'string' ? approved.approved_by : null,
      });
      continue;
    }

    if (rejected) {
      blocklistEntries.push({
        fingerprint,
        text: rejected.text.trim(),
        rejected_at: buildDecisionTime(rejected),
        rejected_by:
          typeof rejected.approved_by === 'string' ? rejected.approved_by : null,
      });
    }
  }

  allowlistEntries.sort((left, right) => right.approved_at.localeCompare(left.approved_at));
  blocklistEntries.sort((left, right) => right.rejected_at.localeCompare(left.rejected_at));

  return {
    events,
    messages,
    conflicts,
    allowlistEntries: allowlistEntries.slice(0, options.maxEntries),
    blocklistEntries: blocklistEntries.slice(0, options.maxEntries),
    riskyApprovedCount: Array.from(latestApprovedRisky.values()).length,
    rejectedCount: Array.from(latestRejected.values()).length,
  };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const database = readDatabase(options.inputPath);
  const siteContent = Array.isArray(database.site_content) ? [...database.site_content] : [];
  const analysis = buildBackfill(database, options);

  if (analysis.events.length === 0) {
    throw new Error('No matching events found in local-db.json');
  }

  const now = new Date().toISOString();
  upsertSiteContentEntry(
    siteContent,
    MODERATION_ALLOWLIST_KEY,
    {
      entries: analysis.allowlistEntries,
      updatedAt: now,
    },
    'backfill-script',
  );
  upsertSiteContentEntry(
    siteContent,
    MODERATION_BLOCKLIST_KEY,
    {
      entries: analysis.blocklistEntries,
      updatedAt: now,
    },
    'backfill-script',
  );

  console.log(
    JSON.stringify(
      {
        inputPath: options.inputPath,
        dryRun: options.dryRun,
        events: analysis.events.map((event) => ({
          id: event.id,
          name: event.name,
        })),
        scannedMessages: analysis.messages.length,
        riskyApprovedFingerprints: analysis.riskyApprovedCount,
        rejectedFingerprints: analysis.rejectedCount,
        conflictingFingerprints: analysis.conflicts,
        finalAllowlistEntries: analysis.allowlistEntries.length,
        finalBlocklistEntries: analysis.blocklistEntries.length,
      },
      null,
      2,
    ),
  );

  if (options.dryRun) {
    return;
  }

  database.site_content = siteContent;
  fs.writeFileSync(options.inputPath, `${JSON.stringify(database, null, 2)}\n`, 'utf8');
}

main();
