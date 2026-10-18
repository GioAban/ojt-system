import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarClock, CheckCircle2, ClipboardList, FileText, Info, Lock, Paperclip } from "lucide-react";
import api from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";
import type { StudentHomeData, WorkCard } from "@/types/studentProfile";
import { STATE_PILL, formatDue, normType, pendingCount, workState, type WorkState } from "@/lib/requirementUi";
import { DashboardLayout } from "@/components/DashboardLayout";
import { TabBar, type TabDef } from "@/components/TabBar";
import { Skeleton } from "@/components/ui/skeleton";

type MainTab = "INITIAL" | "PRE_DEPLOYMENT" | "POST_DEPLOYMENT";
type PreTab = "requirement" | "weekly" | "dtr";

/** Kulay lang ang may kailangan pang gawin. Kapag may nai-attach na, walang kulay. */
const BANNER: Record<WorkState, string> = {
  assigned: "bg-primary/10 text-primary",
  overdue: "bg-red-500/10 text-red-600 dark:text-red-400",
  invalid: "bg-red-500/10 text-red-600 dark:text-red-400",
  attached: "bg-muted text-muted-foreground",
  turned_in: "bg-muted text-muted-foreground",
  checked: "bg-muted text-muted-foreground",
};

const STATUS_NOTE: Record<string, string> = {
  "for approval":
    "Your coordinator hasn't approved you yet. You can already work on the Initial requirements. Pre-Deployment and Post-Deployment will show up once you're approved.",
  approved:
    "You're approved! Apply to a company in the Companies tab. Weekly Report, DTR and Post-Deployment open once you're deployed.",
  deployed: "You're deployed. Keep up with your requirements, weekly reports and DTR.",
  completed: "You've completed your training. Post-Deployment requirements are open.",
};

const EMPTY_TEXT: Record<string, string> = {
  requirement: "No requirements here yet.",
  weekly: "No weekly reports yet.",
  dtr: "No DTR months yet.",
};

function statusTone(status: string) {
  const s = status.trim().toLowerCase();
  if (s === "approved" || s === "completed") return "border-emerald-600/30 bg-emerald-600/10 text-emerald-700 dark:text-emerald-400";
  if (s === "deployed") return "border-blue-600/30 bg-blue-600/10 text-blue-700 dark:text-blue-400";
  return "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400";
}

function loadTab<T extends string>(key: string, allowed: T[], fallback: T): T {
  try {
    const v = localStorage.getItem(key) as T | null;
    if (v && allowed.includes(v)) return v;
  } catch {
    // walang storage
  }
  return fallback;
}

function saveTab(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // hindi kritikal
  }
}

function WorkCardView({ c }: { c: WorkCard }) {
  const state = workState(c.status, c.hasWork, c.dueDate);
  const done = state === "turned_in" || state === "checked";
  return (
    <Link
      to={`/student/work/${c.scope}/${c.id}`}
      className="group flex flex-col overflow-hidden rounded-xl border bg-card transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className={cn("flex h-16 items-center justify-between px-4", BANNER[state])}>
        <FileText className="h-6 w-6" />
        {done && <CheckCircle2 className="h-5 w-5" />}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <p className="line-clamp-2 font-medium group-hover:underline">{c.title}</p>
        {c.subtitle && <p className="text-xs text-muted-foreground">{c.subtitle}</p>}
        {c.instructions && <p className="line-clamp-2 text-xs text-muted-foreground">{c.instructions}</p>}
        <div className="mt-auto flex items-center justify-between gap-2 pt-2 text-xs">
          <span
            className={cn(
              "inline-flex items-center gap-1",
              state === "overdue" ? "font-medium text-red-600 dark:text-red-400" : "text-muted-foreground",
            )}
          >
            <CalendarClock className="h-3 w-3" />
            {formatDue(c.dueDate)}
          </span>
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-medium",
              STATE_PILL[state].cls,
            )}
          >
            {state === "attached" && <Paperclip className="h-3 w-3" />}
            {STATE_PILL[state].text}
          </span>
        </div>
      </div>
    </Link>
  );
}

function LockedNotice({ what }: { what: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-14 text-center">
      <Lock className="h-8 w-8 text-muted-foreground" />
      <p className="max-w-sm text-sm text-muted-foreground">
        {what} opens once your coordinator deploys you. Apply to a company in the Companies tab first.
      </p>
      <Link to="/student/companies" className="text-sm font-medium text-primary underline">
        Go to Companies
      </Link>
    </div>
  );
}

function CardGrid({ items, empty }: { items: WorkCard[]; empty: string }) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-14 text-center">
        <ClipboardList className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{empty}</p>
      </div>
    );
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((c) => (
        <WorkCardView key={`${c.scope}-${c.id}`} c={c} />
      ))}
    </div>
  );
}

export default function StudentHome() {
  const [data, setData] = useState<StudentHomeData | null>(null);
  const [error, setError] = useState("");
  const [main, setMain] = useState<MainTab>(() =>
    loadTab<MainTab>("home_main_tab", ["INITIAL", "PRE_DEPLOYMENT", "POST_DEPLOYMENT"], "INITIAL"),
  );
  const [pre, setPre] = useState<PreTab>(() => loadTab<PreTab>("home_pre_tab", ["requirement", "weekly", "dtr"], "requirement"));

  useEffect(() => {
    api
      .get<StudentHomeData>("/student/requirements")
      .then((res) => setData(res.data))
      .catch((err) => setError(getErrorMessage(err, "Failed to load your requirements.")));
  }, []);

  const status = data?.studentStatus?.trim() || "For Approval";
  const note = STATUS_NOTE[status.toLowerCase()];
  const approved = status.toLowerCase() !== "for approval";
  const deployed = ["deployed", "completed"].includes(status.toLowerCase());

  const groups = useMemo(() => {
    const items = data?.items ?? [];
    const req = (t: string) => items.filter((c) => c.scope === "requirement" && normType(c.type) === t);
    return {
      initial: req("INITIAL"),
      preReq: req("PRE_DEPLOYMENT"),
      post: req("POST_DEPLOYMENT"),
      weekly: items.filter((c) => c.scope === "weekly"),
      dtr: items.filter((c) => c.scope === "dtr"),
    };
  }, [data]);

  const mainTabs: TabDef<MainTab>[] = [
    { key: "INITIAL", label: "Initial", count: pendingCount(groups.initial) },
    ...(approved
      ? ([
          {
            key: "PRE_DEPLOYMENT",
            label: "Pre-Deployment",
            count: pendingCount(groups.preReq) + pendingCount(groups.weekly) + pendingCount(groups.dtr),
          },
          {
            key: "POST_DEPLOYMENT",
            label: "Post-Deployment",
            count: deployed ? pendingCount(groups.post) : undefined,
            locked: !deployed,
          },
        ] as TabDef<MainTab>[])
      : []),
  ];
  const activeMain: MainTab = mainTabs.some((t) => t.key === main) ? main : "INITIAL";

  const preTabs: TabDef<PreTab>[] = [
    { key: "requirement", label: "Requirements", count: pendingCount(groups.preReq) },
    { key: "weekly", label: "Weekly Report", count: pendingCount(groups.weekly), locked: !deployed },
    { key: "dtr", label: "DTR", count: pendingCount(groups.dtr), locked: !deployed },
  ];

  const name = localStorage.getItem("fullname");

  return (
    <DashboardLayout>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Welcome{name ? `, ${name}` : ""}!</h1>
        {data && (
          <span className={cn("rounded-full border px-2.5 py-0.5 text-xs font-medium", statusTone(status))}>{status}</span>
        )}
      </div>
      <p className="mb-4 mt-1 text-sm text-muted-foreground">Your requirements for the practicum.</p>

      {data && note && (
        <div className="mb-5 flex items-start gap-2 rounded-xl border bg-muted/40 p-3 text-sm text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{note}</p>
        </div>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}

      {!data && !error && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-36 w-full rounded-xl" />
          ))}
        </div>
      )}

      {data && (
        <div className="flex flex-col gap-5">
          <TabBar
            label="Requirement groups"
            tabs={mainTabs}
            value={activeMain}
            onChange={(k) => {
              setMain(k);
              saveTab("home_main_tab", k);
            }}
          />

          {activeMain === "INITIAL" && <CardGrid items={groups.initial} empty="No initial requirements yet." />}

          {activeMain === "PRE_DEPLOYMENT" && (
            <>
              <TabBar
                size="sm"
                label="Pre-deployment sections"
                tabs={preTabs}
                value={pre}
                onChange={(k) => {
                  setPre(k);
                  saveTab("home_pre_tab", k);
                }}
              />
              {pre !== "requirement" && !deployed ? (
                <LockedNotice what={pre === "weekly" ? "Weekly Report" : "DTR"} />
              ) : (
                <CardGrid
                  items={pre === "requirement" ? groups.preReq : pre === "weekly" ? groups.weekly : groups.dtr}
                  empty={EMPTY_TEXT[pre]}
                />
              )}
            </>
          )}

          {activeMain === "POST_DEPLOYMENT" &&
            (deployed ? (
              <CardGrid items={groups.post} empty="No post-deployment requirements yet." />
            ) : (
              <LockedNotice what="Post-Deployment" />
            ))}
        </div>
      )}
    </DashboardLayout>
  );
}
