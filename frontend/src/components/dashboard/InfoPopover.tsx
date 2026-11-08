import type { ReactNode } from "react";
import { CircleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";

interface InfoPopoverProps {
  /** Pangalan ng numero o chart, hal. "Needs attention" */
  title: string;
  children: ReactNode;
}

/** Maliit na "!" na button: pindot, tap, o Enter/Space para makita kung paano kinuwenta */
export function InfoPopover({ title, children }: InfoPopoverProps) {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="shrink-0 rounded-full text-muted-foreground hover:text-foreground"
            aria-label={`How "${title}" is calculated`}
          />
        }
      >
        <CircleAlert className="h-4 w-4" />
      </PopoverTrigger>
      <PopoverContent align="start">
        <PopoverTitle>{title}</PopoverTitle>
        <PopoverDescription render={<div />} className="flex flex-col gap-1.5 leading-relaxed">
          {children}
        </PopoverDescription>
      </PopoverContent>
    </Popover>
  );
}
