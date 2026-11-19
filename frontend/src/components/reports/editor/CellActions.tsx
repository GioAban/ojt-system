import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface CellInfo {
  label: string;
  value: string;
  /** Ang halaga sa system o template; null kung walang katumbas (hal. tina-type lang sa report) */
  live: string | null;
}

interface CellActionsProps {
  info: CellInfo;
  onReset: () => void;
}

/** Ang kalagayan ng napiling teksto: binago ba sa report lang, ano ang nasa system, at Reset to system value */
export function CellActions({ info, onReset }: CellActionsProps) {
  const edited = info.live !== null && info.live !== info.value;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
      <p className="min-w-0 flex-1 basis-48 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{info.label}</span>
        {info.live === null
          ? " · Typed in this report only."
          : edited
            ? <> · Edited in this report only, the system value is <span className="text-foreground">{info.live || "(blank)"}</span>.</>
            : " · Same as the system."}
      </p>
      {edited && (
        <Button type="button" variant="outline" size="sm" className="pointer-coarse:h-11" onClick={onReset}>
          <RotateCcw className="h-3.5 w-3.5" /> Reset to system value
        </Button>
      )}
    </div>
  );
}

/** Nakadikit sa ibaba ng screen habang nag-e-edit sa desktop */
export function CellActionsBar(props: CellActionsProps) {
  return (
    <div className="sticky bottom-2 z-20 mt-2 rounded-xl border bg-background/95 p-2 shadow-sm backdrop-blur">
      <CellActions {...props} />
    </div>
  );
}
