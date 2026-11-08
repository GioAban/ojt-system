import { useMemo, useState } from "react";
import { Check, ChevronDown, Eye, Lock, LockOpen } from "lucide-react";
import api from "@/lib/api";
import { postBulk } from "@/lib/bulk";
import { getErrorMessage } from "@/lib/errors";
import { notify } from "@/lib/notify";
import { cn } from "@/lib/utils";
import { useRowSelection } from "@/hooks/useRowSelection";
import { useSectionData } from "@/hooks/useTracking";
import type {
  EvaluationKey,
  EvaluationStudent,
  EvaluationTrackingData,
  TrackingStatus,
} from "@/types/tracking";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DataTablePagination } from "@/components/DataTablePagination";
import { BulkBar } from "@/components/tracking/BulkBar";
import { HeaderLink } from "@/components/tracking/HeaderLink";
import { ReviewDialog } from "@/components/tracking/ReviewDialog";
import {
  SELECT_COL,
  STUDENT_COLS_WIDTH,
  StudentCells,
  StudentColGroup,
  StudentHeadCells,
  formatStudentName,
} from "@/components/tracking/StudentColumns";
import { STATUS_CONFIG, STATUS_ORDER } from "@/components/tracking/statusConfig";
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

const STATUS_COL = 132;
const ACCESS_COL = 112;

interface StatusCellProps {
  status: TrackingStatus;
  title: string;
  pending: boolean;
  onChange: (status: TrackingStatus) => void;
  onView: () => void;
}

function StatusCell({ status, title, pending, onChange, onView }: StatusCellProps) {
  const config = STATUS_CONFIG[status];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={pending}
        title={`${title}: ${config.label}`}
        aria-label={`${title}: ${config.label}. Change status`}
        className={cn(
          "inline-flex h-7 w-full items-center justify-between gap-1 rounded-md border px-2 text-[11px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring",
          config.chipClass,
          pending && "opacity-40",
        )}
      >
        <span className="truncate">{config.label}</span>
        <ChevronDown className="h-2.5 w-2.5 shrink-0 opacity-60" />
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

interface EvaluationPanelProps {
  semesterId: number;
  evaluationKey: EvaluationKey;
  search: string;
}

/** Isang built-in na evaluation: status ng bawat student at kung bukas ito para sa kanya */
export function EvaluationPanel({ semesterId, evaluationKey, search }: EvaluationPanelProps) {
  const { data, error, loading, reload, refresh, update } =
    useSectionData<EvaluationTrackingData>("/coordinator/tracking/evaluation", semesterId, {
      key: evaluationKey,
    });

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [prevSearch, setPrevSearch] = useState(search);
  const [pendingStatus, setPendingStatus] = useState<number | null>(null);
  const [pendingAccess, setPendingAccess] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmAll, setConfirmAll] = useState<boolean | null>(null);
  const [review, setReview] = useState<EvaluationStudent | null>(null);

  if (prevSearch !== search) {
    setPrevSearch(search);
    setPage(1);
  }

  const filtered = useMemo(() => {
    const rows = data?.students ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((s) =>
      `${s.lastname} ${s.firstname} ${s.studentNumber}`.toLowerCase().includes(q),
    );
  }, [data, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const offset = (currentPage - 1) * pageSize;

  const selection = useRowSelection(
    filtered.map((s) => s.id),
    pageRows.map((s) => s.id),
    `${semesterId}-${evaluationKey}`,
  );

  const requirement = data?.requirement ?? null;
  const title = requirement?.title ?? "Evaluation";

  // Ang mababago lang: para tama ang bilang sa kumpirmasyon
  const closedIds = filtered.filter((s) => !s.open).map((s) => s.id);
  const openIds = filtered.filter((s) => s.open).map((s) => s.id);
  const openTotal = (data?.students ?? []).filter((s) => s.open).length;
  const confirmIds = confirmAll === null ? [] : confirmAll ? closedIds : openIds;
  const scopeNote = search.trim() ? " matching your search" : "";
  const plural = (n: number) => `${n} student${n === 1 ? "" : "s"}`;

  function applyStudent(studentId: number, patch: Partial<EvaluationStudent>) {
    update((d) => ({
      ...d,
      students: d.students.map((s) => (s.id === studentId ? { ...s, ...patch } : s)),
    }));
  }

  async function sendAccess(studentIds: number[], open: boolean) {
    await postBulk(
      "evaluation-access",
      { semesterId, key: evaluationKey, studentIds, open },
      `${title} ${open ? "opened" : "closed"}`,
    );
  }

  async function toggleOne(student: EvaluationStudent) {
    setPendingAccess(student.id);
    try {
      await sendAccess([student.id], !student.open);
      applyStudent(student.id, { open: !student.open });
    } catch (err) {
      notify.error(getErrorMessage(err, "Couldn't update this student."));
      await refresh();
    } finally {
      setPendingAccess(null);
    }
  }

  async function applyMany(studentIds: number[], open: boolean) {
    setBusy(true);
    try {
      await sendAccess(studentIds, open);
      selection.clear();
    } catch (err) {
      notify.error(getErrorMessage(err, "The bulk action failed."));
    } finally {
      await refresh();
      setBusy(false);
      setConfirmAll(null);
    }
  }

  async function changeStatus(student: EvaluationStudent, status: TrackingStatus) {
    if (!requirement) return;
    setPendingStatus(student.id);
    try {
      await api.patch("/coordinator/tracking/status", {
        studentId: student.id,
        requirementId: requirement.id,
        status,
      });
      applyStudent(student.id, { status });
    } catch (err) {
      notify.error(getErrorMessage(err, "Failed to update the status."));
    } finally {
      setPendingStatus(null);
    }
  }

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy || closedIds.length === 0}
          onClick={() => setConfirmAll(true)}
        >
          <LockOpen className="h-3.5 w-3.5" />
          Open for all
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy || openIds.length === 0}
          onClick={() => setConfirmAll(false)}
        >
          <Lock className="h-3.5 w-3.5" />
          Close for all
        </Button>
        {data && (
          <span className="ml-auto">
            {filtered.length} of {data.students.length} students · {openTotal} open
          </span>
        )}
      </div>

      {error && (
        <Alert variant="destructive" className="mb-3">
          <AlertDescription className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            {error}
            <Button variant="outline" size="sm" onClick={reload}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <BulkBar selection={selection} filteredTotal={filtered.length}>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => void applyMany(selection.selectedIds, true)}
        >
          <LockOpen className="h-3.5 w-3.5" />
          Open for selected
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => void applyMany(selection.selectedIds, false)}
        >
          <Lock className="h-3.5 w-3.5" />
          Close for selected
        </Button>
      </BulkBar>

      <div className="isolate rounded-xl border bg-card">
        {loading && (
          <div className="flex flex-col gap-2 p-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        )}

        {data && !requirement && (
          <p className="py-16 text-center text-sm text-muted-foreground">
            This evaluation isn't available for this semester yet.
          </p>
        )}

        {data && requirement && (
          <>
            <Table
              className="table-fixed text-xs"
              style={{ minWidth: STUDENT_COLS_WIDTH + SELECT_COL + STATUS_COL + ACCESS_COL + 40 }}
            >
              <colgroup>
                <StudentColGroup selectable />
                <col style={{ width: STATUS_COL }} />
                <col style={{ width: ACCESS_COL }} />
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
                  <TableHead className="h-14 whitespace-normal px-2 pb-2 align-bottom">
                    <HeaderLink
                      to={`/coordinator/document-requirements/${requirement.id}/submissions`}
                      title={`${requirement.title} · open the students' submissions`}
                    >
                      <span className="block text-[11px] font-medium leading-tight">Status</span>
                    </HeaderLink>
                  </TableHead>
                  <TableHead className="h-14 px-2 pb-2 align-bottom">Access</TableHead>
                  <TableHead className="h-14 p-0" />
                </TableRow>
              </TableHeader>

              <TableBody>
                {pageRows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                      No students found.
                    </TableCell>
                  </TableRow>
                )}

                {pageRows.map((s, index) => (
                  <TableRow
                    key={s.id}
                    data-state={selection.isSelected(s.id) ? "selected" : undefined}
                  >
                    <StudentCells
                      number={offset + index + 1}
                      student={s}
                      selection={{
                        checked: selection.isSelected(s.id),
                        onChange: () => selection.toggle(s.id),
                      }}
                    />
                    <TableCell className="px-2 py-1">
                      <StatusCell
                        status={s.status}
                        title={requirement.title}
                        pending={pendingStatus === s.id}
                        onChange={(status) => void changeStatus(s, status)}
                        onView={() => setReview(s)}
                      />
                    </TableCell>
                    <TableCell className="px-2 py-1">
                      <button
                        type="button"
                        disabled={pendingAccess === s.id || busy}
                        aria-pressed={s.open}
                        aria-label={`${requirement.title} is ${s.open ? "open" : "closed"} for ${formatStudentName(s)}. ${s.open ? "Close" : "Open"} it`}
                        title={s.open ? "Open. Click to close it." : "Closed. Click to open it."}
                        onClick={() => void toggleOne(s)}
                        className={cn(
                          "inline-flex h-7 w-full items-center justify-center gap-1.5 rounded-md border px-2 text-[11px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40",
                          s.open
                            ? "border-emerald-600/30 bg-emerald-600/10 text-emerald-700 hover:bg-emerald-600/20 dark:text-emerald-400"
                            : "bg-muted text-muted-foreground hover:bg-muted/70",
                        )}
                      >
                        {s.open ? <LockOpen className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                        {s.open ? "Open" : "Closed"}
                      </button>
                    </TableCell>
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

      <ConfirmDialog
        open={confirmAll !== null}
        title={`${confirmAll ? "Open" : "Close"} ${title} for ${plural(confirmIds.length)}?`}
        description={
          confirmAll
            ? `${plural(confirmIds.length)}${scopeNote} will be able to work on it, and it starts counting in their progress.`
            : `${plural(confirmIds.length)}${scopeNote} won't be able to change it. Their work is kept, and it stops counting in their progress until it's reopened.`
        }
        confirmLabel={confirmAll ? "Open" : "Close"}
        loading={busy}
        onConfirm={() => void applyMany(confirmIds, Boolean(confirmAll))}
        onCancel={() => setConfirmAll(null)}
      />

      {review && requirement && (
        <ReviewDialog
          key={`${review.id}-${requirement.id}`}
          kind="requirement"
          studentId={review.id}
          itemId={requirement.id}
          studentName={formatStudentName(review)}
          itemLabel={requirement.title}
          evaluation
          initialStatus={review.status}
          onOpenChange={(open) => {
            if (!open) setReview(null);
          }}
          onSaved={(result) => applyStudent(review.id, { status: result.cell.status })}
        />
      )}
    </>
  );
}
