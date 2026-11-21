// A small PDF writer, so reports can be saved as PDF on the phone without
// network and without a big library. It knows two fonts (Helvetica and
// Helvetica Bold), filled boxes, lines and text, and works out text widths
// so columns line up and long words are cut with "...".
//
//   const doc = new PdfDoc();
//   doc.text("Hello", 40, 60, { size: 14, bold: true });
//   const bytes = doc.save(); // Uint8Array

// Character widths (1/1000 of the font size) for ASCII 32-126, from the
// standard Adobe font metrics.
const HELVETICA = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556,
  556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667,
  556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556,
  556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722,
  500, 500, 500, 334, 260, 334, 584
];
const HELVETICA_BOLD = [
  278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556,
  556, 556, 556, 556, 333, 333, 584, 584, 584, 611, 975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722,
  611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556, 333, 556,
  611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778,
  556, 556, 500, 389, 280, 389, 584
];

// Characters outside plain ASCII that reports use, mapped to what the
// standard fonts can show (WinAnsi codes or a plain stand-in).
const SPECIAL = {
  "·": { code: 0xb7, width: 278 }, // middle dot
  "−": "-", // minus sign
  "–": "-",
  "—": "-",
  "‘": "'",
  "’": "'",
  "“": '"',
  "”": '"',
  "→": "->",
  "…": "...",
  " ": " "
};

function normalize(text) {
  let out = "";
  for (const char of String(text ?? "")) {
    const special = SPECIAL[char];
    if (typeof special === "string") out += special;
    else if (special) out += char;
    else {
      const code = char.charCodeAt(0);
      out += code >= 32 && code <= 126 ? char : char.normalize("NFD").replace(/[^\x20-\x7e]/g, "") || "?";
    }
  }
  return out;
}

export function textWidth(text, size, bold = false) {
  const table = bold ? HELVETICA_BOLD : HELVETICA;
  let units = 0;
  for (const char of normalize(text)) {
    const special = SPECIAL[char];
    units += special && typeof special === "object" ? special.width : table[char.charCodeAt(0) - 32] ?? 556;
  }
  return (units * size) / 1000;
}

// Cut text to fit a width, ending with "..." when cut.
export function fitText(text, width, size, bold = false) {
  const clean = normalize(text);
  if (textWidth(clean, size, bold) <= width) return clean;
  let cut = clean;
  while (cut.length > 0 && textWidth(`${cut}...`, size, bold) > width) cut = cut.slice(0, -1);
  return cut ? `${cut.trimEnd()}...` : "";
}

// Split text into lines that fit a width (for notes and long labels).
export function wrapText(text, width, size, bold = false) {
  const words = normalize(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (textWidth(next, size, bold) <= width || !line) line = next;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines.map((item) => fitText(item, width, size, bold));
}

function escapePdf(text) {
  let out = "";
  for (const char of normalize(text)) {
    const special = SPECIAL[char];
    if (special && typeof special === "object") out += `\\${special.code.toString(8)}`;
    else if (char === "(" || char === ")" || char === "\\") out += `\\${char}`;
    else out += char;
  }
  return out;
}

function hexToRgb(hex) {
  const value = hex.replace("#", "");
  return [0, 2, 4].map((at) => (parseInt(value.slice(at, at + 2), 16) / 255).toFixed(3)).join(" ");
}

const num = (value) => (Math.round(value * 100) / 100).toString();

export class PdfDoc {
  constructor({ width = 595.28, height = 841.89, title = "Report", author = "" } = {}) {
    this.width = width;
    this.height = height;
    this.title = title;
    this.author = author;
    this.pages = [];
    this.addPage();
  }

  addPage() {
    this.page = [];
    this.pages.push(this.page);
    return this.pages.length;
  }

  get pageNumber() {
    return this.pages.indexOf(this.page) + 1;
  }

  // y is measured from the top of the page, like on screen.
  text(value, x, y, { size = 10, bold = false, color = "#1f2937", align = "left", maxWidth } = {}) {
    let shown = maxWidth ? fitText(value, maxWidth, size, bold) : normalize(value);
    const width = textWidth(shown, size, bold);
    const left = align === "right" ? x - width : align === "center" ? x - width / 2 : x;
    this.page.push(
      `BT /${bold ? "F2" : "F1"} ${num(size)} Tf ${hexToRgb(color)} rg ${num(left)} ${num(this.height - y)} Td (${escapePdf(shown)}) Tj ET`
    );
    return width;
  }

  rect(x, y, width, height, { fill, stroke, lineWidth = 0.6, radius = 0 } = {}) {
    const top = this.height - y;
    let path;
    if (radius > 0) {
      const r = Math.min(radius, width / 2, height / 2);
      const k = 0.5523 * r;
      const bottom = top - height;
      const right = x + width;
      path = [
        `${num(x + r)} ${num(top)} m`,
        `${num(right - r)} ${num(top)} l`,
        `${num(right - r + k)} ${num(top)} ${num(right)} ${num(top - r + k)} ${num(right)} ${num(top - r)} c`,
        `${num(right)} ${num(bottom + r)} l`,
        `${num(right)} ${num(bottom + r - k)} ${num(right - r + k)} ${num(bottom)} ${num(right - r)} ${num(bottom)} c`,
        `${num(x + r)} ${num(bottom)} l`,
        `${num(x + r - k)} ${num(bottom)} ${num(x)} ${num(bottom + r - k)} ${num(x)} ${num(bottom + r)} c`,
        `${num(x)} ${num(top - r)} l`,
        `${num(x)} ${num(top - r + k)} ${num(x + r - k)} ${num(top)} ${num(x + r)} ${num(top)} c`,
        "h"
      ].join(" ");
    } else {
      path = `${num(x)} ${num(top - height)} ${num(width)} ${num(height)} re`;
    }
    const parts = [];
    if (fill) parts.push(`${hexToRgb(fill)} rg`);
    if (stroke) parts.push(`${hexToRgb(stroke)} RG ${num(lineWidth)} w`);
    parts.push(path, fill && stroke ? "B" : fill ? "f" : "S");
    this.page.push(`q ${parts.join(" ")} Q`);
  }

  line(x1, y1, x2, y2, { color = "#e3e9e4", lineWidth = 0.6, dash } = {}) {
    const pattern = dash ? `[${dash.map(num).join(" ")}] 0 d ` : "";
    this.page.push(
      `q ${hexToRgb(color)} RG ${num(lineWidth)} w ${pattern}${num(x1)} ${num(this.height - y1)} m ${num(x2)} ${num(this.height - y2)} l S Q`
    );
  }

  // Many filled boxes in one colour as a single path (used for QR codes, so
  // they stay sharp at any print size). Each box is [x, y, width, height].
  boxes(list, { fill = "#111111" } = {}) {
    if (!list.length) return;
    const path = list
      .map(([x, y, width, height]) => `${num(x)} ${num(this.height - y - height)} ${num(width)} ${num(height)} re`)
      .join(" ");
    this.page.push(`q ${hexToRgb(fill)} rg ${path} f Q`);
  }

  // Draw something on every page (page numbers, footers) once all pages exist.
  eachPage(draw) {
    const current = this.page;
    this.pages.forEach((page, index) => {
      this.page = page;
      draw(index + 1, this.pages.length);
    });
    this.page = current;
  }

  save() {
    const objects = [];
    const add = (body) => {
      objects.push(body);
      return objects.length;
    };
    const catalog = add(null);
    const pagesId = add(null);
    const font1 = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
    const font2 = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
    const pageIds = [];
    for (const page of this.pages) {
      const content = page.join("\n");
      const contentId = add(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
      pageIds.push(
        add(
          `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${num(this.width)} ${num(this.height)}] ` +
            `/Resources << /Font << /F1 ${font1} 0 R /F2 ${font2} 0 R >> >> /Contents ${contentId} 0 R >>`
        )
      );
    }
    objects[catalog - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
    objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;
    const now = new Date();
    const pad = (value) => String(value).padStart(2, "0");
    const stamp = `D:${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const info = add(
      `<< /Title (${escapePdf(this.title)}) /Author (${escapePdf(this.author)}) /Creator (Minders) /CreationDate (${stamp}) >>`
    );

    // Everything above is plain ASCII, so string length = byte length.
    let out = "%PDF-1.4\n%âãÏÓ\n";
    const offsets = [];
    objects.forEach((body, index) => {
      offsets.push(out.length);
      out += `${index + 1} 0 obj\n${body}\nendobj\n`;
    });
    const xref = out.length;
    out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    for (const offset of offsets) out += `${String(offset).padStart(10, "0")} 00000 n \n`;
    out += `trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;

    const bytes = new Uint8Array(out.length);
    for (let index = 0; index < out.length; index += 1) bytes[index] = out.charCodeAt(index) & 0xff;
    return bytes;
  }
}
