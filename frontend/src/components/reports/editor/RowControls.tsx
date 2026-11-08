import { useLayoutEffect, useRef, type ReactNode } from "react";
import { ArrowRightLeft, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export interface RowAction {
  key: string;
  label: string;
  icon: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
}

export interface MoveTarget {
  id: string;
  label: string;
}

interface RowControlsProps {
  /** CSS selector ng row sa loob ng lalagyan ng papel; null = walang napili */
  targetSelector: string | null;
  label: string;
  actions: RowAction[];
  /** "Move to another company" */
  moveTargets?: MoveTarget[];
  onMove?: (targetId: string) => void;
  /** Telepono: bar sa ibaba ng screen sa halip na sa gilid ng papel */
  touch: boolean;
  onClose: () => void;
}

/** Mga control ng row o grupo: sa screen lang (wala sa papel, print, PDF o preview) */
export function RowControls({ targetSelector, label, actions, moveTargets, onMove, touch, onClose }: RowControlsProps) {
  const holder = useRef<HTMLDivElement>(null);

  // Ilagay sa tabi ng row (gutter sa kaliwa ng papel); DOM lang ang ginagalaw, walang re-render
  useLayoutEffect(() => {
    if (touch) return;
    const el = holder.current;
    // Ang overlay ay nasa loob mismo ng lalagyan ng papel
    const box = el?.parentElement;
    if (!el || !box || !targetSelector) return;
    const row = box.querySelector(targetSelector);
    if (!row) { el.style.visibility = "hidden"; return; }
    const top = row.getBoundingClientRect().top - box.getBoundingClientRect().top;
    el.style.top = `${Math.max(0, top)}px`;
    el.style.visibility = "visible";
  });

  if (!targetSelector) return null;

  const move = moveTargets && moveTargets.length > 0 && onMove && (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button type="button" variant="ghost" size={touch ? "icon" : "icon-sm"} aria-label="Move to another company" title="Move to another company" />
        }
      >
        <ArrowRightLeft className="h-4 w-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-72 w-64 max-w-[calc(100vw-1rem)] overflow-y-auto">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Move to</DropdownMenuLabel>
          {moveTargets.map((t) => (
            <DropdownMenuItem key={t.id} onClick={() => onMove(t.id)}>{t.label}</DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const buttons = actions.map((a) => (
    <Button
      key={a.key}
      type="button"
      variant="ghost"
      size={touch ? "icon" : "icon-sm"}
      aria-label={a.label}
      title={a.label}
      disabled={a.disabled}
      className={cn(a.destructive && "text-destructive hover:text-destructive")}
      onClick={a.onClick}
    >
      {a.icon}
    </Button>
  ));

  if (touch) {
    return (
      <div
        data-row-controls
        role="toolbar"
        aria-label={`Actions for ${label}`}
        className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 shadow-[0_-2px_8px_rgba(0,0,0,.08)] backdrop-blur"
      >
        <div className="mx-auto flex max-w-xl items-center gap-1">
          <p className="min-w-0 flex-1 truncate px-1 text-xs text-muted-foreground">{label}</p>
          <Button type="button" variant="ghost" size="icon" aria-label="Close actions" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="mx-auto flex max-w-xl flex-wrap items-center justify-around gap-1">
          {buttons}
          {move}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={holder}
      data-row-controls
      role="toolbar"
      aria-label={`Actions for ${label}`}
      aria-orientation="vertical"
      className="absolute left-1 z-10 flex flex-col gap-0.5 rounded-lg border bg-background/95 p-0.5 shadow-sm"
      style={{ visibility: "hidden" }}
    >
      {buttons}
      {move}
    </div>
  );
}
