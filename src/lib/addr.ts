// Client-safe address helpers.

export const ZERO_ADDRESS = "0x" + "0".repeat(64);

const ADDR_RE = /^0x[0-9a-fA-F]{1,64}$/;

export function isValidAddress(value: string): boolean {
  return ADDR_RE.test(value.trim());
}

/** Lower-case, 0x-prefixed, zero-padded to 32 bytes. Returns input trimmed if invalid. */
export function normAddr(value: string): string {
  const v = value.trim();
  if (!isValidAddress(v)) return v;
  return "0x" + v.slice(2).toLowerCase().padStart(64, "0");
}

export function sameAddr(a: string, b: string): boolean {
  return normAddr(a) === normAddr(b);
}

/** Does free text mention this address (in short or padded form)? */
export function textMentionsAddr(text: string, addr: string): boolean {
  const hay = text.toLowerCase();
  const full = normAddr(addr);
  if (hay.includes(full)) return true;
  const short = addr.trim().toLowerCase();
  return short.length >= 10 && hay.includes(short);
}

export function short(value: string, head = 6, tail = 4): string {
  if (value.length <= head + tail + 1) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}
