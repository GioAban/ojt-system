// Advanced na setting ng pagpapakita (pareho sa lahat ng report): format ng petsa at ang laman ng blangkong cell.
// Hindi nito binabago ang datos; sa papel, print, PDF at Excel lang.

import { DEFAULT_DISPLAY, type BlankDisplay, type DateFormat, type DisplaySettings } from "@/types/reports";

const FORMATS: DateFormat[] = ["long", "short", "iso"];
const BLANKS: BlankDisplay[] = ["empty", "dash", "na"];

/** Pinupunan ang kulang (mga lumang report) at itinatama ang hindi kilalang halaga */
export function displayOf(raw: Partial<DisplaySettings> | null | undefined): DisplaySettings {
  const d = raw ?? {};
  return {
    rowNumbers: typeof d.rowNumbers === "boolean" ? d.rowNumbers : DEFAULT_DISPLAY.rowNumbers,
    striped: typeof d.striped === "boolean" ? d.striped : DEFAULT_DISPLAY.striped,
    dateFormat: FORMATS.includes(d.dateFormat as DateFormat) ? (d.dateFormat as DateFormat) : DEFAULT_DISPLAY.dateFormat,
    blank: BLANKS.includes(d.blank as BlankDisplay) ? (d.blank as BlankDisplay) : DEFAULT_DISPLAY.blank,
  };
}

export const DATE_FORMAT_LABEL: Record<DateFormat, string> = {
  long: "August 1, 2025",
  short: "08/01/2025",
  iso: "2025-08-01",
};

export const BLANK_LABEL: Record<BlankDisplay, string> = { empty: "Leave empty", dash: "Dash (—)", na: "N/A" };

/** Format ng numero ng petsa sa Excel */
export const EXCEL_DATE_FORMAT: Record<DateFormat, string> = {
  long: "mmmm d, yyyy",
  short: "mm/dd/yyyy",
  iso: "yyyy-mm-dd",
};

export const blankText = (b: BlankDisplay) => (b === "dash" ? "—" : b === "na" ? "N/A" : "");

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const LONG_DATE = new RegExp(`\\b(${MONTHS.join("|")})\\s+(\\d{1,2}),\\s*(\\d{4})\\b`, "g");

/** Pinapalitan ang mga petsang "August 1, 2025" sa teksto ayon sa napiling format */
export function formatDates(text: string, format: DateFormat): string {
  if (format === "long" || !text) return text;
  return text.replace(LONG_DATE, (_m, month: string, day: string, year: string) => {
    const mm = String(MONTHS.indexOf(month) + 1).padStart(2, "0");
    const dd = day.padStart(2, "0");
    return format === "iso" ? `${year}-${mm}-${dd}` : `${mm}/${dd}/${year}`;
  });
}

/** Ang ipapakita sa isang cell ng table: format ng petsa at ang blangkong cell */
export function shownCell(value: string, display: DisplaySettings): string {
  if (!value.trim()) return blankText(display.blank);
  return formatDates(value, display.dateFormat);
}

/** Halinhinang kulay ng row (sa print din) */
export const STRIPE = "#f3f4f6";
