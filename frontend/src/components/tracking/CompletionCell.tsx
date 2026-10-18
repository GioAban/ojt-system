import { Pencil } from "lucide-react";
import { formatLongDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const STATUS_CHIP: Record<string, string> = {
  "For Approval": "border-dashed text-muted-foreground",
  Approved:
    "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  Deployed: "border-sky-600/30 bg-sky-600/10 text-sky-700 dark:text-sky-400",
  Completed:
    "border-emerald-600/30 bg-emerald-600/10 text-emerald-700 dark:text-emerald-400",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 shrink-0 items-center rounded-md border px-1.5 text-[10px] font-medium",
        STATUS_CHIP[status] ?? "text-muted-foreground",
      )}
    >
      {status}
    </span>
  );
}

interface CompletionCellProps {
  status: string;
  completedDate: string | null;
  hasCompany: boolean;
  onOpen: () => void;
}

export function CompletionCell({
  status,
  completedDate,
  hasCompany,
  onOpen,
}: CompletionCellProps) {
  if (status === "Completed") {
    const date = formatLongDate(completedDate);

    return (
      <div className="flex min-w-0 items-center gap-2">
        <StatusBadge status={status} />
        <span
          className="truncate text-[11px] text-muted-foreground"
          title={date}
        >
          {date}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 shrink-0 gap-1 px-1.5 text-[11px] text-muted-foreground"
          onClick={onOpen}
        >
          <Pencil className="h-3 w-3" />
          Edit date
        </Button>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 items-center gap-2">
      <StatusBadge status={status} />
      {hasCompany ? (
        <Button
          type="button"
          size="sm"
          className="h-6 px-2 text-xs"
          onClick={onOpen}
        >
          Mark as completed
        </Button>
      ) : (
        <span
          className="truncate text-[11px] text-muted-foreground"
          title="Assign a company to this student in the Initial tab first"
        >
          No company yet
        </span>
      )}
    </div>
  );
}
