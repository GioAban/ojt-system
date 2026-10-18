import { useState } from "react";
import {
  Building2,
  CalendarDays,
  CircleCheck,
  Clock,
  FileSignature,
  ListChecks,
  Star,
  Undo2,
  UserMinus,
} from "lucide-react";
import { getErrorMessage } from "@/lib/errors";
import { postBulk } from "@/lib/bulk";
import { notify } from "@/lib/notify";
import { formatPeriod, todayIso } from "@/lib/dates";
import type { RowSelection } from "@/hooks/useRowSelection";
import type { TrackingStatus } from "@/types/tracking";
import type { DtrColumn, WeeklyColumn } from "@/types/trackingSections";
import { AssignCompanyDialog } from "@/components/tracking/AssignCompanyDialog";
import { BulkBar } from "@/components/tracking/BulkBar";
import { BulkItemsStatusDialog } from "@/components/tracking/BulkItemsStatusDialog";
import {
  BulkDateDialog,
  BulkHoursDialog,
  BulkRatingDialog,
  BulkStatusDialog,
} from "@/components/tracking/BulkDialogs";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const STATUS_LABEL: Record<TrackingStatus, string> = {
  ASSIGNED: "Assigned",
  FOR_CHECKING: "For checking",
  CHECKED: "Checked",
  INVALID: "Invalid",
};

const RATING_LABEL: Record<string, string> = {
  EXCELLENT: "Excellent",
  VERY_GOOD: "Very Good",
  GOOD: "Good",
  POOR: "Poor",
  NONE: "No evaluation",
};

type Done = () => Promise<void> | void;

// ---------------------------------------------------------------------------
// Requirements (Initial, Pre-deployment, Post-deployment)
// ---------------------------------------------------------------------------

type RequirementsDialog =
  | "status"
  | "assign"
  | "remove"
  | "complete"
  | "revert"
  | null;

interface RequirementsBulkActionsProps {
  selection: RowSelection;
  filteredTotal: number;
  requirements: { id: number; title: string }[];
  showPlacement: boolean;
  showCompletion: boolean;
  onDone: Done;
}

export function RequirementsBulkActions({
  selection,
  filteredTotal,
  requirements,
  showPlacement,
  showCompletion,
  onDone,
}: RequirementsBulkActionsProps) {
  const [dialog, setDialog] = useState<RequirementsDialog>(null);
  const [busy, setBusy] = useState(false);

  const ids = selection.selectedIds;
  const count = ids.length;
  const close = (open: boolean) => {
    if (!open) setDialog(null);
  };

  async function quick(path: string, body: object, what: string) {
    setBusy(true);
    try {
      await postBulk(path, body, what);
      await onDone();
    } catch (err) {
      notify.error(getErrorMessage(err, "The bulk action failed."));
    } finally {
      setBusy(false);
      setDialog(null);
    }
  }

  return (
    <>
      <BulkBar selection={selection} filteredTotal={filteredTotal}>
        {requirements.length > 0 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setDialog("status")}
          >
            <ListChecks className="h-3.5 w-3.5" />
            Set status
          </Button>
        )}

        {showPlacement && (
          <>
            <DropdownMenu>
              <DropdownMenuTrigger
                disabled={busy}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                <ListChecks className="h-3.5 w-3.5" />
                Placement status
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem
                  onClick={() =>
                    void quick(
                      "placement-status",
                      { studentIds: ids, status: "FOR_APPROVAL" },
                      "Status set to For Approval",
                    )
                  }
                >
                  For Approval
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() =>
                    void quick(
                      "placement-status",
                      { studentIds: ids, status: "APPROVED" },
                      "Status set to Approved",
                    )
                  }
                >
                  Approved
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger
                disabled={busy}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                <FileSignature className="h-3.5 w-3.5" />
                MOA
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem
                  onClick={() =>
                    void quick(
                      "moa",
                      { studentIds: ids, status: "RELEASED" },
                      "MOA set to Released",
                    )
                  }
                >
                  Released
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() =>
                    void quick(
                      "moa",
                      { studentIds: ids, status: "NOT_RELEASED" },
                      "MOA set to Not released",
                    )
                  }
                >
                  Not released
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDialog("assign")}
            >
              <Building2 className="h-3.5 w-3.5" />
              Assign company
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDialog("remove")}
            >
              <UserMinus className="h-3.5 w-3.5" />
              Remove from company
            </Button>
          </>
        )}

        {showCompletion && (
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDialog("complete")}
            >
              <CircleCheck className="h-3.5 w-3.5" />
              Mark as completed
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDialog("revert")}
            >
              <Undo2 className="h-3.5 w-3.5" />
              Revert to Deployed
            </Button>
          </>
        )}
      </BulkBar>

      {dialog === "status" && (
        <BulkStatusDialog
          onOpenChange={close}
          count={count}
          requirements={requirements}
          onSubmit={async (requirementIds, status) => {
            await postBulk(
              "status",
              { studentIds: ids, requirementIds, status },
              `Status set to ${STATUS_LABEL[status]}`,
            );
            await onDone();
          }}
        />
      )}

      {dialog === "assign" && (
        <AssignCompanyDialog
          open
          onOpenChange={close}
          studentId={ids[0]}
          studentName={`${count} students`}
          currentLabel={null}
          bulk={{
            count,
            onSubmit: async (departmentId) => {
              await postBulk(
                "department",
                { studentIds: ids, departmentId },
                "Company assigned",
              );
              await onDone();
            },
          }}
        />
      )}

      {dialog === "complete" && (
        <BulkDateDialog
          onOpenChange={close}
          title="Mark as completed"
          description={`Select the date the ${count} selected student${count === 1 ? "" : "s"} finished the OJT. Their status will change to Completed.`}
          label="Date completed"
          hint="Students without a company, or who started after this date, are skipped."
          initial={todayIso()}
          max={todayIso()}
          submitLabel="Mark as completed"
          onSubmit={async (date) => {
            await postBulk(
              "complete",
              { studentIds: ids, completedDate: date },
              "Marked as completed",
            );
            await onDone();
          }}
        />
      )}

      <ConfirmDialog
        open={dialog === "remove"}
        title="Remove from company?"
        description={`The ${count} selected student${count === 1 ? "" : "s"} will be removed from their company and department. Their slots will be freed. Students without a company are skipped.`}
        confirmLabel="Remove"
        loading={busy}
        onConfirm={() =>
          void quick(
            "department/remove",
            { studentIds: ids },
            "Removed from company",
          )
        }
        onCancel={() => setDialog(null)}
      />

      <ConfirmDialog
        open={dialog === "revert"}
        title="Revert to Deployed?"
        description={`The completion date, hired date, job relation, and employability of the selected students will be cleared. Students who aren't completed are skipped.`}
        confirmLabel="Revert"
        loading={busy}
        onConfirm={() =>
          void quick("revert", { studentIds: ids }, "Returned to Deployed")
        }
        onCancel={() => setDialog(null)}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Weekly reports
// ---------------------------------------------------------------------------

interface WeeklyBulkActionsProps {
  selection: RowSelection;
  filteredTotal: number;
  weeks: WeeklyColumn[];
  onDone: Done;
}

export function WeeklyBulkActions({
  selection,
  filteredTotal,
  weeks,
  onDone,
}: WeeklyBulkActionsProps) {
  const [dialog, setDialog] = useState<"status" | "rating" | null>(null);
  const open = dialog === "rating";
  const setOpen = (value: boolean) => setDialog(value ? "rating" : null);
  const ids = selection.selectedIds;

  return (
    <>
      <BulkBar selection={selection} filteredTotal={filteredTotal}>
        {weeks.length > 0 && (
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDialog("status")}
            >
              <ListChecks className="h-3.5 w-3.5" />
              Set status
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setOpen(true)}
            >
              <Star className="h-3.5 w-3.5" />
              Set evaluation
            </Button>
          </>
        )}
      </BulkBar>

      {dialog === "status" && (
        <BulkItemsStatusDialog
          onOpenChange={(value) => !value && setDialog(null)}
          count={ids.length}
          noun="week"
          kind="weekly"
          items={weeks.map((w) => ({ id: w.id, label: formatPeriod(w.dateFrom, w.dateTo) }))}
          onSubmit={async (itemIds, status, extra) => {
            await postBulk(
              "weekly-status",
              { studentIds: ids, itemIds, status, rating: extra.rating },
              `Status set to ${STATUS_LABEL[status]}`,
            );
            await onDone();
          }}
        />
      )}

      {open && (
        <BulkRatingDialog
          onOpenChange={setOpen}
          count={ids.length}
          weeks={weeks}
          onSubmit={async (reportIds, rating) => {
            await postBulk(
              "weekly-rating",
              { studentIds: ids, reportIds, rating },
              `Evaluation set to ${RATING_LABEL[rating]}`,
            );
            await onDone();
          }}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// DTR
// ---------------------------------------------------------------------------

type DtrDialog = "hours" | "start" | "status" | null;

interface DtrBulkActionsProps {
  selection: RowSelection;
  filteredTotal: number;
  months: DtrColumn[];
  onDone: Done;
}

export function DtrBulkActions({
  selection,
  filteredTotal,
  months,
  onDone,
}: DtrBulkActionsProps) {
  const [dialog, setDialog] = useState<DtrDialog>(null);
  const ids = selection.selectedIds;
  const count = ids.length;
  const close = (open: boolean) => {
    if (!open) setDialog(null);
  };

  return (
    <>
      <BulkBar selection={selection} filteredTotal={filteredTotal}>
        {months.length > 0 && (
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDialog("status")}
            >
              <ListChecks className="h-3.5 w-3.5" />
              Set status
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDialog("hours")}
            >
              <Clock className="h-3.5 w-3.5" />
              Set hours
            </Button>
          </>
        )}

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setDialog("start")}
        >
          <CalendarDays className="h-3.5 w-3.5" />
          Set start date
        </Button>
      </BulkBar>

      {dialog === "status" && (
        <BulkItemsStatusDialog
          onOpenChange={close}
          count={count}
          noun="month"
          kind="dtr"
          items={months.map((m) => ({ id: m.id, label: m.month }))}
          hint="The student's total rendered hours is updated."
          onSubmit={async (itemIds, status, extra) => {
            await postBulk(
              "dtr-status",
              { studentIds: ids, itemIds, status, hours: extra.hours },
              `Status set to ${STATUS_LABEL[status]}`,
            );
            await onDone();
          }}
        />
      )}

      {dialog === "hours" && (
        <BulkHoursDialog
          onOpenChange={close}
          count={count}
          months={months}
          onSubmit={async (dtrId, hours) => {
            await postBulk(
              "dtr-hours",
              { studentIds: ids, dtrId, hours },
              "Hours saved",
            );
            await onDone();
          }}
        />
      )}

      {dialog === "start" && (
        <BulkDateDialog
          onOpenChange={close}
          title="Set start date"
          description={`The date the ${count} selected student${count === 1 ? "" : "s"} started the training.`}
          label="Date started"
          hint="Leave blank to clear it. The deployed date will be shown instead."
          allowClear
          submitLabel="Apply"
          onSubmit={async (date) => {
            await postBulk(
              "start-date",
              { studentIds: ids, startDate: date },
              "Start date set",
            );
            await onDone();
          }}
        />
      )}
    </>
  );
}
