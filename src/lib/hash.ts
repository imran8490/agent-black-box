import { createHash } from "node:crypto";

export function sha256(bytes: Uint8Array): Uint8Array {
  return new Uint8Array(createHash("sha256").update(bytes).digest());
}

export function toHex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("hex");
}

/** Accepts hex (with/without 0x), number[], or base64, as different clients encode vector<u8> differently. */
export function bytesLikeToHex(value: unknown): string {
  if (Array.isArray(value)) return toHex(Uint8Array.from(value as number[]));
  if (value instanceof Uint8Array) return toHex(value);
  if (typeof value === "string") {
    const stripped = value.startsWith("0x") ? value.slice(2) : value;
    if (/^[0-9a-fA-F]{64}$/.test(stripped)) return stripped.toLowerCase();
    return toHex(Uint8Array.from(Buffer.from(value, "base64")));
  }
  return "";
}
