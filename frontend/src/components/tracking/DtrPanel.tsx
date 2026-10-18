import { useMemo, useRef, useState } from "react";
import { Check, Eye, Plus } from "lucide-react";
import api from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { formatLongDate } from "@/lib/dates";
import { notify } from "@/lib/notify";
import { cn } from "@/lib/utils";
import { useRowSelection } from "@/hooks/useRowSelection";
import { useSectionData } from "@/hooks/useTracking";
import type { TrackingStatus } from "@/types/tracking";
import type { DtrColumn } from "@/types/trackingSections";
import type {
  CellResult,
  DtrReviewData,
  DtrReviewStudent,
  ReviewCell,
} from "@/types/review";
import { DataTablePagination } from "@/components/DataTablePagination";
import { AddMonthDialog } from "@/components/tracking/AddMonthDialog";
import { DtrBulkActions } from "@/components/tracking/BulkActions";
import { ColumnsMenu, useHiddenColumns } from "@/components/tracking/ColumnsMenu";
import { HeaderLink } from "@/components/tracking/HeaderLink";
import { ReviewDialog } from "@/components/tracking/ReviewDialog";
import { StatusPairDialog, type PairValues } from "@/components/tracking/StatusPairDialog";
import { STATUS_CONFIG, STATUS_ORDER } from "@/components/tracking/statusConfig";
import {
  SELECT_COL,
  STUDENT_COLS_WIDTH,
  StudentCells,
  StudentColGroup,
  StudentHeadCells,
  formatStudentName,
} from "@/components/tracking/StudentColumns";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const COL = { started: 148, month: 128, figure: 92, progress: 112 };

const EMPTY_CELL: ReviewCell = {
  status: "ASSIGNED",
  rating: null,
  hours: null,
  hasFile: false,
};

function formatHours(value: number) {
  return value.toLocaleString("en-PH", { maximumFractionDigits: 2 });
}

/** Ang <input type="date"> ay yyyy-MM-dd lang ang tinatanggap */
function toInputValue(value: string | null) {
  return value && /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : "";
}

interface HoursCellProps {
  value: number | null;
  label: string;
  pending: boolean;
  onSave: (hours: number | null) => Promise<void>;
}

/** Oras kada buwan: i-click o i-Tab para mag-type; Enter = save, Esc = cancel */
function HoursCell({ value, label, pending, onSave }: HoursCellProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const skipCommit = useRef(false);

  function startEditing() {
    skipCommit.current = false;
    setDraft(value === null ? "" : String(value));
    setEditing(true);
  }

  function commit() {
    setEditing(false);
    if (skipCommit.current) {
      skipCommit.current = false;
      return;
    }
    const trimmed = draft.trim();
    const next = trimmed === "" ? null : Number(trimmed);
    if (next !== value) void onSave(next);
  }

  if (editing) {
    return (
      <Input
        autoFocus
        inputMode="decimal"
        aria-label={label}
        className="h-7 px-1 text-center text-xs"
        value={draft}
        onChange={(e) => setDraft(e.target.value.replace(/[^\d.]/g, ""))}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.currentTarget.blur();
          } else if (e.key === "Escape") {
            skipCommit.current = true;
            e.currentTarget.blur();
          }
        }}
      />
    );
  }

  return (
    <button
      type="button"
      disabled={pending}
      title={`${label} — click to edit`}
      onFocus={startEditing}
      onClick={startEditing}
      className={cn(
        "flex h-7 w-full items-center justify-center rounded-md text-xs outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring",
        value === null && "text-muted-foreground/60",
        pending && "opacity-40",
      )}
    >
      {value === null ? "—" : formatHours(value)}
    </button>
  );
}

interface StatusIconProps {
  status: TrackingStatus;
  title: string;
  pending: boolean;
  onChange: (status: TrackingStatus) => void;
  onView: () => void;
}

/** Maliit na status button sa tabi ng oras: View work at pagpapalit ng status */
function StatusIcon({ status, title, pending, onChange, onView }: StatusIconProps) {
  const config = STATUS_CONFIG[status];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={pending}
        title={`${title}: ${config.label}`}
        aria-label={`${title}: ${config.label}. Open menu`}
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-md border outline-none focus-visible:ring-2 focus-visible:ring-ring",
          config.chipClass,
          pending && "opacity-40",
        )}
      >
        <config.Icon className="h-3.5 w-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
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
              <optionConfig.Icon className={cn("h-4 w-4", optionConfig.iconClass)} />
              <span className="flex-1">{optionConfig.label}</span>
              {option === status && <Check className="h-4 w-4 text-muted-foreground" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface DateCellProps {
  value: string | null;
  label: string;
  pending: boolean;
  onSave: (date: string | null) => Promise<void>;
}

/** Date started: i-click para pumili o mag-type ng date; Enter o i-click sa labas = save, Esc = cancel */
function DateCell({ value, label, pending, onSave }: DateCellProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const skipCommit = useRef(false);

  function startEditing() {
    skipCommit.current = false;
    setDraft(toInputValue(value));
    setEditing(true);
  }

  function commit() {
    setEditing(false);
    if (skipCommit.current) {
      skipCommit.current = false;
      return;
    }
    if (draft !== toInputValue(value)) void onSave(draft === "" ? null : draft);
  }

  if (editing) {
    return (
      <Input
        autoFocus
        type="date"
        aria-label={label}
        className="h-7 px-1 text-xs"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.currentTarget.blur();
          } else if (e.key === "Escape") {
            skipCommit.current = true;
            e.currentTarget.blur();
          }
        }}
      />
    );
  }

  return (
    <button
      type="button"
      disabled={pending}
      title={`${label} — click to edit`}
      onFocus={startEditing}
      onClick={startEditing}
      className={cn(
        "flex h-7 w-full items-center truncate rounded-md px-1 text-left text-xs outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring",
        !value && "text-muted-foreground/60",
        pending && "opacity-40",
      )}
    >
      {formatLongDate(value)}
    </button>
  );
}

interface DtrPanelProps {
  semesterId: number;
  semesterName: string;
  search: string;
  addOpen: boolean;
  onAddOpenChange: (open: boolean) => void;
}

/** Ang oras ng mga DTR na Checked lang ang binibilang */
function renderedOf(student: DtrReviewStudent) {
  return Object.values(student.cells).reduce(
    (sum, cell) =>
      cell.status === "CHECKED" ? sum + (cell.hours ?? 0) : sum,
    0,
  );
}

export function DtrPanel({
  semesterId,
  semesterName,
  search,
  addOpen,
  onAddOpenChange,
}: DtrPanelProps) {
  const { data, error, loading, reload, refresh, update } =
    useSectionData<DtrReviewData>("/coordinator/review/dtr", semesterId);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [prevSearch, setPrevSearch] = useState(search);
  const [pendingCell, setPendingCell] = useState<string | null>(null);
  const [pendingStart, setPendingStart] = useState<number | null>(null);
  const [pair, setPair] = useState<{
    student: DtrReviewStudent;
    column: DtrColumn;
    status: TrackingStatus;
    hours: number | null;
  } | null>(null);
  const [review, setReview] = useState<{
    student: DtrReviewStudent;
    column: DtrColumn;
    hint?: string;
  } | null>(null);

  if (prevSearch !== search) {
    setPrevSearch(search);
    setPage(1);
  }

  const filtered = useMemo(() => {
    const rows = data?.students ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((s) =>
      `${s.lastname} ${s.firstname} ${s.studentNumber}`
        .toLowerCase()
        .includes(q),
    );
  }, [data, search]);

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

  const columns = useHiddenColumns("tracking-dtr");
  const showStarted = !columns.isHidden("started");
  const showTotal = !columns.isHidden("total");
  const showRendered = !columns.isHidden("rendered");
  const showRemaining = !columns.isHidden("remaining");
  const showProgress = !columns.isHidden("progress");
  const visibleMonths = (data?.columns ?? []).filter(
    (m) => !columns.isHidden(`month:${m.id}`),
  );
  const columnOptions = [
    { key: "started", label: "Date started" },
    ...(data?.columns ?? []).map((m) => ({ key: `month:${m.id}`, label: m.month })),
    { key: "total", label: "Total hours" },
    { key: "rendered", label: "Rendered" },
    { key: "remaining", label: "Remaining" },
    { key: "progress", label: "Progress" },
  ];
  const monthCount = visibleMonths.length;
  const figureCount = [showTotal, showRendered, showRemaining].filter(Boolean).length;
  const tableMinWidth =
    STUDENT_COLS_WIDTH +
    SELECT_COL +
    (showStarted ? COL.started : 0) +
    monthCount * COL.month +
    COL.figure * figureCount +
    (showProgress ? COL.progress : 0) +
    24;

  function applyCell(studentId: number, columnId: number, cell: ReviewCell) {
    update((d) => ({
      ...d,
      students: d.students.map((s) =>
        s.id === studentId
          ? { ...s, cells: { ...s.cells, [String(columnId)]: cell } }
          : s,
      ),
    }));
  }

  async function changeStatus(
    student: DtrReviewStudent,
    column: DtrColumn,
    status: TrackingStatus,
  ) {
    const cell = student.cells[String(column.id)] ?? EMPTY_CELL;

    // Ang Checked ay may kasamang hours: laging magtanong sa modal (nakalagay na ang inilagay ng student)
    if (status === "CHECKED") {
      setPair({ student, column, status, hours: cell.hours });
      return;
    }

    setPendingCell(`${student.id}-${column.id}`);
    try {
      const res = await api.patch<CellResult>("/coordinator/review/cell", {
        kind: "dtr",
        studentId: student.id,
        itemId: column.id,
        status,
      });
      applyCell(student.id, column.id, res.data.cell);
      notify.success(
        `${formatStudentName(student)}: ${column.month} is now ${STATUS_CONFIG[status].label}.`,
      );
    } catch (err) {
      notify.error(getErrorMessage(err, "Failed to update the status."));
    } finally {
      setPendingCell(null);
    }
  }

  async function saveHours(
    student: DtrReviewStudent,
    column: DtrColumn,
    hours: number | null,
  ) {
    if (hours !== null && (Number.isNaN(hours) || hours < 0 || hours > 744)) {
      notify.error("Hours must be a number between 0 and 744.");
      return;
    }

    const cell = student.cells[String(column.id)] ?? EMPTY_CELL;

    // Ang pagbabago ng hours ay laging may kumpirmasyon kasama ang status:
    // may hours = Checked, at kapag binura ang hours ng Checked, babalik ito sa For checking / Assigned
    if (hours !== null || cell.status === "CHECKED") {
      const fallback: TrackingStatus = cell.hasFile ? "FOR_CHECKING" : "ASSIGNED";
      setPair({ student, column, status: hours !== null ? "CHECKED" : fallback, hours });
      return;
    }

    // Ang oras at ang status ay magkasama: may hours = Checked (ina-approve ng coordinator ang inilagay).
    // Kung gusto mong itago ang hours nang hindi Checked, palitan ang status sa menu pagkatapos.
    const status: TrackingStatus =
      hours === null
        ? cell.status === "INVALID"
          ? "INVALID"
          : cell.hasFile
            ? "FOR_CHECKING"
            : "ASSIGNED"
        : "CHECKED";

    setPendingCell(`${student.id}-${column.id}`);
    try {
      const res = await api.patch<CellResult>("/coordinator/review/cell", {
        kind: "dtr",
        studentId: student.id,
        itemId: column.id,
        status,
        hours,
        clearHours: hours === null,
      });
      applyCell(student.id, column.id, res.data.cell);
      notify.success(
        hours === null
          ? `${column.month} hours of ${formatStudentName(student)} cleared.`
          : `${formatStudentName(student)}: ${formatHours(hours)} hours for ${column.month} (${STATUS_CONFIG[res.data.cell.status].label}).`,
      );
    } catch (err) {
      notify.error(getErrorMessage(err, "Failed to save the hours."));
    } finally {
      setPendingCell(null);
    }
  }

  async function savePair(
    student: DtrReviewStudent,
    column: DtrColumn,
    values: PairValues,
  ) {
    const res = await api.patch<CellResult>("/coordinator/review/cell", {
      kind: "dtr",
      studentId: student.id,
      itemId: column.id,
      status: values.status,
      hours: values.hours,
      clearHours: values.hours === null,
    });
    applyCell(student.id, column.id, res.data.cell);
    notify.success(
      `${formatStudentName(student)}: ${column.month} is now ${STATUS_CONFIG[res.data.cell.status].label}${
        res.data.cell.hours !== null ? ` · ${formatHours(res.data.cell.hours)} hrs` : ""
      }.`,
    );
  }

  async function saveStartDate(student: DtrReviewStudent, date: string | null) {
    if (date !== null) {
      const year = Number(date.slice(0, 4));
      if (Number.isNaN(year) || year < 2000 || year > 2100) {
        notify.error("Please enter a year between 2000 and 2100.");
        return;
      }
    }

    setPendingStart(student.id);
    try {
      const res = await api.patch<{ startedDate: string | null }>(
        "/coordinator/tracking/dtr/start-date",
        { studentId: student.id, startDate: date },
      );
      update((d) => ({
        ...d,
        students: d.students.map((s) =>
          s.id === student.id ? { ...s, startDate: res.data.startedDate } : s,
        ),
      }));
      notify.success(`Start date of ${formatStudentName(student)} was updated.`);
    } catch (err) {
      notify.error(getErrorMessage(err, "Failed to save the start date."));
    } finally {
      setPendingStart(null);
    }
  }

  function handleAdded(column: DtrColumn) {
    update((d) => ({ ...d, columns: [...d.columns, column] }));
    notify.success(`${column.month} was added.`);
  }

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {STATUS_ORDER.map((status) => (
          <span
            key={status}
            className={cn(
              "inline-flex h-5 items-center rounded-md border px-1.5 text-[10px] font-medium",
              STATUS_CONFIG[status].chipClass,
            )}
          >
            {STATUS_CONFIG[status].label}
          </span>
        ))}
        <span className="text-muted-foreground/70">
          · Click the hours to type them (Enter saves, Esc cancels). Use the icon
          to view the DTR or change the status. Only Checked DTRs count toward
          Rendered.
        </span>
        {data && data.columns.length > 0 && (
          <span className="ml-auto">
            <ColumnsMenu
              options={columnOptions}
              hidden={columns.hidden}
              onToggle={columns.toggle}
              onShowAll={columns.showAll}
              onHideAll={() => columns.setHidden(columnOptions.map((o) => o.key))}
            />
          </span>
        )}
        {data && (
          <span>
            {filtered.length} of {data.students.length} students ·{" "}
            {data.columns.length} months
          </span>
        )}
      </div>

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

      <DtrBulkActions
        selection={selection}
        filteredTotal={filtered.length}
        months={data?.columns ?? []}
        onDone={refresh}
      />

      <div className="isolate rounded-xl border bg-card">
        {loading && (
          <div className="flex flex-col gap-2 p-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        )}

        {data && data.columns.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-16">
            <p className="text-sm text-muted-foreground">
              No DTR months have been added for this semester yet.
            </p>
            <Button type="button" onClick={() => onAddOpenChange(true)}>
              <Plus className="h-4 w-4" />
              Add month
            </Button>
          </div>
        )}

        {data && data.columns.length > 0 && (
          <>
            <Table
              className="table-fixed text-xs"
              style={{ minWidth: tableMinWidth }}
            >
              <colgroup>
                <StudentColGroup selectable />
                {showStarted && <col style={{ width: COL.started }} />}
                {visibleMonths.map((m) => (
                  <col key={m.id} style={{ width: COL.month }} />
                ))}
                {showTotal && <col style={{ width: COL.figure }} />}
                {showRendered && <col style={{ width: COL.figure }} />}
                {showRemaining && <col style={{ width: COL.figure }} />}
                {showProgress && <col style={{ width: COL.progress }} />}
                <col />
              </colgroup>

              <TableHeader>
                <TableRow>
                  <StudentHeadCells
                    className="h-14"
                    selection={{
                      checked: selection.pageChecked,
                      indeterminate: selection.pageIndeterminate,
                      onChange: selection.togglePage,
                    }}
                  />
                  {showStarted && (
                    <TableHead className="h-14 px-2 pb-2 align-bottom">
                      Date started
                    </TableHead>
                  )}
                  {visibleMonths.map((m) => (
                    <TableHead
                      key={m.id}
                      className="h-14 px-1 pb-2 text-center align-bottom"
                    >
                      <HeaderLink
                        to={`/coordinator/document-requirements/dtr/${m.id}/submissions`}
                        title={`${m.month} · open the students' submissions`}
                      >
                        {m.month}
                      </HeaderLink>
                    </TableHead>
                  ))}
                  {showTotal && (
                  <TableHead
                    className="h-14 whitespace-normal px-1 pb-2 text-center align-bottom leading-tight"
                    title="Required hours of the program"
                  >
                    Total hours
                  </TableHead>
                  )}
                  {showRendered && (
                  <TableHead
                    className="h-14 whitespace-normal px-1 pb-2 text-center align-bottom leading-tight"
                    title="Hours of the Checked DTRs"
                  >
                    Rendered
                  </TableHead>
                  )}
                  {showRemaining && (
                  <TableHead
                    className="h-14 whitespace-normal px-1 pb-2 text-center align-bottom leading-tight"
                    title="Total hours minus rendered"
                  >
                    Remaining
                  </TableHead>
                  )}
                  {showProgress && (
                    <TableHead className="h-14 px-1 pb-2 text-center align-bottom">
                      Progress
                    </TableHead>
                  )}
                  <TableHead className="h-14 p-0" />
                </TableRow>
              </TableHeader>

              <TableBody>
                {pageRows.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={6 + monthCount + (showStarted ? 1 : 0) + figureCount + (showProgress ? 1 : 0)}
                      className="py-10 text-center text-muted-foreground"
                    >
                      No students found.
                    </TableCell>
                  </TableRow>
                )}

                {pageRows.map((s, index) => {
                  const rendered = renderedOf(s);
                  const required = s.trainingDuration;
                  const remaining =
                    required === null ? null : Math.max(0, required - rendered);
                  const excess =
                    required !== null && rendered > required
                      ? rendered - required
                      : 0;
                  const complete =
                    required !== null && required > 0 && rendered === required;
                  const percent =
                    required && required > 0
                      ? Math.min(100, Math.round((rendered / required) * 100))
                      : null;

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

                      {showStarted && (
                      <TableCell className="px-1 py-1">
                        <DateCell
                          value={s.startDate}
                          label={`Date started of ${formatStudentName(s)}`}
                          pending={pendingStart === s.id}
                          onSave={(date) => saveStartDate(s, date)}
                        />
                      </TableCell>
                      )}

                      {visibleMonths.map((m) => {
                        const cell = s.cells[String(m.id)] ?? EMPTY_CELL;
                        return (
                          <TableCell key={m.id} className="px-1 py-1">
                            <div className="flex items-center gap-1">
                              <StatusIcon
                                status={cell.status}
                                title={m.month}
                                pending={pendingCell === `${s.id}-${m.id}`}
                                onChange={(status) =>
                                  void changeStatus(s, m, status)
                                }
                                onView={() =>
                                  setReview({ student: s, column: m })
                                }
                              />
                              <div className="min-w-0 flex-1">
                                <HoursCell
                                  value={cell.hours}
                                  label={`${m.month} hours`}
                                  pending={pendingCell === `${s.id}-${m.id}`}
                                  onSave={(hours) => saveHours(s, m, hours)}
                                />
                              </div>
                            </div>
                          </TableCell>
                        );
                      })}

                      {showTotal && (
                      <TableCell className="px-1 py-0 text-center text-muted-foreground">
                        {required === null ? "—" : formatHours(required)}
                      </TableCell>
                      )}
                      {showRendered && (
                      <TableCell className="px-1 py-1 text-center">
                        <span
                          className={cn(
                            "font-medium",
                            rendered === 0 && "text-destructive",
                          )}
                        >
                          {formatHours(rendered)}
                        </span>
                        {excess > 0 && (
                          <span
                            className="mt-0.5 block text-[10px] font-medium leading-none text-amber-600 dark:text-amber-400"
                            title={`Rendered hours exceed the required ${formatHours(required ?? 0)} hours`}
                          >
                            Exceeded +{formatHours(excess)}
                          </span>
                        )}
                      </TableCell>
                      )}
                      {showRemaining && (
                      <TableCell className="px-1 py-0 text-center text-muted-foreground">
                        {remaining === null ? "—" : formatHours(remaining)}
                      </TableCell>
                      )}
                      {showProgress && (
                      <TableCell className="px-2 py-0 text-center">
                        {percent === null ? (
                          <span className="text-muted-foreground/60">—</span>
                        ) : excess > 0 ? (
                          <span className="inline-flex h-5 items-center rounded-md border border-amber-500/40 bg-amber-500/10 px-1.5 text-[10px] font-medium text-amber-700 dark:text-amber-400">
                            Exceeded
                          </span>
                        ) : complete ? (
                          <span className="inline-flex h-5 items-center rounded-md border border-emerald-600/30 bg-emerald-600/10 px-1.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
                            Completed
                          </span>
                        ) : (
                          <span className="text-muted-foreground">
                            {percent}%
                          </span>
                        )}
                      </TableCell>
                      )}
                      <TableCell className="p-0" />
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

      {addOpen && (
        <AddMonthDialog
          key={semesterId}
          open
          onOpenChange={onAddOpenChange}
          semesterId={semesterId}
          semesterName={semesterName}
          existingMonths={data?.columns.map((m) => m.month) ?? []}
          onAdded={handleAdded}
        />
      )}

      {pair && (
        <StatusPairDialog
          key={`${pair.student.id}-${pair.column.id}`}
          kind="dtr"
          studentName={formatStudentName(pair.student)}
          itemLabel={pair.column.month}
          initialStatus={pair.status}
          initialRating={null}
          initialHours={pair.hours}
          hasFile={pair.student.cells[String(pair.column.id)]?.hasFile ?? false}
          onOpenChange={(open) => {
            if (!open) setPair(null);
          }}
          onSubmit={(values) => savePair(pair.student, pair.column, values)}
        />
      )}

      {review && (
        <ReviewDialog
          key={`${review.student.id}-${review.column.id}`}
          kind="dtr"
          studentId={review.student.id}
          itemId={review.column.id}
          studentName={formatStudentName(review.student)}
          itemLabel={review.column.month}
          hint={review.hint}
          initialStatus={
            review.student.cells[String(review.column.id)]?.status ?? "ASSIGNED"
          }
          onOpenChange={(open) => {
            if (!open) setReview(null);
          }}
          onSaved={(result) =>
            applyCell(review.student.id, review.column.id, result.cell)
          }
        />
      )}
    </>
  );
}
