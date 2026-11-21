let testTransport = null;

export function setSmsTransportForTests(transport) {
  testTransport = transport;
}

function providerName() {
  return (process.env.SMS_PROVIDER || "disabled").trim().toLowerCase();
}

export function smsAvailable() {
  if (testTransport) return true;
  const provider = providerName();
  if (provider === "console") return process.env.NODE_ENV !== "production";
  if (provider === "twilio") {
    return Boolean(
      process.env.TWILIO_ACCOUNT_SID &&
        process.env.TWILIO_AUTH_TOKEN &&
        process.env.TWILIO_FROM_NUMBER
    );
  }
  if (provider === "africastalking") {
    return Boolean(process.env.AT_USERNAME && process.env.AT_API_KEY);
  }
  return false;
}

async function sendWithTwilio(phone, message) {
  const { TWILIO_ACCOUNT_SID: sid, TWILIO_AUTH_TOKEN: token, TWILIO_FROM_NUMBER: from } =
    process.env;
  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({ To: phone, From: from, Body: message }),
      signal: AbortSignal.timeout(10000)
    }
  );
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Twilio rejected the message (${response.status}): ${detail.slice(0, 200)}`);
  }
}

async function sendWithAfricasTalking(phone, message) {
  const { AT_USERNAME: username, AT_API_KEY: apiKey, AT_SENDER_ID: from } = process.env;
  const body = new URLSearchParams({ username, to: phone, message });
  if (from) body.set("from", from);
  const response = await fetch("https://api.africastalking.com/version1/messaging", {
    method: "POST",
    headers: {
      apiKey,
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body,
    signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Africa's Talking rejected the message (${response.status}): ${detail.slice(0, 200)}`
    );
  }
}

export async function sendSms(phone, message) {
  if (!smsAvailable()) throw new Error("SMS is not configured.");
  if (testTransport) {
    await testTransport(phone, message);
    return;
  }
  const provider = providerName();
  if (provider === "console") {
    console.log(`[minders:sms] ${phone}: ${message}`);
    return;
  }
  if (provider === "twilio") return sendWithTwilio(phone, message);
  if (provider === "africastalking") return sendWithAfricasTalking(phone, message);
  throw new Error(`Unknown SMS provider: ${provider}`);
}

export async function sendPasswordResetOtp(phone, code) {
  await sendSms(
    phone,
    `Minders: your PIN reset code is ${code}. It expires in 10 minutes. If you did not ask for this, ignore this message.`
  );
}
