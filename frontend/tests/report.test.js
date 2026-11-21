import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { test } from "node:test";
import { buildFarmerReport, reportFileName, reportPeriod } from "../src/lib/farmReport.js";
import { moneySummary } from "../src/lib/ledger.js";
import { fitText, textWidth } from "../src/lib/pdf.js";
import { reportCsv, reportPdf } from "../src/lib/reportExport.js";

const farms = [
  { id: "f1", clientId: "fc1", farmName: "Swamp farm", farmType: "crop_farming" },
  { id: "f2", clientId: "fc2", farmName: "Chicken pen", farmType: "poultry" }
];
const records = {
  productions: [
    { clientId: "p1", farmClientId: "fc1", productionKind: "crop", name: "Rice", label: "Big swamp", startDate: "2026-03-01", status: "active", plot: "Swamp" },
    { clientId: "p2", farmClientId: "fc2", productionKind: "animal", name: "Chicken", startCount: 40, startDate: "2026-01-05", status: "active" }
  ],
  animalEvents: [
    { clientId: "a1", productionClientId: "p2", eventType: "born", quantity: 12, eventDate: "2026-04-01" },
    { clientId: "a2", productionClientId: "p2", eventType: "died", quantity: 3, eventDate: "2026-04-10", cause: "sickness" },
    { clientId: "a3", productionClientId: "p2", eventType: "sold", quantity: 5, eventDate: "2025-12-10" }
  ],
  harvests: [
    { clientId: "h1", farmClientId: "fc1", productionClientId: "p1", crop: "Rice", quantity: 20, unit: "bags", harvestDate: "2026-07-10" },
    { clientId: "h2", farmClientId: "fc2", productionClientId: "p2", crop: "Eggs", quantity: 300, unit: "eggs", harvestDate: "2026-05-12" }
  ],
  inspections: [],
  buyers: [{ clientId: "b1", name: "Ma Hawa, \"Red\" market", buyerType: "market_woman" }],
  sales: [
    { clientId: "s1", harvestClientId: "h1", buyerClientId: "b1", crop: "Rice", quantity: 8, unit: "bags", totalAmount: 25600, currency: "LRD", saleDate: "2026-07-15" },
    { clientId: "s2", harvestClientId: "h2", crop: "Eggs", quantity: 120, unit: "eggs", totalAmount: 18, currency: "USD", saleDate: "2026-05-18" },
    { clientId: "s3", harvestClientId: "h1", crop: "Rice", quantity: 1, unit: "bags", totalAmount: 3000, currency: "LRD", saleDate: "2025-11-01" }
  ],
  payments: [
    { clientId: "pa1", saleClientId: "s1", amount: 20000, paidDate: "2026-07-15" },
    { clientId: "pa2", saleClientId: "s2", amount: 12.5, paidDate: "2026-05-19" }
  ],
  expenses: [
    { clientId: "e1", farmClientId: "fc1", productionClientId: "p1", category: "seeds", amount: 4000, currency: "LRD", expenseDate: "2026-03-02" },
    { clientId: "e2", farmClientId: "fc1", category: "labour", amount: 6000, currency: "LRD", expenseDate: "2026-04-05", notes: "=cmd|' /C calc'!A0" },
    { clientId: "e3", farmClientId: null, category: "transport", amount: 1500, currency: "LRD", expenseDate: "2026-06-01" },
    { clientId: "e4", farmClientId: "fc2", category: "feed", amount: 7.25, currency: "USD", expenseDate: "2026-05-01" }
  ]
};
const activities = [
  { clientId: "w1", farmId: "f1", activityType: "weeding", activityDate: "2026-04-01" },
  { clientId: "w2", farmId: "f1", activityType: "weeding", activityDate: "2026-05-01" },
  { clientId: "w3", farmId: "f2", activityType: "feeding", activityDate: "2026-05-01" }
];
const user = { fullName: "Musu Kollie", phoneNumber: "0770000001", community: "Kpelleh Town", district: "Gbarnga", county: "Bong" };
const now = new Date(2026, 10, 21);

test("report periods: this/last month, this/last year, picked days (in any order)", () => {
  assert.deepEqual(reportPeriod("month", {}, now), { from: "2026-11-01", to: "2026-11-21" });
  assert.deepEqual(reportPeriod("lastMonth", {}, now), { from: "2026-10-01", to: "2026-10-31" });
  assert.deepEqual(reportPeriod("lastYear", {}, now), { from: "2025-01-01", to: "2025-12-31" });
  assert.deepEqual(reportPeriod("custom", { from: "2026-06-30", to: "2026-01-01" }, now), { from: "2026-01-01", to: "2026-06-30" });
  assert.deepEqual(reportPeriod("all", {}, now), {});
});

test("the report's money matches the Money screen, and keeps the currencies apart", () => {
  const report = buildFarmerReport({ user, farms, records, activities, choice: "year", now });
  const screen = moneySummary(records, reportPeriod("year", {}, now));
  assert.deepEqual(report.currencies, ["LRD", "USD"]);
  assert.equal(report.totals.LRD.sold, screen.sold.LRD);
  assert.equal(report.totals.LRD.income, 20000);
  assert.equal(report.totals.LRD.spent, 11500);
  assert.equal(report.totals.LRD.profit, 8500);
  assert.equal(report.totals.USD.profit, 5.25);
  assert.equal(report.sales.length, 2, "last year's sale is not in this year");
  assert.equal(report.sales.find((s) => s.item === "Rice").toPay, 5600);
  assert.equal(report.costsByCategory[0].name, "Workers");
  assert.equal(report.harvests.find((h) => h.crop === "Rice").left, 11);
  const hens = report.animals[0];
  assert.deepEqual([hens.added, hens.died, hens.sold, hens.now], [12, 3, 0, 44]);
  assert.deepEqual(report.work[0], { name: report.work[0].name, count: 2 });
  assert.equal(report.counts.work, 3);
});

test("a report for one farm only counts that farm", () => {
  const report = buildFarmerReport({ user, farms, records, activities, choice: "all", farm: farms[1], now });
  assert.deepEqual(report.currencies, ["USD"]);
  assert.equal(report.totals.USD.sold, 18);
  assert.equal(report.expenses.length, 1);
  assert.equal(report.counts.work, 1);
  assert.equal(report.byFarm.length, 0);
  assert.match(reportFileName(report, "pdf"), /^farm-report-musu-kollie-chicken-pen-all-time\.pdf$/);
});

test("CSV: sections, quoted commas and quotes, and no spreadsheet formulas", () => {
  const csv = reportCsv(buildFarmerReport({ user, farms, records, activities, choice: "year", now }));
  assert.ok(csv.startsWith("﻿Minders farm report"));
  assert.match(csv, /\r\nSUMMARY\r\nCurrency,Total sales,Total income,Total expenses,Profit\r\nLRD,25600,20000,11500,8500\r\nUSD,18,12.50,7.25,5.25/);
  assert.match(csv, /"Ma Hawa, ""Red"" market"/);
  assert.match(csv, /'=cmd/);
  assert.ok(!/,=cmd/.test(csv));
});

test("PDF: a valid file with a correct cross-reference table", () => {
  const bytes = reportPdf(buildFarmerReport({ user, farms, records, activities, choice: "year", now }));
  const text = Buffer.from(bytes).toString("latin1");
  assert.ok(text.startsWith("%PDF-1.4"));
  assert.ok(text.trimEnd().endsWith("%%EOF"));
  const xref = Number(text.match(/startxref\n(\d+)/)[1]);
  assert.equal(text.slice(xref, xref + 4), "xref");
  for (const [, offset, id] of [...text.matchAll(/(\d{10}) 00000 n /g)].map((m, i) => [m, Number(m[1]), i + 1])) {
    assert.equal(text.slice(offset, offset + `${id} 0 obj`.length), `${id} 0 obj`);
  }
  assert.match(text, /\(Musu Kollie\) Tj/);
  if (process.env.REPORT_PDF_OUT) writeFileSync(process.env.REPORT_PDF_OUT, bytes);
});

test("PDF text: widths and cutting long words", () => {
  assert.equal(textWidth("ii", 10), 4.44);
  assert.ok(textWidth("bold", 10, true) > textWidth("bold", 10));
  const cut = fitText("A very long buyer name that does not fit", 60, 9);
  assert.ok(cut.endsWith("..."));
  assert.ok(textWidth(cut, 9) <= 60);
});
