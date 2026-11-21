import assert from "node:assert/strict";
import { test } from "node:test";
import { qrMatrix, qrSvgPath } from "../src/lib/qr.js";

// An independent QR reader written from the standard (ISO/IEC 18004), not
// from qr.js. It reads the format bits, unmasks the data, checks every
// Reed–Solomon block has zero syndromes (no damage), and decodes the text.
// If the encoder made any mistake, one of these steps fails.

const TOTAL_CODEWORDS = [0, 26, 44, 70, 100, 134, 172, 196, 242, 292, 346];
const M_BLOCKS = [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5];
const M_ECC = [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26];
const ALIGN = [null, [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]];

const MASK = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0
];

// GF(256) with the QR polynomial x^8 + x^4 + x^3 + x^2 + 1.
const EXP = new Array(512);
const LOG = new Array(256);
{
  let x = 1;
  for (let i = 0; i < 255; i += 1) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i += 1) EXP[i] = EXP[i - 255];
}
const mul = (a, b) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

function bchFormatValid(bits15) {
  let value = bits15;
  for (let i = 14; i >= 10; i -= 1) if ((value >>> i) & 1) value ^= 0x537 << (i - 10);
  return value === 0;
}

function readFormat(m) {
  const size = m.length;
  const bit = (r, c) => (m[r][c] ? 1 : 0);
  // Copy 1, around the top-left finder: bits 14..0.
  const a = [
    bit(8, 0), bit(8, 1), bit(8, 2), bit(8, 3), bit(8, 4), bit(8, 5), bit(8, 7), bit(8, 8),
    bit(7, 8), bit(5, 8), bit(4, 8), bit(3, 8), bit(2, 8), bit(1, 8), bit(0, 8)
  ];
  // Copy 2, split between the bottom-left and top-right finders.
  const b = [];
  for (let i = 0; i < 7; i += 1) b.push(bit(size - 1 - i, 8));
  for (let i = 0; i < 8; i += 1) b.push(bit(8, size - 8 + i));
  const toInt = (list) => list.reduce((value, item) => (value << 1) | item, 0);
  return { first: toInt(a) ^ 0x5412, second: toInt(b) ^ 0x5412, firstRaw: toInt(a), secondRaw: toInt(b) };
}

function functionMap(version) {
  const size = version * 4 + 17;
  const f = Array.from({ length: size }, () => new Array(size).fill(false));
  const mark = (r0, c0, h, w) => {
    for (let r = r0; r < r0 + h; r += 1) for (let c = c0; c < c0 + w; c += 1) if (r >= 0 && c >= 0 && r < size && c < size) f[r][c] = true;
  };
  mark(0, 0, 9, 9); // finder, separator, format
  mark(0, size - 8, 9, 8);
  mark(size - 8, 0, 8, 9);
  mark(6, 0, 1, size); // timing
  mark(0, 6, size, 1);
  const align = ALIGN[version];
  for (const r of align) {
    for (const c of align) {
      if ((r === 6 && c === 6) || (r === 6 && c === align[align.length - 1]) || (r === align[align.length - 1] && c === 6)) continue;
      mark(r - 2, c - 2, 5, 5);
    }
  }
  if (version >= 7) {
    mark(0, size - 11, 6, 3);
    mark(size - 11, 0, 3, 6);
  }
  return f;
}

function readCodewords(m, version, mask) {
  const size = m.length;
  const fn = functionMap(version);
  const bits = [];
  let upward = true;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let step = 0; step < size; step += 1) {
      const r = upward ? size - 1 - step : step;
      for (const c of [right, right - 1]) {
        if (fn[r][c]) continue;
        bits.push((m[r][c] ? 1 : 0) ^ (MASK[mask](r, c) ? 1 : 0));
      }
    }
    upward = !upward;
  }
  const words = [];
  for (let i = 0; i + 8 <= bits.length && words.length < TOTAL_CODEWORDS[version]; i += 8) {
    words.push(bits.slice(i, i + 8).reduce((value, item) => (value << 1) | item, 0));
  }
  return words;
}

function syndromesZero(block, eccLength) {
  for (let i = 0; i < eccLength; i += 1) {
    let value = 0;
    const alpha = EXP[i];
    for (const byte of block) value = mul(value, alpha) ^ byte;
    if (value !== 0) return false;
  }
  return true;
}

export function decodeQr(m) {
  const size = m.length;
  assert.ok(m.every((row) => row.length === size), "square");
  const version = (size - 17) / 4;
  assert.ok(Number.isInteger(version) && version >= 1 && version <= 10, `version ${version}`);

  // Finder patterns in three corners.
  const finderAt = (r0, c0) => {
    for (let r = 0; r < 7; r += 1) {
      for (let c = 0; c < 7; c += 1) {
        const ring = Math.max(Math.abs(r - 3), Math.abs(c - 3));
        assert.equal(m[r0 + r][c0 + c], ring !== 2, `finder at ${r0},${c0}`);
      }
    }
  };
  finderAt(0, 0);
  finderAt(0, size - 7);
  finderAt(size - 7, 0);
  for (let i = 8; i < size - 8; i += 1) {
    assert.equal(m[6][i], i % 2 === 0, "timing row");
    assert.equal(m[i][6], i % 2 === 0, "timing column");
  }
  assert.equal(m[size - 8][8], true, "dark module");

  const format = readFormat(m);
  assert.equal(format.firstRaw, format.secondRaw, "both copies of the format agree");
  assert.ok(bchFormatValid(format.firstRaw ^ 0x5412), "format BCH is valid");
  const ecl = format.first >>> 13;
  const mask = (format.first >>> 10) & 7;
  assert.equal(ecl, 0b00, "error correction level M");

  const words = readCodewords(m, version, mask);
  assert.equal(words.length, TOTAL_CODEWORDS[version]);

  // Split back into blocks.
  const total = TOTAL_CODEWORDS[version];
  const numBlocks = M_BLOCKS[version];
  const ecc = M_ECC[version];
  const shortLength = Math.floor(total / numBlocks);
  const numShort = numBlocks - (total % numBlocks);
  const dataLengths = Array.from({ length: numBlocks }, (_, i) => shortLength - ecc + (i < numShort ? 0 : 1));
  const blocks = dataLengths.map(() => []);
  let k = 0;
  for (let i = 0; i < Math.max(...dataLengths); i += 1) {
    for (let b = 0; b < numBlocks; b += 1) if (i < dataLengths[b]) blocks[b].push(words[k++]);
  }
  for (let i = 0; i < ecc; i += 1) for (let b = 0; b < numBlocks; b += 1) blocks[b].push(words[k++]);
  blocks.forEach((block, index) => assert.ok(syndromesZero(block, ecc), `Reed-Solomon block ${index} is clean`));

  const data = blocks.flatMap((block, index) => block.slice(0, dataLengths[index]));
  const bits = data.flatMap((byte) => Array.from({ length: 8 }, (_, i) => (byte >>> (7 - i)) & 1));
  let at = 0;
  const take = (n) => {
    let value = 0;
    for (let i = 0; i < n; i += 1) value = (value << 1) | bits[at++];
    return value;
  };
  assert.equal(take(4), 0b0100, "byte mode");
  const count = take(version <= 9 ? 8 : 16);
  const bytes = Array.from({ length: count }, () => take(8));
  return { version, mask, text: new TextDecoder("utf-8", { fatal: true }).decode(new Uint8Array(bytes)) };
}

test("QR codes decode back to the exact text (passport links, short, long, non-ASCII)", () => {
  const samples = [
    "A",
    "LR-ABCDEFGH23",
    "https://minders.example.org/p/LR-7KQ2MXP9ZA",
    "Gbarnga – Kpelleh Town · ŋɔ́ · 50%",
    "x".repeat(100),
    "https://minders.example.org/p/LR-ZZZZZZZZZZ?ref=" + "q".repeat(150)
  ];
  const versions = new Set();
  for (const text of samples) {
    const matrix = qrMatrix(text);
    const result = decodeQr(matrix);
    assert.equal(result.text, text);
    versions.add(result.version);
  }
  assert.ok(versions.size >= 3, "several versions were exercised");
});

test("every mask pattern the encoder picks still decodes", () => {
  const masks = new Set();
  for (let i = 0; i < 60; i += 1) {
    const text = `https://minders.example.org/p/LR-${i.toString(36).toUpperCase().padStart(10, "Q")}`;
    const { mask, text: decoded } = decodeQr(qrMatrix(text));
    assert.equal(decoded, text);
    masks.add(mask);
  }
  assert.ok(masks.size >= 3, `masks seen: ${[...masks]}`);
});

test("the biggest version (10) works and anything longer is refused", () => {
  const max = "y".repeat(213); // version 10-M holds 213 bytes
  const result = decodeQr(qrMatrix(max));
  assert.equal(result.version, 10);
  assert.equal(result.text, max);
  assert.throws(() => qrMatrix("y".repeat(214)), /too long/);
});

test("the SVG path has one square per dark module and a 4-module quiet zone", () => {
  const matrix = qrMatrix("LR-ABCDEFGH23");
  const { path, size } = qrSvgPath(matrix);
  const dark = matrix.flat().filter(Boolean).length;
  assert.equal((path.match(/M/g) || []).length, dark);
  assert.equal(size, matrix.length + 8);
  assert.ok(!/M[0-3],/.test(path) && !/,[0-3]h/.test(path), "nothing drawn inside the quiet zone");
});

test("the reader is strict: one wrong module is caught", () => {
  const matrix = qrMatrix("https://minders.example.org/p/LR-ABCDEFGH23").map((row) => [...row]);
  const size = matrix.length;
  // A data module in the bottom-right corner (never a fixed pattern).
  matrix[size - 1][size - 1] = !matrix[size - 1][size - 1];
  assert.throws(() => decodeQr(matrix), /Reed-Solomon/);
});
