import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

/** Pampublikong page na walang login (verify email, forgot/reset password): logo, isang card, mobile first */
export function AuthShell({ label, children, footer }: { label: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <main className="min-h-dvh bg-muted/30">
      <div className="mx-auto w-full max-w-md px-4 pb-10 pt-6 sm:pt-16">
        <Link to="/login" className="mb-4 flex items-center justify-center gap-2">
          <img src="/logos/ucu-logo.png" alt="" className="h-8 w-8 object-contain" />
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">OJT System · {label}</span>
        </Link>
        <div className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">{children}</div>
        {footer && <div className="mt-4 text-center text-sm text-muted-foreground">{footer}</div>}
      </div>
    </main>
  );
}

type Tone = "primary" | "success" | "warning" | "danger";

const TONES: Record<Tone, string> = {
  primary: "bg-primary/10 text-primary",
  success: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  warning: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  danger: "bg-destructive/10 text-destructive",
};

/** Malaking icon, pamagat at paliwanag; ang mga button ay nasa children */
export function StatusBlock({
  icon,
  tone = "primary",
  title,
  children,
}: {
  icon: ReactNode;
  tone?: Tone;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 py-2 text-center" role="status" aria-live="polite">
      <div className={cn("rounded-full p-3", TONES[tone])}>{icon}</div>
      <h1 className="text-lg font-semibold">{title}</h1>
      <div className="flex w-full flex-col gap-3 text-sm text-muted-foreground">{children}</div>
    </div>
  );
}
