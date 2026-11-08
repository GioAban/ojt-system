import { useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { CellDef } from "@/lib/hteCells";

interface CellSheetProps {
  cells: CellDef[];
  openId: string | null;
  onClose: () => void;
  onCommit: (id: string, value: string) => void;
  onNavigate: (id: string) => void;
  /** Hal. Reset at Apply to system ng cell na ito */
  renderExtra?: (cell: CellDef) => ReactNode;
}

/** Sa telepono: malaking text box para sa isang cell, may Previous/Next, Cancel at Done */
export function CellSheet({ cells, openId, onClose, onCommit, onNavigate, renderExtra }: CellSheetProps) {
  const index = openId ? cells.findIndex((c) => c.id === openId) : -1;
  const cell = index >= 0 ? cells[index] : null;
  return (
    <Sheet open={cell !== null} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="bottom" className="max-h-[85dvh] gap-3 rounded-t-2xl p-4 pb-[max(env(safe-area-inset-bottom),1rem)]">
        {cell && (
          <CellForm
            key={cell.id}
            cell={cell}
            hasPrev={index > 0}
            hasNext={index < cells.length - 1}
            onCancel={onClose}
            onDone={(v) => { if (v !== cell.value) onCommit(cell.id, v); onClose(); }}
            onGo={(v, dir) => {
              if (v !== cell.value) onCommit(cell.id, v);
              onNavigate(cells[index + dir].id);
            }}
            extra={renderExtra?.(cell)}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function CellForm({ cell, hasPrev, hasNext, onCancel, onDone, onGo, extra }: {
  cell: CellDef;
  hasPrev: boolean;
  hasNext: boolean;
  onCancel: () => void;
  onDone: (value: string) => void;
  onGo: (value: string, dir: 1 | -1) => void;
  extra?: ReactNode;
}) {
  const [text, setText] = useState(cell.value);
  return (
    <>
      <SheetHeader className="p-0">
        <SheetTitle>{cell.label}</SheetTitle>
        <SheetDescription>Type the text exactly as it should print.</SheetDescription>
      </SheetHeader>
      <textarea
        autoFocus
        rows={cell.multiline ? 6 : 3}
        value={text}
        aria-label={cell.label}
        onChange={(e) => setText(cell.multiline ? e.target.value : e.target.value.replace(/\n/g, " "))}
        className="w-full resize-y rounded-lg border border-input bg-transparent px-3 py-2 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring dark:bg-input/30"
      />
      {extra}
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="icon" aria-label="Previous cell" disabled={!hasPrev} onClick={() => onGo(text, -1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button type="button" variant="outline" size="icon" aria-label="Next cell" disabled={!hasNext} onClick={() => onGo(text, 1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <span className="flex-1" />
        <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button type="button" onClick={() => onDone(text)}>Done</Button>
      </div>
    </>
  );
}
