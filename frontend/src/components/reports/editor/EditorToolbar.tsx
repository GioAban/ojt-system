import {
  Check, CloudOff, Database, Eraser, Eye, Loader2, Maximize2, Minus, MoreHorizontal, Plus, Redo2, RefreshCw,
  SlidersHorizontal, Undo, Undo2, UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EditModeSwitch } from "@/components/reports/editor/EditModeSwitch";
import { SYNC_TEXT, type SyncStatus } from "@/hooks/useReportDraft";

interface EditorToolbarProps {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  scale: number;
  onZoomStep: (dir: 1 | -1) => void;
  onFit: () => void;
  onActual: () => void;
  /** Awtomatikong nase-save ang report; ito lang ang palatandaan (Saved, Saving..., Offline) */
  status: SyncStatus;
  /** Ang sidebar ng mga setting (sa telepono: bottom sheet) */
  settingsOpen: boolean;
  onToggleSettings: () => void;
  /** "Add new students (N)"; 0 o wala = hindi ipinapakita */
  missingCount?: number;
  onAddMissing?: () => void;
  onReload: () => void;
  /** "Clear" ng buong report (Annual at HTE); wala sa mga listahan (may Reset bawat section) */
  onClear?: () => void;
  onPreview: () => void;
  editMode: boolean;
  onEditMode: (on: boolean) => void;
  /** Mga pagbabago sa tunay na record na hindi pa naisusulat sa database */
  pendingCount?: number;
  /** "Save changes to database": bubuksan ang buod (Confirm / Cancel) */
  onSaveToDatabase?: () => void;
  /** "Discard changes": itatapon ang mga hindi pa naisusulat (may kumpirmasyon) */
  onDiscardChanges?: () => void;
  /** Mga edit sa report lang ngayong Edit mode (hiwalay na maliit na label; hindi kasama sa bilang ng database) */
  reportOnlyCount?: number;
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
        <Button
          type="button"
          variant={p.settingsOpen ? "secondary" : "ghost"}
          size="sm"
          aria-pressed={p.settingsOpen}
          title={p.settingsOpen ? "Hide report settings" : "Show report settings"}
          onClick={p.onToggleSettings}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Settings
        </Button>

        <span className="mx-1 h-5 w-px bg-border" aria-hidden />

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

        {p.editMode && p.onSaveToDatabase && (
          <>
            {(p.reportOnlyCount ?? 0) > 0 && (
              <span
                className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-800 dark:text-amber-300"
                title="Edits that change this report only. They're saved automatically with the report and don't change the database."
              >
                {p.reportOnlyCount} report-only {p.reportOnlyCount === 1 ? "edit" : "edits"}
              </span>
            )}
            <Button
              type="button"
              size="sm"
              onClick={p.onSaveToDatabase}
              title="Review and write your changes to the real records"
            >
              <Database className="h-3.5 w-3.5" />
              Save <span className="hidden sm:inline">changes </span>to database
              {(p.pendingCount ?? 0) > 0 && ` (${p.pendingCount})`}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={p.onDiscardChanges}
              title="Remove the changes to real records that aren't saved yet"
            >
              <Undo className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Discard changes</span>
              <span className="sm:hidden">Discard</span>
            </Button>
          </>
        )}

        {missingCount > 0 && (
          <Button type="button" variant="outline" size="sm" onClick={p.onAddMissing} title="Students in the system who aren't in this report yet">
            <UserPlus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Add new students</span> ({missingCount})
          </Button>
        )}

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
            {p.onClear && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="gap-2 text-destructive focus:text-destructive" onClick={p.onClear}>
                  <Eraser className="h-4 w-4" /> Clear
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button type="button" size="sm" onClick={p.onPreview}>
          <Eye className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Preview, print or download</span>
          <span className="sm:hidden">Preview</span>
        </Button>
      </div>
    </div>
  );
}
