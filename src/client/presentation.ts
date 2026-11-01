import Decimal from "decimal.js";

const branchTimeZone = "America/Argentina/Buenos_Aires";

function parseDate(value: string): Date {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Invalid presentation date");
  }
  return parsed;
}

export function formatDate(value: string, locale = "es-AR"): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "short",
    timeZone: branchTimeZone,
  }).format(parseDate(value));
}

export function formatDateTime(value: string, locale = "es-AR"): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "short",
    timeStyle: "short",
    hourCycle: "h23",
    timeZone: branchTimeZone,
  }).format(parseDate(value));
}

export function formatTime(value: string, locale = "es-AR"): string {
  return new Intl.DateTimeFormat(locale, {
    timeStyle: "short",
    hourCycle: "h23",
    timeZone: branchTimeZone,
  }).format(parseDate(value));
}

function timeZoneOffsetMinutes(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts.filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)]),
  );
  const asUtc = Date.UTC(values.year, values.month - 1, values.day, values.hour, values.minute, values.second);
  return Math.round((asUtc - date.getTime()) / 60000);
}

export function formatDateTimeLocal(value: string, timeZone = branchTimeZone): string {
  const date = parseDate(value);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]),
  );
  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}`;
}

export function parseDateTimeLocal(value: string, timeZone = branchTimeZone): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return value;
  const [, year, month, day, hour, minute] = match;
  const wallClockAsUtc = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute));
  const initial = new Date(wallClockAsUtc);
  const offset = timeZoneOffsetMinutes(initial, timeZone);
  return new Date(wallClockAsUtc - offset * 60000).toISOString();
}

export function formatQuantity(value: string, precision = 3): string {
  const quantity = new Decimal(value);
  return quantity.toFixed(precision).replace(/(\.\d*?[1-9])0+$/, "$1").replace(/\.0+$/, "");
}

export function formatCurrency(
  value: string | null | undefined,
  currency = "ARS",
  locale = "es-AR",
): string {
  if (value == null || value.trim() === "") value = "0";
  const amount = new Decimal(value);
  const fixed = amount.toFixed(2);
  const [integer, fraction] = fixed.split(".");
  const parts = new Intl.NumberFormat(locale, { style: "currency", currency }).formatToParts(1000.5);
  const group = parts.find((part) => part.type === "group")?.value ?? ".";
  const decimal = parts.find((part) => part.type === "decimal")?.value ?? ",";
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, group);
  const numberText = `${grouped}${decimal}${fraction}`;
  const currencyText = parts.find((part) => part.type === "currency")?.value ?? currency;
  const currencyBefore = parts.findIndex((part) => part.type === "currency") < parts.findIndex((part) => part.type === "integer");
  return currencyBefore ? `${currencyText}${numberText}` : `${numberText} ${currencyText}`;
}
