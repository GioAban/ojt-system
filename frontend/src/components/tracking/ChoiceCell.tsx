import { Check, ChevronDown, Lock, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface ChoiceOption<T extends string> {
  value: T;
  label: string;
  chipClass: string;
}

interface ChoiceCellProps<T extends string> {
  value: T | null;
  options: ChoiceOption<T>[];
  label: string;
  placeholder?: string;
  disabled?: boolean;
  disabledReason?: string;
  pending: boolean;
  onChange: (value: T | null) => void;
}

export function ChoiceCell<T extends string>({
  value,
  options,
  label,
  placeholder = "Select",
  disabled = false,
  disabledReason,
  pending,
  onChange,
}: ChoiceCellProps<T>) {
  const selected = options.find((o) => o.value === value) ?? null;

  if (disabled) {
    return (
      <span
        title={disabledReason}
        className={cn(
          "inline-flex h-6 w-full cursor-not-allowed items-center gap-1.5 px-1.5 text-[11px]",
          selected
            ? cn(
                "rounded-md border text-[10px] font-medium opacity-60",
                selected.chipClass,
              )
            : "text-muted-foreground/50",
        )}
      >
        <Lock className="h-3 w-3 shrink-0" />
        <span className="truncate">{selected ? selected.label : "Locked"}</span>
      </span>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={pending}
        title={`${label}: ${selected ? selected.label : "not set"}`}
        aria-label={`${label}: ${selected ? selected.label : "not set"}. Change`}
        className={cn(
          "inline-flex h-6 w-full items-center justify-between gap-0.5 rounded-md border px-1.5 text-[10px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring",
          selected
            ? selected.chipClass
            : "border-dashed border-primary/40 bg-primary/5 text-primary hover:bg-primary/10",
          pending && "opacity-40",
        )}
      >
        <span className="truncate">
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown className="h-2.5 w-2.5 shrink-0 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center">
        {options.map((option) => (
          <DropdownMenuItem
            key={option.value}
            className="gap-2"
            onClick={() => {
              if (option.value !== value) onChange(option.value);
            }}
          >
            <span className="flex-1">{option.label}</span>
            {option.value === value && (
              <Check className="h-4 w-4 text-muted-foreground" />
            )}
          </DropdownMenuItem>
        ))}
        {selected && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="gap-2 text-muted-foreground"
              onClick={() => onChange(null)}
            >
              <X className="h-4 w-4" />
              Clear
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
