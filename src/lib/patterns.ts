// Client-safe: prompt-injection heuristics + human labels for guard flags.

export const INJECTION_PATTERNS: RegExp[] = [
  /ignore (all |any )?(the )?(previous|prior|above|earlier) (instructions|rules|messages)/gi,
  /system\s*(override|prompt|message|notice)/gi,
  /do not (tell|inform|mention|alert|notify)[^.\n]*/gi,
  /(wallet|address) (has )?(changed|updated|moved)/gi,
  /\b(send|transfer|pay)\b[^\n]{0,120}\bimmediately/gi,
];

export function findInjections(text: string): string[] {
  const hits: string[] = [];
  for (const re of INJECTION_PATTERNS) {
    const copy = new RegExp(re.source, re.flags);
    for (const m of text.matchAll(copy)) hits.push(m[0]);
  }
  return hits;
}

export interface Segment {
  text: string;
  hit: boolean;
}

/** Split text into segments, marking the parts that look like injected instructions. */
export function highlight(text: string): Segment[] {
  const ranges: [number, number][] = [];
  for (const re of INJECTION_PATTERNS) {
    const copy = new RegExp(re.source, re.flags);
    for (const m of text.matchAll(copy)) {
      if (m.index === undefined) continue;
      ranges.push([m.index, m.index + m[0].length]);
    }
  }
  if (ranges.length === 0) return [{ text, hit: false }];
  ranges.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else merged.push([r[0], r[1]]);
  }
  const out: Segment[] = [];
  let cursor = 0;
  for (const [s, e] of merged) {
    if (s > cursor) out.push({ text: text.slice(cursor, s), hit: false });
    out.push({ text: text.slice(s, e), hit: true });
    cursor = e;
  }
  if (cursor < text.length) out.push({ text: text.slice(cursor), hit: false });
  return out;
}

export const FLAG_LABELS: Record<string, string> = {
  invalid_recipient: "Recipient is not a valid Sui address",
  recipient_only_in_untrusted_input:
    "Recipient appears only in untrusted content, never in the user's instruction",
  recipient_not_in_user_instruction:
    "Recipient was not mentioned by the user",
  amount_exceeds_limit: "Amount is above the allowed limit",
  recipient_flagged_before:
    "This recipient was blocked or flagged in an earlier decision (Walrus Memory)",
  source_flagged_before:
    "This page carried an attack in an earlier decision (Walrus Memory)",
  injection_pattern_in_untrusted_input:
    "Untrusted content contains prompt-injection phrases",
};
