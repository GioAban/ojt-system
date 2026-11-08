import { cn } from "@/lib/utils";

/** Iisang kulay para sa magnitude (asul); hiwalay na hakbang para sa dark mode */
const SERIES = "bg-[#2a78d6] dark:bg-[#3987e5]";

/** Status na kulay: laging may kasamang label at bilang, hindi kulay lang */
const TONES = {
  good: "bg-[#0ca30c]",
  warning: "bg-[#fab219]",
  critical: "bg-[#d03b3b]",
  neutral: "bg-muted-foreground/30",
} as const;
export type Tone = keyof typeof TONES;

function pct(part: number, whole: number) {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

export interface BarItem {
  label: string;
  value: number;
  /** Maliit na dagdag na text sa kanan, hal. "2 departments" */
  note?: string;
}

/**
 * Pahalang na bar bawat kategorya. Laging may label at bilang na text,
 * kaya hindi kailangan ng legend at nababasa kahit walang kulay.
 */
export function BarList({ items, label, showPercent = true }: { items: BarItem[]; label: string; showPercent?: boolean }) {
  const total = items.reduce((sum, i) => sum + i.value, 0);
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="flex flex-col gap-2.5" aria-label={label}>
      {items.map((item) => (
        <li key={item.label} title={`${item.label}: ${item.value}${showPercent ? ` (${pct(item.value, total)}%)` : ""}`}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate">{item.label}</span>
            <span className="shrink-0 tabular-nums text-muted-foreground">
              <span className="font-medium text-foreground">{item.value}</span>
              {showPercent && ` · ${pct(item.value, total)}%`}
              {item.note && ` · ${item.note}`}
            </span>
          </div>
          <div className="h-2 rounded-full bg-muted">
            <div
              className={cn("h-2 rounded-full", SERIES)}
              style={{ width: `${(item.value / max) * 100}%`, minWidth: item.value > 0 ? 4 : 0 }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export interface Segment {
  label: string;
  value: number;
  tone: Tone;
}

/** 100% na pahalang na bar na hinati sa mga bahagi, may legend na may bilang at porsiyento */
export function StackedBar({ segments, label }: { segments: Segment[]; label: string }) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  return (
    <div>
      <div
        className="flex h-3 gap-0.5 overflow-hidden rounded-full bg-muted"
        role="img"
        aria-label={`${label}: ${segments.map((s) => `${s.label} ${s.value}`).join(", ")}`}
      >
        {total > 0 &&
          segments
            .filter((s) => s.value > 0)
            .map((s) => (
              <div
                key={s.label}
                className={cn("h-full first:rounded-l-full last:rounded-r-full", TONES[s.tone])}
                style={{ width: `${(s.value / total) * 100}%` }}
                title={`${s.label}: ${s.value} (${pct(s.value, total)}%)`}
              />
            ))}
      </div>
      <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
        {segments.map((s) => (
          <li key={s.label} className="flex min-w-0 items-center gap-1.5">
            <span className={cn("h-2.5 w-2.5 shrink-0 rounded-sm", TONES[s.tone])} aria-hidden />
            <span className="truncate">{s.label}</span>
            <span className="ml-auto shrink-0 tabular-nums text-muted-foreground sm:ml-1">
              <span className="font-medium text-foreground">{s.value}</span>
              {total > 0 && ` · ${pct(s.value, total)}%`}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Isang bar na nagpapakita ng bahagi ng kabuuan (hal. oras na nagawa sa kailangang oras) */
export function Meter({ value, max, label }: { value: number; max: number; label: string }) {
  const p = Math.min(100, pct(value, max));
  return (
    <div
      className="h-3 rounded-full bg-muted"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={p}
    >
      <div className={cn("h-3 rounded-full", SERIES)} style={{ width: `${p}%`, minWidth: value > 0 ? 6 : 0 }} />
    </div>
  );
}
