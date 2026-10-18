import { useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, Plus } from "lucide-react";
import api from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { formatPeriod } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { useSectionData } from "@/hooks/useTracking";
import type {
  WeeklyColumn,
  WeeklyRating,
  WeeklyStudent,
  WeeklyTrackingData,
} from "@/types/trackingSections";
import { DataTablePagination } from "@/components/DataTablePagination";
import { AddWeekDialog } from "@/components/tracking/AddWeekDialog";
import {
  STUDENT_COLS_WIDTH,
  StudentCells,
  StudentColGroup,
  StudentHeadCells,
} from "@/components/tracking/StudentColumns";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const WEEK_COL = 104;

const RATING_ORDER: WeeklyRating[] = [
  "EXCELLENT",
  "VERY_GOOD",
  "GOOD",
  "POOR",
  "NONE",
];

const RATING_CONFIG: Record<
  WeeklyRating,
  { label: string; chipClass: string }
> = {
  EXCELLENT: {
    label: "Excellent",
    chipClass:
      "border-emerald-600/30 bg-emerald-600/10 text-emerald-700 dark:text-emerald-400",
  },
  VERY_GOOD: {
    label: "Very Good",
    chipClass: "border-sky-600/30 bg-sky-600/10 text-sky-700 dark:text-sky-400",
  },
  GOOD: {
    label: "Good",
    chipClass:
      "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  },
  POOR: {
    label: "Poor",
    chipClass: "border-destructive/30 bg-destructive/10 text-destructive",
  },
  NONE: {
    label: "No Report",
    chipClass: "border-dashed text-muted-foreground hover:bg-muted",
  },
};

interface RatingCellProps {
  rating: WeeklyRating;
  title: string;
  pending: boolean;
  onChange: (rating: WeeklyRating) => void;
}

function RatingCell({ rating, title, pending, onChange }: RatingCellProps) {
  const config = RATING_CONFIG[rating];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={pending}
        title={`${title}: ${config.label}`}
        aria-label={`${title}: ${config.label}. Change evaluation`}
        className={cn(
          "inline-flex h-6 w-full items-center justify-between gap-0.5 rounded-md border px-1.5 text-[10px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring",
          config.chipClass,
          pending && "opacity-40",
        )}
      >
        <span className="truncate">{config.label}</span>
        <ChevronDown className="h-2.5 w-2.5 shrink-0 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center">
        {RATING_ORDER.map((option) => (
          <DropdownMenuItem
            key={option}
            className="gap-2"
            onClick={() => {
              if (option !== rating) onChange(option);
            }}
          >
            <span className="flex-1">{RATING_CONFIG[option].label}</span>
            {option === rating && (
              <Check className="h-4 w-4 text-muted-foreground" />
            )}
          </DropdownMenuItem>
        ))}
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
  const { data, error, loading, reload, update } =
    useSectionData<WeeklyTrackingData>(
      "/coordinator/tracking/weekly",
      semesterId,
    );

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [prevSearch, setPrevSearch] = useState(search);
  const [pendingCell, setPendingCell] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState("");

  if (prevSearch !== search) {
    setPrevSearch(search);
    setPage(1);
  }

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

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

  const columnCount = data?.columns.length ?? 0;
  const tableMinWidth = STUDENT_COLS_WIDTH + columnCount * WEEK_COL + 40;

  async function changeRating(
    student: WeeklyStudent,
    column: WeeklyColumn,
    rating: WeeklyRating,
  ) {
    setPendingCell(`${student.id}-${column.id}`);
    setActionError("");

    try {
      await api.patch("/coordinator/tracking/weekly/rating", {
        studentId: student.id,
        reportId: column.id,
        rating,
      });
      update((d) => ({
        ...d,
        students: d.students.map((s) =>
          s.id === student.id
            ? { ...s, ratings: { ...s.ratings, [String(column.id)]: rating } }
            : s,
        ),
      }));
    } catch (err) {
      setActionError(getErrorMessage(err, "Failed to update the evaluation."));
    } finally {
      setPendingCell(null);
    }
  }

  function handleAdded(column: WeeklyColumn) {
    update((d) => ({
      ...d,
      columns: [...d.columns, column].sort((a, b) =>
        a.dateFrom.localeCompare(b.dateFrom),
      ),
    }));
    setNotice(`${formatPeriod(column.dateFrom, column.dateTo)} was added.`);
  }

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {RATING_ORDER.map((rating) => (
          <span
            key={rating}
            className={cn(
              "inline-flex h-5 items-center rounded-md border px-1.5 text-[10px] font-medium",
              RATING_CONFIG[rating].chipClass,
            )}
          >
            {RATING_CONFIG[rating].label}
          </span>
        ))}
        <span className="text-muted-foreground/70">
          · The supervisor's evaluation of each weekly report
        </span>
        {data && (
          <span className="ml-auto">
            {filtered.length} of {data.students.length} students ·{" "}
            {data.columns.length} weeks
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

      <div className="rounded-xl border bg-card">
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
                <StudentColGroup />
                {data.columns.map((c) => (
                  <col key={c.id} style={{ width: WEEK_COL }} />
                ))}
                <col />
              </colgroup>

              <TableHeader>
                <TableRow>
                  <StudentHeadCells className="h-14" />
                  {data.columns.map((c) => (
                    <TableHead
                      key={c.id}
                      className="h-14 whitespace-normal px-1 pb-2 text-center align-bottom"
                      title={formatPeriod(c.dateFrom, c.dateTo)}
                    >
                      <span className="block text-[10px] font-medium leading-tight">
                        {formatPeriod(c.dateFrom, c.dateTo)}
                      </span>
                    </TableHead>
                  ))}
                  <TableHead className="h-14 p-0" />
                </TableRow>
              </TableHeader>

              <TableBody>
                {pageRows.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={5 + columnCount}
                      className="py-10 text-center text-muted-foreground"
                    >
                      No students found.
                    </TableCell>
                  </TableRow>
                )}

                {pageRows.map((s, index) => (
                  <TableRow key={s.id}>
                    <StudentCells number={offset + index + 1} student={s} />
                    {data.columns.map((c) => (
                      <TableCell key={c.id} className="px-1 py-1">
                        <RatingCell
                          rating={s.ratings[String(c.id)] ?? "NONE"}
                          title={formatPeriod(c.dateFrom, c.dateTo)}
                          pending={pendingCell === `${s.id}-${c.id}`}
                          onChange={(rating) => void changeRating(s, c, rating)}
                        />
                      </TableCell>
                    ))}
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
    </>
  );
}
