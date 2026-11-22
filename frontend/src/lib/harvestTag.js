// The Harvest Passport QR code as files a farmer can keep, print or send:
//   - a PNG picture of the QR code (with the crop and code under it)
//   - a product tag as PDF: one 4x6 inch label, or an A4 sheet of 4 tags to cut
// Both are made on the phone, so they work without network. The tag shows
// the same things as the public passport page: never the phone number or the
// full name, only the first name.

import { PdfDoc, fitText, textWidth } from "./pdf.js";
import { qrMatrix } from "./qr.js";
import { longDate } from "./farmReport.js";

const COLOR = {
  primary: "#198754",
  primaryDark: "#14532d",
  primarySoft: "#e8f5e9",
  ink: "#1f2937",
  soft: "#6b7280",
  line: "#d5ddd7",
  qr: "#111111"
};

const GRADE_COLOR = { A: "#15803d", B: "#0f766e", C: "#b45309", rejected: "#b91c1c" };

// Everything a tag shows, from the harvest and what is on the phone.
export function tagData({ harvest, farm, user, grade, gradeText, checks = [], unit, url }) {
  return {
    crop: harvest.crop,
    quantity: harvest.quantity,
    unit: unit || harvest.unit,
    harvestDate: harvest.harvestDate,
    code: harvest.passportCode,
    url,
    grade: grade || null,
    gradeText: gradeText || "",
    checks,
    farmName: farm?.farmName || "",
    place: [farm?.community, farm?.district, farm?.county].filter(Boolean).join(", "),
    farmer: String(user?.fullName || "").trim().split(/\s+/)[0] || ""
  };
}

export function tagFileName(tag, extension, suffix = "") {
  const slug = String(tag.crop || "harvest").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return `harvest-passport-${slug}-${tag.code}${suffix}.${extension}`;
}

// Dark squares merged into runs along each row, so the PDF stays small.
function qrBoxes(matrix, x, y, size) {
  const quiet = 4;
  const cell = size / (matrix.length + quiet * 2);
  const boxes = [];
  matrix.forEach((row, r) => {
    let start = -1;
    for (let c = 0; c <= row.length; c += 1) {
      const dark = c < row.length && row[c];
      if (dark && start < 0) start = c;
      if (!dark && start >= 0) {
        // A hair of overlap so no thin white lines show between rows.
        boxes.push([x + (quiet + start) * cell, y + (quiet + r) * cell, (c - start) * cell + 0.02, cell + 0.05]);
        start = -1;
      }
    }
  });
  return boxes;
}

// Draws one tag inside the box (x, y, w, h). Designed at 288 x 432 points
// (4 x 6 inches) and scaled to fit the box.
function drawTag(doc, x, y, w, h, tag) {
  const s = Math.min(w / 288, h / 432);
  const tw = 288 * s;
  const th = 432 * s;
  const left = x + (w - tw) / 2;
  const top = y + (h - th) / 2;
  const pad = 16 * s;
  const inner = tw - pad * 2;

  // Card and header band.
  doc.rect(left, top, tw, th, { fill: "#ffffff", stroke: COLOR.line, lineWidth: 0.8 * s, radius: 10 * s });
  doc.rect(left, top, tw, 70 * s, { fill: COLOR.primary, radius: 10 * s });
  doc.rect(left, top + 50 * s, tw, 20 * s, { fill: COLOR.primary });
  // A punch hole to tie the tag to a bag.
  doc.rect(left + tw / 2 - 7 * s, top + 8 * s, 14 * s, 14 * s, { fill: "#ffffff", stroke: COLOR.primaryDark, lineWidth: 0.6 * s, radius: 7 * s });

  doc.text("HARVEST PASSPORT", left + pad, top + 20 * s, { size: 7.5 * s, bold: true, color: "#c8ecd6" });
  doc.text("Product of Liberia", left + tw - pad, top + 20 * s, { size: 7.5 * s, color: "#c8ecd6", align: "right" });
  doc.text(tag.crop, left + pad, top + 52 * s, { size: 24 * s, bold: true, color: "#ffffff", maxWidth: inner - (tag.grade ? 78 * s : 0) });

  // Grade pill, top right of the band.
  if (tag.grade) {
    const label = tag.gradeText || `Grade ${tag.grade}`;
    const pillWidth = Math.min(textWidth(label, 9 * s, true) + 16 * s, 90 * s);
    const pillX = left + tw - pad - pillWidth;
    doc.rect(pillX, top + 36 * s, pillWidth, 20 * s, { fill: "#ffffff", radius: 10 * s });
    doc.text(label, pillX + pillWidth / 2, top + 49.5 * s, { size: 9 * s, bold: true, color: GRADE_COLOR[tag.grade] || COLOR.ink, align: "center", maxWidth: pillWidth - 8 * s });
  }

  // QR code, centred.
  const qrSize = 168 * s;
  const qrX = left + (tw - qrSize) / 2;
  const qrY = top + 82 * s;
  doc.rect(qrX - 4 * s, qrY - 4 * s, qrSize + 8 * s, qrSize + 8 * s, { fill: "#ffffff", stroke: COLOR.line, lineWidth: 0.6 * s, radius: 6 * s });
  doc.boxes(qrBoxes(qrMatrix(tag.url), qrX, qrY, qrSize), { fill: COLOR.qr });

  // The code in large letters, for buyers without a camera.
  const codeY = qrY + qrSize + 22 * s;
  doc.text(tag.code.split("").join(" "), left + tw / 2, codeY, { size: 13 * s, bold: true, color: COLOR.ink, align: "center" });
  doc.text("Scan the code to see where this harvest came from", left + tw / 2, codeY + 13 * s, {
    size: 7 * s,
    color: COLOR.soft,
    align: "center",
    maxWidth: inner
  });

  // Details in two columns.
  const rowsTop = codeY + 26 * s;
  doc.line(left + pad, rowsTop, left + tw - pad, rowsTop, { color: COLOR.line, lineWidth: 0.6 * s });
  const rows = [
    [["Quantity", `${formatNumber(tag.quantity)} ${tag.unit}`], ["Harvested", longDate(tag.harvestDate)]],
    [["Farm", tag.farmName], ["Farmer", tag.farmer]],
    [["Place", tag.place]]
  ]
    .map((row) => row.filter(([, value]) => value))
    .filter((row) => row.length);
  const colWidth = inner / 2;
  let fy = rowsTop + 14 * s;
  for (const row of rows) {
    row.forEach(([label, value], index) => {
      const fx = left + pad + index * colWidth;
      const width = row.length === 1 ? inner : colWidth;
      doc.text(label.toUpperCase(), fx, fy, { size: 6.5 * s, bold: true, color: COLOR.soft });
      doc.text(value, fx, fy + 11 * s, { size: 9.5 * s, bold: true, color: COLOR.ink, maxWidth: width - 6 * s });
    });
    fy += 25 * s;
  }

  // Quality checks that passed.
  if (tag.checks.length) {
    const text = `Checked: ${tag.checks.join("  ·  ")}`;
    doc.text(fitText(text, inner, 7.5 * s), left + pad, Math.min(fy + 2 * s, top + th - 30 * s), { size: 7.5 * s, color: COLOR.primaryDark });
  }

  // Footer.
  doc.rect(left, top + th - 22 * s, tw, 22 * s, { fill: COLOR.primarySoft, radius: 10 * s });
  doc.rect(left, top + th - 22 * s, tw, 10 * s, { fill: COLOR.primarySoft });
  doc.text("FarmBok", left + pad, top + th - 8 * s, { size: 7.5 * s, bold: true, color: COLOR.primaryDark });
  doc.text(shortUrl(tag.url), left + tw - pad, top + th - 8 * s, { size: 7 * s, color: COLOR.primaryDark, align: "right", maxWidth: inner - 50 * s });
}

function shortUrl(url) {
  return String(url || "").replace(/^https?:\/\//, "");
}

function formatNumber(value) {
  const number = Number(value || 0);
  return number.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

// layout "label": one 4x6 inch page (label printers, or print and cut).
// layout "sheet": A4 with 4 tags and dashed cut lines (any printer).
export function harvestTagPdf(tag, { layout = "label" } = {}) {
  if (layout === "sheet") {
    const doc = new PdfDoc({ title: `Harvest Passport ${tag.code}` });
    const margin = 24;
    const gap = 16;
    const cellW = (doc.width - margin * 2 - gap) / 2;
    const cellH = (doc.height - margin * 2 - gap) / 2;
    for (let row = 0; row < 2; row += 1) {
      for (let col = 0; col < 2; col += 1) {
        drawTag(doc, margin + col * (cellW + gap), margin + row * (cellH + gap), cellW, cellH, tag);
      }
    }
    const midX = doc.width / 2;
    const midY = doc.height / 2;
    doc.line(midX, 8, midX, doc.height - 8, { color: "#9ca3af", lineWidth: 0.5, dash: [4, 3] });
    doc.line(8, midY, doc.width - 8, midY, { color: "#9ca3af", lineWidth: 0.5, dash: [4, 3] });
    doc.text("Cut along the dashed lines", margin, doc.height - 10, { size: 6.5, color: "#9ca3af" });
    return doc.save();
  }
  const doc = new PdfDoc({ width: 288, height: 432, title: `Harvest Passport ${tag.code}` });
  drawTag(doc, 0, 0, 288, 432, tag);
  return doc.save();
}

// The QR code as an SVG picture (also used to make the PNG).
export function qrSvg(text, { size = 1024, caption = [] } = {}) {
  const matrix = qrMatrix(text);
  const quiet = 4;
  const cells = matrix.length + quiet * 2;
  const cell = size / cells;
  const captionHeight = caption.length ? 40 + caption.length * 56 : 0;
  let path = "";
  matrix.forEach((row, y) => {
    row.forEach((dark, x) => {
      if (dark) path += `M${x + quiet},${y + quiet}h1v1h-1z`;
    });
  });
  const lines = caption
    .map(
      (line, index) =>
        `<text x="${size / 2}" y="${size + 56 + index * 56}" font-family="Arial, Helvetica, sans-serif" font-size="${index === 0 ? 44 : 34}" font-weight="${index === 0 ? 700 : 400}" fill="${index === 0 ? COLOR.ink : COLOR.soft}" text-anchor="middle">${escapeXml(line)}</text>`
    )
    .join("");
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size + captionHeight}" viewBox="0 0 ${size} ${size + captionHeight}">` +
    `<rect width="100%" height="100%" fill="#ffffff"/>` +
    `<g transform="scale(${cell})" shape-rendering="crispEdges"><path d="${path}" fill="${COLOR.qr}"/></g>` +
    lines +
    `</svg>`
  );
}

function escapeXml(text) {
  return String(text).replace(/[<>&"']/g, (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[char]);
}

// The QR picture as PNG (opens anywhere, sends well on WhatsApp). Drawn
// straight onto a canvas, so it does not depend on the browser reading SVG.
export function qrPng(text, { size = 1024, caption = [] } = {}) {
  const matrix = qrMatrix(text);
  const quiet = 4;
  const cells = matrix.length + quiet * 2;
  const cell = Math.floor(size / cells);
  const qrSize = cell * cells;
  const captionHeight = caption.length ? 40 + caption.length * 56 : 0;
  const canvas = document.createElement("canvas");
  canvas.width = qrSize;
  canvas.height = qrSize + captionHeight;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = COLOR.qr;
  matrix.forEach((row, y) => {
    row.forEach((dark, x) => {
      if (dark) ctx.fillRect((x + quiet) * cell, (y + quiet) * cell, cell, cell);
    });
  });
  ctx.textAlign = "center";
  caption.forEach((line, index) => {
    ctx.font = `${index === 0 ? "bold 44px" : "34px"} Arial, Helvetica, sans-serif`;
    ctx.fillStyle = index === 0 ? COLOR.ink : COLOR.soft;
    ctx.fillText(line, qrSize / 2, qrSize + 56 + index * 56, qrSize - 40);
  });
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not make the picture."))), "image/png");
  });
}
