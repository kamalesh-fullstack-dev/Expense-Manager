const MAX_AMOUNT = 1_000_000_000_000;
const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export const isMonthKey = (value: unknown): value is string =>
  typeof value === "string" && MONTH_PATTERN.test(value);

// Returns a rounded rupee amount, or null when the input is not a usable number.
export function parseAmount(value: unknown, { allowZero = false, allowNegative = false } = {}) {
  if (value === null || value === undefined || value === "" || typeof value === "boolean") {
    return null;
  }

  const amount = Number(value);

  if (!Number.isFinite(amount) || Math.abs(amount) > MAX_AMOUNT) return null;
  if (amount < 0 && !allowNegative) return null;
  if (amount === 0 && !allowZero) return null;

  return Math.round(amount * 100) / 100;
}

export function parseDate(value: unknown) {
  if (typeof value !== "string" && !(value instanceof Date)) return null;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function cleanText(value: unknown, maxLength = 200) {
  return typeof value === "string" || typeof value === "number" ? String(value).trim().slice(0, maxLength) : "";
}
