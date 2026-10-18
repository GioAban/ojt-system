import { useMemo, useState } from "react";
import { Check, ChevronDown, Eye, Plus } from "lucide-react";
import api from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { formatPeriod } from "@/lib/dates";
import { notify } from "@/lib/notify";
import { cn } from "@/lib/utils";
import { useRowSelection } from "@/hooks/useRowSelection";
import { useSectionData } from "@/hooks/useTracking";
import type { TrackingStatus } from "@/types/tracking";
import type { WeeklyColumn } from "@/types/trackingSections";
import type {
  CellResult,
  ReviewCell,
  ReviewRating,
  WeeklyReviewData,
  WeeklyReviewStudent,
} from "@/types/review";
import { DataTablePagination } from "@/components/DataTablePagination";
import { AddWeekDialog } from "@/components/tracking/AddWeekDialog";
import { WeeklyBulkActions } from "@/components/tracking/BulkActions";
import { ColumnsMenu, useHiddenColumns } from "@/components/tracking/ColumnsMenu";
import { HeaderLink } from "@/components/tracking/HeaderLink";
import { ReviewDialog } from "@/components/tracking/ReviewDialog";
import { StatusPairDialog, type PairValues } from "@/components/tracking/StatusPairDialog";
import {
  RATING_LABEL,
  RATING_ORDER,
  STATUS_CONFIG,
  STATUS_ORDER,
} from "@/components/tracking/statusConfig";
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

const WEEK_COL = 152;

const EMPTY_CELL: ReviewCell = {
  status: "ASSIGNED",
  rating: null,
  hours: null,
  hasFile: false,
};

const RATING_CLASS: Record<ReviewRating, string> = {
  EXCELLENT: "text-emerald-700 dark:text-emerald-400",
  VERY_GOOD: "text-sky-700 dark:text-sky-400",
  GOOD: "text-amber-700 dark:text-amber-400",
  POOR: "text-destructive",
};

interface StatusIconProps {
  status: TrackingStatus;
  title: string;
  pending: boolean;
  onChange: (status: TrackingStatus) => void;
  onView: () => void;
}

/** Maliit na status button: View work at pagpapalit ng status */
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

interface RatingCellProps {
  rating: ReviewRating | null;
  title: string;
  pending: boolean;
  onChange: (rating: ReviewRating | "NONE") => void;
}

/** Evaluation ng supervisor: Poor, Good, Very Good, Excellent */
function RatingCell({ rating, title, pending, onChange }: RatingCellProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={pending}
        title={`${title}: ${rating ? RATING_LABEL[rating] : "No evaluation yet"}`}
        aria-label={`${title} evaluation`}
        className={cn(
          "flex h-7 min-w-0 flex-1 items-center justify-between gap-0.5 rounded-md px-1.5 text-xs outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring",
          rating ? cn("font-medium", RATING_CLASS[rating]) : "text-muted-foreground/60",
          pending && "opacity-40",
        )}
      >
        <span className="truncate">{rating ? RATING_LABEL[rating] : "—"}</span>
        <ChevronDown className="h-2.5 w-2.5 shrink-0 opacity-50" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {[...RATING_ORDER].reverse().map((option) => (
          <DropdownMenuItem
            key={option}
            className="gap-2"
            onClick={() => {
              if (option !== rating) onChange(option);
            }}
          >
            <span className={cn("flex-1", RATING_CLASS[option])}>
              {RATING_LABEL[option]}
            </span>
            {option === rating && <Check className="h-4 w-4 text-muted-foreground" />}
          </DropdownMenuItem>
        ))}
        {rating && (
          <DropdownMenuItem onClick={() => onChange("NONE")}>
            <span className="flex-1 text-muted-foreground">Clear evaluation</span>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface WeeklyPanelProps {
  semesterId: number;
  semesterName: string;
  search: string;
  addOpen: boolean;
  onAddOpenChange: (open: boolean) => void;
}

export function WeeklyPanel({
  semesterId,
  semesterName,
  search,
  addOpen,
  onAddOpenChange,
}: WeeklyPanelProps) {
  const { data, error, loading, reload, refresh, update } =
    useSectionData<WeeklyReviewData>("/coordinator/review/weekly", semesterId);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [prevSearch, setPrevSearch] = useState(search);
  const [pendingCell, setPendingCell] = useState<string | null>(null);
  const [pair, setPair] = useState<{
    student: WeeklyReviewStudent;
    column: WeeklyColumn;
    status: TrackingStatus;
    rating: ReviewRating | null;
  } | null>(null);
  const [review, setReview] = useState<{
    student: WeeklyReviewStudent;
    column: WeeklyColumn;
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

  const columns = useHiddenColumns("tracking-weekly");
  const visibleColumns = (data?.columns ?? []).filter(
    (c) => !columns.isHidden(`week:${c.id}`),
  );
  const columnOptions = (data?.columns ?? []).map((c) => ({
    key: `week:${c.id}`,
    label: formatPeriod(c.dateFrom, c.dateTo),
  }));
  const columnCount = visibleColumns.length;
  const tableMinWidth =
    STUDENT_COLS_WIDTH + SELECT_COL + columnCount * WEEK_COL + 40;

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
    student: WeeklyReviewStudent,
    column: WeeklyColumn,
    status: TrackingStatus,
  ) {
    const current = student.cells[String(column.id)] ?? EMPTY_CELL;

    // Ang Checked ay nangangailangan ng evaluation: magtanong sa modal
    if (status === "CHECKED" && current.rating === null) {
      setPair({ student, column, status, rating: null });
      return;
    }

    setPendingCell(`${student.id}-${column.id}`);
    try {
      const res = await api.patch<CellResult>("/coordinator/review/cell", {
        kind: "weekly",
        studentId: student.id,
        itemId: column.id,
        status,
      });
      applyCell(student.id, column.id, res.data.cell);
      notify.success(
        `${formatStudentName(student)}: ${formatPeriod(column.dateFrom, column.dateTo)} is now ${STATUS_CONFIG[status].label}.`,
      );
    } catch (err) {
      notify.error(getErrorMessage(err, "Failed to update the status."));
    } finally {
      setPendingCell(null);
    }
  }

  async function changeRating(
    student: WeeklyReviewStudent,
    column: WeeklyColumn,
    rating: ReviewRating | "NONE",
  ) {
    const cell = student.cells[String(column.id)] ?? EMPTY_CELL;

    // Ang evaluation ay para sa Checked: kung hindi pa Checked, ipakita ang status sa modal
    if (rating !== "NONE" && cell.status !== "CHECKED") {
      setPair({ student, column, status: "CHECKED", rating });
      return;
    }

    // May evaluation = Checked. Kapag inalis, babalik sa For checking (may file) o Assigned.
    const status: TrackingStatus =
      rating === "NONE"
        ? cell.status === "INVALID"
          ? "INVALID"
          : cell.hasFile
            ? "FOR_CHECKING"
            : "ASSIGNED"
        : "CHECKED";

    setPendingCell(`${student.id}-${column.id}`);
    try {
      const res = await api.patch<CellResult>("/coordinator/review/cell", {
        kind: "weekly",
        studentId: student.id,
        itemId: column.id,
        status,
        rating,
      });
      applyCell(student.id, column.id, res.data.cell);
      notify.success(
        rating === "NONE"
          ? `${formatStudentName(student)}: evaluation for ${formatPeriod(column.dateFrom, column.dateTo)} cleared.`
          : `${formatStudentName(student)}: ${formatPeriod(column.dateFrom, column.dateTo)} rated ${RATING_LABEL[rating]}.`,
      );
    } catch (err) {
      notify.error(getErrorMessage(err, "Failed to save the evaluation."));
    } finally {
      setPendingCell(null);
    }
  }

  async function savePair(
    student: WeeklyReviewStudent,
    column: WeeklyColumn,
    values: PairValues,
  ) {
    const res = await api.patch<CellResult>("/coordinator/review/cell", {
      kind: "weekly",
      studentId: student.id,
      itemId: column.id,
      status: values.status,
      rating: values.rating,
    });
    applyCell(student.id, column.id, res.data.cell);
    notify.success(
      `${formatStudentName(student)}: ${formatPeriod(column.dateFrom, column.dateTo)} is now ${STATUS_CONFIG[res.data.cell.status].label}${
        res.data.cell.rating ? ` · ${RATING_LABEL[res.data.cell.rating]}` : ""
      }.`,
    );
  }

  function handleAdded(column: WeeklyColumn) {
    update((d) => ({
      ...d,
      columns: [...d.columns, column].sort((a, b) =>
        a.dateFrom.localeCompare(b.dateFrom),
      ),
    }));
    notify.success(`${formatPeriod(column.dateFrom, column.dateTo)} was added.`);
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
          · Use the icon to view the student's work or change the status, and the label to set the evaluation (Poor to Excellent)
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
            {data.columns.length} weeks
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

      <WeeklyBulkActions
        selection={selection}
        filteredTotal={filtered.length}
        weeks={data?.columns ?? []}
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
              No weekly report periods have been added for this semester yet.
            </p>
            <Button type="button" onClick={() => onAddOpenChange(true)}>
              <Plus className="h-4 w-4" />
              Add week
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
                {visibleColumns.map((c) => (
                  <col key={c.id} style={{ width: WEEK_COL }} />
                ))}
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
                  {visibleColumns.map((c) => (
                    <TableHead
                      key={c.id}
                      className="h-14 whitespace-normal px-1 pb-2 text-center align-bottom"
                    >
                      <HeaderLink
                        to={`/coordinator/document-requirements/weekly/${c.id}/submissions`}
                        title={`${formatPeriod(c.dateFrom, c.dateTo)} · open the students' submissions`}
                      >
                        <span className="block text-[10px] font-medium leading-tight">
                          {formatPeriod(c.dateFrom, c.dateTo)}
                        </span>
                      </HeaderLink>
                    </TableHead>
                  ))}
                  <TableHead className="h-14 p-0" />
                </TableRow>
              </TableHeader>

              <TableBody>
                {pageRows.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={6 + columnCount}
                      className="py-10 text-center text-muted-foreground"
                    >
                      No students found.
                    </TableCell>
                  </TableRow>
                )}

                {pageRows.map((s, index) => (
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
                    {visibleColumns.map((c) => {
                      const cell = s.cells[String(c.id)] ?? EMPTY_CELL;
                      return (
                        <TableCell key={c.id} className="px-1 py-1">
                          <div className="flex items-center gap-1">
                            <StatusIcon
                              status={cell.status}
                              title={formatPeriod(c.dateFrom, c.dateTo)}
                              pending={pendingCell === `${s.id}-${c.id}`}
                              onChange={(status) =>
                                void changeStatus(s, c, status)
                              }
                              onView={() => setReview({ student: s, column: c })}
                            />
                            <RatingCell
                              rating={cell.rating}
                              title={formatPeriod(c.dateFrom, c.dateTo)}
                              pending={pendingCell === `${s.id}-${c.id}`}
                              onChange={(rating) =>
                                void changeRating(s, c, rating)
                              }
                            />
                          </div>
                        </TableCell>
                      );
                    })}
                    <TableCell className="p-0" />
                  </TableRow>
                ))}
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
        <AddWeekDialog
          key={semesterId}
          open
          onOpenChange={onAddOpenChange}
          semesterId={semesterId}
          semesterName={semesterName}
          onAdded={handleAdded}
        />
      )}

      {pair && (
        <StatusPairDialog
          key={`${pair.student.id}-${pair.column.id}`}
          kind="weekly"
          studentName={formatStudentName(pair.student)}
          itemLabel={formatPeriod(pair.column.dateFrom, pair.column.dateTo)}
          initialStatus={pair.status}
          initialRating={pair.rating}
          initialHours={null}
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
          kind="weekly"
          studentId={review.student.id}
          itemId={review.column.id}
          studentName={formatStudentName(review.student)}
          itemLabel={formatPeriod(review.column.dateFrom, review.column.dateTo)}
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
