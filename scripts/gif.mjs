/**
 * A tiny, dependency-free animated-GIF encoder for the README animations.
 *
 *   decodePng(buffer)            → { width, height, rgba }   (8-bit RGB/RGBA PNGs, as Chrome writes them)
 *   encodeGif(frames, w, h)      → Buffer                     (frames: [{ rgba, delayMs }])
 *
 * How it keeps files small:
 *  - one shared 255-colour palette, picked from the most common colours
 *    across all frames (5 bits per channel buckets, averaged);
 *  - every frame after the first only stores the rectangle that changed, and
 *    pixels inside it that didn't change are transparent (they compress to
 *    almost nothing);
 *  - standard GIF LZW compression with variable-width codes.
 */
import { inflateSync } from "node:zlib";

// ---------- PNG ----------

export function decodePng(buf) {
  let pos = 8;
  let width = 0;
  let height = 0;
  let colorType = 0;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString("ascii", pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      if (data[8] !== 8 || data[12] !== 0) throw new Error("only 8-bit, non-interlaced PNGs");
      colorType = data[9];
    } else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    pos += 12 + len;
  }
  const bpp = colorType === 6 ? 4 : colorType === 2 ? 3 : 0;
  if (!bpp) throw new Error(`unsupported PNG colour type ${colorType}`);
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * bpp;
  const out = new Uint8Array(width * height * 4);
  let prev = new Uint8Array(stride);
  for (let y = 0; y < height; y++) {
    const f = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const cur = new Uint8Array(stride);
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? cur[i - bpp] : 0;
      const b = prev[i];
      const c = i >= bpp ? prev[i - bpp] : 0;
      let v = line[i];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      cur[i] = v & 255;
    }
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      out[o] = cur[x * bpp];
      out[o + 1] = cur[x * bpp + 1];
      out[o + 2] = cur[x * bpp + 2];
      out[o + 3] = 255;
    }
    prev = cur;
  }
  return { width, height, rgba: out };
}

// ---------- palette ----------

const key = (r, g, b) => ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);

function buildPalette(frames) {
  const count = new Uint32Array(32768);
  const sum = new Float64Array(32768 * 3);
  for (const { rgba } of frames)
    for (let i = 0; i < rgba.length; i += 8) {
      const k = key(rgba[i], rgba[i + 1], rgba[i + 2]);
      count[k]++;
      sum[k * 3] += rgba[i];
      sum[k * 3 + 1] += rgba[i + 1];
      sum[k * 3 + 2] += rgba[i + 2];
    }
  const top = [...count.keys()].filter((k) => count[k]).sort((a, b) => count[b] - count[a]).slice(0, 255);
  // index 0 is reserved for "transparent: same as the previous frame"
  const pal = [[0, 0, 0]];
  for (const k of top) pal.push([Math.round(sum[k * 3] / count[k]), Math.round(sum[k * 3 + 1] / count[k]), Math.round(sum[k * 3 + 2] / count[k])]);
  while (pal.length < 256) pal.push([0, 0, 0]);
  const cache = new Int16Array(32768).fill(-1);
  const nearest = (r, g, b) => {
    const k = key(r, g, b);
    if (cache[k] >= 0) return cache[k];
    let best = 1;
    let bd = Infinity;
    for (let i = 1; i <= top.length; i++) {
      const [pr, pg, pb] = pal[i];
      const d = (pr - r) ** 2 * 2 + (pg - g) ** 2 * 4 + (pb - b) ** 2 * 3;
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    cache[k] = best;
    return best;
  };
  return { pal, nearest };
}

// ---------- LZW ----------

function lzw(indices, minCode = 8) {
  const clear = 1 << minCode;
  const end = clear + 1;
  const out = [];
  let cur = 0;
  let bits = 0;
  let size = minCode + 1;
  const put = (code) => {
    cur |= code << bits;
    bits += size;
    while (bits >= 8) {
      out.push(cur & 255);
      cur >>>= 8;
      bits -= 8;
    }
  };
  let dict = new Map();
  let next = end + 1;
  put(clear);
  let prefix = indices[0];
  for (let i = 1; i < indices.length; i++) {
    const c = indices[i];
    const k = prefix * 256 + c;
    const hit = dict.get(k);
    if (hit !== undefined) {
      prefix = hit;
      continue;
    }
    put(prefix);
    if (next < 4096) {
      dict.set(k, next++);
      if (next > 1 << size && size < 12) size++;
    } else {
      put(clear);
      dict = new Map();
      next = end + 1;
      size = minCode + 1;
    }
    prefix = c;
  }
  put(prefix);
  put(end);
  if (bits > 0) out.push(cur & 255);
  return Buffer.from(out);
}

function subBlocks(data) {
  const parts = [];
  for (let i = 0; i < data.length; i += 255) {
    const n = Math.min(255, data.length - i);
    parts.push(Buffer.from([n]), data.subarray(i, i + n));
  }
  parts.push(Buffer.from([0]));
  return Buffer.concat(parts);
}

// ---------- GIF ----------

export function encodeGif(frames, width, height) {
  const { pal, nearest } = buildPalette(frames);
  const u16 = (n) => Buffer.from([n & 255, (n >> 8) & 255]);
  const parts = [Buffer.from("GIF89a"), u16(width), u16(height), Buffer.from([0xf7, 0, 0])];
  parts.push(Buffer.from(pal.flat()));
  parts.push(Buffer.from([0x21, 0xff, 11]), Buffer.from("NETSCAPE2.0"), Buffer.from([3, 1, 0, 0, 0])); // loop forever

  let prev = null;
  for (const f of frames) {
    const idx = new Uint8Array(width * height);
    for (let i = 0, p = 0; i < idx.length; i++, p += 4) idx[i] = nearest(f.rgba[p], f.rgba[p + 1], f.rgba[p + 2]);
    // the changed rectangle
    let x0 = 0;
    let y0 = 0;
    let x1 = width - 1;
    let y1 = height - 1;
    if (prev) {
      x0 = width;
      y0 = height;
      x1 = -1;
      y1 = -1;
      for (let y = 0; y < height; y++)
        for (let x = 0; x < width; x++)
          if (idx[y * width + x] !== prev[y * width + x]) {
            if (x < x0) x0 = x;
            if (x > x1) x1 = x;
            if (y < y0) y0 = y;
            if (y > y1) y1 = y;
          }
      if (x1 < 0) {
        x0 = y0 = x1 = y1 = 0; // nothing changed: a 1-pixel transparent frame keeps the timing
      }
    }
    const w = x1 - x0 + 1;
    const h = y1 - y0 + 1;
    const rect = new Uint8Array(w * h);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = (y0 + y) * width + x0 + x;
        rect[y * w + x] = prev && idx[i] === prev[i] ? 0 : idx[i];
      }
    const delay = Math.max(2, Math.round(f.delayMs / 10));
    parts.push(Buffer.from([0x21, 0xf9, 4, prev ? 0b00000101 : 0b00000100]), u16(delay), Buffer.from([0, 0]));
    parts.push(Buffer.from([0x2c]), u16(x0), u16(y0), u16(w), u16(h), Buffer.from([0]));
    parts.push(Buffer.from([8]), subBlocks(lzw(rect)));
    prev = idx;
  }
  parts.push(Buffer.from([0x3b]));
  return Buffer.concat(parts);
}
