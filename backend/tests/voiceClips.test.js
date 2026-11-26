import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";

// Recorded prompts: backend/voice-clips/<language>/<prompt key>.mp3.
// The folder must be known before the app loads.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "farmbok-clips-"));
process.env.VOICE_CLIPS_DIR = dir;
fs.mkdirSync(path.join(dir, "en"));
const MP3 = Buffer.from("ID3fake-audio");
for (const name of ["ivr.welcome.mp3", "ivr.languages.mp3", "ivr.noInput.wav", "ivr.hello.mp3"]) {
  fs.writeFileSync(path.join(dir, "en", name), MP3);
}
fs.writeFileSync(path.join(dir, "en", "notes.txt"), "not audio");

const { closeDatabase, createFarmerRecord, resetDatabase, startServer } = await import("./helpers.js");
const { resetClipCache } = await import("../src/lib/voiceClips.js");
const { promptKeys, packStatus } = await import("../src/channels/prompts.js");

let server;
before(async () => {
  resetClipCache();
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

test("the simulator gets recording links where they exist, and the English stand-in elsewhere", async () => {
  await createFarmerRecord({ phoneNumber: "+231775554099", pin: "1234", fullName: "Musu Kollie" });
  const started = await fetch(`${server.baseUrl}/api/voice/simulator/calls`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "development", phone: "+231775554099" })
  }).then((response) => response.json());
  const base = `${server.baseUrl}/api/voice/clips/en`;
  assert.deepEqual(
    started.prompts.map((prompt) => [prompt.key, prompt.audioUrl, prompt.fallback]),
    [
      ["ivr.welcome", `${base}/ivr.welcome.mp3`, null],
      ["ivr.languages", `${base}/ivr.languages.mp3`, null]
    ]
  );
  // A prompt with a name in it can't be a recording: "Hello Musu" is read out.
  const pin = await fetch(`${server.baseUrl}/api/voice/simulator/calls/${started.call.token}/keys`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ digits: "1", step: 0 })
  }).then((response) => response.json());
  assert.deepEqual(pin.prompts.map((prompt) => [prompt.key, prompt.fallback]), [
    ["ivr.hello", "english-tts"],
    ["ivr.pin", "english-tts"]
  ]);
});

test("Africa's Talking plays the recordings", async () => {
  process.env.VOICE_SECRET = "voice-key";
  const xml = await fetch(`${server.baseUrl}/api/voice?key=voice-key`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ sessionId: "c1", callerNumber: "+231775554099", isActive: "1" })
  }).then((response) => response.text());
  const base = `${server.baseUrl}/api/voice/clips/en`;
  assert.equal(
    xml.replace(/callbackUrl="[^"]+"/, 'callbackUrl="X"'),
    '<?xml version="1.0" encoding="UTF-8"?><Response>' +
      `<Play url="${base}/ivr.welcome.mp3"/>` +
      `<GetDigits timeout="20" numDigits="1" callbackUrl="X"><Play url="${base}/ivr.languages.mp3"/></GetDigits>` +
      `<Say voice="woman">We did not hear any keys. Please call again. Goodbye.</Say></Response>`
  );
});

test("clips are served cross-site, and only real clip files", async () => {
  const ok = await fetch(`${server.baseUrl}/api/voice/clips/en/ivr.welcome.mp3`);
  assert.equal(ok.status, 200);
  assert.equal(ok.headers.get("content-type"), "audio/mpeg");
  assert.equal(ok.headers.get("cross-origin-resource-policy"), "cross-origin");
  assert.deepEqual(Buffer.from(await ok.arrayBuffer()), MP3);
  for (const bad of ["en/nothing.mp3", "en/notes.txt", "kpelle/ivr.welcome.mp3", "en/..%2F..%2Fpackage.json", "EN/ivr.welcome.mp3"]) {
    assert.equal((await fetch(`${server.baseUrl}/api/voice/clips/${bad}`)).status, 404, bad);
  }
});

test("prompt packs: English complete, Kpelle and Bassa marked missing until native speakers fill them", () => {
  const keys = promptKeys();
  assert.ok(keys.length > 80);
  assert.deepEqual(packStatus("en").translated, keys.length);
  for (const language of ["kpelle", "bassa"]) {
    const status = packStatus(language);
    assert.equal(status.status, "missing");
    assert.equal(status.translated, 0);
  }
});
