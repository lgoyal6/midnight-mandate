export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/^0x/, '');
  if (clean.length % 2 !== 0) throw new Error(`odd-length hex: ${hex}`);
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export function hexToBytes32(hex: string): Uint8Array {
  const bytes = hexToBytes(hex);
  const out = new Uint8Array(32);
  out.set(bytes.subarray(0, 32));
  return out;
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function randomBytes32(): Uint8Array {
  return globalThis.crypto.getRandomValues(new Uint8Array(32));
}

