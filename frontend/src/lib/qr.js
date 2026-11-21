// Small QR code generator (byte mode, error correction level M, versions 1–10),
// so Harvest Passport codes can be drawn on the phone without internet or an
// extra package. Follows ISO/IEC 18004; structure based on Project Nayuki's
// public-domain-style reference design. Returns a square matrix of booleans
// (true = dark).

const ECC_PER_BLOCK_M = [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26];
const NUM_BLOCKS_M = [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5];
const FORMAT_BITS_M = 0;
const MAX_VERSION = 10;

function rawDataModules(version) {
  let result = (16 * version + 128) * version + 64;
  if (version >= 2) {
    const numAlign = Math.floor(version / 7) + 2;
    result -= (25 * numAlign - 10) * numAlign - 55;
    if (version >= 7) result -= 36;
  }
  return result;
}

function dataCodewords(version) {
  return Math.floor(rawDataModules(version) / 8) - ECC_PER_BLOCK_M[version] * NUM_BLOCKS_M[version];
}

function gfMultiply(x, y) {
  let z = 0;
  for (let i = 7; i >= 0; i -= 1) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z & 0xff;
}

function rsDivisor(degree) {
  const result = new Array(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i += 1) {
    for (let j = 0; j < result.length; j += 1) {
      result[j] = gfMultiply(result[j], root);
      if (j + 1 < result.length) result[j] ^= result[j + 1];
    }
    root = gfMultiply(root, 0x02);
  }
  return result;
}

function rsRemainder(data, divisor) {
  const result = divisor.map(() => 0);
  for (const byte of data) {
    const factor = byte ^ result.shift();
    result.push(0);
    divisor.forEach((coefficient, index) => {
      result[index] ^= gfMultiply(coefficient, factor);
    });
  }
  return result;
}

function utf8Bytes(text) {
  return Array.from(new TextEncoder().encode(text));
}

function encodeData(bytes, version) {
  const bits = [];
  const push = (value, length) => {
    for (let i = length - 1; i >= 0; i -= 1) bits.push((value >>> i) & 1);
  };
  push(0b0100, 4); // byte mode
  push(bytes.length, version <= 9 ? 8 : 16);
  for (const byte of bytes) push(byte, 8);
  const capacityBits = dataCodewords(version) * 8;
  push(0, Math.min(4, capacityBits - bits.length));
  push(0, (8 - (bits.length % 8)) % 8);
  const codewords = [];
  for (let i = 0; i < bits.length; i += 8) {
    let value = 0;
    for (let j = 0; j < 8; j += 1) value = (value << 1) | bits[i + j];
    codewords.push(value);
  }
  for (let pad = 0xec; codewords.length < dataCodewords(version); pad ^= 0xec ^ 0x11) codewords.push(pad);
  return codewords;
}

function addEccAndInterleave(data, version) {
  const numBlocks = NUM_BLOCKS_M[version];
  const blockEccLength = ECC_PER_BLOCK_M[version];
  const rawCodewords = Math.floor(rawDataModules(version) / 8);
  const numShortBlocks = numBlocks - (rawCodewords % numBlocks);
  const shortBlockLength = Math.floor(rawCodewords / numBlocks);
  const divisor = rsDivisor(blockEccLength);
  const blocks = [];
  for (let i = 0, k = 0; i < numBlocks; i += 1) {
    const block = data.slice(k, k + shortBlockLength - blockEccLength + (i < numShortBlocks ? 0 : 1));
    k += block.length;
    const ecc = rsRemainder(block, divisor);
    if (i < numShortBlocks) block.push(0);
    blocks.push(block.concat(ecc));
  }
  const result = [];
  for (let i = 0; i < blocks[0].length; i += 1) {
    blocks.forEach((block, j) => {
      if (i !== shortBlockLength - blockEccLength || j >= numShortBlocks) result.push(block[i]);
    });
  }
  return result;
}

function alignmentPositions(version, size) {
  if (version === 1) return [];
  const numAlign = Math.floor(version / 7) + 2;
  const step = Math.ceil((version * 4 + 4) / (numAlign * 2 - 2)) * 2;
  const result = [6];
  for (let pos = size - 7; result.length < numAlign; pos -= step) result.splice(1, 0, pos);
  return result;
}

const MASKS = [
  (x, y) => (x + y) % 2 === 0,
  (x, y) => y % 2 === 0,
  (x) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0
];

function buildMatrix(version, codewords, mask) {
  const size = version * 4 + 17;
  const modules = Array.from({ length: size }, () => new Array(size).fill(false));
  const isFunction = Array.from({ length: size }, () => new Array(size).fill(false));
  const set = (x, y, dark) => {
    modules[y][x] = dark;
    isFunction[y][x] = true;
  };

  for (let i = 0; i < size; i += 1) {
    set(6, i, i % 2 === 0);
    set(i, 6, i % 2 === 0);
  }
  const finder = (cx, cy) => {
    for (let dy = -4; dy <= 4; dy += 1) {
      for (let dx = -4; dx <= 4; dx += 1) {
        const x = cx + dx;
        const y = cy + dy;
        if (x < 0 || x >= size || y < 0 || y >= size) continue;
        const dist = Math.max(Math.abs(dx), Math.abs(dy));
        set(x, y, dist !== 2 && dist !== 4);
      }
    }
  };
  finder(3, 3);
  finder(size - 4, 3);
  finder(3, size - 4);

  const positions = alignmentPositions(version, size);
  const last = positions.length - 1;
  positions.forEach((px, i) => {
    positions.forEach((py, j) => {
      if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) return;
      for (let dy = -2; dy <= 2; dy += 1) {
        for (let dx = -2; dx <= 2; dx += 1) set(px + dx, py + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
      }
    });
  });

  const drawFormat = (maskValue) => {
    const data = (FORMAT_BITS_M << 3) | maskValue;
    let rem = data;
    for (let i = 0; i < 10; i += 1) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const bits = ((data << 10) | rem) ^ 0x5412;
    const bit = (i) => ((bits >>> i) & 1) !== 0;
    for (let i = 0; i <= 5; i += 1) set(8, i, bit(i));
    set(8, 7, bit(6));
    set(8, 8, bit(7));
    set(7, 8, bit(8));
    for (let i = 9; i < 15; i += 1) set(14 - i, 8, bit(i));
    for (let i = 0; i < 8; i += 1) set(size - 1 - i, 8, bit(i));
    for (let i = 8; i < 15; i += 1) set(8, size - 15 + i, bit(i));
    set(8, size - 8, true);
  };
  drawFormat(0);

  if (version >= 7) {
    let rem = version;
    for (let i = 0; i < 12; i += 1) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const bits = (version << 12) | rem;
    for (let i = 0; i < 18; i += 1) {
      const dark = ((bits >>> i) & 1) !== 0;
      const a = size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      set(a, b, dark);
      set(b, a, dark);
    }
  }

  let bitIndex = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert += 1) {
      for (let j = 0; j < 2; j += 1) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vert : vert;
        if (!isFunction[y][x] && bitIndex < codewords.length * 8) {
          modules[y][x] = ((codewords[bitIndex >>> 3] >>> (7 - (bitIndex & 7))) & 1) !== 0;
          bitIndex += 1;
        }
      }
    }
  }

  const maskFn = MASKS[mask];
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (!isFunction[y][x] && maskFn(x, y)) modules[y][x] = !modules[y][x];
    }
  }
  drawFormat(mask);
  return modules;
}

// Standard penalty score; lower is easier for cameras to read.
function penalty(modules) {
  const size = modules.length;
  let score = 0;
  const lineScore = (get) => {
    for (let a = 0; a < size; a += 1) {
      let run = 1;
      for (let b = 1; b < size; b += 1) {
        if (get(a, b) === get(a, b - 1)) {
          run += 1;
          if (run === 5) score += 3;
          else if (run > 5) score += 1;
        } else run = 1;
      }
      const line = Array.from({ length: size }, (_, b) => (get(a, b) ? 1 : 0)).join("");
      for (const pattern of ["10111010000", "00001011101"]) {
        let index = line.indexOf(pattern);
        while (index !== -1) {
          score += 40;
          index = line.indexOf(pattern, index + 1);
        }
      }
    }
  };
  lineScore((a, b) => modules[a][b]);
  lineScore((a, b) => modules[b][a]);
  for (let y = 0; y < size - 1; y += 1) {
    for (let x = 0; x < size - 1; x += 1) {
      const c = modules[y][x];
      if (c === modules[y][x + 1] && c === modules[y + 1][x] && c === modules[y + 1][x + 1]) score += 3;
    }
  }
  let dark = 0;
  for (const row of modules) for (const cell of row) if (cell) dark += 1;
  const total = size * size;
  score += Math.floor(Math.abs(dark * 20 - total * 10) / total) * 10;
  return score;
}

export function qrMatrix(text) {
  const bytes = utf8Bytes(text);
  let version = 1;
  for (; version <= MAX_VERSION; version += 1) {
    const headerBits = 4 + (version <= 9 ? 8 : 16);
    if (headerBits + bytes.length * 8 <= dataCodewords(version) * 8) break;
  }
  if (version > MAX_VERSION) throw new Error("Text is too long for this QR code.");
  const codewords = addEccAndInterleave(encodeData(bytes, version), version);
  let best = null;
  let bestScore = Infinity;
  for (let mask = 0; mask < 8; mask += 1) {
    const matrix = buildMatrix(version, codewords, mask);
    const score = penalty(matrix);
    if (score < bestScore) {
      best = matrix;
      bestScore = score;
    }
  }
  return best;
}

// One SVG path for all dark squares, plus the quiet zone around the code.
export function qrSvgPath(matrix, border = 4) {
  let path = "";
  matrix.forEach((row, y) => {
    row.forEach((dark, x) => {
      if (dark) path += `M${x + border},${y + border}h1v1h-1z`;
    });
  });
  return { path, size: matrix.length + border * 2 };
}
