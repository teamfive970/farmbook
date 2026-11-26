import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";

// The clips folder must be known before the app loads.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "farmbok-clips-"));
process.env.VOICE_CLIPS_DIR = dir;
process.env.VOICE_SECRET = "voice-key";
fs.mkdirSync(path.join(dir, "en-lr"));
const MP3 = Buffer.from("ID3fake-audio");
for (const name of ["welcome-to-farmbok.mp3", "press-3-for-market-prices.mp3", "we-did-not-hear-any-keys.wav"]) {
  fs.writeFileSync(path.join(dir, "en-lr", name), MP3);
}
fs.writeFileSync(path.join(dir, "en-lr", "notes.txt"), "not audio");

const { closeDatabase, resetDatabase, startServer } = await import("./helpers.js");
const { phraseCatalog, resetVoiceCalls, spoken } = await import("../src/services/voiceService.js");
const { clipKey, resetClipCache } = await import("../src/lib/voiceClips.js");

let server;
before(async () => {
  resetClipCache();
  resetVoiceCalls();
  await resetDatabase();
  server = await startServer();
});
after(async () => {
  delete process.env.VOICE_SECRET;
  delete process.env.VOICE_CLIPS_DIR;
  fs.rmSync(dir, { recursive: true, force: true });
  await server.close();
  await closeDatabase();
});

test("recorded sentences play; the rest is read by the computer voice", async () => {
  const response = await fetch(`${server.baseUrl}/api/voice?key=voice-key`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ sessionId: "c1", callerNumber: "+231775554099", isActive: "1" })
  });
  const xml = await response.text();
  const base = `${server.baseUrl}/api/voice/clips/en-lr`;
  assert.equal(
    xml,
    '<?xml version="1.0" encoding="UTF-8"?><Response>' +
      `<Play url="${base}/welcome-to-farmbok.mp3"/>` +
      '<Say voice="woman">Keep your farm records. Press 1 for how to make an account. Press 2 for weather.</Say>' +
      `<GetDigits timeout="20" numDigits="1" callbackUrl="${server.baseUrl}/api/voice?key=voice-key">` +
      `<Play url="${base}/press-3-for-market-prices.mp3"/></GetDigits>` +
      `<Play url="${base}/we-did-not-hear-any-keys.wav"/>` +
      '<Say voice="woman">Please call again. Goodbye.</Say></Response>'
  );
});

test("clips are served, and only real clip files", async () => {
  const ok = await fetch(`${server.baseUrl}/api/voice/clips/en-lr/welcome-to-farmbok.mp3`);
  assert.equal(ok.status, 200);
  assert.equal(ok.headers.get("content-type"), "audio/mpeg");
  assert.deepEqual(Buffer.from(await ok.arrayBuffer()), MP3);
  for (const bad of ["en-lr/nothing.mp3", "en-lr/notes.txt", "kpe/welcome-to-farmbok.mp3", "en-lr/..%2F..%2Fpackage.json", "EN/welcome-to-farmbok.mp3"]) {
    assert.equal((await fetch(`${server.baseUrl}/api/voice/clips/${bad}`)).status, 404, bad);
  }
});

test("money is read the way people say it", () => {
  assert.equal(
    spoken("Eggs US$0.13/egg; Oil L$2.5/gallon; Fish US$1/pack; Rice L$3,523/bag"),
    "Eggs 13 US cents per egg. Oil 2 Liberian dollars and 50 cents per gallon. Fish 1 US dollar per pack. Rice 3,523 Liberian dollars per bag"
  );
  assert.equal(
    spoken("L$: got L$120, spent L$900, profit -L$780"),
    "In Liberian dollars: got 120 Liberian dollars, spent 900 Liberian dollars, profit minus 780 Liberian dollars"
  );
});

test("the recording list has one file per sentence, named as the menu looks them up", () => {
  const phrases = phraseCatalog();
  const keys = phrases.map((phrase) => phrase.key);
  assert.equal(new Set(keys).size, keys.length);
  for (const phrase of phrases) assert.equal(clipKey(phrase.text), phrase.key);
  assert.ok(keys.includes("press-1-for-record-farm-work"));
  assert.ok(keys.includes("thank-you-for-calling-farmbok"));
  assert.match(clipKey("To make your FarmBok account, dial the FarmBok USSD code on your phone."), /^[a-z0-9-]{1,60}$/);
});
