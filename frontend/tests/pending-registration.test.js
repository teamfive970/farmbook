import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import {
  createPendingRegistration,
  dropPendingRegistration,
  findPendingByPhone,
  getPendingRegistration,
  isPendingUserId,
  pendingUserFrom,
  readPendingRegistrations,
  registrationPayload,
  savePendingRegistration
} from "../src/lib/pendingRegistration.js";

// A stand-in for the browser's localStorage.
function memoryStorage() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key)
  };
}

beforeEach(() => {
  globalThis.localStorage = memoryStorage();
});

const fields = {
  fullName: "Ama Kollie",
  phoneNumber: "0770123456",
  county: "Bong",
  district: "Jorquelleh",
  community: "Gbarnga"
};

test("a profile made offline gets a local id and holds no secrets", () => {
  const record = createPendingRegistration(fields);
  assert.ok(isPendingUserId(record.id));
  assert.equal(record.fullName, fields.fullName);
  assert.equal(record.phoneNumber, fields.phoneNumber);
  assert.ok(record.createdAt > 0);
  assert.equal("pin" in record, false);
  assert.equal("securityQuestion" in record, false);
  assert.equal("securityAnswer" in record, false);
});

test("saved profiles survive and are read oldest first", () => {
  const first = savePendingRegistration({
    ...createPendingRegistration(fields),
    createdAt: 2000
  });
  const second = savePendingRegistration({
    ...createPendingRegistration({ ...fields, fullName: "Kollie Sumo" }),
    createdAt: 1000
  });
  const all = readPendingRegistrations();
  assert.deepEqual(all.map((record) => record.id), [second.id, first.id]);
  assert.deepEqual(getPendingRegistration(first.id), first);
  assert.equal(getPendingRegistration("local-acc-missing"), null);
});

test("a phone number matches however the farmer writes it", () => {
  const record = savePendingRegistration(createPendingRegistration(fields));
  assert.equal(findPendingByPhone("0770123456").id, record.id);
  assert.equal(findPendingByPhone("+231 77 012 3456").id, record.id);
  assert.equal(findPendingByPhone("770123456").id, record.id);
  assert.equal(findPendingByPhone("0770999999"), null);
  assert.equal(findPendingByPhone(""), null);
});

test("sending a profile removes it, and unknown ids do nothing", () => {
  const record = savePendingRegistration(createPendingRegistration(fields));
  dropPendingRegistration("local-acc-missing");
  assert.equal(getPendingRegistration(record.id).id, record.id);
  dropPendingRegistration(record.id);
  assert.equal(getPendingRegistration(record.id), null);
  assert.deepEqual(readPendingRegistrations(), []);
});

test("damaged storage reads as empty instead of throwing", () => {
  globalThis.localStorage.setItem("minders.pendingRegistrations", "{not json");
  assert.deepEqual(readPendingRegistrations(), []);
  assert.equal(findPendingByPhone("0770123456"), null);
});

test("the pending user is a farmer who cannot do online-only things yet", () => {
  const record = createPendingRegistration(fields);
  const user = pendingUserFrom(record);
  assert.equal(user.id, record.id);
  assert.equal(user.role, "farmer");
  assert.equal(user.pendingRegistration, true);
  assert.equal(user.status, "pending");
  assert.equal(user.hasSecurityQuestion, false);
  assert.equal(user.phoneNumber, "0770123456");
});

test("the send payload carries the PIN but never the recovery answer", () => {
  const record = createPendingRegistration({
    ...fields,
    securityQuestion: "mother",
    securityAnswer: "Mary"
  });
  const payload = registrationPayload(record, "1234");
  assert.equal(payload.pin, "1234");
  assert.equal(payload.confirmPin, "1234");
  assert.equal("securityQuestion" in payload, false);
  assert.equal("securityAnswer" in payload, false);
  assert.equal(payload.fullName, fields.fullName);
});
