import assert from "node:assert/strict";
import { test } from "node:test";
import { productionMoney } from "../src/lib/ledger.js";
import { animalCount, animalTotals, linkedRecords, productionsForFarm } from "../src/lib/production.js";

const hens = { clientId: "p-hens", productionKind: "animal", name: "Chicken", farmClientId: "f1", startCount: 20, status: "active", startDate: "2026-01-01" };
const rice = { clientId: "p-rice", productionKind: "crop", name: "Rice", farmClientId: "f1", status: "finished", startDate: "2026-02-01" };
const events = [
  { clientId: "e1", productionClientId: "p-hens", eventType: "born", quantity: 6, eventDate: "2026-02-01" },
  { clientId: "e2", productionClientId: "p-hens", eventType: "died", quantity: 3, eventDate: "2026-02-03", cause: "sickness" },
  { clientId: "e3", productionClientId: "p-hens", eventType: "sold", quantity: 5, eventDate: "2026-02-05" },
  { clientId: "e4", productionClientId: "p-other", eventType: "bought", quantity: 50, eventDate: "2026-02-05" }
];

test("animal count = start + born/bought/given in − died/sold/eaten/given out", () => {
  assert.equal(animalCount(hens, events), 18);
  assert.deepEqual(animalTotals(hens, events), { born: 6, bought: 0, given_in: 0, died: 3, sold: 5, eaten: 0, given_out: 0 });
  assert.equal(animalCount(hens, []), 20);
});

test("active plantings and groups come before finished ones", () => {
  const list = productionsForFarm({ clientId: "f1" }, [rice, hens, { ...hens, clientId: "x", farmClientId: "f2" }]);
  assert.deepEqual(list.map((item) => item.clientId), ["p-hens", "p-rice"]);
});

test("records link to a planting directly or through its harvest, and money follows", () => {
  const records = {
    harvests: [{ clientId: "h1", productionClientId: "p-rice", crop: "Rice" }],
    sales: [
      { clientId: "s1", harvestClientId: "h1", totalAmount: 1000, currency: "LRD", saleDate: "2026-03-01" },
      { clientId: "s2", productionClientId: "p-hens", totalAmount: 25, currency: "USD", saleDate: "2026-03-01" }
    ],
    payments: [
      { clientId: "pay1", saleClientId: "s1", amount: 600, paidDate: "2026-03-02" },
      { clientId: "pay2", saleClientId: "s2", amount: 25, paidDate: "2026-03-02" }
    ],
    expenses: [
      { clientId: "x1", productionClientId: "p-rice", amount: 200, currency: "LRD", expenseDate: "2026-02-10" },
      { clientId: "x2", harvestClientId: "h1", amount: 50, currency: "LRD", expenseDate: "2026-03-01" }
    ],
    animalEvents: events
  };
  const linked = linkedRecords(rice, records, [{ clientId: "a1", productionClientId: "p-rice" }]);
  assert.equal(linked.harvests.length, 1);
  assert.equal(linked.sales.length, 1);
  assert.equal(linked.expenses.length, 2);
  assert.equal(linked.activities.length, 1);

  const money = productionMoney(records);
  const riceRow = money.find((row) => row.productionClientId === "p-rice");
  assert.deepEqual(riceRow, { productionClientId: "p-rice", currency: "LRD", sold: 1000, income: 600, spent: 250, profit: 350 });
  const henRow = money.find((row) => row.productionClientId === "p-hens");
  assert.equal(henRow.currency, "USD");
  assert.equal(henRow.profit, 25);
});
