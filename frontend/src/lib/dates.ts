export function parseIsoDate(value: string) {
  return new Date(`${value}T00:00:00`);
}

/** Lokal na format (iwas timezone shift ng toISOString) */
function toIso(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function todayIso() {
  return toIso(new Date());
}

export function addDays(value: string, days: number) {
  const date = parseIsoDate(value);
  date.setDate(date.getDate() + days);
  return toIso(date);
}

export function formatPeriod(from: string, to: string) {
  const a = parseIsoDate(from);
  const b = parseIsoDate(to);
  const month = (d: Date) => d.toLocaleDateString("en-PH", { month: "long" });

  if (a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()) {
    return a.getDate() === b.getDate()
      ? `${month(a)} ${a.getDate()}`
      : `${month(a)} ${a.getDate()}–${b.getDate()}`;
  }

  const short = (d: Date) =>
    d.toLocaleDateString("en-PH", { month: "short", day: "numeric" });
  return `${short(a)} – ${short(b)}`;
}

export function formatLongDate(value: string | null) {
  if (!value) return "—";
  const date = parseIsoDate(value.slice(0, 10));
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString("en-PH", {
        month: "long",
        day: "numeric",
        year: "numeric",
      });
}

/** "Oct 30" (lokal na oras ng browser, para sa Timestamp mula sa server) */
export function formatShortDate(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleDateString("en-PH", { month: "short", day: "numeric" });
}

/** "October 30, 2026" */
export function formatFullDate(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleDateString("en-PH", {
        month: "long",
        day: "numeric",
        year: "numeric",
      });
}

/** yyyy-MM-dd para sa <input type="date">, galing sa Timestamp ng server */
export function toLocalDateInput(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : toIso(date);
}

export function isPastDue(value: string | null) {
  if (!value) return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date.getTime() < Date.now();
}

/** "Oct 7, 2026, 11:22 AM" */
export function formatDateTime(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleString("en-PH", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
}
