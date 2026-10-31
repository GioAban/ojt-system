import type { DtrContent, DtrRow } from "@/lib/dtrDraftStore";

export function toMinutes(t: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h > 23 || min > 59 ? null : h * 60 + min;
}

function span(from: string, to: string): number {
  const a = toMinutes(from);
  const b = toMinutes(to);
  return a === null || b === null || b <= a ? 0 : b - a;
}

/** Oras (decimal) ng isang araw: (AM out - AM in) + (PM out - PM in); 0 kung hindi pumasok */
export function rowHours(r: DtrRow): number {
  if (!r.worked) return 0;
  return Math.round(((span(r.amIn, r.amOut) + span(r.pmIn, r.pmOut)) / 60) * 100) / 100;
}

export function totalHours(c: DtrContent): number {
  return Math.round(c.rows.reduce((sum, r) => sum + rowHours(r), 0) * 100) / 100;
}

export function formatHours(h: number): string {
  return h === 0 ? "" : String(Math.round(h * 100) / 100);
}

/** 24-oras -> "8:00" (12-oras na walang AM/PM; nasa column header na ang AM/PM) */
export function formatTime(t: string): string {
  const m = toMinutes(t);
  if (m === null) return "";
  const h = Math.floor(m / 60) % 12 || 12;
  return `${h}:${String(m % 60).padStart(2, "0")}`;
}

export function chunk<T>(items: T[], perPage: number | undefined): T[][] {
  const n = perPage && perPage > 0 ? perPage : Math.max(items.length, 1);
  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += n) pages.push(items.slice(i, i + n));
  return pages.length ? pages : [[]];
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function parseIso(iso: string): { y: number; m: number; d: number; dow: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const dt = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]), dow: dt.getUTCDay() };
}

export function dayName(iso: string): string {
  const p = parseIso(iso);
  return p ? DAYS[p.dow] : "";
}

/** "Mar 3" */
export function shortDate(iso: string): string {
  const p = parseIso(iso);
  return p ? `${MONTHS[p.m - 1]} ${p.d}` : iso;
}

export function isWeekend(iso: string): boolean {
  const p = parseIso(iso);
  return p ? p.dow === 0 || p.dow === 6 : false;
}
