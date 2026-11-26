// Checks an uploaded photo and removes hidden data (EXIF: GPS position, phone
// model, time) before it is saved. Only JPEG and WebP are accepted.

export function detectType(buffer) {
  if (buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (buffer.length > 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") {
    return "image/webp";
  }
  return null;
}

// JPEG: drop APP1-APP15 (EXIF, XMP, …) and comment segments; keep the rest.
function cleanJpeg(buffer) {
  const parts = [buffer.subarray(0, 2)];
  let offset = 2;
  while (offset + 4 <= buffer.length) {
    if (buffer[offset] !== 0xff) throw new Error("bad jpeg");
    const marker = buffer[offset + 1];
    if (marker === 0xd9) break;
    if (marker === 0xda) {
      parts.push(buffer.subarray(offset));
      return Buffer.concat(parts);
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      parts.push(buffer.subarray(offset, offset + 2));
      offset += 2;
      continue;
    }
    const length = buffer.readUInt16BE(offset + 2);
    if (length < 2 || offset + 2 + length > buffer.length) throw new Error("bad jpeg");
    const drop = (marker >= 0xe1 && marker <= 0xef) || marker === 0xfe;
    if (!drop) parts.push(buffer.subarray(offset, offset + 2 + length));
    offset += 2 + length;
  }
  throw new Error("bad jpeg");
}

// WebP: drop EXIF and XMP chunks and clear their flags.
function cleanWebp(buffer) {
  const chunks = [];
  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const id = buffer.toString("ascii", offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    const end = offset + 8 + size + (size % 2);
    if (end > buffer.length + 1) throw new Error("bad webp");
    if (id !== "EXIF" && id !== "XMP ") chunks.push(Buffer.from(buffer.subarray(offset, Math.min(end, buffer.length))));
    offset = end;
  }
  if (!chunks.length) throw new Error("bad webp");
  for (const chunk of chunks) {
    if (chunk.toString("ascii", 0, 4) === "VP8X") chunk[8] &= ~(0x08 | 0x04);
  }
  const body = Buffer.concat(chunks);
  const header = Buffer.alloc(12);
  header.write("RIFF", 0, "ascii");
  header.writeUInt32LE(body.length + 4, 4);
  header.write("WEBP", 8, "ascii");
  return Buffer.concat([header, body]);
}

export function cleanImage(buffer) {
  const type = detectType(buffer);
  if (!type) return null;
  try {
    return { type, data: type === "image/jpeg" ? cleanJpeg(buffer) : cleanWebp(buffer) };
  } catch {
    return null;
  }
}
