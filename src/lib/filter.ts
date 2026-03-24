// ============================================
// Message Filter Engine
// Shared between client (pre-filter) and server (validation)
// ============================================

import type { FilterResult } from './types.ts';

// Exact-match blocked words (will use word-boundary matching)
const BLACKLIST_EXACT = [
  // Indonesian profanity & variants
  "anjing", "anjir", "anjg", "anjay", "anying", "anjrit",
  "babi", "babs",
  "kontol", "kontl", "kntl", "kontoool",
  "memek", "mmk", "memex",
  "goblok", "goblog", "gblk",
  "tolol", "tll",
  "bangsat", "bngst", "bgst",
  "jancok", "jancuk", "jnck", "dancok", "cok",
  "asu",
  "bajingan",
  "keparat",
  "setan", "seten",
  "brengsek",
  "kampret", "kmprt",
  "tai", "taik",
  "sialan",
  "monyet", "monyong",
  "perek",
  "lonte", "lonthe",
  "sundal",
  "kimak",
  // English profanity & variants
  "fuck", "fucked", "fucker", "fucking", "fck", "fuk", "fak", "phuck",
  "shit", "shite", "shet", "shyt",
  "bitch", "biatch", "b1tch",
  "asshole", "ashole",
  "dick", "d1ck",
  "pussy", "pus5y",
  "nigger", "nigg3r", "n1gger", "nigga",
  "faggot", "fag", "f4g",
  "cunt", "c0nt",
  "whore", "wh0re",
  "bastard", "b4stard",
  // Spam / promo
  "casino", "porn", "xxx", "crypto", "btc",
];

// Substring-match blocked patterns (will match anywhere in text)
const BLACKLIST_SUBSTRING = [
  "ngentot", "ngewe", "ngesex", "bokep",
  "jembut", "pepek", "titit",
  "pornhub", "xvideos", "xhamster",
];

// Words flagged as risky (needs review but not auto-blocked)
const RISKY_WORDS = [
  "bodoh", "idiot", "stupid", "dumb", "noob", "bot",
  "gila", "cuk", "sialan",
  "bego", "bodo", "koplak", "edan", "gendeng",
  "bacot", "bangke", "bejat",
];

// Basic leet-speak / homoglyph normalization
function normalizeLeetSpeak(text: string): string {
  return text
    .replace(/@/g, 'a')
    .replace(/0/g, 'o')
    .replace(/1/g, 'i')
    .replace(/\$/g, 's')
    .replace(/3/g, 'e')
    .replace(/4/g, 'a')
    .replace(/5/g, 's')
    .replace(/7/g, 't')
    .replace(/!/g, 'i')
    .replace(/8/g, 'b');
}

// Strip spaces/dots/dashes inserted between letters to evade filters
function normalizeEvasion(text: string): string {
  // Remove zero-width chars, dots, dashes, underscores between letters
  return text.replace(/[\s\.\-_*]+/g, '');
}

// Word-boundary-aware word check for exact matches
function containsBlockedWord(text: string): boolean {
  const lower = text.toLowerCase();
  const normalized = normalizeLeetSpeak(lower);
  const compacted = normalizeEvasion(normalized);

  // Check exact word-boundary matches
  for (const word of BLACKLIST_EXACT) {
    const pattern = new RegExp(`\\b${word}\\b`, 'i');
    if (pattern.test(lower) || pattern.test(normalized) || pattern.test(compacted)) {
      return true;
    }
  }

  // Check substring matches (for compound words)
  for (const word of BLACKLIST_SUBSTRING) {
    if (lower.includes(word) || normalized.includes(word) || compacted.includes(word)) {
      return true;
    }
  }

  return false;
}

// Check risky words (word-boundary)
function containsRiskyWord(text: string): boolean {
  const lower = text.toLowerCase();
  const normalized = normalizeLeetSpeak(lower);
  return RISKY_WORDS.some(word => {
    const pattern = new RegExp(`\\b${word}\\b`, 'i');
    return pattern.test(lower) || pattern.test(normalized);
  });
}

export function basicFilterIntelligence(message: string, maxLength: number = 100): FilterResult {
  const msg = message.toLowerCase().trim();

  // ===== BLOCKED checks (outright reject) =====

  // Length check (early exit)
  if (msg.length > maxLength || msg.length < 2) {
    return { ok: false, riskLevel: 'blocked', reason: 'length' };
  }

  // Blacklist check (word-boundary + substring)
  if (containsBlockedWord(msg)) {
    return { ok: false, riskLevel: 'blocked', reason: 'blacklist' };
  }

  // Link detection
  if (/https?:\/\/|www\.|\.\s*(com|net|id|org|io|co)\b/i.test(msg)) {
    return { ok: false, riskLevel: 'blocked', reason: 'link' };
  }

  // Spam detection: repeated characters (5+)
  if (/(.)(\1){4,}/.test(msg)) {
    return { ok: false, riskLevel: 'blocked', reason: 'spam' };
  }

  // Spam detection: repeated words (same word 4+ times)
  const words = msg.split(/\s+/);
  if (words.length >= 3) {
    const wordCounts = new Map<string, number>();
    for (const word of words) {
      const count = (wordCounts.get(word) || 0) + 1;
      wordCounts.set(word, count);
      if (count >= 4) {
        return { ok: false, riskLevel: 'blocked', reason: 'spam' };
      }
    }
  }

  // ===== RISKY checks (needs manual review) =====
  let isRisky = false;

  // Borderline / risky words
  if (containsRiskyWord(msg)) {
    isRisky = true;
  }

  // Excessive uppercase (>70% of alphabetic chars)
  const alphaChars = message.replace(/[^a-zA-Z]/g, '');
  if (alphaChars.length > 5) {
    const upperCount = alphaChars.replace(/[^A-Z]/g, '').length;
    if (upperCount / alphaChars.length > 0.7) {
      isRisky = true;
    }
  }

  // Repeated characters (3-4 times — suspicious but not spam)
  if (/(.)(\1){2,3}/.test(msg) && msg.length > 3) {
    isRisky = true;
  }

  // Excessive special characters (>30% non-alphanumeric)
  const specialChars = msg.replace(/[a-z0-9\s]/gi, '');
  if (msg.length > 5 && specialChars.length / msg.length > 0.3) {
    isRisky = true;
  }

  // Very short messages (2-3 chars) — potentially meaningless
  if (msg.length <= 3) {
    isRisky = true;
  }

  // ===== SAFE — passes everything =====
  return {
    ok: true,
    riskLevel: isRisky ? 'risky' : 'safe',
    cleanedText: message.trim(),
  };
}
