import assert from "node:assert/strict";
import { test } from "node:test";
import { linkReach, passportBase, passportUrl } from "../src/lib/passportLink.js";

test("passport links use the public web address when it is set", () => {
  const location = { origin: "http://localhost:5101" };
  assert.equal(passportUrl("lr-abc", { VITE_PUBLIC_URL: "https://farmbok.example.org/" }, location), "https://farmbok.example.org/p/LR-ABC");
  assert.equal(passportUrl("LR-ABC", {}, location), "http://localhost:5101/p/LR-ABC");
  assert.equal(passportBase({ VITE_PUBLIC_URL: "not a url" }, location), "http://localhost:5101");
});

test("links that buyers on other phones can't open are spotted", () => {
  assert.equal(linkReach("http://localhost:5101/p/X"), "this-device");
  assert.equal(linkReach("http://127.0.0.1:8000/p/X"), "this-device");
  assert.equal(linkReach("http://192.168.1.20:5101/p/X"), "same-wifi");
  assert.equal(linkReach("http://10.0.0.5/p/X"), "same-wifi");
  assert.equal(linkReach("http://172.20.1.1/p/X"), "same-wifi");
  assert.equal(linkReach("https://farmbok.example.org/p/X"), "anyone");
  assert.equal(linkReach("http://172.40.1.1/p/X"), "anyone");
});
