// The Harvest Passport link that buyers open (from the QR code, a shared
// link or a printed tag).
//
// The link must use an address the BUYER's phone can reach. The address the
// farmer's phone uses to open the app is often not one: "localhost" or
// "127.0.0.1" only work on that same computer, and 192.168.x.x / 10.x.x.x
// only work on the same Wi-Fi. So the public web address of the app can be set
// with VITE_PUBLIC_URL (in frontend/.env), e.g.
//   VITE_PUBLIC_URL=https://farmbok.example.org
// When it is not set, the address the app was opened from is used.

function cleanBase(value) {
  const text = String(value || "").trim();
  if (!/^https?:\/\/[^\s/]+/i.test(text)) return "";
  return text.replace(/\/+$/, "");
}

export function passportBase(env = import.meta.env, location = typeof window !== "undefined" ? window.location : null) {
  return cleanBase(env?.VITE_PUBLIC_URL) || (location ? location.origin : "");
}

export function passportUrl(code, env, location) {
  return `${passportBase(env, location)}/p/${encodeURIComponent(String(code || "").trim().toUpperCase())}`;
}

// Who can open a link: "anyone", "same-wifi" or "this-device".
export function linkReach(url) {
  let host = "";
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return "this-device";
  }
  if (host === "localhost" || host.endsWith(".localhost") || host === "::1" || host === "[::1]" || /^127\./.test(host) || host === "0.0.0.0") {
    return "this-device";
  }
  if (
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    /^169\.254\./.test(host) ||
    host.endsWith(".local")
  ) {
    return "same-wifi";
  }
  return "anyone";
}
