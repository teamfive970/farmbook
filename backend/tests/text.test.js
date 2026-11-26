import test from "node:test";
import assert from "node:assert/strict";
import { shortPrice } from "../src/lib/text.js";

test("shortPrice keeps cents on small prices and rounds big ones", () => {
  assert.equal(shortPrice(0.13), "0.13");
  assert.equal(shortPrice(0.5), "0.5");
  assert.equal(shortPrice(3), "3");
  assert.equal(shortPrice(3523), "3,523");
  assert.equal(shortPrice(8559.5), "8,560");
  assert.equal(shortPrice("x"), "0");
});
