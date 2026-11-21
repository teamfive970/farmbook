import assert from "node:assert/strict";
import { test } from "node:test";
import {
  clearGroupCaches,
  dashboardName,
  dropGroupCache,
  forgetGroupOnError,
  groupCacheKey,
  readGroupCache,
  readGroupCacheTime,
  reconcileGroupCaches,
  writeGroupCache
} from "../src/lib/groupCache.js";

// A stand-in for the browser's localStorage.
function memoryStorage() {
  const map = new Map();
  return {
    get length() {
      return map.size;
    },
    key: (index) => [...map.keys()][index] ?? null,
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
    keys: () => [...map.keys()]
  };
}

test("copies are kept per person, with the time they were saved", () => {
  const storage = memoryStorage();
  writeGroupCache("ama", "mine", { items: [{ id: "g1" }] }, storage, 1000);
  writeGroupCache("kollie", "mine", { items: [] }, storage, 2000);
  assert.deepEqual(readGroupCache("ama", "mine", storage), { items: [{ id: "g1" }] });
  assert.deepEqual(readGroupCache("kollie", "mine", storage), { items: [] });
  assert.equal(readGroupCacheTime("ama", "mine", storage), 1000);
  assert.equal(readGroupCache("nobody", "mine", storage), null);
});

test("older copies saved without the wrapper are still read", () => {
  const storage = memoryStorage();
  storage.setItem(groupCacheKey("ama", "mine"), JSON.stringify({ items: [{ id: "old" }] }));
  assert.deepEqual(readGroupCache("ama", "mine", storage), { items: [{ id: "old" }] });
  storage.setItem(groupCacheKey("ama", "broken"), "{not json");
  assert.equal(readGroupCache("ama", "broken", storage), null);
});

test("leaving or being taken out of a group drops that group's saved dashboard", () => {
  const storage = memoryStorage();
  writeGroupCache("ama", dashboardName("g1"), { cooperative: { name: "Rice" } }, storage);
  writeGroupCache("ama", dashboardName("g2"), { cooperative: { name: "Pepper" } }, storage);
  writeGroupCache("kollie", dashboardName("g2"), { cooperative: { name: "Pepper" } }, storage);

  // The fresh list says Ama is only in g1 now.
  reconcileGroupCaches("ama", { items: [{ id: "g1" }] }, storage);
  assert.ok(readGroupCache("ama", dashboardName("g1"), storage));
  assert.equal(readGroupCache("ama", dashboardName("g2"), storage), null);
  // Somebody else on the same phone keeps theirs.
  assert.ok(readGroupCache("kollie", dashboardName("g2"), storage));
});

test("a 403 or 404 from the server forgets the group; other errors keep the copy", () => {
  const storage = memoryStorage();
  writeGroupCache("ama", "mine", { items: [{ id: "g1" }] }, storage);
  writeGroupCache("ama", dashboardName("g1"), { ok: true }, storage);

  assert.equal(forgetGroupOnError("ama", "g1", { status: 0 }, storage), false, "no network keeps the copy");
  assert.equal(forgetGroupOnError("ama", "g1", { status: 500 }, storage), false);
  assert.ok(readGroupCache("ama", dashboardName("g1"), storage));

  assert.equal(forgetGroupOnError("ama", "g1", { status: 403 }, storage), true);
  assert.equal(readGroupCache("ama", dashboardName("g1"), storage), null);
  assert.equal(readGroupCache("ama", "mine", storage), null, "the list is refreshed too");
});

test("joining a group drops the saved list, and removing a person clears all their copies", () => {
  const storage = memoryStorage();
  writeGroupCache("ama", "mine", { items: [] }, storage);
  dropGroupCache("ama", "mine", storage);
  assert.equal(readGroupCache("ama", "mine", storage), null);

  writeGroupCache("ama", "mine", { items: [{ id: "g1" }] }, storage);
  writeGroupCache("ama", dashboardName("g1"), {}, storage);
  writeGroupCache("kollie", "mine", { items: [] }, storage);
  storage.setItem("minders.other.setting", "keep me");
  clearGroupCaches("ama", storage);
  assert.deepEqual(storage.keys().sort(), [groupCacheKey("kollie", "mine"), "minders.other.setting"].sort());
});

test("a full or blocked storage never breaks the screen", () => {
  const storage = memoryStorage();
  storage.setItem = () => {
    throw new Error("QuotaExceededError");
  };
  assert.doesNotThrow(() => writeGroupCache("ama", "mine", { items: [] }, storage));
  assert.equal(readGroupCache("ama", "mine", null), null);
});
