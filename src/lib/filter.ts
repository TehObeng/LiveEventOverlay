// ============================================
// Message Filter Engine
// Shared between client (pre-filter) and server (validation)
// ============================================

import type { FilterResult } from './types.ts';

const BLACKLIST_EXACT = [
  'anjing', 'anjir', 'anjg', 'anjay', 'anying', 'anjrit',
  'babi', 'babs',
  'kontol', 'kontl', 'kntl', 'kontoool',
  'memek', 'mmk', 'memex',
  'goblok', 'goblog', 'gblk',
  'tolol', 'tll',
  'bangsat', 'bngst', 'bgst',
  'jancok', 'jancuk', 'jnck', 'dancok', 'cok',
  'asu',
  'bajingan',
  'keparat',
  'setan', 'seten',
  'brengsek',
  'kampret', 'kmprt',
  'tai', 'taik',
  'sialan',
  'monyet', 'monyong',
  'perek',
  'lonte', 'lonthe',
  'sundal',
  'kimak',
  'fuck', 'fucked', 'fucker', 'fucking', 'fck', 'fuk', 'fak', 'phuck',
  'shit', 'shite', 'shet', 'shyt',
  'bitch', 'biatch', 'b1tch',
  'asshole', 'ashole',
  'dick', 'd1ck',
  'pussy', 'pus5y',
  'nigger', 'nigg3r', 'n1gger', 'nigga',
  'faggot', 'fag', 'f4g',
  'cunt', 'c0nt',
  'whore', 'wh0re',
  'bastard', 'b4stard',
  'motherfucker',
  'casino', 'porn', 'xxx', 'crypto', 'btc',
];

const BLACKLIST_SUBSTRING = [
  'ngentot', 'ngewe', 'ngesex', 'bokep',
  'jembut', 'pepek', 'titit',
  'pornhub', 'xvideos', 'xhamster',
  'gofuckyourself', 'fuckyou', 'fuckyou', 'fucku', 'fukyou',
  'anjinglu', 'anjinglo', 'anjingkau',
  'suckmydick', 'eatshit',
  '操你', '操你妈', '傻逼', '傻b', '妈的', '他妈的', '去死',
];

const RISKY_WORDS = [
  'bodoh', 'idiot', 'stupid', 'dumb', 'noob', 'bot',
  'gila', 'cuk', 'sialan',
  'bego', 'bodo', 'koplak', 'edan', 'gendeng',
  'bacot', 'bangke', 'bejat',
  'sampah', 'tol', 'loser', 'moron', 'retard',
  '垃圾', '笨蛋',
];

const ZERO_WIDTH_AND_BIDI = /[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g;
const COMBINING_MARKS = /\p{Mark}+/gu;
const NON_ALPHANUMERIC = /[^\p{Letter}\p{Number}]+/gu;

const CONFUSABLE_CHARACTER_MAP: Record<string, string> = {
  '@': 'a',
  '$': 's',
  '€': 'e',
  '£': 'l',
  '¥': 'y',
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
  'а': 'a',
  'е': 'e',
  'і': 'i',
  'ј': 'j',
  'о': 'o',
  'р': 'p',
  'с': 'c',
  'у': 'y',
  'х': 'x',
  'к': 'k',
  'м': 'm',
  'т': 't',
  'в': 'b',
  'Α': 'a',
  'Β': 'b',
  'Ε': 'e',
  'Η': 'h',
  'Ι': 'i',
  'Κ': 'k',
  'Μ': 'm',
  'Ν': 'n',
  'Ο': 'o',
  'Ρ': 'p',
  'Τ': 't',
  'Χ': 'x',
};

type MatchForms = {
  canonical: string;
  spaced: string;
  compact: string;
  compactCollapsed: string;
  tokens: string[];
};

function normalizeFullWidthToAscii(text: string) {
  return text.replace(/[\uFF01-\uFF5E]/g, (char) =>
    String.fromCharCode(char.charCodeAt(0) - 0xfee0),
  );
}

function canonicalizeCharacters(text: string) {
  return Array.from(text, (character) => CONFUSABLE_CHARACTER_MAP[character] || character).join('');
}

function normalizeUnicode(text: string) {
  return canonicalizeCharacters(
    normalizeFullWidthToAscii(text)
      .normalize('NFKD')
      .replace(COMBINING_MARKS, '')
      .replace(ZERO_WIDTH_AND_BIDI, '')
      .toLowerCase(),
  );
}

function collapseRepeatedCharacters(text: string, maxRun: number) {
  if (!text) {
    return text;
  }

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

function getMatchForms(text: string): MatchForms {
  const canonical = normalizeUnicode(text);
  const spaced = canonical.replace(NON_ALPHANUMERIC, ' ').trim().replace(/\s+/g, ' ');
  const compact = canonical.replace(NON_ALPHANUMERIC, '');
  const compactCollapsed = collapseRepeatedCharacters(compact, 1);

  return {
    canonical,
    spaced,
    compact,
    compactCollapsed,
    tokens: spaced ? spaced.split(' ') : [],
  };
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildSeparatedWordPattern(word: string) {
  const body = Array.from(word, (character) => escapeRegex(character)).join('[^\\p{Letter}\\p{Number}]*');
  return new RegExp(`(^|[^\\p{Letter}\\p{Number}])${body}(?=$|[^\\p{Letter}\\p{Number}])`, 'iu');
}

function levenshteinDistance(left: string, right: string) {
  if (left === right) {
    return 0;
  }

  if (!left.length) {
    return right.length;
  }

  if (!right.length) {
    return left.length;
  }

  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  const current = new Array<number>(right.length + 1).fill(0);

  for (let row = 1; row <= left.length; row += 1) {
    current[0] = row;

    for (let column = 1; column <= right.length; column += 1) {
      const substitutionCost = left[row - 1] === right[column - 1] ? 0 : 1;
      current[column] = Math.min(
        current[column - 1] + 1,
        previous[column] + 1,
        previous[column - 1] + substitutionCost,
      );
    }

    for (let column = 0; column <= right.length; column += 1) {
      previous[column] = current[column];
    }
  }

  return previous[right.length];
}

function isApproximateTokenMatch(token: string, candidate: string) {
  if (token === candidate) {
    return true;
  }

  if (!token || !candidate || token[0] !== candidate[0]) {
    return false;
  }

  const maxLengthDelta = candidate.length >= 5 ? 2 : 1;
  if (Math.abs(token.length - candidate.length) > maxLengthDelta) {
    return false;
  }

  const maxDistance = candidate.length >= 5 ? 2 : 1;
  return levenshteinDistance(token, candidate) <= maxDistance;
}

function containsBlockedWord(forms: MatchForms): boolean {
  for (const word of BLACKLIST_EXACT) {
    if (forms.tokens.includes(word)) {
      return true;
    }

    if (buildSeparatedWordPattern(word).test(forms.canonical)) {
      return true;
    }

    if (forms.tokens.some((token) => token.length >= 3 && isApproximateTokenMatch(token, word))) {
      return true;
    }
  }

  for (const fragment of BLACKLIST_SUBSTRING) {
    const normalizedFragment = normalizeUnicode(fragment).replace(NON_ALPHANUMERIC, '');
    const collapsedFragment = collapseRepeatedCharacters(normalizedFragment, 1);
    if (
      forms.compact.includes(normalizedFragment) ||
      forms.compactCollapsed.includes(collapsedFragment)
    ) {
      return true;
    }
  }

  return false;
}

function containsRiskyWord(forms: MatchForms): boolean {
  for (const word of RISKY_WORDS) {
    if (forms.tokens.includes(word)) {
      return true;
    }

    if (buildSeparatedWordPattern(word).test(forms.canonical)) {
      return true;
    }

    if (forms.tokens.some((token) => token.length >= 3 && isApproximateTokenMatch(token, word))) {
      return true;
    }
  }

  return false;
}

export function buildModerationFingerprint(text: string) {
  return getMatchForms(text).compactCollapsed;
}

export function basicFilterIntelligence(message: string, maxLength: number = 100): FilterResult {
  const trimmed = message.trim();
  const forms = getMatchForms(trimmed);

  if (trimmed.length > maxLength || trimmed.length < 2) {
    return { ok: false, riskLevel: 'blocked', reason: 'length' };
  }

  if (containsBlockedWord(forms)) {
    return { ok: false, riskLevel: 'blocked', reason: 'blacklist' };
  }

  if (/https?:\/\/|www\.|\.\s*(com|net|id|org|io|co)\b/i.test(trimmed)) {
    return { ok: false, riskLevel: 'blocked', reason: 'link' };
  }

  if (/(.)((\s|[^\p{Letter}\p{Number}])*\1){4,}/iu.test(trimmed)) {
    return { ok: false, riskLevel: 'blocked', reason: 'spam' };
  }

  if (forms.tokens.length >= 3) {
    const wordCounts = new Map<string, number>();
    for (const token of forms.tokens) {
      const count = (wordCounts.get(token) || 0) + 1;
      wordCounts.set(token, count);
      if (count >= 4) {
        return { ok: false, riskLevel: 'blocked', reason: 'spam' };
      }
    }
  }

  let isRisky = false;

  if (containsRiskyWord(forms)) {
    isRisky = true;
  }

  const alphaChars = trimmed.replace(/[^\p{Letter}]/gu, '');
  if (alphaChars.length > 5) {
    const upperCount = alphaChars.replace(/[^\p{Lu}]/gu, '').length;
    if (upperCount / alphaChars.length > 0.7) {
      isRisky = true;
    }
  }

  if (/(.)((\s|[^\p{Letter}\p{Number}])*\1){2,3}/iu.test(trimmed) && trimmed.length > 3) {
    isRisky = true;
  }

  const specialChars = trimmed.replace(/[\p{Letter}\p{Number}\s]/gu, '');
  if (trimmed.length > 5 && specialChars.length / trimmed.length > 0.3) {
    isRisky = true;
  }

  if (trimmed.length <= 3) {
    isRisky = true;
  }

  return {
    ok: true,
    riskLevel: isRisky ? 'risky' : 'safe',
    cleanedText: trimmed,
  };
}
