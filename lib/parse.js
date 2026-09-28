// Nexus sits behind a login, so nothing can be scraped automatically. The next best
// thing is making a paste painless: copy the assignment text out of the portal, drop it
// in, and let this pull out titles and dates. Deliberately deterministic — no LLM, no
// quota, and no ambiguity about how it decided your deadline.

const MONTHS = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};
const MONTH_WORD = "jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec";
// Only strips a weekday that introduces a date ("Due: Sunday, 27 September"), never one
// that is part of the name itself ("Friday Post — Week 4").
const WEEKDAY = /\b(mon|tue|wed|thu|fri|sat|sun)[a-z]*\.?\s*,\s*/gi;

function monthFrom(word) {
  return MONTHS[word.slice(0, 3).toLowerCase()] ?? null;
}

function findTime(line) {
  const t = line.match(/\b(\d{1,2})[:.](\d{2})\s*(am|pm)?/i);
  if (t) {
    let h = +t[1];
    if (t[3]) {
      if (/pm/i.test(t[3]) && h < 12) h += 12;
      if (/am/i.test(t[3]) && h === 12) h = 0;
    }
    return [h, +t[2]];
  }
  const bare = line.match(/\b(\d{1,2})\s*(am|pm)\b/i);
  if (!bare) return null;
  let h = +bare[1];
  if (/pm/i.test(bare[2]) && h < 12) h += 12;
  if (/am/i.test(bare[2]) && h === 12) h = 0;
  return [h, 0];
}

// Each pattern is scanned globally and the FIRST match that yields a real month wins.
// Scanning only the first regex hit is what made "Case 1 Pre-Read (23 Sept)" fail — the
// "1 Pre" fragment matched the shape of a date but "Pre" is not a month.
const PATTERNS = [
  // 2026-10-02
  { re: /\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/g, take: (m) => ({ y: +m[1], mo: +m[2] - 1, d: +m[3] }) },
  // 2 October 2026 / 23 Sept
  { re: new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${MONTH_WORD})[a-z]*\\.?,?\\s*(20\\d{2})?`, "gi"),
    take: (m) => ({ d: +m[1], mo: monthFrom(m[2]), y: m[3] ? +m[3] : null }) },
  // October 2, 2026 / Oct 16
  { re: new RegExp(`\\b(${MONTH_WORD})[a-z]*\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s*(20\\d{2})?`, "gi"),
    take: (m) => ({ mo: monthFrom(m[1]), d: +m[2], y: m[3] ? +m[3] : null }) },
  // 02/10/2026 — day-first, matching Indian convention
  { re: /\b(\d{1,2})\/(\d{1,2})\/(20\d{2})\b/g, take: (m) => ({ d: +m[1], mo: +m[2] - 1, y: +m[3] }) },
];

/** Returns { iso, span:[start,end] } or null. The span lets the title cleaner remove
 *  exactly the text that was recognised as a date, instead of guessing. */
export function findDateSpan(line, fallbackYear = new Date().getFullYear()) {
  for (const { re, take } of PATTERNS) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(line)) !== null) {
      const { y, mo, d } = take(m);
      if (mo === null || mo === undefined || !d || d < 1 || d > 31) continue;
      const year = y || fallbackYear;
      const time = findTime(line) || [23, 59];
      const iso =
        `${year}-${String(mo + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}` +
        `T${String(time[0]).padStart(2, "0")}:${String(time[1]).padStart(2, "0")}:00+05:30`;
      if (isNaN(new Date(iso))) continue;
      return { iso, span: [m.index, m.index + m[0].length] };
    }
  }
  return null;
}

export function findDate(line, fallbackYear = new Date().getFullYear()) {
  return findDateSpan(line, fallbackYear)?.iso ?? null;
}

function cleanTitle(line, span) {
  let s = span ? line.slice(0, span[0]) + " " + line.slice(span[1]) : line;
  s = s
    .replace(/\b(due|deadline|submit by|submission|due date)\b\s*[:\-–]?/gi, " ")
    .replace(WEEKDAY, " ")
    .replace(/\b\d{1,2}[:.]\d{2}\s*(am|pm)?/gi, " ")
    .replace(/\b\d{1,2}\s*(am|pm)\b/gi, " ")
    .replace(/[|•·]+/g, " ")
    .replace(/[\s,;:\-–—]+$/g, "")
    .replace(/^[\s,;:\-–—]+/g, "")
    .replace(/\(\s*\)/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
  return s;
}

// A line is only a title if something survives cleaning that isn't just punctuation.
function isRealTitle(s) {
  return s.length >= 3 && /[A-Za-z]{3}/.test(s);
}

const NOISE = /^(due|deadline|submit|status|assignment|module|week|tab)\s*[:\-–]?\s*$/i;

/**
 * Each non-empty line is a candidate. A line carrying a date keeps it; a line that is
 * *only* a date attaches to the assignment above it, which is how portals usually lay
 * things out (title on one row, "Due ..." on the next).
 */
export function parseAssignments(text, fallbackYear = new Date().getFullYear()) {
  const lines = String(text || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const out = [];
  let pendingDate = null;

  for (const line of lines) {
    if (NOISE.test(line)) continue;

    const found = findDateSpan(line, fallbackYear);
    const title = cleanTitle(line, found?.span);

    if (!isRealTitle(title)) {
      // A bare "Due: Sunday, 27 September, 11:59 PM" row.
      if (found) {
        if (out.length) out[out.length - 1].due_at = found.iso;
        else pendingDate = found.iso;
      }
      continue;
    }

    out.push({ title, due_at: found?.iso ?? pendingDate ?? null });
    pendingDate = null;
  }
  return out;
}
