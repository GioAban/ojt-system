import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type PlacementKey = "FOR_APPROVAL" | "APPROVED" | "DEPLOYED";

export const PLACEMENT_OPTIONS: {
  key: PlacementKey;
  stored: string;
  label: string;
  hint: string;
  chipClass: string;
}[] = [
  {
    key: "FOR_APPROVAL",
    stored: "For Approval",
    label: "For Approval",
    hint: "The student can only see the companies.",
    chipClass: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  },
  {
    key: "APPROVED",
    stored: "Approved",
    label: "Approved",
    hint: "The student can apply to a company or request a new company and department.",
    chipClass: "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-400",
  },
  {
    key: "DEPLOYED",
    stored: "Deployed",
    label: "Deployed",
    hint: "Placed in a company: the application was accepted or you assigned one.",
    chipClass:
      "border-emerald-600/30 bg-emerald-600/10 text-emerald-700 dark:text-emerald-400",
  },
];

interface Props {
  /** Nakaimbak na status: For Approval, Approved, Deployed, o Completed */
  status: string;
  pending: boolean;
  onChange: (status: PlacementKey) => void;
}

/** Status ng student sa placement. Ang Completed ay hindi mapipili rito (may sarili itong proseso). */
export function PlacementStatusCell({ status, pending, onChange }: Props) {
  const current = PLACEMENT_OPTIONS.find(
    (o) => o.stored.toLowerCase() === status.toLowerCase(),
  );

  if (!current) {
    // Completed (o hindi kilalang status): nababasa lang
    return (
      <span
        title="Completed students are managed in the Post-deployment tab."
        className="inline-flex h-6 w-full items-center rounded-md border border-primary/30 bg-primary/10 px-1.5 text-[11px] font-medium text-primary"
      >
        {status}
      </span>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={pending}
        title={current.hint}
        aria-label={`Status: ${current.label}. Change status`}
        className={cn(
          "inline-flex h-6 w-full items-center justify-between gap-1 rounded-md border px-1.5 text-[11px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring",
          current.chipClass,
          pending && "opacity-40",
        )}
      >
        <span className="truncate">{current.label}</span>
        <ChevronDown className="h-3 w-3 shrink-0 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        {PLACEMENT_OPTIONS.map((option) => (
          <DropdownMenuItem
            key={option.key}
            className="flex-col items-start gap-0.5"
            onClick={() => {
              if (option.key !== current.key) onChange(option.key);
            }}
          >
            <span className="flex w-full items-center gap-2 font-medium">
              <span className="flex-1">{option.label}</span>
              {option.key === current.key && (
                <Check className="h-4 w-4 text-muted-foreground" />
              )}
            </span>
            <span className="text-xs font-normal text-muted-foreground">
              {option.hint}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
