export function firstNameOnly(name) {
  return String(name || "").trim().split(/\s+/)[0] || "";
}
