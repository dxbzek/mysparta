/**
 * ULIDs for scrappers and bouts: 48 bits of time then 80 random bits, 26 Crockford base-32
 * characters, so ids sort by creation time. Time and randomness are injected for tests.
 */
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export type RandomBytes = (n: number) => Uint8Array;

export const cryptoBytes: RandomBytes = (n) => {
  const out = new Uint8Array(n);
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c && typeof c.getRandomValues === "function") c.getRandomValues(out);
  else for (let i = 0; i < n; i++) out[i] = Math.floor(Math.random() * 256);
  return out;
};

export function ulid(nowMs: number, bytes: RandomBytes = cryptoBytes): string {
  let time = Math.max(0, Math.floor(nowMs));
  let head = "";
  for (let i = 0; i < 10; i++) {
    head = ALPHABET[time % 32]! + head;
    time = Math.floor(time / 32);
  }
  const rnd = bytes(16);
  let tail = "";
  for (let i = 0; i < 16; i++) tail += ALPHABET[(rnd[i] ?? 0) % 32]!;
  return head + tail;
}

export const isUlid = (s: unknown): s is string => typeof s === "string" && /^[0-9A-HJKMNP-TV-Z]{26}$/.test(s);
