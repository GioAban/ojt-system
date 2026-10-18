import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { formatLongDate } from "@/lib/dates";
import { isApproved, moaState } from "@/lib/company";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";

const CHIP = "inline-flex h-5 shrink-0 items-center rounded-md border px-1.5 text-[10px] font-medium";

export function ApprovalBadge({ status }: { status: string }) {
  return isApproved(status) ? (
    <span
      className={cn(
        CHIP,
        "border-emerald-600/30 bg-emerald-600/10 text-emerald-700 dark:text-emerald-400",
      )}
    >
      Approved
    </span>
  ) : (
    <span
      className={cn(
        CHIP,
        "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
      )}
    >
      Pending
    </span>
  );
}

export function ArchivedBadge() {
  return <span className={cn(CHIP, "border-dashed text-muted-foreground")}>Archived</span>;
}

export function MoaInfo({ start, expiration }: { start: string | null; expiration: string | null }) {
  const state = moaState(expiration);

  if (!start && !expiration) {
    return <span className="text-xs text-muted-foreground">No MOA dates</span>;
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <span className="text-xs">
        {start ? formatLongDate(start) : "—"} – {expiration ? formatLongDate(expiration) : "—"}
      </span>

      {state === "valid" && (
        <span
          className={cn(
            CHIP,
            "border-emerald-600/30 bg-emerald-600/10 text-emerald-700 dark:text-emerald-400",
          )}
        >
          Valid
        </span>
      )}
      {state === "soon" && (
        <span
          className={cn(
            CHIP,
            "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
          )}
        >
          Expires soon
        </span>
      )}
      {state === "expired" && (
        <span className={cn(CHIP, "border-destructive/30 bg-destructive/10 text-destructive")}>
          Expired
        </span>
      )}
    </div>
  );
}

export function SlotsMeter({ filled, slots }: { filled: number; slots: number }) {
  const full = slots > 0 && filled >= slots;
  const pct = slots === 0 ? 0 : Math.min(100, (filled / slots) * 100);

  return (
    <div className="flex min-w-24 flex-col gap-1">
      <span className="text-xs">
        {filled}/{slots} placed
        {full && <span className="ml-1 font-medium text-destructive">Full</span>}
      </span>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full",
            full ? "bg-destructive" : pct >= 75 ? "bg-amber-400" : "bg-emerald-500",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

interface FieldProps {
  label: string;
  htmlFor?: string;
  required?: boolean;
  error?: string;
  hint?: string;
  className?: string;
  children: ReactNode;
}

export function Field({ label, htmlFor, required, error, hint, className, children }: FieldProps) {
  return (
    <div className={cn("flex flex-col gap-2 [&>div]:w-full", className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {required ? (
          <span className="text-destructive"> *</span>
        ) : (
          <span className="font-normal text-muted-foreground"> (optional)</span>
        )}
      </Label>
      {children}
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string;
  hint?: string;
  warn?: boolean;
}

export function StatCard({ icon: Icon, label, value, hint, warn }: StatCardProps) {
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card p-4">
      <span
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
          warn ? "bg-amber-500/15 text-amber-600" : "bg-primary text-primary-foreground",
        )}
      >
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="text-2xl font-semibold leading-none">{value}</p>
        <p className="mt-1 truncate text-xs text-muted-foreground">{label}</p>
        {hint && <p className="truncate text-[11px] text-muted-foreground/80">{hint}</p>}
      </div>
    </div>
  );
}
