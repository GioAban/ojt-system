import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CompanyCellProps {
  companyName: string | null;
  onOpen: () => void;
}

export function CompanyCell({ companyName, onOpen }: CompanyCellProps) {
  if (!companyName) {
    return (
      <Button
        type="button"
        variant="destructive"
        size="sm"
        className="h-6 px-2 text-xs"
        onClick={onOpen}
      >
        Assign
      </Button>
    );
  }

  return (
    <div className="flex min-w-0 items-center gap-1">
      <span className="truncate" title={companyName}>
        {companyName}
      </span>
      <button
        type="button"
        aria-label="Change company"
        title="Change company"
        onClick={onOpen}
        className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <Pencil className="h-3 w-3" />
      </button>
    </div>
  );
}
