import { Check, ChevronDown, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TrackingStatus } from "@/types/tracking";
import { STATUS_CONFIG, STATUS_ORDER } from "@/components/tracking/statusConfig";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Props {
  status: TrackingStatus;
  /** Dagdag na teksto sa chip, hal. "120h" o "Good" */
  detail?: string;
  title: string;
  pending: boolean;
  onChange: (status: TrackingStatus) => void;
  onView: () => void;
}

/** Chip ng status na may menu: View work at pagpapalit ng status */
export function ReviewStatusCell({ status, detail, title, pending, onChange, onView }: Props) {
  const config = STATUS_CONFIG[status];
  const text = detail ? `${config.short} · ${detail}` : config.short;
  const tooltip =
    status === "ASSIGNED"
      ? `${title}: ${config.label} (nothing submitted yet)`
      : `${title}: ${config.label}${detail ? ` · ${detail}` : ""}`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={pending}
        title={tooltip}
        aria-label={`${tooltip}. Open menu`}
        className={cn(
          "inline-flex h-6 w-full items-center justify-between gap-0.5 rounded-md border px-1.5 text-[10px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring",
          config.chipClass,
          pending && "opacity-40",
        )}
      >
        <span className="truncate">{text}</span>
        <ChevronDown className="h-2.5 w-2.5 shrink-0 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center">
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
