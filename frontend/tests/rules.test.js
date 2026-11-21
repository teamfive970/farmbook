import assert from "node:assert/strict";
import { test } from "node:test";
import { allFarmCrops, farmCrops, farmGrows, splitCrops } from "../src/lib/farmCrops.js";
import { moneyDecimals, nextMoneyText } from "../src/lib/moneyInput.js";
import { suggestGrade } from "../src/lib/words.js";

const type = (keys, currency) =>
  keys.split("").reduce((text, key) => nextMoneyText(text, key === "<" ? "delete" : key, { decimals: moneyDecimals(currency) }), "");

test("US dollars take cents (two places); Liberian dollars are whole", () => {
  assert.equal(type("12.5", "USD"), "12.5");
  assert.equal(type("12.505", "USD"), "12.50");
  assert.equal(type(".75", "USD"), "0.75");
  assert.equal(type("1..2", "USD"), "1.2");
  assert.equal(type("12.5", "LRD"), "125");
  assert.equal(type("0007", "LRD"), "7");
  assert.equal(type("12.3<<", "USD"), "12");
  assert.equal(type("12345678901", "LRD"), "1234567890", "no more than 10 digits");
});

test("a skipped quality check does not lower the grade", () => {
  assert.equal(suggestGrade({}), null, "nothing answered, no suggestion");
  assert.equal(suggestGrade({ dry: true }), "A", "one yes and the rest skipped is A");
  assert.equal(suggestGrade({ dry: true, clean: true, no_pests: false }), "B");
  assert.equal(suggestGrade({ dry: false, clean: false }), "C");
  assert.equal(suggestGrade({ dry: false, clean: false, no_pests: false }), "rejected");
  assert.equal(
    suggestGrade({ dry: true, clean: true, no_pests: true, no_mold: true, sorted: true, good_smell: true }),
    "A"
  );
});

test("a farm's crops come from its list, or from the old text the same way the server splits it", () => {
  assert.deepEqual(splitCrops("Cassava and rice, Pepper & Corn/Okra"), ["Cassava", "rice", "Pepper", "Corn", "Okra"]);
  assert.deepEqual(farmCrops({ crops: ["Rice", "rice", "Cassava"] }), ["Rice", "Cassava"]);
  assert.deepEqual(farmCrops({ crops: [], mainCropOrLivestock: "Goats" }), ["Goats"]);
  assert.ok(farmGrows({ crops: ["Bitter ball"] }, "bitter BALL"));
  assert.ok(!farmGrows({ crops: ["Rice"] }, "Pepper"));
  assert.deepEqual(allFarmCrops([{ crops: ["Rice"] }, { crops: ["rice", "Goats"] }]), ["Rice", "Goats"]);
});
