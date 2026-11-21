import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { test } from "node:test";
import { harvestTagPdf, qrSvg, tagData, tagFileName } from "../src/lib/harvestTag.js";

const tag = tagData({
  harvest: { crop: "Rice", quantity: 20, unit: "bags", harvestDate: "2026-07-10", passportCode: "LR-ABCDEFGH23" },
  farm: { farmName: "Swamp farm", community: "Kpelleh Town", district: "Gbarnga", county: "Bong" },
  user: { fullName: "Musu Kollie", phoneNumber: "0770000001" },
  grade: "A",
  gradeText: "Grade A",
  checks: ["Dry", "Clean", "No bugs"],
  unit: "Bags",
  url: "https://minders.example.org/p/LR-ABCDEFGH23"
});

test("the tag shows the first name only, never the phone number", () => {
  assert.equal(tag.farmer, "Musu");
  assert.ok(!JSON.stringify(tag).includes("0770000001"));
  assert.equal(tagFileName(tag, "pdf"), "harvest-passport-rice-LR-ABCDEFGH23.pdf");
});

for (const layout of ["label", "sheet"]) {
  test(`product tag PDF (${layout}) is a valid file with the code on it`, () => {
    const bytes = harvestTagPdf(tag, { layout });
    const text = Buffer.from(bytes).toString("latin1");
    assert.ok(text.startsWith("%PDF-1.4") && text.trimEnd().endsWith("%%EOF"));
    const xref = Number(text.match(/startxref\n(\d+)/)[1]);
    assert.equal(text.slice(xref, xref + 4), "xref");
    assert.match(text, /L R - A B C D E F G H 2 3/);
    assert.match(text, /\(Musu\) Tj/);
    if (layout === "label") assert.match(text, /MediaBox \[0 0 288 432\]/);
    if (process.env.TAG_PDF_DIR) writeFileSync(`${process.env.TAG_PDF_DIR}/tag-${layout}.pdf`, bytes);
  });
}

test("QR picture as SVG has the caption, escaped", () => {
  const svg = qrSvg(tag.url, { caption: ["Rice & beans", "LR-ABCDEFGH23"] });
  assert.ok(svg.startsWith("<svg"));
  assert.match(svg, /Rice &amp; beans/);
  if (process.env.TAG_PDF_DIR) writeFileSync(`${process.env.TAG_PDF_DIR}/qr.svg`, svg);
});
