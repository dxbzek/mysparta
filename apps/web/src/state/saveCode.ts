/**
 * Save codes (brief 3.14): the whole document, compressed and base64, for the player to copy out
 * and paste in. "RZ1." = deflate-raw; "RZ0." = plain UTF-8 where the browser has no
 * CompressionStream. Import runs the same migration and check as a load.
 */
import type { SaveDoc } from "../contracts";
import { readDoc } from "./migrations";

const PLAIN = "RZ0.";
const DEFLATE = "RZ1.";

function toB64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromB64(text: string): Uint8Array {
  const s = atob(text.replace(/-/g, "+").replace(/_/g, "/").replace(/\s+/g, ""));
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

async function pipe(bytes: Uint8Array, stream: GenericTransformStream): Promise<Uint8Array> {
  const out = new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(stream as unknown as ReadableWritablePair<Uint8Array, Uint8Array>));
  return new Uint8Array(await out.arrayBuffer());
}

const hasStreams = (): boolean => typeof CompressionStream === "function" && typeof DecompressionStream === "function";

export async function encodeSave(doc: SaveDoc): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(doc));
  if (!hasStreams()) return PLAIN + toB64(bytes);
  return DEFLATE + toB64(await pipe(bytes, new CompressionStream("deflate-raw")));
}

export async function decodeSave(code: string): Promise<{ ok: true; doc: SaveDoc } | { ok: false }> {
  try {
    const c = code.trim();
    let bytes: Uint8Array;
    if (c.startsWith(DEFLATE)) {
      if (!hasStreams()) return { ok: false };
      bytes = await pipe(fromB64(c.slice(DEFLATE.length)), new DecompressionStream("deflate-raw"));
    } else if (c.startsWith(PLAIN)) {
      bytes = fromB64(c.slice(PLAIN.length));
    } else {
      return { ok: false };
    }
    const r = readDoc(new TextDecoder().decode(bytes));
    return r.ok ? { ok: true, doc: r.doc } : { ok: false };
  } catch {
    return { ok: false };
  }
}
