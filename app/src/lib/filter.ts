// ============================================
// Message Filter Engine
// Shared between client (pre-filter) and server (validation)
// ============================================

import { FilterResult } from './types';

const BLACKLIST = [
  // Indonesian
  "anjing", "babi", "kontol", "memek", "goblok", "tolol", "bangsat",
  "jancok", "asu", "bajingan", "keparat", "setan", "brengsek",
  // English
  "fuck", "shit", "bitch", "asshole", "dick", "pussy", "nigger", "faggot",
  // Spam / promo
  "casino", "slot", "porn", "xxx", "crypto", "btc", "http", "www."
];

export function basicFilterIntelligence(message: string, maxLength: number = 100): FilterResult {
  const msg = message.toLowerCase().trim();

  // Blacklist check
  if (BLACKLIST.some(word => msg.includes(word))) {
    return { ok: false, reason: 'blacklist' };
  }

  // Link detection
  if (/https?:\/\/|www\.|\.com|\.net|\.id|\.org/i.test(msg)) {
    return { ok: false, reason: 'link' };
  }

  // Spam detection (repeated characters)
  if (/(.)\1{4,}/.test(msg)) {
    return { ok: false, reason: 'spam' };
  }

  // Length check
  if (msg.length > maxLength || msg.length < 2) {
    return { ok: false, reason: 'length' };
  }

  return { ok: true, cleanedText: message.trim() };
}
