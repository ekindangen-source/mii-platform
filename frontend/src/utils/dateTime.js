const DATE_PATTERN = /^(\d{2})\/(\d{2})\/(\d{4})$/;
const DATE_TIME_PATTERN =
  /^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{1,2}):(\d{2})\s*(AM|PM)$/i;

const pad = (value) => String(value).padStart(2, "0");

function validDate(year, month, day, hour = 0, minute = 0) {
  const date = new Date(year, month - 1, day, hour, minute, 0, 0);

  return date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day &&
    date.getHours() === hour &&
    date.getMinutes() === minute
    ? date
    : null;
}

export function formatDateInput(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

export function formatDateTimeInput(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const hour24 = date.getHours();
  const period = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 || 12;

  return (
    `${formatDateInput(date)} ${pad(hour12)}:` +
    `${pad(date.getMinutes())} ${period}`
  );
}

export function parseDateInput(value) {
  const match = String(value || "").trim().match(DATE_PATTERN);

  if (!match) {
    return null;
  }

  return validDate(Number(match[3]), Number(match[2]), Number(match[1]));
}

export function parseDateTimeInput(value) {
  const match = String(value || "").trim().match(DATE_TIME_PATTERN);

  if (!match) {
    return null;
  }

  let hour = Number(match[4]);
  const minute = Number(match[5]);
  const period = match[6].toUpperCase();

  if (hour < 1 || hour > 12 || minute > 59) {
    return null;
  }

  hour = hour % 12 + (period === "PM" ? 12 : 0);

  return validDate(
    Number(match[3]),
    Number(match[2]),
    Number(match[1]),
    hour,
    minute
  );
}

export function dateInputToIsoDate(value) {
  const date = parseDateInput(value);

  if (!date) {
    return null;
  }

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function dateTimeInputToIso(value) {
  const date = parseDateTimeInput(value);
  return date ? date.toISOString() : null;
}

export function formatDateDisplay(value) {
  return formatDateInput(value) || "-";
}

export function formatDateTimeDisplay(value) {
  return formatDateTimeInput(value) || "-";
}
