import crypto from "node:crypto";

// The browser IVR simulator: a phone call without a phone line. The browser
// starts a call, gets a call token, and sends each key press with it. Only a
// hash of the token is stored, so the token works like a password for that
// one call.

export function newCallToken() {
  return crypto.randomBytes(24).toString("base64url");
}

export function keyForToken(token) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

// FarmBok's call step result, as JSON for the simulator page.
export function toJson(result, { clipBase, token }) {
  const { session, screen, voice } = result;
  return {
    call: {
      token,
      status: session.endedAt || screen.end ? "completed" : "active",
      endedReason: session.endedReason || (screen.end ? screen.id : null),
      demo: session.isDemo,
      language: session.language || "en",
      authenticated: session.authenticated,
      step: session.steps,
      startedAt: session.createdAt,
      expiresAt: session.expiresAt
    },
    screen: screen.id,
    prompts: voice.items.map((item) => ({
      key: item.key,
      text: item.text,
      language: item.language,
      audioUrl: item.audio && clipBase ? `${clipBase}/${item.audio}` : null,
      // No recording: the page reads the English words with the browser's
      // voice and labels it as a stand-in.
      fallback: item.audio ? null : "english-tts",
      missingTranslation: item.missingTranslation
    })),
    expect: voice.input
  };
}
