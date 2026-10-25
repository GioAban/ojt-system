import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Circle,
  CircleAlert,
  Clock,
  XCircle,
} from "lucide-react";
import api from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { DashboardLayout } from "@/components/DashboardLayout";
import { SegmentedProgress } from "@/components/progress/SegmentedProgress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Item {
  label: string;
  detail: string;
  state: "done" | "review" | "invalid" | "pending";
}
interface Category {
  key: string;
  label: string;
  percent: number;
  done: number;
  total: number;
  unit: string;
  items: Item[];
}
interface MeData {
  overall: number;
  categories: Category[];
}
interface ClassRow {
  label: string;
  me: boolean;
  overall: number;
  categories: Record<string, number>;
}
interface ClassData {
  average: number;
  students: ClassRow[];
}

const STATE_ICON = {
  done: <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-label="Done" />,
  review: (
    <Clock className="h-4 w-4 text-amber-500" aria-label="For checking" />
  ),
  invalid: (
    <XCircle className="h-4 w-4 text-destructive" aria-label="Invalid" />
  ),
  pending: (
    <Circle className="h-4 w-4 text-muted-foreground" aria-label="Pending" />
  ),
};

function MyProgress({ data }: { data: MeData }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border bg-card p-4">
        <p className="mb-2 text-sm font-medium">Overall progress</p>
        <SegmentedProgress
          percent={data.overall}
          showScale
          label="Overall progress"
        />
      </div>

      {data.categories.map((c) => (
        <section key={c.key} className="rounded-xl border bg-card p-4">
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <h2 className="font-semibold">{c.label}</h2>
            <span className="text-xs text-muted-foreground">
              {c.total === 0
                ? "Nothing assigned yet"
                : `${c.done} / ${c.total} ${c.unit}`}
            </span>
          </div>
          <SegmentedProgress percent={c.percent} label={c.label} />
          {c.items.length > 0 && (
            <ul className="mt-3 divide-y text-sm">
              {c.items.map((it, i) => (
                <li key={i} className="flex items-center gap-2 py-1.5">
                  {STATE_ICON[it.state]}
                  <span className="min-w-0 flex-1 truncate">{it.label}</span>
                  {it.detail && (
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {it.detail}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}

const COLUMNS = [
  { key: "initial", label: "Initial" },
  { key: "pre", label: "Prelim" },
  { key: "post", label: "Post" },
  { key: "dtr", label: "DTR" },
  { key: "weekly", label: "Weekly" },
];

const pctText = (v: number | undefined) =>
  v === undefined || v < 0 ? "–" : `${v}%`;

function Everyone({ data }: { data: ClassData }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-xl border bg-card p-4">
        <p className="mb-2 text-sm font-medium">Class average</p>
        <SegmentedProgress percent={data.average} label="Class average" />
      </div>
      <div className="rounded-xl border bg-card">
        {/* Header ng mga column (desktop) */}
        <div className="hidden items-center gap-4 border-b px-4 py-2 text-xs font-medium text-muted-foreground lg:flex">
          <span className="w-44 shrink-0">Student</span>
          <span className="flex-1">Overall</span>
          <div className="grid w-80 shrink-0 grid-cols-5 text-center">
            {COLUMNS.map((c) => (
              <span key={c.key}>{c.label}</span>
            ))}
          </div>
        </div>
        {data.students.map((s, i) => (
          <div
            key={i}
            className="flex flex-col gap-1 border-b p-4 last:border-b-0 lg:flex-row lg:items-center lg:gap-4"
          >
            <p
              className={`text-sm lg:w-44 lg:shrink-0 ${s.me ? "font-semibold" : ""}`}
            >
              {s.label}
            </p>
            <Tooltip>
              <TooltipTrigger
                render={<div className="flex-1 cursor-default" />}
              >
                <SegmentedProgress
                  percent={s.overall}
                  label={`${s.label} progress`}
                />
              </TooltipTrigger>
              <TooltipContent side="top" className="min-w-40">
                <p className="mb-1 font-semibold">{s.label}</p>
                {COLUMNS.map((c) => (
                  <div
                    key={c.key}
                    className="flex justify-between gap-6 text-xs"
                  >
                    <span>{c.label}</span>
                    <span className="tabular-nums">
                      {pctText(s.categories[c.key])}
                    </span>
                  </div>
                ))}
              </TooltipContent>
            </Tooltip>
            <div className="grid w-80 shrink-0 grid-cols-5 text-center text-xs tabular-nums max-lg:hidden">
              {COLUMNS.map((c) => (
                <span key={c.key}>{pctText(s.categories[c.key])}</span>
              ))}
            </div>
          </div>
        ))}
        {data.students.length === 0 && (
          <p className="p-6 text-center text-sm text-muted-foreground">
            No classmates yet.
          </p>
        )}
      </div>
    </div>
  );
}

const HOW_IT_WORKS = [
  {
    title: "Initial / Preliminary / Post Requirements",
    body: 'Number of requirements that have been checked by the coordinator ÷ total number of assigned requirements. Example: 3 checked out of 5 = 60%. "For Checking" and "Invalid" requirements are not counted yet.',
  },
  {
    title: "DTR",
    body: "Total hours rendered (based on the signed DTR) ÷ total required training hours. Example: 120 out of 486 hours = 25%. If no required hours are specified, the calculation uses the number of months with a DTR ÷ total number of months.",
  },
  {
    title: "Weekly Reports",
    body: "Number of weekly reports with a rating ÷ total number of weekly reports. Example: 4 rated reports out of 8 = 50%.",
  },
  {
    title: "Overall",
    body: "Average of all assigned categories. Categories with no data (–) are not included in the average.",
  },
  {
    title: "Everyone Tab",
    body: "The same calculation is applied to each student in your class. The Class Average is the average of all students' overall scores. Hover over the bar to view the breakdown.",
  },
];

function HowItWorks() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="How progress is computed"
      >
        <CircleAlert className="h-5 w-5" />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>How your progress is computed</DialogTitle>
            <DialogDescription>
              Each bar has 16 boxes. The number of filled boxes corresponds to
              the percentage.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 text-sm">
            {HOW_IT_WORKS.map((h) => (
              <div key={h.title}>
                <p className="font-medium">{h.title}</p>
                <p className="text-muted-foreground">{h.body}</p>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function StudentProgress() {
  const [me, setMe] = useState<MeData | null>(null);
  const [cls, setCls] = useState<ClassData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get<MeData>("/student/progress/me")
      .then((r) => setMe(r.data))
      .catch((e) =>
        setError(getErrorMessage(e, "Couldn't load your progress.")),
      );
    api
      .get<ClassData>("/student/progress/class")
      .then((r) => setCls(r.data))
      .catch((e) =>
        setError(getErrorMessage(e, "Couldn't load class progress.")),
      );
  }, []);

  const loading = (
    <div className="flex flex-col gap-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-24 w-full rounded-xl" />
      ))}
    </div>
  );

  return (
    <DashboardLayout>
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Progress</h1>
        <HowItWorks />
      </div>
      <p className="mb-6 mt-1 text-sm text-muted-foreground">
        Track your requirements, DTR and weekly reports.
      </p>
      {error && <p className="mb-3 text-sm text-destructive">{error}</p>}

      <Tabs defaultValue="mine">
        <TabsList>
          <TabsTrigger value="mine">My progress</TabsTrigger>
          <TabsTrigger value="everyone">Everyone</TabsTrigger>
        </TabsList>
        <TabsContent value="mine" className="mt-4">
          {me ? <MyProgress data={me} /> : loading}
        </TabsContent>
        <TabsContent value="everyone" className="mt-4">
          {cls ? <Everyone data={cls} /> : loading}
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}
