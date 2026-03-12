const pad2 = (value) => String(value).padStart(2, "0");

const formatDateTime = (date) => {
  const d = date.getDate();
  const m = date.getMonth() + 1;
  const y = date.getFullYear();
  const hh = date.getHours();
  const mm = date.getMinutes();
  const ss = date.getSeconds();

  return `${pad2(d)}-${pad2(m)}-${y} ${pad2(hh)}:${pad2(mm)}:${pad2(ss)}`;
};

const isPlainObject = (value) =>
  Object.prototype.toString.call(value) === "[object Object]";

const isDateLikeString = (value) => {
  if (typeof value !== "string") return false;

  const text = value.trim();
  if (text === "") return false;

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return true;

  return /^\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/.test(
    text
  );
};

const toDate = (value) => {
  if (value instanceof Date) return value;

  if (typeof value === "string") {
    const text = value.trim();

    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
      return new Date(`${text}T00:00:00`);
    }

    const parsed = new Date(text);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return null;
};

const formatDatesInPayload = (payload) => {
  if (payload === null || payload === undefined) return payload;

  if (payload instanceof Date) {
    return formatDateTime(payload);
  }

  if (Array.isArray(payload)) {
    return payload.map((item) => formatDatesInPayload(item));
  }

  if (isPlainObject(payload)) {
    const next = {};
    for (const [key, value] of Object.entries(payload)) {
      next[key] = formatDatesInPayload(value);
    }
    return next;
  }

  if (isDateLikeString(payload)) {
    const parsed = toDate(payload);
    if (parsed) return formatDateTime(parsed);
  }

  return payload;
};

module.exports = {
  formatDatesInPayload,
  formatDateTime
};
