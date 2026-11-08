import { RotateCcw, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface CellInfo {
  label: string;
  value: string;
  /** Ang halaga sa system; null kung walang katumbas (hal. tina-type lang sa report) */
  live: string | null;
  /** Kabilang sa mga field na pwedeng isulat pabalik */
  canApply: boolean;
  /** Bakit hindi pwede, kung field na karaniwang pwede */
  applyNote?: string;
}

interface CellActionsProps {
  info: CellInfo;
  onReset: () => void;
  onApply: () => void;
}

/** Ang kalagayan ng napiling cell: binago ba, ano ang nasa system, at ang Reset at Apply to system */
export function CellActions({ info, onReset, onApply }: CellActionsProps) {
  const edited = info.live !== null && info.live !== info.value;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
      <p className="min-w-0 flex-1 basis-48 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{info.label}</span>
        {info.live === null
          ? " · Typed in this report only."
          : edited
            ? <> · Edited in this report. System value: <span className="text-foreground">{info.live || "(blank)"}</span></>
            : " · Same as the system."}
        {edited && info.applyNote && <> {info.applyNote}</>}
      </p>
      {edited && (
        <Button type="button" variant="outline" size="sm" className="pointer-coarse:h-11" onClick={onReset}>
          <RotateCcw className="h-3.5 w-3.5" /> Reset to live value
        </Button>
      )}
      {edited && info.canApply && (
        <Button type="button" variant="outline" size="sm" className="pointer-coarse:h-11" onClick={onApply}>
          <Upload className="h-3.5 w-3.5" /> Apply to system
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
