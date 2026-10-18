import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type MoaValue = "RELEASED" | "NOT_RELEASED";

const OPTIONS: { value: MoaValue; label: string }[] = [
  { value: "RELEASED", label: "Released" },
  { value: "NOT_RELEASED", label: "Not released" },
];

interface MoaCellProps {
  moaStatus: string | null;
  pending: boolean;
  onChange: (value: MoaValue) => void;
}

export function MoaCell({ moaStatus, pending, onChange }: MoaCellProps) {
  const current: MoaValue =
    moaStatus === "Released" ? "RELEASED" : "NOT_RELEASED";
  const released = current === "RELEASED";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={pending}
        aria-label="Change MOA status"
        className={cn(
          "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring",
          released
            ? "border-emerald-600/30 bg-emerald-600/10 text-emerald-700 dark:text-emerald-400"
            : "text-muted-foreground hover:bg-muted",
          pending && "opacity-50",
        )}
      >
        {released ? "Released" : "Not released"}
        <ChevronDown className="h-3 w-3" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {OPTIONS.map((option) => (
          <DropdownMenuItem
            key={option.value}
            className="gap-2"
            onClick={() => {
              if (option.value !== current) onChange(option.value);
            }}
          >
            <span className="flex-1">{option.label}</span>
            {option.value === current && (
              <Check className="h-4 w-4 text-muted-foreground" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
