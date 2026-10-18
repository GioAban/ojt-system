import type { WorkCard } from "@/types/studentProfile";

export type WorkState = "assigned" | "overdue" | "attached" | "turned_in" | "checked" | "invalid";

export function normType(t: string) {
  const v = t.trim().toLowerCase();
  if (v.startsWith("pre")) return "PRE_DEPLOYMENT";
  if (v.startsWith("post")) return "POST_DEPLOYMENT";
  return "INITIAL";
}

export const TYPE_LABEL: Record<string, string> = {
  INITIAL: "Initial",
  PRE_DEPLOYMENT: "Pre-Deployment",
  POST_DEPLOYMENT: "Post-Deployment",
};

export const SCOPE_LABEL: Record<string, string> = {
  requirement: "Requirement",
  weekly: "Weekly report",
  dtr: "Daily time record",
};

export function isPastDue(iso: string | null) {
  if (!iso) return false;
  const d = new Date(iso);
  return !Number.isNaN(d.getTime()) && d.getTime() < Date.now();
}

export function formatDue(iso: string | null, withTime = false) {
  if (!iso) return "No due date";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "No due date";
  const opts: Intl.DateTimeFormatOptions = withTime
    ? { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }
    : { month: "short", day: "numeric", year: "numeric" };
  return d.toLocaleString(undefined, opts);
}

/** Itsura ng card: kulay lang kapag may kailangan pang gawin. May nai-attach na = walang kulay. */
export function workState(status: string, hasWork: boolean, dueDate: string | null): WorkState {
  const s = status.trim().toLowerCase();
  if (s === "checked") return "checked";
  if (s === "for checking") return "turned_in";
  if (s === "invalid") return "invalid";
  if (hasWork) return "attached";
  return isPastDue(dueDate) ? "overdue" : "assigned";
}

/** Kulay ng status ng isinumite: pareho sa pahina ng gawain at sa mga card */
export const STATE_PILL: Record<WorkState, { text: string; cls: string }> = {
  assigned: { text: "Assigned", cls: "border-border bg-muted text-muted-foreground" },
  overdue: { text: "Overdue", cls: "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400" },
  attached: { text: "Not turned in", cls: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400" },
  turned_in: { text: "Turned in", cls: "border-blue-600/30 bg-blue-600/10 text-blue-700 dark:text-blue-400" },
  checked: { text: "Checked", cls: "border-emerald-600/30 bg-emerald-600/10 text-emerald-700 dark:text-emerald-400" },
  invalid: { text: "Needs revision", cls: "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400" },
};

/** Bilang ng gawain na wala pang nai-upload (o kailangang ayusin) */
export function pendingCount(items: WorkCard[]) {
  return items.filter((c) => {
    const st = workState(c.status, c.hasWork, c.dueDate);
    return st === "assigned" || st === "overdue" || st === "invalid";
  }).length;
}

export function formatSize(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function timeAgo(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
