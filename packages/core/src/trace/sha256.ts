/**
 * SHA-256, computed in chunks (FIPS 180-4).
 *
 * The core runs in the browser and reads files in pieces, and the Web Crypto
 * API only hashes a whole buffer at once, so the hash is computed here. It is
 * used to identify the input files of an analysis, not for security.
 */

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

const encoder = new TextEncoder();

export class Sha256 {
  private readonly h = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  private readonly block = new Uint8Array(64);
  private readonly w = new Uint32Array(64);
  private filled = 0;
  private length = 0;
  private done = false;

  /** Adds bytes, or a string encoded as UTF-8. */
  update(data: Uint8Array | string): this {
    if (this.done) throw new Error('The hash was already computed.');
    const bytes = typeof data === 'string' ? encoder.encode(data) : data;
    this.length += bytes.length;
    let i = 0;
    while (i < bytes.length) {
      const n = Math.min(64 - this.filled, bytes.length - i);
      this.block.set(bytes.subarray(i, i + n), this.filled);
      this.filled += n;
      i += n;
      if (this.filled === 64) {
        this.compress();
        this.filled = 0;
      }
    }
    return this;
  }

  /** Bytes added so far. */
  get bytes(): number {
    return this.length;
  }

  /** The hash as 64 lowercase hex characters. */
  hex(): string {
    if (!this.done) {
      const bits = this.length * 8;
      this.block[this.filled++] = 0x80;
      if (this.filled > 56) {
        this.block.fill(0, this.filled);
        this.compress();
        this.filled = 0;
      }
      this.block.fill(0, this.filled, 56);
      const view = new DataView(this.block.buffer);
      view.setUint32(56, Math.floor(bits / 0x1_0000_0000));
      view.setUint32(60, bits >>> 0);
      this.compress();
      this.done = true;
    }
    return [...this.h].map((x) => x.toString(16).padStart(8, '0')).join('');
  }

  private compress(): void {
    const { w, h, block } = this;
    const view = new DataView(block.buffer);
    for (let t = 0; t < 16; t++) w[t] = view.getUint32(t * 4);
    for (let t = 16; t < 64; t++) {
      const a = w[t - 15]!;
      const b = w[t - 2]!;
      const s0 = ((a >>> 7) | (a << 25)) ^ ((a >>> 18) | (a << 14)) ^ (a >>> 3);
      const s1 = ((b >>> 17) | (b << 15)) ^ ((b >>> 19) | (b << 13)) ^ (b >>> 10);
      w[t] = (w[t - 16]! + s0 + w[t - 7]! + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, hh] = [h[0]!, h[1]!, h[2]!, h[3]!, h[4]!, h[5]!, h[6]!, h[7]!];
    for (let t = 0; t < 64; t++) {
      const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const ch = (e & f) ^ (~e & g);
      const t1 = (hh + S1 + ch + K[t]! + w[t]!) >>> 0;
      const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) >>> 0;
      hh = g;
      g = f;
      f = e;
      e = (d + t1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) >>> 0;
    }
    h[0] = (h[0]! + a) >>> 0;
    h[1] = (h[1]! + b) >>> 0;
    h[2] = (h[2]! + c) >>> 0;
    h[3] = (h[3]! + d) >>> 0;
    h[4] = (h[4]! + e) >>> 0;
    h[5] = (h[5]! + f) >>> 0;
    h[6] = (h[6]! + g) >>> 0;
    h[7] = (h[7]! + hh) >>> 0;
  }
}

/** SHA-256 of bytes, or of a string encoded as UTF-8, as hex. */
export function sha256(data: Uint8Array | string): string {
  return new Sha256().update(data).hex();
}
