import { cn } from "@/lib/utils";

interface Props {
  percent: number;
  segments?: number;
  className?: string;
  label?: string;
  /** Maliliit na label sa ilalim ng mga box (0%, 25%, ...) */
  showScale?: boolean;
}

// Gradient: itim -> berde, bawat box ay may sariling kulay sa gradient
const FROM = [17, 24, 39]; // itim (gray-900)
const TO = [16, 185, 129]; // emerald-500

function colorAt(i: number, n: number) {
  const t = n <= 1 ? 1 : i / (n - 1);
  const c = FROM.map((f, k) => Math.round(f + (TO[k] - f) * t));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

const TICKS = [0, 25, 50, 75, 100];

export function SegmentedProgress({ percent, segments = 16, className, label, showScale }: Props) {
  const pct = Math.max(0, Math.min(100, Math.round(percent)));
  const filled = Math.round((pct / 100) * segments);
  return (
    <div className={cn("flex items-start gap-3", className)}>
      <div className="flex-1">
        <div
          className="flex gap-[3px]"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={label}
        >
          {Array.from({ length: segments }).map((_, i) => (
            <span
              key={i}
              className={cn("h-6 flex-1 rounded-[3px]", i >= filled && "bg-muted")}
              style={i < filled ? { backgroundColor: colorAt(i, segments) } : undefined}
            />
          ))}
        </div>
        {showScale && (
          <div className="mt-1 flex justify-between text-[10px] leading-none text-muted-foreground">
            {TICKS.map((t) => <span key={t}>{t}%</span>)}
          </div>
        )}
      </div>
      <span className="w-11 shrink-0 pt-1 text-right text-sm font-semibold tabular-nums">{pct}%</span>
    </div>
  );
}
