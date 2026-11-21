// Typing rules for money on the big number keys (MoneyPad), kept apart from
// the screen so they can be tested: Liberian dollars are whole amounts; US
// dollars may have cents (up to two places after the point).
export function moneyDecimals(currency) {
  return currency === "USD" ? 2 : 0;
}

export function nextMoneyText(current, key, { decimals = 0 } = {}) {
  const text = String(current ?? "");
  if (key === "delete") return text.slice(0, -1);
  if (key === ".") {
    if (decimals <= 0 || text.includes(".")) return text;
    return (text || "0") + ".";
  }
  if (!/^\d$/.test(key)) return text;
  const [whole, cents] = text.split(".");
  if (cents !== undefined) {
    if (cents.length >= decimals) return text;
    return `${text}${key}`;
  }
  if (whole.replace(/^0+/, "").length >= 10) return text;
  return `${whole}${key}`.replace(/^0+(?=\d)/, "");
}
