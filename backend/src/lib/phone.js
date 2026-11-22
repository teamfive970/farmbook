// Normalizes Liberian mobile numbers to the canonical +231XXXXXXXXX form.
// Accepts 0770000000, 770000000, +231770000000 and spaced/dashed variants.
export function normalizePhone(value) {
  if (typeof value !== "string") return null;
  const digits = value.replace(/\D/g, "");
  let national = null;
  if (digits.length === 12 && digits.startsWith("231")) national = digits.slice(3);
  else if (digits.length === 10 && digits.startsWith("0")) national = digits.slice(1);
  else if (digits.length === 9) national = digits;
  if (!national || !/^\d{9}$/.test(national)) return null;
  return `+231${national}`;
}

export function formatPhone(value) {
  if (!value) return "";
  const match = /^\+231(\d{3})(\d{3})(\d{3})$/.exec(value);
  return match ? `+231 ${match[1]} ${match[2]} ${match[3]}` : value;
}

// What an administrator sees by default. The last three digits are enough to
// check a number with the farmer on the phone, and not enough to contact them
// or copy the registry. The full number needs a reason, the admin PIN and an
// audit entry (see adminService.revealFarmerPhone).
export function maskPhone(value) {
  if (!value) return "";
  const digits = String(value).replace(/\D/g, "");
  if (digits.length < 4) return "••• ••• •••";
  const last = digits.slice(-3);
  return `+231 ••• ••• ${last}`;
}
