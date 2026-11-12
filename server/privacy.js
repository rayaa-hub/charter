// Privacy filter: strips personal data and secrets from agent text BEFORE it is sent
// to the AI provider and BEFORE it is stored. Raw text is never persisted.

export function luhnValid(digits) {
  if (!/^\d{13,19}$/.test(digits)) return false;
  let sum = 0;
  let dbl = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (dbl) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    dbl = !dbl;
  }
  return sum % 10 === 0;
}

export function ibanValid(raw) {
  const s = String(raw).replace(/\s+/g, '').toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(s)) return false;
  const rearranged = s.slice(4) + s.slice(0, 4);
  let rem = 0;
  for (const ch of rearranged) {
    const v = ch >= 'A' && ch <= 'Z' ? String(ch.charCodeAt(0) - 55) : ch;
    for (const c of v) rem = (rem * 10 + (c.charCodeAt(0) - 48)) % 97;
  }
  return rem === 1;
}

// Longest valid IBAN prefix of a candidate (handles trailing uppercase words).
function ibanPrefix(m) {
  let s = m;
  while (s.replace(/\s/g, '').length >= 15) {
    if (ibanValid(s)) return s.length;
    s = s.slice(0, -1).trimEnd();
  }
  return false;
}

const digitCount = (m) => m.replace(/\D/g, '').length;

// Order matters: specific secrets first, phone numbers last.
const DETECTORS = [
  { type: 'SECRET', re: /\b(?:sk-[A-Za-z0-9_-]{16,}|chr_sk_[A-Za-z0-9_-]{16,}|AKIA[0-9A-Z]{16})/g },
  // Long opaque tokens (32+ chars containing both letters and digits)
  { type: 'SECRET', re: /(?<![A-Za-z0-9_-])(?=[A-Za-z0-9_-]*\d)(?=[A-Za-z0-9_-]*[A-Za-z])[A-Za-z0-9_-]{32,}(?![A-Za-z0-9_-])/g },
  { type: 'EMAIL', re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g },
  { type: 'IBAN', re: /\b[A-Z]{2}\d{2}(?: ?[A-Z0-9]){11,34}/g, check: ibanPrefix },
  { type: 'CARD', re: /(?<![\w.,$])\d(?:[ -]?\d){12,18}(?![\w])/g, check: (m) => luhnValid(m.replace(/\D/g, '')) },
  { type: 'SSN', re: /\b\d{3}-\d{2}-\d{4}\b/g },
  {
    type: 'PHONE',
    re: /(?<![\w+$.,])\+?\(?\d[\d\s().-]*\d(?![\w])/g,
    check: (m) => {
      const n = digitCount(m);
      return n >= 10 && n <= 15;
    },
  },
];

/**
 * @param {string} input
 * @returns {{text: string, findings: Array<{type: string, count: number}>}}
 */
export function redact(input) {
  let text = String(input ?? '');
  const counts = {};
  for (const det of DETECTORS) {
    text = text.replace(det.re, (m) => {
      let tail = '';
      if (det.check) {
        const r = det.check(m);
        if (r === false) return m;
        if (typeof r === 'number') tail = m.slice(r);
      }
      counts[det.type] = (counts[det.type] || 0) + 1;
      return `[${det.type}_${counts[det.type]}]${tail}`;
    });
  }
  return { text, findings: Object.entries(counts).map(([type, count]) => ({ type, count })) };
}
