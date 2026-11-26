export function firstNameOnly(name) {
  return String(name || "").trim().split(/\s+/)[0] || "";
}

// A price for a short text (SMS, USSD). Whole numbers above 10 round, smaller
// prices keep their cents, so an egg at US$0.13 never reads as "US$0".
export function shortPrice(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0";
  if (Math.abs(n) >= 10 || Number.isInteger(n)) return Math.round(n).toLocaleString("en-US");
  return n.toFixed(2).replace(/0$/, "");
}
