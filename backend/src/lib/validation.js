import { badRequest } from "./errors.js";

function fail(field, message) {
  throw badRequest(message, { field });
}

export function requireString(value, field, { min = 1, max = 200, label = field } = {}) {
  if (typeof value !== "string" || value.trim().length < min) {
    fail(field, `${label} is required.`);
  }
  const trimmed = value.trim();
  if (trimmed.length > max) fail(field, `${label} must be ${max} characters or fewer.`);
  return trimmed;
}

export function optionalString(value, field, { max = 200, label = field } = {}) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") fail(field, `${label} must be text.`);
  const trimmed = value.trim();
  if (trimmed.length > max) fail(field, `${label} must be ${max} characters or fewer.`);
  return trimmed || null;
}

export function requireEnum(value, allowed, field, label = field) {
  if (!allowed.includes(value)) fail(field, `Choose a valid ${label}.`);
  return value;
}

export function optionalEnum(value, allowed, field, label = field) {
  if (value === undefined || value === null || value === "") return null;
  return requireEnum(value, allowed, field, label);
}

export function optionalNumber(value, field, { min = 0, max = 999999999, label = field } = {}) {
  if (value === undefined || value === null || value === "") return null;
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number) || number < min || number > max) {
    fail(field, `${label} must be a number between ${min} and ${max}.`);
  }
  return number;
}

export function requireDateString(value, field, label = field) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    fail(field, `Choose a valid ${label}.`);
  }
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) fail(field, `Choose a valid ${label}.`);
  return value;
}

export function requireUuid(value, field, label = field) {
  if (
    typeof value !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  ) {
    fail(field, `Invalid ${label}.`);
  }
  return value;
}

export function requirePin(value, field = "pin", label = "PIN") {
  if (typeof value !== "string" || !/^\d{4,6}$/.test(value)) {
    fail(field, `${label} must be 4 to 6 digits.`);
  }
  return value;
}

export function parsePagination(query, { defaultPageSize = 20, maxPageSize = 50 } = {}) {
  const page = Number(query.page || 1);
  const pageSize = Number(query.pageSize || defaultPageSize);
  if (!Number.isInteger(page) || page < 1) fail("page", "Page must be a positive number.");
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > maxPageSize) {
    fail("pageSize", `Page size must be between 1 and ${maxPageSize}.`);
  }
  return { page, pageSize, offset: (page - 1) * pageSize };
}
