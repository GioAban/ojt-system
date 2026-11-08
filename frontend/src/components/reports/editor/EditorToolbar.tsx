import {
  Check, CloudOff, Eraser, Eye, Loader2, Maximize2, Minus, MoreHorizontal, Plus, Redo2, RefreshCw,
  Save, Settings2, Undo2, Upload, UserPlus,
} from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import { EditModeSwitch } from "@/components/reports/editor/EditModeSwitch";
import { PageSettingsPanel } from "@/components/reports/editor/PageSettingsPanel";
import { SYNC_TEXT, type SyncStatus } from "@/hooks/useReportDraft";
import type { PageSettings } from "@/types/reports";

interface EditorToolbarProps {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  scale: number;
  onZoomStep: (dir: 1 | -1) => void;
  onFit: () => void;
  onActual: () => void;
  status: SyncStatus;
  onSave: () => void;
  settings: PageSettings;
  onSettings: (next: PageSettings) => void;
  allowOrientation?: boolean;
  /** "Add new students (N)"; 0 o wala = hindi ipinapakita */
  missingCount?: number;
  onAddMissing?: () => void;
  onReload: () => void;
  onClear: () => void;
  onPreview: () => void;
  editMode: boolean;
  onEditMode: (on: boolean) => void;
  /** Mga pagbabagong pwedeng isulat sa system; 0 o wala = hindi ipinapakita */
  applyCount?: number;
  onApplyAll?: () => void;
  /** Hal. ang pagpili ng column */
  extra?: ReactNode;
}

/** Manipis na toolbar sa itaas ng papel (nakadikit sa ilalim ng top bar) */
export function EditorToolbar(p: EditorToolbarProps) {
  const saving = p.status === "syncing" || p.status === "local";
  const missingCount = p.missingCount ?? 0;
  const StatusIcon = saving ? Loader2 : p.status === "offline" || p.status === "error" ? CloudOff : Check;
  return (
    <div
      role="toolbar"
      aria-label="Report editor"
      className="sticky top-14 z-20 -mx-4 mb-3 border-b bg-background/95 px-4 py-2 backdrop-blur sm:mx-0 sm:rounded-xl sm:border"
    >
      <div className="flex flex-wrap items-center gap-1">
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Undo (Ctrl+Z)" title="Undo (Ctrl+Z)" disabled={!p.canUndo} onClick={p.onUndo}>
          <Undo2 className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Redo (Ctrl+Y)" title="Redo (Ctrl+Y)" disabled={!p.canRedo} onClick={p.onRedo}>
          <Redo2 className="h-4 w-4" />
        </Button>

        <span className="mx-1 h-5 w-px bg-border" aria-hidden />

        <Button type="button" variant="ghost" size="icon-sm" aria-label="Zoom out" title="Zoom out" onClick={() => p.onZoomStep(-1)}>
          <Minus className="h-4 w-4" />
        </Button>
        <span className="w-11 text-center text-xs tabular-nums text-muted-foreground" aria-live="polite">
          {Math.round(p.scale * 100)}%
        </span>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Zoom in" title="Zoom in" onClick={() => p.onZoomStep(1)}>
          <Plus className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="sm" className="hidden sm:inline-flex" onClick={p.onFit} title="Fit the page width">
          <Maximize2 className="h-3.5 w-3.5" /> Fit
        </Button>
        <Button type="button" variant="ghost" size="sm" className="hidden sm:inline-flex" onClick={p.onActual}>
          100%
        </Button>

        <span className="mx-1 hidden h-5 w-px bg-border sm:block" aria-hidden />

        <p className="hidden min-w-0 items-center gap-1.5 text-xs text-muted-foreground lg:inline-flex" aria-live="polite">
          <StatusIcon className={saving ? "h-3.5 w-3.5 shrink-0 animate-spin" : "h-3.5 w-3.5 shrink-0"} />
          <span className="truncate">{SYNC_TEXT[p.status]}</span>
        </p>
        <span className="lg:hidden" title={SYNC_TEXT[p.status]} aria-label={SYNC_TEXT[p.status]} role="status">
          <StatusIcon className={saving ? "h-3.5 w-3.5 animate-spin text-muted-foreground" : "h-3.5 w-3.5 text-muted-foreground"} />
        </span>

        <span className="flex-1" />

        <EditModeSwitch on={p.editMode} onChange={p.onEditMode} />

        {(p.applyCount ?? 0) > 0 && (
          <Button type="button" variant="outline" size="sm" onClick={p.onApplyAll} title="Write the allowed edits to the real records, after you confirm">
            <Upload className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Apply to system</span> ({p.applyCount})
          </Button>
        )}

        {missingCount > 0 && (
          <Button type="button" variant="outline" size="sm" onClick={p.onAddMissing} title="Students in the system who aren't in this report yet">
            <UserPlus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Add new students</span> ({missingCount})
          </Button>
        )}

        {p.extra}

        <Popover>
          <PopoverTrigger render={<Button type="button" variant="ghost" size="sm" aria-label="Page settings" />}>
            <Settings2 className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Page settings</span>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80">
            <PopoverTitle>Page settings</PopoverTitle>
            <PageSettingsPanel settings={p.settings} onChange={p.onSettings} allowOrientation={p.allowOrientation} compact />
          </PopoverContent>
        </Popover>

        <DropdownMenu>
          <DropdownMenuTrigger render={<Button type="button" variant="ghost" size="icon-sm" aria-label="More actions" title="More actions" />}>
            <MoreHorizontal className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuItem className="gap-2" onClick={p.onReload}>
              <RefreshCw className="h-4 w-4" /> Regenerate from live data
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2 sm:hidden" onClick={p.onFit}>
              <Maximize2 className="h-4 w-4" /> Fit the page width
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2 text-destructive focus:text-destructive" onClick={p.onClear}>
              <Eraser className="h-4 w-4" /> Clear
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button type="button" variant="outline" size="sm" onClick={p.onSave}>
          <Save className="h-3.5 w-3.5" />
          Save
        </Button>

        <Button type="button" size="sm" onClick={p.onPreview}>
          <Eye className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Preview, print or download</span>
          <span className="sm:hidden">Preview</span>
        </Button>
      </div>
    </div>
  );
}
