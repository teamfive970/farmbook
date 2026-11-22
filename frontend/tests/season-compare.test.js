import assert from "node:assert/strict";
import { test } from "node:test";
import { comparePeriods, compareSeasons, trend } from "../src/lib/seasonCompare.js";

const today = new Date(2026, 10, 22); // 22 Nov 2026

test("season = last 6 months and the 6 months before; year = so far and same time last year", () => {
  const season = comparePeriods("season", today);
  assert.deepEqual(
    [season.current.from, season.current.to, season.previous.from, season.previous.to],
    ["2026-05-23", "2026-11-22", "2025-11-23", "2026-05-22"]
  );
  assert.equal(season.current.label, "May – Nov 2026");
  assert.equal(season.previous.label, "Nov 2025 – May 2026");
  const year = comparePeriods("year", today);
  assert.deepEqual(
    [year.current.from, year.current.to, year.previous.from, year.previous.to],
    ["2026-01-01", "2026-11-22", "2025-01-01", "2025-11-22"]
  );
});

const records = {
  productions: [
    { clientId: "p-rice", productionKind: "crop", name: "Rice" },
    { clientId: "p-hens", productionKind: "animal", name: "Chicken" }
  ],
  harvests: [
    { clientId: "h-old", productionClientId: "p-rice", crop: "Rice", harvestDate: "2026-02-10", quantity: 8, unit: "bags" },
    { clientId: "h-new", productionClientId: "p-rice", crop: "Rice", harvestDate: "2026-09-10", quantity: 12, unit: "bags" },
    { clientId: "h-cas", crop: "cassava", harvestDate: "2026-10-01", quantity: 30, unit: "bundles" }
  ],
  inspections: [
    { clientId: "i1", harvestClientId: "h-new", inspectionDate: "2026-09-11", grade: "A" },
    { clientId: "i2", harvestClientId: "h-old", inspectionDate: "2026-02-11", grade: "B" }
  ],
  sales: [
    { clientId: "s-old", harvestClientId: "h-old", crop: "Rice", saleDate: "2026-02-15", totalAmount: 8000, currency: "LRD" },
    { clientId: "s-new", harvestClientId: "h-new", crop: "Rice", saleDate: "2026-09-15", totalAmount: 15000, currency: "LRD" },
    { clientId: "s-cas", harvestClientId: "h-cas", crop: "Cassava", saleDate: "2026-10-02", totalAmount: 3000, currency: "LRD" },
    { clientId: "s-usd", productionClientId: "p-hens", crop: "Eggs", saleDate: "2026-08-01", totalAmount: 40, currency: "USD" }
  ],
  payments: [
    { clientId: "pay1", saleClientId: "s-old", amount: 8000, paidDate: "2026-02-16" },
    { clientId: "pay2", saleClientId: "s-new", amount: 12000, paidDate: "2026-09-16" },
    { clientId: "pay3", saleClientId: "s-cas", amount: 3000, paidDate: "2026-10-03" },
    { clientId: "pay4", saleClientId: "s-usd", amount: 40, paidDate: "2026-08-02" },
  ],
  expenses: [
    { clientId: "e1", productionClientId: "p-rice", expenseDate: "2026-01-20", amount: 2000, currency: "LRD" },
    { clientId: "e2", harvestClientId: "h-new", expenseDate: "2026-08-20", amount: 3000, currency: "LRD" },
    { clientId: "e3", expenseDate: "2026-09-01", amount: 500, currency: "LRD" },
    { clientId: "e4", expenseDate: "2024-01-01", amount: 999, currency: "LRD" }
  ],
  animalEvents: [
    { clientId: "a1", productionClientId: "p-hens", eventType: "died", quantity: 3, eventDate: "2026-07-01" },
    { clientId: "a2", productionClientId: "p-hens", eventType: "died", quantity: 1, eventDate: "2026-01-01" },
    { clientId: "a3", productionClientId: "p-hens", eventType: "born", quantity: 9, eventDate: "2026-07-01" }
  ]
};

test("rows per crop and animal group, side by side, with costs not tied to a crop kept apart", () => {
  const result = compareSeasons(records, comparePeriods("season", today));
  const byName = Object.fromEntries(result.rows.map((row) => [row.name, row]));
  assert.deepEqual(result.rows.map((row) => row.name), ["Rice", "Chicken", "Cassava", "Costs not tied to a crop or animal"]);

  const rice = byName.Rice;
  assert.deepEqual(rice.current.harvest, { quantity: 12, unit: "bags" });
  assert.deepEqual(rice.previous.harvest, { quantity: 8, unit: "bags" });
  assert.deepEqual(rice.current.received, { LRD: 12000, USD: 0 });
  assert.deepEqual(rice.current.spent, { LRD: 3000, USD: 0 }); // cost for the batch counts for its crop
  assert.deepEqual(rice.current.profit, { LRD: 9000, USD: 0 });
  assert.deepEqual(rice.previous.profit, { LRD: 6000, USD: 0 });
  assert.equal(rice.current.gradeAShare, 1);
  assert.equal(rice.previous.gradeAShare, 0);
  assert.equal(rice.isNew, false);

  const cassava = byName.Cassava; // name from the harvest, tidied
  assert.equal(cassava.isNew, true);
  assert.equal(cassava.kind, "crop");

  const hens = byName.Chicken;
  assert.equal(hens.kind, "animal");
  assert.deepEqual(hens.current.profit, { LRD: 0, USD: 40 });
  assert.equal(hens.current.animalsLost, 3);
  assert.equal(hens.previous.animalsLost, 1);

  assert.deepEqual(byName["Costs not tied to a crop or animal"].current.spent, { LRD: 500, USD: 0 });

  // Totals never mix currencies; the 2024 cost is in neither period.
  assert.deepEqual(result.totals.current.profit, { LRD: 11500, USD: 40 });
  assert.deepEqual(result.totals.previous.profit, { LRD: 6000, USD: 0 });
  assert.deepEqual(result.currencies, ["LRD", "USD"]);
  assert.equal(result.hasPrevious, true);
});

test("plain sentences about the biggest changes", () => {
  const result = compareSeasons(records, comparePeriods("season", today));
  assert.equal(result.insights.length, 3);
  assert.equal(result.insights[0].text, "Total profit up L$5,500 on the season before.");
  assert.equal(result.insights[1].text, "Total profit up US$40 on the season before.");
  assert.match(result.insights[2].say, /percent|profit|died/);
  const texts = compareSeasons(records, comparePeriods("season", today)).insights.map((item) => item.tone);
  assert.ok(texts.every((tone) => tone === "up" || tone === "down"));
});

test("no records gives empty rows, and nothing before says so", () => {
  const empty = compareSeasons({}, comparePeriods("season", today));
  assert.deepEqual(empty.rows, []);
  assert.equal(empty.hasPrevious, false);
  assert.equal(empty.hasCurrent, false);
  assert.deepEqual(empty.currencies, ["LRD"]);
  assert.equal(trend(5, 3), "up");
  assert.equal(trend(3, 5), "down");
  assert.equal(trend(2, 2), "same");
});

test("a harvest that stopped is not called 'down 100%'", () => {
  const stopped = {
    productions: [{ clientId: "p", productionKind: "animal", name: "Chicken" }],
    harvests: [{ clientId: "h", productionClientId: "p", harvestDate: "2026-02-01", quantity: 545, unit: "eggs" }]
  };
  const result = compareSeasons(stopped, comparePeriods("season", today));
  assert.equal(result.insights.some((item) => /harvest/.test(item.text)), false);
});
