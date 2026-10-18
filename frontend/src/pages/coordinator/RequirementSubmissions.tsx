import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ChevronDown,
  FileText,
  Link2,
  ListChecks,
  Paperclip,
  Pencil,
  Search,
  Users,
} from "lucide-react";
import api from "@/lib/api";
import { postBulk } from "@/lib/bulk";
import { formatFullDate, formatPeriod } from "@/lib/dates";
import { getErrorMessage } from "@/lib/errors";
import { openExternalLink, openProtectedFile } from "@/lib/files";
import { notify } from "@/lib/notify";
import { cn } from "@/lib/utils";
import type { TrackingStatus } from "@/types/tracking";
import type { WeeklyRating } from "@/types/trackingSections";
import type { CellResult, ReviewRating } from "@/types/review";
import type {
  MaterialItem,
  RequirementKind,
  SubmissionFile,
  SubmissionStudent,
  SubmissionsData,
} from "@/types/requirements";
import { DashboardLayout } from "@/components/DashboardLayout";
import { MaterialChip } from "@/components/requirements/MaterialChip";
import { StatusPairDialog, type PairValues } from "@/components/tracking/StatusPairDialog";
import { PrivateComments } from "@/components/requirements/PrivateComments";
import { EditRequirementDialog } from "@/components/requirements/EditRequirementDialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";

type Tab = "instructions" | "work";

const API_BASE: Record<RequirementKind, string> = {
  document: "/coordinator/requirements",
  weekly: "/coordinator/requirements/weekly",
  dtr: "/coordinator/requirements/dtr",
};

const KIND_LABELS: Record<RequirementKind, string> = {
  document: "Requirement",
  weekly: "Weekly report",
  dtr: "DTR",
};

const TYPE_LABELS: Record<string, string> = {
  initial: "Initial requirement",
  pre: "Pre-deployment requirement",
  post: "Post-deployment requirement",
};

const STATUS: Record<TrackingStatus, { label: string; className: string }> = {
  ASSIGNED: { label: "Assigned", className: "text-muted-foreground" },
  FOR_CHECKING: {
    label: "For checking",
    className: "text-amber-600 dark:text-amber-400",
  },
  CHECKED: {
    label: "Checked",
    className: "text-emerald-600 dark:text-emerald-400",
  },
  INVALID: { label: "Invalid", className: "text-destructive" },
};

const STATUS_ORDER: TrackingStatus[] = [
  "ASSIGNED",
  "FOR_CHECKING",
  "CHECKED",
  "INVALID",
];

const RATING: Record<WeeklyRating, { label: string; className: string }> = {
  EXCELLENT: {
    label: "Excellent",
    className: "text-emerald-600 dark:text-emerald-400",
  },
  VERY_GOOD: {
    label: "Very Good",
    className: "text-sky-600 dark:text-sky-400",
  },
  GOOD: { label: "Good", className: "text-amber-600 dark:text-amber-400" },
  POOR: { label: "Poor", className: "text-destructive" },
  NONE: { label: "No evaluation", className: "text-muted-foreground" },
};

const RATING_ORDER: WeeklyRating[] = [
  "EXCELLENT",
  "VERY_GOOD",
  "GOOD",
  "POOR",
  "NONE",
];

const AVATAR_COLORS = [
  "bg-emerald-600",
  "bg-sky-600",
  "bg-orange-500",
  "bg-violet-600",
  "bg-rose-500",
  "bg-teal-600",
  "bg-indigo-600",
];

/** Dagdag na datos ng DTR: kabuuang rendered hours at haba ng training */
interface Extra {
  renderedHours: number | null;
  trainingDuration: number | null;
}

/** Sagot ng /coordinator/review/submissions */
interface OverlayRow extends Extra {
  studentId: number;
  status: TrackingStatus;
  rating: string | null;
  hours: number | null;
  hasFile: boolean;
}

interface LoadState {
  key: string;
  data: SubmissionsData | null;
  extras: Record<number, Extra>;
  error: string;
}

function nameOf(s: SubmissionStudent) {
  const initial = s.middleInitial ? ` ${s.middleInitial}.` : "";
  return `${s.lastname}, ${s.firstname}${initial}`;
}

function formatHours(value: number) {
  return value.toLocaleString("en-PH", { maximumFractionDigits: 2 });
}

/** Tapos na ba ang pagsusuri? Ang status na Checked na lang ang basehan */
function isDone(_kind: RequirementKind, s: SubmissionStudent) {
  return s.status === "CHECKED";
}

function isTurnedIn(_kind: RequirementKind, s: SubmissionStudent) {
  return s.status !== "ASSIGNED" || s.files.length > 0;
}

function display(
  kind: RequirementKind,
  s: SubmissionStudent,
): { label: string; className: string } {
  const base = STATUS[s.status];
  let detail = "";
  if (kind === "dtr" && s.hours != null) {
    detail = ` · ${formatHours(s.hours)} hrs`;
  } else if (kind === "weekly" && s.rating && s.rating !== "NONE") {
    detail = ` · ${RATING[s.rating as WeeklyRating].label}`;
  }
  return { label: `${base.label}${detail}`, className: base.className };
}

function filterOptions(
  kind: RequirementKind,
): { value: string; label: string }[] {
  return [
    { value: "all", label: kind === "document" ? "All statuses" : "All students" },
    { value: "turned", label: "Turned in" },
    { value: "missing", label: "Not submitted" },
    { value: "FOR_CHECKING", label: "For checking" },
    { value: "CHECKED", label: "Checked" },
    { value: "INVALID", label: "Invalid" },
  ];
}

function matches(kind: RequirementKind, s: SubmissionStudent, filter: string) {
  switch (filter) {
    case "all":
      return true;
    case "turned":
      return isTurnedIn(kind, s);
    case "missing":
      return !isTurnedIn(kind, s);
    default:
      return s.status === filter;
  }
}

function Initials({
  student,
  className,
}: {
  student: SubmissionStudent;
  className?: string;
}) {
  const text =
    `${student.firstname[0] ?? ""}${student.lastname[0] ?? ""}`.toUpperCase();
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full text-xs font-medium text-white",
        AVATAR_COLORS[student.studentId % AVATAR_COLORS.length],
        className ?? "h-8 w-8",
      )}
    >
      {text}
    </span>
  );
}

function FileSummary({ files }: { files: SubmissionFile[] }) {
  if (files.length === 0) {
    return (
      <span className="text-xs text-muted-foreground">No attachments</span>
    );
  }
  if (files.length > 1) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs">
        <Paperclip className="h-3.5 w-3.5" />
        {files.length} attachments
      </span>
    );
  }

  const file = files[0];
  const FileIcon = file.kind === "LINK" ? Link2 : FileText;
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5 text-xs">
      <FileIcon className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{file.name}</span>
    </span>
  );
}

interface HoursEditorProps {
  value: number | null;
  pending: boolean;
  onSave: (hours: number | null) => void;
}

function HoursEditor({ value, pending, onSave }: HoursEditorProps) {
  const [draft, setDraft] = useState(value === null ? "" : String(value));

  const trimmed = draft.trim();
  const parsed = trimmed === "" ? null : Number(trimmed);
  const dirty = parsed !== value;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(parsed);
      }}
      className="flex flex-wrap items-center gap-2"
    >
      <span className="text-xs text-muted-foreground">Hours rendered</span>
      <Input
        inputMode="decimal"
        aria-label="Hours rendered"
        className="h-9 w-24"
        value={draft}
        onChange={(e) => setDraft(e.target.value.replace(/[^\d.]/g, ""))}
      />
      <Button
        type="submit"
        size="sm"
        disabled={pending || !dirty}
      >
        Save
      </Button>
    </form>
  );
}

/** Training duration, total render (mga Checked na DTR) at to render */
function DtrFigures({ extra }: { extra: Extra | undefined }) {
  const duration = extra?.trainingDuration ?? null;
  const total = extra?.renderedHours ?? 0;
  const remaining = duration === null ? null : Math.max(0, duration - total);

  const items = [
    { label: "Required hours", value: duration },
    { label: "Total render", value: total },
    { label: "To render", value: remaining },
  ];

  return (
    <div className="mt-4 flex flex-wrap gap-x-10 gap-y-3 rounded-lg bg-muted/40 px-4 py-3">
      {items.map((i) => (
        <div key={i.label}>
          <p className="text-2xl font-light leading-none">
            {i.value === null ? "—" : formatHours(i.value)}
            {i.value !== null && (
              <span className="ml-1 text-xs text-muted-foreground">hrs</span>
            )}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{i.label}</p>
        </div>
      ))}
      <p className="basis-full text-xs text-muted-foreground">
        Only DTRs marked Checked count toward Total render.
      </p>
    </div>
  );
}

export default function RequirementSubmissions({
  kind = "document",
}: {
  kind?: RequirementKind;
}) {
  const { requirementId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const [tab, setTab] = useState<Tab>("work");
  const [reloadToken, setReloadToken] = useState(0);
  const [state, setState] = useState<LoadState | null>(null);
  // ?student=ID (galing sa abiso) ay direktang bubuksan ang gawain ng student na iyon
  const [selectedId, setSelectedId] = useState<number | null>(() => {
    const id = Number(searchParams.get("student"));
    return Number.isFinite(id) && id > 0 ? id : null;
  });
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  /** Modal para sa status at evaluation (weekly) o hours (DTR) */
  const [pair, setPair] = useState<{
    student: SubmissionStudent;
    status: TrackingStatus;
    rating: WeeklyRating | null;
    hours: number | null;
  } | null>(null);

  const key = requirementId ? `${kind}:${requirementId}:${reloadToken}` : "";

  useEffect(() => {
    if (!requirementId) return;
    let cancelled = false;

    const overlay: Promise<OverlayRow[] | null> =
      kind === "document"
        ? Promise.resolve(null)
        : api
            .get<OverlayRow[]>(
              `/coordinator/review/submissions?kind=${kind}&itemId=${requirementId}`,
            )
            .then((res) => res.data)
            .catch(() => null);

    Promise.all([
      api.get<SubmissionsData>(`${API_BASE[kind]}/${requirementId}/submissions`),
      overlay,
    ])
      .then(([res, rows]) => {
        if (cancelled) return;

        const extras: Record<number, Extra> = {};
        let list = res.data.students;
        if (rows) {
          const byId = new Map(rows.map((r) => [r.studentId, r]));
          list = list.map((s) => {
            const o = byId.get(s.studentId);
            if (!o) return s;
            extras[s.studentId] = {
              renderedHours: o.renderedHours,
              trainingDuration: o.trainingDuration,
            };
            return {
              ...s,
              status: o.status,
              rating: (o.rating ?? "NONE") as WeeklyRating,
              hours: o.hours,
            };
          });
        }
        setState({
          key,
          data: { ...res.data, students: list },
          extras,
          error: "",
        });
      })
      .catch((err) => {
        if (!cancelled) {
          setState({
            key,
            data: null,
            extras: {},
            error: getErrorMessage(err, "Failed to load the student work."),
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [kind, requirementId, key]);

  const current = state && state.key === key ? state : null;
  const loading = key !== "" && current === null;
  const data = current?.data ?? null;
  const extras = current?.extras ?? {};

  const filtered = useMemo(() => {
    const rows = data?.students ?? [];
    const q = search.trim().toLowerCase();

    return rows.filter((s) => {
      if (!matches(kind, s, filter)) return false;
      return (
        !q ||
        `${s.lastname} ${s.firstname} ${s.studentNumber}`
          .toLowerCase()
          .includes(q)
      );
    });
  }, [data, kind, search, filter]);

  const students = data?.students ?? [];
  const total = students.length;
  const turnedIn = students.filter((s) => isTurnedIn(kind, s)).length;
  const done = students.filter((s) => isDone(kind, s)).length;
  const selected = students.find((s) => s.studentId === selectedId) ?? null;

  const heading = data
    ? kind === "weekly" && data.dateFrom && data.dateTo
      ? formatPeriod(data.dateFrom, data.dateTo)
      : data.title
    : "Student work";

  const subtitle = data
    ? `${kind === "document" ? (TYPE_LABELS[data.type ?? ""] ?? KIND_LABELS.document) : KIND_LABELS[kind]}` +
      (data.dueDate
        ? ` · Due ${formatFullDate(data.dueDate)}`
        : " · No due date") +
      (data.archived ? " · Archived" : "")
    : "";

  const commentsPath = (studentId: number) =>
    `${API_BASE[kind]}/${requirementId}/submissions/${studentId}/comments`;

  function goBack() {
    // Galing sa Tracking: bumalik doon
    if ((location.state as { from?: string } | null)?.from === "tracking") {
      navigate(-1);
      return;
    }
    const type = kind === "document" ? (data?.type ?? undefined) : "pre";
    navigate("/coordinator/document-requirements", {
      state: type ? { type } : undefined,
    });
  }

  function patchStudent(studentId: number, patch: Partial<SubmissionStudent>) {
    setState((prev) =>
      prev && prev.data
        ? {
            ...prev,
            data: {
              ...prev.data,
              students: prev.data.students.map((s) =>
                s.studentId === studentId ? { ...s, ...patch } : s,
              ),
            },
          }
        : prev,
    );
  }

  function patchExtra(studentId: number, patch: Partial<Extra>) {
    setState((prev) =>
      prev
        ? {
            ...prev,
            extras: {
              ...prev.extras,
              [studentId]: {
                renderedHours:
                  patch.renderedHours !== undefined
                    ? patch.renderedHours
                    : (prev.extras[studentId]?.renderedHours ?? null),
                trainingDuration:
                  patch.trainingDuration !== undefined
                    ? patch.trainingDuration
                    : (prev.extras[studentId]?.trainingDuration ?? null),
              },
            },
          }
        : prev,
    );
  }

  function applyCell(student: SubmissionStudent, result: CellResult) {
    patchStudent(student.studentId, {
      status: result.cell.status,
      ...(kind === "weekly"
        ? { rating: (result.cell.rating ?? "NONE") as WeeklyRating }
        : {}),
      ...(kind === "dtr" ? { hours: result.cell.hours } : {}),
    });
    if (kind === "dtr" && result.renderedHours != null) {
      patchExtra(student.studentId, { renderedHours: result.renderedHours });
    }
  }

  async function changeStatus(
    student: SubmissionStudent,
    status: TrackingStatus,
  ) {
    if (!data || status === student.status) return;

    // Ang Checked ay may kasamang evaluation (weekly) o hours (DTR): magtanong sa modal.
    // Sa DTR, laging may kumpirmasyon, kahit may hours na inilagay ang student (nakalagay na ito sa modal).
    if (
      status === "CHECKED" &&
      ((kind === "weekly" && (!student.rating || student.rating === "NONE")) ||
        kind === "dtr")
    ) {
      setPair({
        student,
        status,
        rating: null,
        hours: kind === "dtr" ? (student.hours ?? null) : null,
      });
      return;
    }

    setPendingId(student.studentId);
    try {
      if (kind === "document") {
        await api.patch("/coordinator/tracking/status", {
          studentId: student.studentId,
          requirementId: data.requirementId,
          status,
        });
        patchStudent(student.studentId, { status });
      } else {
        const res = await api.patch<CellResult>("/coordinator/review/cell", {
          kind,
          studentId: student.studentId,
          itemId: data.requirementId,
          status,
        });
        applyCell(student, res.data);
      }
      notify.success(
        `${heading} of ${nameOf(student)} set to ${STATUS[status].label}.`,
      );
    } catch (err) {
      notify.error(getErrorMessage(err, "Failed to update the status."));
    } finally {
      setPendingId(null);
    }
  }

  async function changeRating(
    student: SubmissionStudent,
    rating: WeeklyRating,
  ) {
    if (!data) return;

    // Ang evaluation ay para sa Checked: kung hindi pa Checked, ipakita ang status sa modal
    if (rating !== "NONE" && student.status !== "CHECKED") {
      setPair({ student, status: "CHECKED", rating, hours: null });
      return;
    }

    const status: TrackingStatus =
      rating === "NONE"
        ? student.status === "INVALID"
          ? "INVALID"
          : student.files.length > 0
            ? "FOR_CHECKING"
            : "ASSIGNED"
        : "CHECKED";

    setPendingId(student.studentId);
    try {
      const res = await api.patch<CellResult>("/coordinator/review/cell", {
        kind: "weekly",
        studentId: student.studentId,
        itemId: data.requirementId,
        status,
        rating,
      });
      applyCell(student, res.data);
      notify.success(
        rating === "NONE"
          ? `Evaluation of ${nameOf(student)} cleared (${STATUS[res.data.cell.status].label}).`
          : `${heading} of ${nameOf(student)} set to ${RATING[rating].label} and marked Checked.`,
      );
    } catch (err) {
      notify.error(getErrorMessage(err, "Failed to update the evaluation."));
    } finally {
      setPendingId(null);
    }
  }

  async function saveHours(student: SubmissionStudent, hours: number | null) {
    if (!data) return;

    if (hours !== null && (Number.isNaN(hours) || hours < 0 || hours > 744)) {
      notify.error("Hours must be a number between 0 and 744.");
      return;
    }

    // Ang pagbabago ng hours ay laging may kumpirmasyon kasama ang status:
    // may hours = Checked, at kapag binura ang hours ng Checked, babalik ito sa For checking / Assigned
    if (hours !== null || student.status === "CHECKED") {
      const fallback: TrackingStatus = student.files.length > 0 ? "FOR_CHECKING" : "ASSIGNED";
      setPair({
        student,
        status: hours !== null ? "CHECKED" : fallback,
        rating: null,
        hours,
      });
      return;
    }

    // Ang hours at ang status ay magkasama: may hours = Checked
    const status: TrackingStatus =
      hours === null
        ? student.status === "INVALID"
          ? "INVALID"
          : student.files.length > 0
            ? "FOR_CHECKING"
            : "ASSIGNED"
        : "CHECKED";

    setPendingId(student.studentId);
    try {
      const res = await api.patch<CellResult>("/coordinator/review/cell", {
        kind: "dtr",
        studentId: student.studentId,
        itemId: data.requirementId,
        status,
        hours,
        clearHours: hours === null,
      });
      applyCell(student, res.data);
      notify.success(
        hours === null
          ? `${data.title} hours of ${nameOf(student)} cleared.`
          : `${formatHours(hours)} hours saved for ${nameOf(student)} (${data.title}) and marked Checked.`,
      );
    } catch (err) {
      notify.error(getErrorMessage(err, "Failed to save the hours."));
    } finally {
      setPendingId(null);
    }
  }

  async function savePair(student: SubmissionStudent, values: PairValues) {
    if (!data) return;

    const res = await api.patch<CellResult>("/coordinator/review/cell", {
      kind,
      studentId: student.studentId,
      itemId: data.requirementId,
      status: values.status,
      ...(kind === "weekly"
        ? { rating: values.rating }
        : { hours: values.hours, clearHours: values.hours === null }),
    });
    applyCell(student, res.data);
    notify.success(
      `${nameOf(student)}: ${heading} is now ${STATUS[res.data.cell.status].label}.`,
    );
  }

  // --- Bulk -----------------------------------------------------------

  const filteredIds = filtered.map((s) => s.studentId);
  const allChecked =
    filteredIds.length > 0 && filteredIds.every((id) => checked.has(id));

  function toggleOne(id: number) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setChecked((prev) => {
      const next = new Set(prev);
      if (allChecked) filteredIds.forEach((id) => next.delete(id));
      else filteredIds.forEach((id) => next.add(id));
      return next;
    });
  }

  async function bulkSet(status: TrackingStatus, rating?: WeeklyRating) {
    if (!data || checked.size === 0) return;

    const studentIds = [...checked];
    const path =
      kind === "document"
        ? "status"
        : kind === "weekly"
          ? "weekly-status"
          : "dtr-status";
    const body =
      kind === "document"
        ? { studentIds, requirementIds: [data.requirementId], status }
        : {
            studentIds,
            itemIds: [data.requirementId],
            status,
            rating: rating ?? null,
          };

    setBulkBusy(true);
    try {
      await postBulk(path, body, `Status set to ${STATUS[status].label}`);
      setChecked(new Set());
      setReloadToken((t) => t + 1);
    } catch (err) {
      notify.error(getErrorMessage(err, "The bulk action failed."));
    } finally {
      setBulkBusy(false);
    }
  }

  async function openFile(file: SubmissionFile) {
    if (file.kind === "LINK") {
      if (!file.url || !openExternalLink(file.url))
        notify.error("That link can't be opened.");
      return;
    }

    try {
      await openProtectedFile(
        `${API_BASE[kind]}/${requirementId}/submissions/${file.id}/file`,
        file.name,
      );
    } catch (err) {
      notify.error(
        err instanceof Error ? err.message : "Couldn't open the file.",
      );
    }
  }

  async function openMaterial(material: MaterialItem) {
    if (material.kind === "LINK") {
      if (!material.url || !openExternalLink(material.url))
        notify.error("That link can't be opened.");
      return;
    }

    try {
      await openProtectedFile(
        `/coordinator/requirements/${requirementId}/materials/${material.id}/file`,
        material.name,
      );
    } catch (err) {
      notify.error(
        err instanceof Error ? err.message : "Couldn't open the file.",
      );
    }
  }

  const activeTab: Tab = kind === "document" ? tab : "work";

  return (
    <DashboardLayout wide>
      <div className="mb-4 flex items-start gap-3">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Back to requirements"
          onClick={goBack}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold tracking-tight">
            {heading}
          </h1>
          {subtitle && (
            <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          )}
        </div>
        {data && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="ml-auto shrink-0"
            onClick={() => setEditOpen(true)}
          >
            <Pencil className="mr-1.5 h-3.5 w-3.5" />
            Edit {kind === "document" ? "requirement" : kind === "weekly" ? "week" : "month"}
          </Button>
        )}
      </div>

      {kind === "document" && (
        <nav className="mb-4 flex gap-1 border-b" aria-label="Sections">
          {(
            [
              { value: "instructions", label: "Instructions" },
              { value: "work", label: "Student work" },
            ] as { value: Tab; label: string }[]
          ).map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setTab(t.value)}
              className={cn(
                "-mb-px border-b-2 px-4 py-2.5 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                tab === t.value
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </button>
          ))}
        </nav>
      )}

      {current?.error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription className="flex items-center justify-between gap-4">
            {current.error}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setReloadToken((t) => t + 1)}
            >
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {loading && (
        <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
          <Skeleton className="h-96 w-full rounded-xl" />
          <Skeleton className="h-96 w-full rounded-xl" />
        </div>
      )}

      {data && kind === "document" && activeTab === "instructions" && (
        <div className="max-w-3xl rounded-xl border bg-card p-4 sm:p-6">
          <p className="mb-1 text-xs font-medium text-muted-foreground">
            Instructions
          </p>
          <p
            className={cn(
              "whitespace-pre-wrap text-sm",
              !data.instructions && "text-muted-foreground",
            )}
          >
            {data.instructions || "No instructions."}
          </p>

          <p className="mb-2 mt-6 text-xs font-medium text-muted-foreground">
            Attachments
          </p>
          {(data.materials ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No attachments.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {(data.materials ?? []).map((m) => (
                <MaterialChip
                  key={m.id}
                  kind={m.kind}
                  name={m.name}
                  url={m.url}
                  size={m.size}
                  contentType={m.contentType}
                  onOpen={() => void openMaterial(m)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {data && activeTab === "work" && (
        <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
          {/* Listahan ng mga student */}
          <aside className="flex min-w-0 flex-col rounded-xl border bg-card">
            <button
              type="button"
              onClick={() => setSelectedId(null)}
              className={cn(
                "flex items-center gap-3 border-b px-4 py-3 text-left text-sm font-medium outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring",
                selectedId === null && "bg-muted",
              )}
            >
              <Users className="h-4 w-4 text-muted-foreground" />
              All students
              <span className="ml-auto text-xs font-normal text-muted-foreground">
                {total}
              </span>
            </button>

            <div className="flex flex-col gap-2 border-b p-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search student..."
                  className="pl-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="[&>div]:w-full">
                <NativeSelect
                  aria-label="Filter"
                  className="w-full"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  {filterOptions(kind).map((o) => (
                    <NativeSelectOption key={o.value} value={o.value}>
                      {o.label}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>
            </div>

            {filtered.length > 0 && (
              <label className="flex cursor-pointer items-center gap-3 border-b px-4 py-2 text-xs text-muted-foreground hover:bg-muted">
                <input
                  type="checkbox"
                  checked={allChecked}
                  onChange={toggleAll}
                  className="h-4 w-4 accent-primary"
                />
                Select all ({filtered.length})
              </label>
            )}

            <div className="max-h-[60vh] overflow-y-auto">
              {filtered.length === 0 && (
                <p className="p-4 text-center text-sm text-muted-foreground">
                  No students found.
                </p>
              )}

              {filtered.map((s) => {
                const shown = display(kind, s);
                return (
                  <div
                    key={s.studentId}
                    className={cn(
                      "flex items-center gap-3 border-b pl-4 last:border-b-0 hover:bg-muted",
                      selectedId === s.studentId && "bg-muted",
                    )}
                  >
                    <input
                      type="checkbox"
                      aria-label={`Select ${nameOf(s)}`}
                      checked={checked.has(s.studentId)}
                      onChange={() => toggleOne(s.studentId)}
                      className="h-4 w-4 shrink-0 accent-primary"
                    />
                    <button
                      type="button"
                      onClick={() => setSelectedId(s.studentId)}
                      className="flex min-w-0 flex-1 items-center gap-3 py-2.5 pr-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <Initials student={s} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm">
                          {nameOf(s)}
                        </span>
                        <span
                          className={cn(
                            "block truncate text-xs",
                            shown.className,
                          )}
                        >
                          {shown.label}
                        </span>
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>
          </aside>

          {/* Kanang bahagi */}
          <section className="min-w-0 rounded-xl border bg-card p-4 sm:p-6">
            {checked.size > 0 && (
              <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2 text-sm">
                <span className="font-medium">{checked.size} selected</span>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    disabled={bulkBusy}
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                  >
                    <ListChecks className="h-3.5 w-3.5" />
                    Set status
                    <ChevronDown className="h-3 w-3 opacity-60" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    {STATUS_ORDER.map((status) => (
                      <DropdownMenuItem
                        key={status}
                        onClick={() => void bulkSet(status)}
                      >
                        {status === "CHECKED" && kind === "weekly"
                          ? "Checked (keep each evaluation)"
                          : status === "CHECKED" && kind === "dtr"
                            ? "Checked (use each student's hours)"
                            : STATUS[status].label}
                      </DropdownMenuItem>
                    ))}
                    {kind === "weekly" &&
                      (["EXCELLENT", "VERY_GOOD", "GOOD", "POOR"] as WeeklyRating[]).map(
                        (rating) => (
                          <DropdownMenuItem
                            key={rating}
                            onClick={() => void bulkSet("CHECKED", rating)}
                          >
                            Checked · {RATING[rating].label}
                          </DropdownMenuItem>
                        ),
                      )}
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={bulkBusy}
                  onClick={() => setChecked(new Set())}
                >
                  Clear
                </Button>
                {kind === "dtr" && (
                  <span className="text-xs text-muted-foreground">
                    Checked needs hours. Students without hours are skipped.
                  </span>
                )}
                {kind === "weekly" && (
                  <span className="text-xs text-muted-foreground">
                    Checked needs an evaluation. Other statuses clear it.
                  </span>
                )}
              </div>
            )}

            {selected === null ? (
              <>
                <h2 className="text-lg font-medium">{heading}</h2>

                <div className="mt-4 flex flex-wrap gap-x-10 gap-y-3 border-b pb-5">
                  <div>
                    <p className="text-3xl font-light leading-none">
                      {turnedIn}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Turned in
                    </p>
                  </div>
                  <div>
                    <p className="text-3xl font-light leading-none">
                      {total - turnedIn}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Not submitted
                    </p>
                  </div>
                  <div>
                    <p className="text-3xl font-light leading-none">
                      {kind === "document" ? total : done}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {kind === "document" ? "Students" : "Checked"}
                    </p>
                  </div>
                </div>

                {total === 0 ? (
                  <p className="py-12 text-center text-sm text-muted-foreground">
                    No students in this semester yet.
                  </p>
                ) : filtered.length === 0 ? (
                  <p className="py-12 text-center text-sm text-muted-foreground">
                    No students match the filter.
                  </p>
                ) : (
                  <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {filtered.map((s) => {
                      const shown = display(kind, s);
                      return (
                        <div key={s.studentId} className="relative">
                          <input
                            type="checkbox"
                            aria-label={`Select ${nameOf(s)}`}
                            checked={checked.has(s.studentId)}
                            onChange={() => toggleOne(s.studentId)}
                            className="absolute right-3 top-3 h-4 w-4 accent-primary"
                          />
                          <button
                            type="button"
                            onClick={() => setSelectedId(s.studentId)}
                            className="flex w-full flex-col gap-3 rounded-xl border bg-background p-3 text-left outline-none transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <span className="flex min-w-0 items-center gap-2 pr-6">
                              <Initials
                                student={s}
                                className="h-7 w-7 text-[11px]"
                              />
                              <span className="truncate text-sm">
                                {nameOf(s)}
                              </span>
                            </span>

                            <span className="flex min-h-12 min-w-0 items-center rounded-md bg-muted/50 px-2 py-2">
                              <FileSummary files={s.files} />
                            </span>

                            <span
                              className={cn(
                                "text-xs font-medium",
                                shown.className,
                              )}
                            >
                              {shown.label}
                            </span>

                            {kind === "dtr" && (
                              <span className="text-xs text-muted-foreground">
                                Total {formatHours(extras[s.studentId]?.renderedHours ?? 0)}
                                {" · To render "}
                                {extras[s.studentId]?.trainingDuration == null
                                  ? "—"
                                  : formatHours(
                                      Math.max(
                                        0,
                                        (extras[s.studentId]?.trainingDuration ?? 0) -
                                          (extras[s.studentId]?.renderedHours ?? 0),
                                      ),
                                    )}
                              </span>
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setSelectedId(null)}
                  className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  All students
                </button>

                <div className="flex flex-wrap items-center gap-3 border-b pb-4">
                  <Initials student={selected} className="h-10 w-10 text-sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-lg font-medium">
                      {nameOf(selected)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {selected.studentNumber}
                    </p>
                  </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        Status
                      </span>
                      <NativeSelect
                        aria-label="Status"
                        value={selected.status}
                        disabled={pendingId === selected.studentId}
                        onChange={(e) =>
                          void changeStatus(
                            selected,
                            e.target.value as TrackingStatus,
                          )
                        }
                      >
                        {STATUS_ORDER.map((status) => (
                          <NativeSelectOption key={status} value={status}>
                            {STATUS[status].label}
                          </NativeSelectOption>
                        ))}
                      </NativeSelect>
                    </div>

                  {kind === "weekly" && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        Evaluation
                      </span>
                      <NativeSelect
                        aria-label="Evaluation"
                        value={selected.rating ?? "NONE"}
                        disabled={pendingId === selected.studentId}
                        onChange={(e) =>
                          void changeRating(
                            selected,
                            e.target.value as WeeklyRating,
                          )
                        }
                      >
                        {RATING_ORDER.map((rating) => (
                          <NativeSelectOption key={rating} value={rating}>
                            {RATING[rating].label}
                          </NativeSelectOption>
                        ))}
                      </NativeSelect>
                    </div>
                  )}

                  {kind === "dtr" && (
                    <HoursEditor
                      key={selected.studentId}
                      value={selected.hours ?? null}
                      pending={pendingId === selected.studentId}
                      onSave={(hours) => void saveHours(selected, hours)}
                    />
                  )}
                </div>

                {kind === "dtr" && (
                  <DtrFigures extra={extras[selected.studentId]} />
                )}

                <p className="mb-2 mt-5 text-xs font-medium text-muted-foreground">
                  Student's work
                </p>
                {selected.files.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {isTurnedIn(kind, selected)
                      ? "No file is attached. This was recorded by you."
                      : "This student hasn't submitted anything yet."}
                  </p>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {selected.files.map((f) => (
                      <MaterialChip
                        key={f.id}
                        kind={f.kind}
                        name={f.name}
                        url={f.url}
                        onOpen={() => void openFile(f)}
                      />
                    ))}
                  </div>
                )}

                {kind === "weekly" && selected.comment && (
                  <div className="mt-5">
                    <p className="mb-1 text-xs font-medium text-muted-foreground">
                      Supervisor's comment
                    </p>
                    <p className="whitespace-pre-wrap rounded-md bg-muted/50 px-3 py-2 text-sm">
                      {selected.comment}
                    </p>
                  </div>
                )}

                <PrivateComments
                  key={`${kind}-${data.requirementId}-${selected.studentId}`}
                  path={commentsPath(selected.studentId)}
                  studentName={nameOf(selected)}
                />
              </>
            )}
          </section>
        </div>
      )}

      {editOpen && data && (
        <EditRequirementDialog
          kind={kind}
          requirementId={data.requirementId}
          title={data.title}
          instructions={data.instructions}
          dueDate={data.dueDate}
          dateFrom={data.dateFrom ? String(data.dateFrom) : null}
          dateTo={data.dateTo ? String(data.dateTo) : null}
          onOpenChange={setEditOpen}
          onSaved={() => setReloadToken((t) => t + 1)}
        />
      )}

      {pair && (
        <StatusPairDialog
          key={`${pair.student.studentId}-${pair.status}`}
          kind={kind === "weekly" ? "weekly" : "dtr"}
          studentName={nameOf(pair.student)}
          itemLabel={heading}
          initialStatus={pair.status}
          initialRating={
            pair.rating && pair.rating !== "NONE"
              ? (pair.rating as ReviewRating)
              : null
          }
          initialHours={pair.hours}
          hasFile={pair.student.files.length > 0}
          onOpenChange={(open) => {
            if (!open) setPair(null);
          }}
          onSubmit={(values) => savePair(pair.student, values)}
        />
      )}
    </DashboardLayout>
  );
}
