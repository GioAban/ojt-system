import { useEffect, useMemo, useState } from "react";
import {
  Check,
  ChevronDown,
  CircleCheck,
  CircleDashed,
  CircleX,
  Clock,
  Eye,
  EyeOff,
  Plus,
  Search,
} from "lucide-react";
import api from "@/lib/api";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { formatLongDate, todayIso } from "@/lib/dates";
import { getErrorMessage } from "@/lib/errors";
import { notify } from "@/lib/notify";
import { cn } from "@/lib/utils";
import { useSectionData, useSemesterSelection } from "@/hooks/useTracking";
import type {
  EmployabilityLevel,
  JobRelated,
  RequirementType,
  TrackingData,
  TrackingRequirement,
  TrackingStatus,
  TrackingStudent,
} from "@/types/tracking";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PageHeader } from "@/components/PageHeader";
import { DataTablePagination } from "@/components/DataTablePagination";
import { AddRequirementDialog } from "@/components/tracking/AddRequirementDialog";
import { AssignCompanyDialog } from "@/components/tracking/AssignCompanyDialog";
import {
  ChoiceCell,
  type ChoiceOption,
} from "@/components/tracking/ChoiceCell";
import { CompanyCell } from "@/components/tracking/CompanyCell";
import { CompleteOjtDialog } from "@/components/tracking/CompleteOjtDialog";
import { CompletionCell } from "@/components/tracking/CompletionCell";
import { DateCell } from "@/components/tracking/DateCell";
import { DtrPanel } from "@/components/tracking/DtrPanel";
import { MoaCell, type MoaValue } from "@/components/tracking/MoaCell";
import {
  PLACEMENT_OPTIONS,
  PlacementStatusCell,
  type PlacementKey,
} from "@/components/tracking/PlacementStatusCell";
import { ReviewDialog } from "@/components/tracking/ReviewDialog";
import {
  SELECT_COL,
  STUDENT_COLS_WIDTH,
  StudentCells,
  StudentColGroup,
  StudentHeadCells,
  formatStudentName,
} from "@/components/tracking/StudentColumns";
import { ColumnsMenu, useHiddenColumns } from "@/components/tracking/ColumnsMenu";
import { HeaderLink } from "@/components/tracking/HeaderLink";
import { WeeklyPanel } from "@/components/tracking/WeeklyPanel";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RequirementsBulkActions } from "@/components/tracking/BulkActions";
import { useRowSelection } from "@/hooks/useRowSelection";

type View = "requirements" | "weekly" | "dtr";
type EmploymentField = "hiredDate" | "jobRelated" | "employabilityLevel";
type PlacementFilter = "all" | "with" | "without";
type OjtFilter = "all" | "completed" | "pending";

// Dito lumalabas ang Weekly reports at DTR (gawing "post" para ilipat sa Post-deployment)
const REPORTS_TAB: RequirementType = "pre";

// Mga tab na may MOA, Company, at Department columns
const PLACEMENT_TYPES: RequirementType[] = ["initial"];

// Mga tab na may OJT status at ang hating Employment/Prediction columns
const COMPLETION_TYPES: RequirementType[] = ["post"];

const VIEWS: { value: View; label: string }[] = [
  { value: "requirements", label: "Requirements" },
  { value: "weekly", label: "Weekly reports" },
  { value: "dtr", label: "DTR" },
];

const COL = { requirement: 74, moa: 112, status: 132, completion: 300 };

// Kanang bahagi ng hati sa Post-deployment
const EMPLOYMENT_COL = {
  hired: 150,
  job: 140,
  level: 112,
  predicted: 112,
  confidence: 100,
  predictedAt: 140,
};
const EMPLOYMENT_WIDTH = Object.values(EMPLOYMENT_COL).reduce(
  (sum, w) => sum + w,
  0,
);

// Ang hiwalay na column na naghahati sa kaliwa at kanan
const DIVIDER_COL = 16;
const DIVIDER_CELL = "border-x border-x-foreground/25 bg-foreground/10 p-0";

const GROUP_LABEL =
  "h-8 px-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground";

const STATUS_CONFIG: Record<
  TrackingStatus,
  {
    label: string;
    short: string;
    Icon: typeof CircleCheck;
    iconClass: string;
    chipClass: string;
  }
> = {
  ASSIGNED: {
    label: "Assigned",
    short: "Assigned",
    Icon: CircleDashed,
    iconClass: "text-muted-foreground/60",
    chipClass: "border-dashed text-muted-foreground hover:bg-muted",
  },
  FOR_CHECKING: {
    label: "For checking",
    short: "Checking",
    Icon: Clock,
    iconClass: "text-amber-500",
    chipClass:
      "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  },
  CHECKED: {
    label: "Checked",
    short: "Checked",
    Icon: CircleCheck,
    iconClass: "text-emerald-600 dark:text-emerald-400",
    chipClass:
      "border-emerald-600/30 bg-emerald-600/10 text-emerald-700 dark:text-emerald-400",
  },
  INVALID: {
    label: "Invalid",
    short: "Invalid",
    Icon: CircleX,
    iconClass: "text-destructive",
    chipClass: "border-destructive/30 bg-destructive/10 text-destructive",
  },
};

// Lahat ay pwedeng piliin, kasama ang Assigned para maibalik ang status
const STATUS_ORDER: TrackingStatus[] = [
  "ASSIGNED",
  "FOR_CHECKING",
  "CHECKED",
  "INVALID",
];

const JOB_CONFIG: Record<JobRelated, { label: string; chipClass: string }> = {
  RELATED: {
    label: "Related",
    chipClass:
      "border-emerald-600/30 bg-emerald-600/10 text-emerald-700 dark:text-emerald-400",
  },
  SOMEWHAT_RELATED: {
    label: "Somewhat related",
    chipClass: "border-sky-600/30 bg-sky-600/10 text-sky-700 dark:text-sky-400",
  },
  UNRELATED: {
    label: "Unrelated",
    chipClass:
      "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  },
};

const LEVEL_CONFIG: Record<
  EmployabilityLevel,
  { label: string; chipClass: string }
> = {
  HIGH: {
    label: "High",
    chipClass:
      "border-emerald-600/30 bg-emerald-600/10 text-emerald-700 dark:text-emerald-400",
  },
  AVERAGE: {
    label: "Average",
    chipClass:
      "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  },
  LOW: {
    label: "Low",
    chipClass: "border-destructive/30 bg-destructive/10 text-destructive",
  },
};

const JOB_OPTIONS: ChoiceOption<JobRelated>[] = (
  Object.keys(JOB_CONFIG) as JobRelated[]
).map((value) => ({ value, ...JOB_CONFIG[value] }));

const LEVEL_OPTIONS: ChoiceOption<EmployabilityLevel>[] = (
  Object.keys(LEVEL_CONFIG) as EmployabilityLevel[]
).map((value) => ({ value, ...LEVEL_CONFIG[value] }));

const TYPE_LABELS: Record<RequirementType, string> = {
  initial: "initial",
  pre: "pre-deployment",
  post: "post-deployment",
};

interface EmploymentResult {
  hiredDate: string | null;
  jobRelated: JobRelated | null;
  employabilityLevel: EmployabilityLevel | null;
}

interface FilterChipsProps<T extends string> {
  value: T;
  options: { value: T; label: string; count: number }[];
  onChange: (value: T) => void;
}

function FilterChips<T extends string>({
  value,
  options,
  onChange,
}: FilterChipsProps<T>) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-1">
      <span className="mr-1 text-xs text-muted-foreground">Show</span>
      {options.map((option) => (
        <Button
          key={option.value}
          type="button"
          size="sm"
          variant={value === option.value ? "default" : "outline"}
          onClick={() => onChange(option.value)}
        >
          {option.label} ({option.count})
        </Button>
      ))}
    </div>
  );
}

interface StatusCellProps {
  status: TrackingStatus;
  title: string;
  pending: boolean;
  onChange: (status: TrackingStatus) => void;
  onView: () => void;
}

function StatusCell({ status, title, pending, onChange, onView }: StatusCellProps) {
  const config = STATUS_CONFIG[status];
  const tooltip =
    status === "ASSIGNED"
      ? `${title}: ${config.label} (nothing submitted yet)`
      : `${title}: ${config.label}`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={pending}
        title={tooltip}
        aria-label={`${tooltip}. Change status`}
        className={cn(
          "inline-flex h-6 w-full items-center justify-between gap-0.5 rounded-md border px-1.5 text-[10px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring",
          config.chipClass,
          pending && "opacity-40",
        )}
      >
        <span className="truncate">{config.short}</span>
        <ChevronDown className="h-2.5 w-2.5 shrink-0 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center">
        <DropdownMenuItem className="gap-2" onClick={onView}>
          <Eye className="h-4 w-4 text-muted-foreground" />
          <span className="flex-1">View work</span>
        </DropdownMenuItem>
        {STATUS_ORDER.map((option) => {
          const optionConfig = STATUS_CONFIG[option];
          return (
            <DropdownMenuItem
              key={option}
              className="gap-2"
              onClick={() => {
                if (option !== status) onChange(option);
              }}
            >
              <optionConfig.Icon
                className={cn("h-4 w-4", optionConfig.iconClass)}
              />
              <span className="flex-1">{optionConfig.label}</span>
              {option === status && (
                <Check className="h-4 w-4 text-muted-foreground" />
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function Tracking() {
  const {
    semesters,
    loaded: semestersLoaded,
    error: semestersError,
    semesterId,
  } = useSemesterSelection();

  const [type, setType] = useState<RequirementType>("initial");
  const [view, setView] = useState<View>("requirements");
  const [reviewTarget, setReviewTarget] = useState<{
    student: TrackingStudent;
    requirement: TrackingRequirement;
  } | null>(null);

  const [search, setSearch] = useState("");
  // Mga column na itinago (ang Department ay nakatago sa simula)
  const columns = useHiddenColumns(`tracking-${type}`, ["department"]);
  const showDepartment = !columns.isHidden("department");
  const showMoa = !columns.isHidden("moa");
  const showStatusCol = !columns.isHidden("status");
  const showCompanyCol = !columns.isHidden("company");
  const [placementFilter, setPlacementFilter] =
    useState<PlacementFilter>("all");
  const [ojtFilter, setOjtFilter] = useState<OjtFilter>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [prevSemesterId, setPrevSemesterId] = useState(semesterId);
  if (prevSemesterId !== semesterId) {
    setPrevSemesterId(semesterId);
    setPage(1);
  }
  const [pendingCell, setPendingCell] = useState<string | null>(null);
  const [pendingMoa, setPendingMoa] = useState<number | null>(null);
  const [pendingPlacement, setPendingPlacement] = useState<number | null>(null);
  const [placementConfirm, setPlacementConfirm] = useState<{
    student: TrackingStudent;
    status: PlacementKey;
  } | null>(null);
  const [pendingEmployment, setPendingEmployment] = useState<string | null>(
    null,
  );
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState("");
  const [assignTarget, setAssignTarget] = useState<TrackingStudent | null>(
    null,
  );
  const [completeTarget, setCompleteTarget] = useState<TrackingStudent | null>(
    null,
  );

  const [addRequirementOpen, setAddRequirementOpen] = useState(false);
  const [addWeekOpen, setAddWeekOpen] = useState(false);
  const [addMonthOpen, setAddMonthOpen] = useState(false);

  const showPlacement = PLACEMENT_TYPES.includes(type);
  const showCompletion = COMPLETION_TYPES.includes(type);
  const hasSubViews = type === REPORTS_TAB;
  const activeView: View = hasSubViews ? view : "requirements";

  const { data, error, loading, reload, refresh, update } =
    useSectionData<TrackingData>("/coordinator/tracking", semesterId, { type });

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  const semesterName =
    semesters.find((s) => s.id === semesterId)?.semester ?? "";

  const allStudents = data?.students ?? [];
  const placementCounts = {
    all: allStudents.length,
    with: allStudents.filter((s) => s.companyName !== null).length,
    without: allStudents.filter((s) => s.companyName === null).length,
  };
  const ojtCounts = {
    all: allStudents.length,
    completed: allStudents.filter((s) => s.status === "Completed").length,
    pending: allStudents.filter((s) => s.status !== "Completed").length,
  };

  const filtered = useMemo(() => {
    let rows = data?.students ?? [];

    if (showPlacement && placementFilter !== "all") {
      rows = rows.filter((s) =>
        placementFilter === "with"
          ? s.companyName !== null
          : s.companyName === null,
      );
    }

    if (showCompletion && ojtFilter !== "all") {
      rows = rows.filter((s) =>
        ojtFilter === "completed"
          ? s.status === "Completed"
          : s.status !== "Completed",
      );
    }

    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((s) =>
      `${s.lastname} ${s.firstname} ${s.studentNumber} ${showPlacement ? (s.companyName ?? "") : ""}`
        .toLowerCase()
        .includes(q),
    );
  }, [data, search, showPlacement, showCompletion, placementFilter, ojtFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );
  const offset = (currentPage - 1) * pageSize;

  const selection = useRowSelection(
    filtered.map((s) => s.id),
    pageRows.map((s) => s.id),
    String(semesterId),
  );

  const visibleRequirements = (data?.requirements ?? []).filter(
    (r) => !columns.isHidden(`req:${r.id}`),
  );
  const requirementCount = visibleRequirements.length;
  const columnOptions = [
    ...(data?.requirements ?? []).map((r) => ({
      key: `req:${r.id}`,
      label: r.title,
    })),
    ...(showPlacement
      ? [
          { key: "moa", label: "MOA" },
          { key: "status", label: "Status" },
          { key: "company", label: "Company" },
          { key: "department", label: "Department" },
        ]
      : []),
  ];
  const tableMinWidth =
    STUDENT_COLS_WIDTH +
    SELECT_COL +
    requirementCount * COL.requirement +
    (showPlacement
      ? (showMoa ? COL.moa : 0) +
        (showStatusCol ? COL.status : 0) +
        (showCompanyCol ? 180 : 0) +
        (showDepartment ? 160 : 0)
      : showCompletion
        ? COL.completion + DIVIDER_COL + EMPLOYMENT_WIDTH + 24
        : 120);
  const emptyColSpan =
    5 +
    requirementCount +
    (showPlacement
      ? (showMoa ? 1 : 0) +
        (showStatusCol ? 1 : 0) +
        (showCompanyCol ? 1 : 0) +
        (showDepartment ? 1 : 0)
      : showCompletion
        ? 9
        : 1);

  const addLabel =
    activeView === "weekly"
      ? "Add week"
      : activeView === "dtr"
        ? "Add month"
        : "Add requirement";

  function openAdd() {
    if (activeView === "weekly") setAddWeekOpen(true);
    else if (activeView === "dtr") setAddMonthOpen(true);
    else setAddRequirementOpen(true);
  }

  function updateStudent(studentId: number, patch: Partial<TrackingStudent>) {
    update((d) => ({
      ...d,
      students: d.students.map((s) =>
        s.id === studentId ? { ...s, ...patch } : s,
      ),
    }));
  }

  function applyStatus(
    studentId: number,
    requirementId: number,
    status: TrackingStatus,
  ) {
    update((d) => ({
      ...d,
      students: d.students.map((s) =>
        s.id === studentId
          ? {
              ...s,
              statuses: { ...s.statuses, [String(requirementId)]: status },
            }
          : s,
      ),
    }));
  }

  async function changeStatus(
    student: TrackingStudent,
    requirement: TrackingRequirement,
    status: TrackingStatus,
  ) {
    setPendingCell(`${student.id}-${requirement.id}`);
    setActionError("");

    try {
      await api.patch("/coordinator/tracking/status", {
        studentId: student.id,
        requirementId: requirement.id,
        status,
      });
      applyStatus(student.id, requirement.id, status);
    } catch (err) {
      setActionError(getErrorMessage(err, "Failed to update the status."));
    } finally {
      setPendingCell(null);
    }
  }

  async function changePlacement(
    student: TrackingStudent,
    status: PlacementKey,
    removePlacement = false,
  ) {
    // Ang Deployed ay nangangailangan ng company: buksan ang pag-assign
    if (status === "DEPLOYED" && student.companyName === null) {
      setAssignTarget(student);
      setNotice(
        `Assign a company to ${formatStudentName(student)} to mark them as Deployed.`,
      );
      return;
    }

    // Ang pag-alis sa Deployed ay nag-aalis din ng company: magtanong muna
    if (status !== "DEPLOYED" && student.companyName !== null && !removePlacement) {
      setPlacementConfirm({ student, status });
      return;
    }

    setPendingPlacement(student.id);
    setActionError("");
    try {
      const res = await api.patch<{ status: string; placementRemoved: boolean }>(
        "/coordinator/placement/status",
        { studentId: student.id, status, removePlacement },
      );
      updateStudent(student.id, {
        status: res.data.status,
        ...(res.data.placementRemoved
          ? { companyName: null, departmentName: null }
          : {}),
      });
      setNotice(
        `${formatStudentName(student)} is now ${res.data.status}${
          res.data.placementRemoved ? " and was removed from the company" : ""
        }.`,
      );
      // Isabay sa server para tama ang Company at Department
      await refresh();
    } catch (err) {
      setActionError(getErrorMessage(err, "Failed to update the status."));
      await refresh();
    } finally {
      setPendingPlacement(null);
    }
  }

  async function changeMoa(student: TrackingStudent, value: MoaValue) {
    setPendingMoa(student.id);
    setActionError("");

    try {
      const res = await api.patch<{ moaStatus: string }>(
        `/coordinator/students/${student.id}/moa`,
        { status: value },
      );
      updateStudent(student.id, { moaStatus: res.data.moaStatus });
    } catch (err) {
      setActionError(getErrorMessage(err, "Failed to update the MOA status."));
    } finally {
      setPendingMoa(null);
    }
  }

  async function saveEmployment(
    student: TrackingStudent,
    field: EmploymentField,
    value: string | null,
  ) {
    const name = formatStudentName(student);
    setPendingEmployment(`${student.id}-${field}`);

    try {
      const res = await api.patch<EmploymentResult>(
        `/coordinator/students/${student.id}/employment`,
        { [field]: value },
      );
      updateStudent(student.id, {
        hiredDate: res.data.hiredDate,
        jobRelated: res.data.jobRelated,
        employabilityLevel: res.data.employabilityLevel,
      });

      if (field === "hiredDate") {
        notify.success(
          res.data.hiredDate
            ? `Hired date of ${name} set to ${formatLongDate(res.data.hiredDate)}.`
            : `Hired date of ${name} cleared.`,
        );
      } else if (field === "jobRelated") {
        notify.success(
          res.data.jobRelated
            ? `Job of ${name} marked as ${JOB_CONFIG[res.data.jobRelated].label.toLowerCase()} to the course.`
            : `Job relation of ${name} cleared.`,
        );
      } else {
        notify.success(
          res.data.employabilityLevel
            ? `Employability of ${name} set to ${LEVEL_CONFIG[res.data.employabilityLevel].label}.`
            : `Employability of ${name} cleared.`,
        );
      }
    } catch (err) {
      notify.error(getErrorMessage(err, "Failed to save the change."));
    } finally {
      setPendingEmployment(null);
    }
  }

  function handleRequirementAdded(requirement: TrackingRequirement) {
    setNotice(
      `"${requirement.title}" was added to ${TYPE_LABELS[type]} requirements.`,
    );

    if (!data) {
      reload();
      return;
    }

    update((d) => ({
      ...d,
      requirements: [...d.requirements, requirement],
      students: d.students.map((s) => ({
        ...s,
        statuses: {
          ...s.statuses,
          [String(requirement.id)]: "ASSIGNED" as TrackingStatus,
        },
      })),
    }));
  }

  const noSemester = semestersLoaded && semesterId === null && !semestersError;

  return (
    <DashboardLayout wide>
      <PageHeader
        title="Tracking"
        description="Monitor student requirements, weekly reports, daily time records, MOA, and company placement."
      />

      <div className="mb-3 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <Tabs
          value={type}
          onValueChange={(value) => {
            setType(value as RequirementType);
            setPage(1);
          }}
        >
          <TabsList>
            <TabsTrigger value="initial">Initial</TabsTrigger>
            <TabsTrigger value="pre">Pre-deployment</TabsTrigger>
            <TabsTrigger value="post">Post-deployment</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-56">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={
                activeView === "requirements" && showPlacement
                  ? "Search student or company..."
                  : "Search student..."
              }
              className="pl-9"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>

          {activeView === "requirements" && (
            <ColumnsMenu
              options={columnOptions}
              hidden={columns.hidden}
              onToggle={columns.toggle}
              onShowAll={columns.showAll}
              onHideAll={() => columns.setHidden(columnOptions.map((o) => o.key))}
            />
          )}

          {activeView === "requirements" && showPlacement && (
            <Button
              type="button"
              variant={showDepartment ? "default" : "outline"}
              onClick={() => columns.toggle("department")}
            >
              {showDepartment ? (
                <Eye className="h-4 w-4" />
              ) : (
                <EyeOff className="h-4 w-4" />
              )}
              Department
            </Button>
          )}

          <Button
            type="button"
            disabled={
              semesterId === null || (activeView === "requirements" && loading)
            }
            onClick={openAdd}
          >
            <Plus className="h-4 w-4" />
            {addLabel}
          </Button>
        </div>
      </div>

      {hasSubViews && (
        <nav
          className="mb-4 flex gap-1 border-b"
          aria-label="Pre-deployment sections"
        >
          {VIEWS.map((v) => (
            <button
              key={v.value}
              type="button"
              onClick={() => {
                setView(v.value);
                setPage(1);
              }}
              className={cn(
                "-mb-px border-b-2 px-3 py-2 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                activeView === v.value
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {v.label}
            </button>
          ))}
        </nav>
      )}

      {semestersError && (
        <Alert variant="destructive" className="mb-3">
          <AlertDescription>{semestersError}</AlertDescription>
        </Alert>
      )}

      <RequirementsBulkActions
        selection={selection}
        filteredTotal={filtered.length}
        requirements={data?.requirements ?? []}
        showPlacement={showPlacement}
        showCompletion={showCompletion}
        onDone={refresh}
      />

      {noSemester && (
        <div className="isolate rounded-xl border bg-card">
          <p className="py-16 text-center text-sm text-muted-foreground">
            No active semester found. Ask the director to add one.
          </p>
        </div>
      )}

      {semesterId !== null && activeView === "weekly" && (
        <WeeklyPanel
          semesterId={semesterId}
          semesterName={semesterName}
          search={search}
          addOpen={addWeekOpen}
          onAddOpenChange={setAddWeekOpen}
        />
      )}

      {semesterId !== null && activeView === "dtr" && (
        <DtrPanel
          semesterId={semesterId}
          semesterName={semesterName}
          search={search}
          addOpen={addMonthOpen}
          onAddOpenChange={setAddMonthOpen}
        />
      )}

      {semesterId !== null && activeView === "requirements" && (
        <>
          {data &&
            (data.requirements.length > 0 || showCompletion) &&
            showPlacement && (
              <FilterChips<PlacementFilter>
                value={placementFilter}
                options={[
                  { value: "all", label: "All", count: placementCounts.all },
                  {
                    value: "with",
                    label: "With company",
                    count: placementCounts.with,
                  },
                  {
                    value: "without",
                    label: "No company",
                    count: placementCounts.without,
                  },
                ]}
                onChange={(value) => {
                  setPlacementFilter(value);
                  setPage(1);
                }}
              />
            )}

          {data && showCompletion && (
            <FilterChips<OjtFilter>
              value={ojtFilter}
              options={[
                { value: "all", label: "All", count: ojtCounts.all },
                {
                  value: "completed",
                  label: "Completed",
                  count: ojtCounts.completed,
                },
                {
                  value: "pending",
                  label: "Not completed",
                  count: ojtCounts.pending,
                },
              ]}
              onChange={(value) => {
                setOjtFilter(value);
                setPage(1);
              }}
            />
          )}

          <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {(Object.keys(STATUS_CONFIG) as TrackingStatus[]).map((status) => {
              const { chipClass, label } = STATUS_CONFIG[status];
              return (
                <span
                  key={status}
                  className={cn(
                    "inline-flex h-5 items-center rounded-md border px-1.5 text-[10px] font-medium",
                    chipClass,
                  )}
                >
                  {label}
                </span>
              );
            })}
            <span className="text-muted-foreground/70">
              · Use the dropdown in each cell to change a status. Choose
              Assigned to reset it.
            </span>
            {data && (
              <span className="ml-auto">
                {filtered.length} of {data.students.length} students ·{" "}
                {data.requirements.length} requirements
              </span>
            )}
          </div>

          {notice && (
            <Alert className="mb-3">
              <AlertDescription>{notice}</AlertDescription>
            </Alert>
          )}

          {actionError && (
            <Alert variant="destructive" className="mb-3">
              <AlertDescription>{actionError}</AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert variant="destructive" className="mb-3">
              <AlertDescription className="flex items-center justify-between gap-4">
                {error}
                <Button variant="outline" size="sm" onClick={reload}>
                  Retry
                </Button>
              </AlertDescription>
            </Alert>
          )}

          <div className="isolate rounded-xl border bg-card">
            {loading && (
              <div className="flex flex-col gap-2 p-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            )}

            {data && data.requirements.length === 0 && !showCompletion && (
              <div className="flex flex-col items-center gap-3 py-16">
                <p className="text-sm text-muted-foreground">
                  No {TYPE_LABELS[type]} requirements have been created for this
                  semester yet.
                </p>
                <Button
                  type="button"
                  onClick={() => setAddRequirementOpen(true)}
                >
                  <Plus className="h-4 w-4" />
                  Add requirement
                </Button>
              </div>
            )}

            {data && (data.requirements.length > 0 || showCompletion) && (
              <>
                <Table
                  className="table-fixed text-xs"
                  style={{ minWidth: tableMinWidth }}
                >
                  <colgroup>
                    <StudentColGroup selectable />
                    {visibleRequirements.map((r) => (
                      <col key={r.id} style={{ width: COL.requirement }} />
                    ))}
                    {showPlacement ? (
                      <>
                        {showMoa && <col style={{ width: COL.moa }} />}
                        {showStatusCol && <col style={{ width: COL.status }} />}
                        {showCompanyCol && <col />}
                        {showDepartment && <col />}
                      </>
                    ) : showCompletion ? (
                      <>
                        <col style={{ width: COL.completion }} />
                        <col style={{ width: DIVIDER_COL }} />
                        <col style={{ width: EMPLOYMENT_COL.hired }} />
                        <col style={{ width: EMPLOYMENT_COL.job }} />
                        <col style={{ width: EMPLOYMENT_COL.level }} />
                        <col style={{ width: EMPLOYMENT_COL.predicted }} />
                        <col style={{ width: EMPLOYMENT_COL.confidence }} />
                        <col style={{ width: EMPLOYMENT_COL.predictedAt }} />
                        <col />
                      </>
                    ) : (
                      <col /> /* sasalo sa natitirang lapad */
                    )}
                  </colgroup>

                  <TableHeader>
                    {showCompletion && (
                      <TableRow className="hover:bg-transparent">
                        <TableHead
                          colSpan={5 + requirementCount + 1}
                          className={GROUP_LABEL}
                        >
                          Requirements &amp; OJT
                        </TableHead>
                        <TableHead className={cn("h-8", DIVIDER_CELL)} />
                        <TableHead colSpan={3} className={GROUP_LABEL}>
                          Employment
                        </TableHead>
                        <TableHead colSpan={4} className={GROUP_LABEL}>
                          Prediction (model output)
                        </TableHead>
                      </TableRow>
                    )}

                    <TableRow>
                      <StudentHeadCells
                        className="h-16"
                        selection={{
                          checked: selection.pageChecked,
                          indeterminate: selection.pageIndeterminate,
                          onChange: selection.togglePage,
                        }}
                      />

                      {visibleRequirements.map((r) => (
                        <TableHead
                          key={r.id}
                          className="h-16 whitespace-normal px-1 pb-2 text-center align-bottom"
                        >
                          <HeaderLink
                            to={`/coordinator/document-requirements/${r.id}/submissions`}
                            title={
                              r.dueDate
                                ? `${r.title} · due ${new Date(
                                    r.dueDate,
                                  ).toLocaleDateString("en-PH", {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                  })} · open the students' submissions`
                                : `${r.title} · open the students' submissions`
                            }
                          >
                            <span className="block text-[10px] font-medium leading-tight">
                              {r.title}
                            </span>
                          </HeaderLink>
                        </TableHead>
                      ))}

                      {showPlacement ? (
                        <>
                          {showMoa && (
                            <TableHead className="h-16 px-2 pb-2 align-bottom">
                              MOA
                            </TableHead>
                          )}
                          {showStatusCol && (
                            <TableHead className="h-16 px-2 pb-2 align-bottom">
                              Status
                            </TableHead>
                          )}
                          {showCompanyCol && (
                            <TableHead className="h-16 px-2 pb-2 align-bottom">
                              Company
                            </TableHead>
                          )}
                          {showDepartment && (
                            <TableHead className="h-16 px-2 pb-2 align-bottom">
                              Department
                            </TableHead>
                          )}
                        </>
                      ) : showCompletion ? (
                        <>
                          <TableHead className="h-16 px-2 pb-2 align-bottom">
                            OJT status
                          </TableHead>
                          <TableHead className={cn("h-16", DIVIDER_CELL)} />
                          <TableHead className="h-16 px-2 pb-2 align-bottom">
                            Hired date
                          </TableHead>
                          <TableHead className="h-16 whitespace-normal px-2 pb-2 align-bottom leading-tight">
                            Job related to course
                          </TableHead>
                          <TableHead className="h-16 px-2 pb-2 align-bottom">
                            Employability
                          </TableHead>
                          <TableHead className="h-16 whitespace-normal px-2 pb-2 align-bottom leading-tight">
                            Predicted level
                          </TableHead>
                          <TableHead className="h-16 whitespace-normal px-2 pb-2 align-bottom leading-tight">
                            Prediction confidence
                          </TableHead>
                          <TableHead className="h-16 px-2 pb-2 align-bottom">
                            Predicted at
                          </TableHead>
                          <TableHead className="h-16 p-0" />
                        </>
                      ) : (
                        <TableHead className="h-16 p-0" />
                      )}
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {pageRows.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={emptyColSpan}
                          className="py-10 text-center text-muted-foreground"
                        >
                          No students found.
                        </TableCell>
                      </TableRow>
                    )}

                    {pageRows.map((s, index) => {
                      const locked = s.status !== "Completed";
                      const lockedReason = "Complete the student's OJT first";
                      const name = formatStudentName(s);

                      return (
                        <TableRow
                          key={s.id}
                          data-state={
                            selection.isSelected(s.id) ? "selected" : undefined
                          }
                        >
                          <StudentCells
                            number={offset + index + 1}
                            student={s}
                            selection={{
                              checked: selection.isSelected(s.id),
                              onChange: () => selection.toggle(s.id),
                            }}
                          />

                          {visibleRequirements.map((r) => (
                            <TableCell key={r.id} className="px-1 py-1">
                              <StatusCell
                                status={s.statuses[String(r.id)] ?? "ASSIGNED"}
                                title={r.title}
                                pending={pendingCell === `${s.id}-${r.id}`}
                                onChange={(status) =>
                                  void changeStatus(s, r, status)
                                }
                                onView={() =>
                                  setReviewTarget({ student: s, requirement: r })
                                }
                              />
                            </TableCell>
                          ))}

                          {showPlacement ? (
                            <>
                              {showMoa && (
                                <TableCell className="px-2 py-0">
                                  <MoaCell
                                    moaStatus={s.moaStatus}
                                    pending={pendingMoa === s.id}
                                    onChange={(value) =>
                                      void changeMoa(s, value)
                                    }
                                  />
                                </TableCell>
                              )}

                              {showStatusCol && (
                                <TableCell className="px-2 py-0">
                                  <PlacementStatusCell
                                    status={s.status}
                                    pending={pendingPlacement === s.id}
                                    onChange={(next) =>
                                      void changePlacement(s, next)
                                    }
                                  />
                                </TableCell>
                              )}

                              {showCompanyCol && (
                                <TableCell className="px-2 py-0">
                                  {s.companyName ? (
                                    <CompanyCell
                                      companyName={s.companyName}
                                      onOpen={() => setAssignTarget(s)}
                                    />
                                  ) : (
                                    <span
                                      className="text-muted-foreground"
                                      title="Set the status to Deployed to assign a company"
                                    >
                                      —
                                    </span>
                                  )}
                                </TableCell>
                              )}

                              {showDepartment && (
                                <TableCell
                                  className="truncate px-2 py-0"
                                  title={s.departmentName ?? ""}
                                >
                                  {s.departmentName ?? (
                                    <span className="text-muted-foreground">
                                      —
                                    </span>
                                  )}
                                </TableCell>
                              )}
                            </>
                          ) : showCompletion ? (
                            <>
                              <TableCell className="px-2 py-1">
                                <CompletionCell
                                  status={s.status}
                                  completedDate={s.completedDate}
                                  hasCompany={s.companyName !== null}
                                  onOpen={() => setCompleteTarget(s)}
                                />
                              </TableCell>

                              <TableCell className={DIVIDER_CELL} />

                              <TableCell className="px-1 py-1">
                                <DateCell
                                  value={s.hiredDate}
                                  label={`Hired date of ${name}`}
                                  pending={
                                    pendingEmployment === `${s.id}-hiredDate`
                                  }
                                  disabled={locked}
                                  disabledReason={lockedReason}
                                  max={todayIso()}
                                  onSave={(date) =>
                                    saveEmployment(s, "hiredDate", date)
                                  }
                                />
                              </TableCell>

                              <TableCell className="px-1 py-1">
                                <ChoiceCell
                                  value={s.jobRelated}
                                  options={JOB_OPTIONS}
                                  label={`Job related to course of ${name}`}
                                  disabled={locked}
                                  disabledReason={lockedReason}
                                  pending={
                                    pendingEmployment === `${s.id}-jobRelated`
                                  }
                                  onChange={(value) =>
                                    void saveEmployment(s, "jobRelated", value)
                                  }
                                />
                              </TableCell>

                              <TableCell className="px-1 py-1">
                                <ChoiceCell
                                  value={s.employabilityLevel}
                                  options={LEVEL_OPTIONS}
                                  label={`Employability of ${name}`}
                                  disabled={locked}
                                  disabledReason={lockedReason}
                                  pending={
                                    pendingEmployment ===
                                    `${s.id}-employabilityLevel`
                                  }
                                  onChange={(value) =>
                                    void saveEmployment(
                                      s,
                                      "employabilityLevel",
                                      value,
                                    )
                                  }
                                />
                              </TableCell>

                              <TableCell className="px-2 py-0">
                                {s.predictedLevel ? (
                                  <span
                                    className={cn(
                                      "inline-flex h-5 items-center rounded-md border px-1.5 text-[10px] font-medium",
                                      LEVEL_CONFIG[s.predictedLevel].chipClass,
                                    )}
                                  >
                                    {LEVEL_CONFIG[s.predictedLevel].label}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground/60">
                                    —
                                  </span>
                                )}
                              </TableCell>

                              <TableCell className="px-2 py-0 text-muted-foreground">
                                {s.predictionConfidence === null
                                  ? "—"
                                  : `${Number(
                                      s.predictionConfidence,
                                    ).toLocaleString("en-PH", {
                                      maximumFractionDigits: 2,
                                    })}%`}
                              </TableCell>

                              <TableCell
                                className="truncate px-2 py-0 text-muted-foreground"
                                title={formatLongDate(s.predictedAt)}
                              >
                                {formatLongDate(s.predictedAt)}
                              </TableCell>

                              <TableCell className="p-0" />
                            </>
                          ) : (
                            <TableCell className="p-0" />
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>

                <DataTablePagination
                  page={currentPage}
                  pageSize={pageSize}
                  total={filtered.length}
                  pageSizeOptions={[10, 20, 50]}
                  onPageChange={setPage}
                  onPageSizeChange={(size) => {
                    setPageSize(size);
                    setPage(1);
                  }}
                />
              </>
            )}
          </div>
        </>
      )}

      {assignTarget && (
        <AssignCompanyDialog
          key={assignTarget.id}
          open
          onOpenChange={(open) => {
            if (!open) setAssignTarget(null);
          }}
          studentId={assignTarget.id}
          studentName={formatStudentName(assignTarget)}
          currentLabel={
            assignTarget.companyName
              ? assignTarget.companyName +
                (assignTarget.departmentName
                  ? ` · ${assignTarget.departmentName}`
                  : "")
              : null
          }
          onAssigned={(assignment) => {
            // Ang may company ay Deployed na
            const target = assignTarget;
            if (target.status !== "Completed") {
              void api
                .patch("/coordinator/placement/status", {
                  studentId: target.id,
                  status: "DEPLOYED",
                })
                .then(() => {
                  updateStudent(target.id, { status: "Deployed" });
                  return refresh();
                })
                .catch(() =>
                  setActionError(
                    "The company was assigned, but the status could not be set to Deployed.",
                  ),
                );
            }
            updateStudent(assignTarget.id, {
              companyName: assignment.companyName,
              departmentName: assignment.departmentName,
            });
            setNotice(
              `${formatStudentName(assignTarget)} was assigned to ${assignment.companyName}` +
                (assignment.departmentName
                  ? ` · ${assignment.departmentName}`
                  : "") +
                ".",
            );
          }}
          onRemoved={() => {
            // Wala nang company: bumalik sa Approved
            const target = assignTarget;
            if (target.status === "Deployed") {
              void api
                .patch("/coordinator/placement/status", {
                  studentId: target.id,
                  status: "APPROVED",
                  removePlacement: true,
                })
                .then(() => {
                  updateStudent(target.id, { status: "Approved" });
                  return refresh();
                })
                .catch(() => refresh());
            }
            updateStudent(assignTarget.id, {
              companyName: null,
              departmentName: null,
            });
            setNotice(
              `${formatStudentName(assignTarget)} was removed from ${assignTarget.companyName}.`,
            );
          }}
        />
      )}

      <ConfirmDialog
        open={placementConfirm !== null}
        title="Remove from company?"
        description={
          placementConfirm
            ? `${formatStudentName(placementConfirm.student)} is placed in ${placementConfirm.student.companyName}. Setting the status to ${
                PLACEMENT_OPTIONS.find((o) => o.key === placementConfirm.status)?.label
              } removes the student from the company and frees the slot.`
            : ""
        }
        confirmLabel="Remove and set status"
        loading={pendingPlacement !== null}
        onConfirm={() => {
          const target = placementConfirm;
          setPlacementConfirm(null);
          if (target) void changePlacement(target.student, target.status, true);
        }}
        onCancel={() => setPlacementConfirm(null)}
      />

      {completeTarget && (
        <CompleteOjtDialog
          key={completeTarget.id}
          open
          onOpenChange={(open) => {
            if (!open) setCompleteTarget(null);
          }}
          studentId={completeTarget.id}
          studentName={formatStudentName(completeTarget)}
          initialDate={completeTarget.completedDate}
          isEdit={completeTarget.status === "Completed"}
          onCompleted={(result) =>
            updateStudent(completeTarget.id, {
              status: result.status,
              completedDate: result.completedDate,
            })
          }
          onReverted={() =>
            updateStudent(completeTarget.id, {
              status: "Deployed",
              completedDate: null,
              hiredDate: null,
              jobRelated: null,
              employabilityLevel: null,
            })
          }
        />
      )}

      {reviewTarget && (
        <ReviewDialog
          key={`${reviewTarget.student.id}-${reviewTarget.requirement.id}`}
          kind="requirement"
          studentId={reviewTarget.student.id}
          itemId={reviewTarget.requirement.id}
          studentName={formatStudentName(reviewTarget.student)}
          itemLabel={reviewTarget.requirement.title}
          initialStatus={
            reviewTarget.student.statuses[String(reviewTarget.requirement.id)] ??
            "ASSIGNED"
          }
          onOpenChange={(open) => {
            if (!open) setReviewTarget(null);
          }}
          onSaved={(result) =>
            applyStatus(
              reviewTarget.student.id,
              reviewTarget.requirement.id,
              result.cell.status,
            )
          }
        />
      )}

      {addRequirementOpen && semesterId !== null && (
        <AddRequirementDialog
          key={`${semesterId}-${type}`}
          open
          onOpenChange={setAddRequirementOpen}
          semesterId={semesterId}
          semesterName={semesterName}
          type={type}
          onAdded={handleRequirementAdded}
        />
      )}
    </DashboardLayout>
  );
}
