import type { ReactNode } from "react";
import { X } from "lucide-react";
import type { RowSelection } from "@/hooks/useRowSelection";
import { Button } from "@/components/ui/button";

interface BulkBarProps {
  selection: RowSelection;
  filteredTotal: number;
  children: ReactNode;
}

export function BulkBar({ selection, filteredTotal, children }: BulkBarProps) {
  if (selection.count === 0) return null;

  return (
    <div
      role="region"
      aria-label="Bulk actions"
      className="sticky top-2 z-[3] mb-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border bg-card px-3 py-2 shadow-md"
    >
      <span className="text-sm font-medium">{selection.count} selected</span>

      {selection.pageChecked && !selection.allFilteredSelected && (
        <Button
          type="button"
          variant="link"
          size="sm"
          className="h-auto p-0"
          onClick={selection.selectAllFiltered}
        >
          Select all {filteredTotal} students
        </Button>
      )}

      {selection.allFilteredSelected && filteredTotal > 1 && (
        <span className="text-xs text-muted-foreground">
          All {filteredTotal} students selected
        </span>
      )}

      <Button type="button" variant="ghost" size="sm" onClick={selection.clear}>
        <X className="h-3.5 w-3.5" />
        Clear
      </Button>

      <span className="hidden h-5 w-px bg-border sm:block" />

      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}
