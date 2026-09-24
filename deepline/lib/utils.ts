/**
 * Utility functions for Deepline plays
 * Common patterns extracted from Clay workflows
 */

/**
 * Normalize string for comparison (remove non-alphanumeric, lowercase)
 */
export function normalize(s: string | null | undefined): string {
  if (!s) return '';
  return s.replace(/[^a-z0-9]/gi, '').toLowerCase();
}

/**
 * Squash string (like normalize but more aggressive, used for name matching)
 */
export function squash(s: string | null | undefined): string {
  if (!s) return '';
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Check if value is a placeholder/junk string
 */
export function isPlaceholder(v: string | null | undefined): boolean {
  const BLOCK = new Set([
    'na', 'n', 'none', 'null', 'nil', 'unknown', 'unknowncompany', 'tbd', 'tba',
    'test', 'testing', 'xxx', 'asdf', 'retired', 'unemployed', 'student',
    'freelance', 'freelancer', 'selfemployed', 'self', 'soleproprietor',
    'soleproprietorship', 'privatepractice', 'private', 'confidential',
    'confidentialjobs', 'confidentialcompany', 'homemaker', 'various', 'other',
    'myself', 'me', 'personal', 'notapplicable', 'stealth', 'stealthmode',
    'stealthstartup'
  ]);
  
  const n = normalize(v);
  if (!n) return true;
  if (BLOCK.has(n)) return true;
  if (n.startsWith('selfemployed')) return true;
  return false;
}

/**
 * Calculate months since a date (YYYY-MM-DD)
 */
export function monthsSince(isoDate: string | null | undefined): number {
  if (!isoDate) return 9999;
  
  try {
    const parts = isoDate.substring(0, 10).split('-');
    const year = parseInt(parts[0]);
    const month = parseInt(parts[1]);
    
    const now = new Date();
    return (now.getFullYear() - year) * 12 + (now.getMonth() + 1 - month);
  } catch {
    return 9999;
  }
}

/**
 * Format currency amount
 */
export function formatCurrency(amount: number): string {
  if (amount >= 1e9) {
    return `$${(amount / 1e9).toFixed(1)} B`;
  } else if (amount >= 1e6) {
    return `$${Math.round(amount / 1e6)}M`;
  } else {
    return `$${Math.round(amount)}`;
  }
}

/**
 * Get month name from month number (1-12)
 */
export function getMonthName(month: number): string {
  const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return MONTHS[month - 1] || '';
}

/**
 * Flesch-Kincaid grade level calculator
 */
export function fleschKincaidGrade(text: string): number {
  if (!text) return 0;
  
  const words = text.match(/[A-Za-z]+/g) || [];
  if (words.length === 0) return 0;
  
  const syllableCount = (word: string): number => {
    const w = word.toLowerCase();
    const groups = w.match(/[aeiouy]+/g) || [];
    let n = groups.length;
    if (w.endsWith('e') && n > 1) n--;
    return Math.max(1, n);
  };
  
  const totalSyllables = words.reduce((sum, w) => sum + syllableCount(w), 0);
  const sentences = Math.max(1, (text.match(/[.!?]/g) || []).length || 1);
  
  return 0.39 * (words.length / sentences) + 11.8 * (totalSyllables / words.length) - 15.59;
}

/**
 * QC checks for generated lines
 */
export interface QCResult {
  pass: boolean;
  reason: string;
}

export function qcLine(
  line: string,
  options: {
    maxLength?: number;
    allowTrailingPeriod?: boolean;
    allowLeadingCapital?: boolean;
    bannedPhrases?: string[];
  } = {}
): QCResult {
  const {
    maxLength = 90,
    allowTrailingPeriod = false,
    allowLeadingCapital = false,
    bannedPhrases = []
  } = options;
  
  if (!line) {
    return { pass: false, reason: 'empty' };
  }
  
  if (line.includes('—') || line.includes('–')) {
    return { pass: false, reason: 'fail: dash' };
  }
  
  if (!allowTrailingPeriod && line.endsWith('.')) {
    return { pass: false, reason: 'fail: trailing period' };
  }
  
  if (!allowLeadingCapital && line[0] && line[0] === line[0].toUpperCase()) {
    return { pass: false, reason: 'fail: uppercase start' };
  }
  
  if (line.length > maxLength) {
    return { pass: false, reason: 'fail: too long' };
  }
  
  const lineLower = line.toLowerCase();
  for (const phrase of bannedPhrases) {
    if (lineLower.includes(phrase.toLowerCase())) {
      return { pass: false, reason: `fail: banned phrase "${phrase}"` };
    }
  }
  
  return { pass: true, reason: 'pass' };
}

/**
 * Verify that claimed values appear verbatim in source text
 */
export function verifyClaims(claims: string[], sourceText: string): string[] {
  const haystack = normalize(sourceText);
  return claims.filter(claim => !normalize(claim) || !haystack.includes(normalize(claim)));
}
