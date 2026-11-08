import type { ElementType, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { InfoPopover } from "@/components/dashboard/InfoPopover";

interface SectionProps {
  title: string;
  /** Paliwanag sa "!" na popover */
  info: ReactNode;
  icon?: ElementType;
  /** Maliit na bilang sa tabi ng title (hal. ilang student ang nasa listahan) */
  count?: number;
  /** Kulay ng bilang: "alert" kapag may kailangang gawin */
  tone?: "default" | "alert";
  className?: string;
  children: ReactNode;
}

/** Card na may title, "!" na paliwanag at laman */
export function Section({ title, info, icon: Icon, count, tone = "default", className, children }: SectionProps) {
  return (
    <section className={cn("flex min-w-0 flex-col rounded-xl border bg-card p-4", className)}>
      <header className="mb-3 flex items-center gap-2">
        {Icon && <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />}
        <h2 className="min-w-0 truncate text-sm font-semibold">{title}</h2>
        {count !== undefined && (
          <span
            className={cn(
              "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums",
              tone === "alert" && count > 0
                ? "bg-destructive/10 text-destructive"
                : "bg-muted text-muted-foreground",
            )}
          >
            {count}
          </span>
        )}
        <span className="ml-auto" />
        <InfoPopover title={title}>{info}</InfoPopover>
      </header>
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </section>
  );
}

interface StatCardProps {
  label: string;
  value: string;
  icon: ElementType;
  info: ReactNode;
  hint?: string;
}

/** Malaking numero sa itaas ng dashboard */
export function StatCard({ label, value, icon: Icon, info, hint }: StatCardProps) {
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card p-4">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold tabular-nums leading-tight">{value}</p>
        {hint && <p className="truncate text-xs text-muted-foreground">{hint}</p>}
      </div>
      <InfoPopover title={label}>{info}</InfoPopover>
    </div>
  );
}

/** Mensahe kapag walang laman ang isang section */
export function EmptyNote({ children }: { children: ReactNode }) {
  return (
    <p className="flex flex-1 items-center justify-center rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
      {children}
    </p>
  );
}
