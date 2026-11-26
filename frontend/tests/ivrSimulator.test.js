import assert from "node:assert/strict";
import { test } from "node:test";
import { formatDuration, pressKey, shownKeys } from "../src/lib/ivrSimulator.js";

const CHOICE = { kind: "choice", numDigits: 1, finishOnKey: null, maxDigits: null };
const NUMBER = { kind: "number", numDigits: null, finishOnKey: "#", maxDigits: 9 };
const PIN = { kind: "pin", numDigits: null, finishOnKey: "#", maxDigits: 6 };

test("a menu sends one key at once; * and # do nothing there", () => {
  assert.deepEqual(pressKey(CHOICE, "", "3"), { typed: "", send: "3" });
  assert.deepEqual(pressKey(CHOICE, "", "#"), { typed: "", send: null });
  assert.deepEqual(pressKey(CHOICE, "", "*"), { typed: "", send: null });
});

test("numbers and PINs collect keys until #; * rubs out; not past the limit", () => {
  let state = { typed: "" };
  for (const key of "12") state = pressKey(NUMBER, state.typed, key);
  assert.deepEqual(state, { typed: "12", send: null });
  state = pressKey(NUMBER, state.typed, "*");
  assert.deepEqual(state, { typed: "1", send: null });
  assert.deepEqual(pressKey(NUMBER, "15", "#"), { typed: "", send: "15" });
  assert.deepEqual(pressKey(NUMBER, "", "#"), { typed: "", send: null });
  assert.deepEqual(pressKey(PIN, "123456", "7"), { typed: "123456", send: null });
  assert.deepEqual(pressKey(null, "12", "3"), { typed: "", send: null });
});

test("a PIN is never shown; the call timer reads mm:ss", () => {
  assert.equal(shownKeys(PIN, "1234"), "••••");
  assert.equal(shownKeys(NUMBER, "25"), "25");
  assert.equal(formatDuration(0), "00:00");
  assert.equal(formatDuration(125_400), "02:05");
});
