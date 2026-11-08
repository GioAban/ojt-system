import { useEffect, useMemo, useRef, useState } from "react";
import { notify } from "@/lib/notify";
import { useIsMobile } from "@/hooks/use-mobile";
import { useReportDraft } from "@/hooks/useReportDraft";
import { useUndoRedo } from "@/hooks/useUndoRedo";
import {
  NONE, buildListContent, buildListRows, cellOf, defaultListView, filterOptions, listCellId, parseListContent, templateColumns,
  templateFilters, templateInfo, visibleUnits,
} from "@/lib/listTemplates";
import { listLayout } from "@/lib/listLayout";
import { paperSize } from "@/lib/paperExport";
import { downloadExcel, listExcel } from "@/lib/reportExcel";
import { listAfterApply, listApplyBlock, listApplyItems, type ApplyItem } from "@/lib/reportWriteBack";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ListSheet, type ListEditBindings } from "@/components/reports/ListSheet";
import { ReportPreviewDialog } from "@/components/reports/ReportPreviewDialog";
import { ApplyToSystemDialog } from "@/components/reports/editor/ApplyToSystemDialog";
import { CellActions, CellActionsBar, type CellInfo } from "@/components/reports/editor/CellActions";
import { CellSheet } from "@/components/reports/editor/CellSheet";
import { ColumnPicker } from "@/components/reports/editor/ColumnPicker";
import { EDIT_CSS } from "@/components/reports/editor/editCss";
import { EditorContext, type ActiveCell, type EditorApi } from "@/components/reports/editor/editorContext";
import { EditorToolbar } from "@/components/reports/editor/EditorToolbar";
import { PaperSurface, MAX_ZOOM, MIN_ZOOM, type Zoom } from "@/components/reports/editor/PaperSurface";
import { ReportHeader, ReportLoadState } from "@/components/reports/editor/ReportHeader";
import type { CellDef } from "@/lib/hteCells";
import type { ListContent, ListTemplate, ReportSource } from "@/types/reports";

const SELECT =
  "mt-1 block h-9 w-full rounded-md border bg-background px-3 text-base outline-none pointer-coarse:h-11 md:text-sm focus-visible:ring-2 focus-visible:ring-ring";
const LABEL = "block text-xs font-medium text-muted-foreground";

/** Stable na buildContent para sa bawat template: isang function bawat uri */
const BUILDERS = new Map<ListTemplate, (source: ReportSource) => ListContent>();
function builderFor(template: ListTemplate) {
  let fn = BUILDERS.get(template);
  if (!fn) {
    fn = (source) => buildListContent(template, source);
    BUILDERS.set(template, fn);
  }
  return fn;
}

/** "l:<row>:<col>" -> row at column */
function parseCellId(id: string) {
  const [, rowId, col] = id.split(":");
  return { rowId, col };
}

/** Tagabuo ng listahan: mga filter sa gilid, ang papel sa kanan (o sa ilalim sa telepono) */
export function ListBuilder({ template, reportId }: { template: ListTemplate; reportId: number }) {
  const { content, source, update, get, status, loadError, retry, gone, title, setTitle, saveNow, replaceSource } =
    useReportDraft<ListContent>({ reportId, build: builderFor(template), parse: parseListContent });
  const history = useUndoRedo<ListContent>();
  const touch = useIsMobile();

  const [zoom, setZoom] = useState<Zoom>("fit");
  const [scale, setScale] = useState(1);
  const [confirm, setConfirm] = useState<"regenerate" | "clear" | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [currentCell, setCurrentCell] = useState<string | null>(null);
  const [sheetCell, setSheetCell] = useState<string | null>(null);
  const [applying, setApplying] = useState<ApplyItem[] | null>(null);

  const active = useRef<ActiveCell | null>(null);

  const api = useMemo<EditorApi>(() => ({
    touch,
    onCellFocus: (info) => setCurrentCell(info.id),
    onCellBlur: () => {},
    openSheet: (id) => { setCurrentCell(id); setSheetCell(id); },
    focusControls: () => {},
    getActive: () => active.current,
    setActive: (cell) => { active.current = cell; },
  }), [touch]);

  // Nagbago ba ang datos ng system mula nang buuin ang listahan?
  const stale = useMemo(() => {
    if (!content || !source) return false;
    return JSON.stringify(buildListRows(content.template, source)) !== JSON.stringify(content.rows);
  }, [content, source]);

  const mutate = (fn: (c: ListContent) => ListContent, key?: string) => {
    const cur = get();
    if (!cur) return;
    history.record(cur, key);
    update(fn(cur));
  };

  const undoRef = useRef<(redo: boolean) => void>(() => {});
  useEffect(() => {
    undoRef.current = (redo) => {
      const cur = get();
      if (!cur) return;
      const next = redo ? history.redo(cur) : history.undo(cur);
      if (next) update(next);
    };
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      // Ang mga text box at cell ay may sarili nang undo
      if (t?.closest?.("input, textarea, select, [contenteditable], [role=dialog]")) return;
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      if (mod && k === "z" && !e.shiftKey) { e.preventDefault(); undoRef.current(false); }
      if (mod && (k === "y" || (k === "z" && e.shiftKey))) { e.preventDefault(); undoRef.current(true); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!content || !source) {
    return <ReportLoadState gone={gone} loadError={loadError} onRetry={retry} />;
  }

  const c = content;
  const ctx = source.context;
  const info = templateInfo(template);
  const columns = templateColumns(template);
  const units = visibleUnits(c);
  const shown = units.filter((u) => u.kind === "row").length;
  const paperWidth = paperSize(c.settings.orientation, c.settings.paper).width;
  const pending = editMode ? listApplyItems(c, source) : [];
  const editedCount = Object.values(c.overrides).reduce((n, e) => n + Object.keys(e).length, 0);

  const setFilter = (key: string, value: string) =>
    mutate((cur) => {
      const filters = { ...cur.filters };
      if (value) filters[key] = value;
      else delete filters[key];
      return { ...cur, filters };
    });

  const toggleColumn = (key: string, on: boolean) =>
    mutate((cur) => ({
      ...cur,
      columns: on ? [...cur.columns, key] : cur.columns.filter((k) => k !== key),
    }));

  /** Isang edit sa cell; kung kapareho na ng datos, wala nang edit */
  const setCell = (rowId: string, col: string, value: string) => {
    const row = get()?.rows.find((r) => r.id === rowId);
    if (!row) return;
    const live = row.cells[col] ?? "";
    mutate((cur) => {
      const edits = { ...(cur.overrides[rowId] ?? {}) };
      if (value === live) delete edits[col];
      else edits[col] = value;
      const overrides = { ...cur.overrides };
      if (Object.keys(edits).length > 0) overrides[rowId] = edits;
      else delete overrides[rowId];
      return { ...cur, overrides };
    }, listCellId(rowId, col));
  };

  const labelOf = (id: string) => {
    const { rowId, col } = parseCellId(id);
    const row = c.rows.find((r) => r.id === rowId);
    const name = columns.find((x) => x.key === col)?.label ?? "Cell";
    return row ? `${name}, ${cellOf(c, row, "name")}` : name;
  };

  const bindings: ListEditBindings = { onText: setCell, labelOf };

  const cellDefs: CellDef[] = editMode
    ? units.flatMap((u) => (u.kind === "row"
      ? columns.filter((col) => c.columns.includes(col.key)).map((col) => {
          const id = listCellId(u.row.id, col.key);
          return { id, label: labelOf(id), value: cellOf(c, u.row, col.key) };
        })
      : []))
    : [];

  const cellInfo = (id: string | null): CellInfo | null => {
    if (!id) return null;
    const { rowId, col } = parseCellId(id);
    const row = c.rows.find((r) => r.id === rowId);
    if (!row || !c.columns.includes(col)) return null;
    const block = listApplyBlock(row, col);
    const writable = !block || !block.includes("can't be written");
    return {
      label: labelOf(id),
      value: cellOf(c, row, col),
      live: row.cells[col] ?? "",
      canApply: block === null,
      applyNote: writable && block ? block : undefined,
    };
  };

  const resetCell = (id: string) => {
    const { rowId, col } = parseCellId(id);
    const row = c.rows.find((r) => r.id === rowId);
    if (row) setCell(rowId, col, row.cells[col] ?? "");
  };

  const applyCell = (id: string) => {
    const { rowId, col } = parseCellId(id);
    const items = listApplyItems(c, source, { rowId, col });
    if (items.length > 0) setApplying(items);
  };

  const confirmText = confirm === "regenerate"
    ? {
        title: "Regenerate from live data?",
        description: editedCount > 0
          ? `The records will be replaced with the current system data, and your ${editedCount} edited ${editedCount === 1 ? "cell" : "cells"} will be replaced too. Your title, header, footer, filters, columns and paper settings stay. You can undo this.`
          : "The records will be replaced with the current system data. Your title, header, footer, filters, columns and paper settings stay. You can undo this.",
        label: "Regenerate",
      }
    : {
        title: "Reset this list?",
        description: "Filters, columns, sorting, header and footer go back to the defaults. Edited cells stay. You can undo this.",
        label: "Reset",
      };

  function doConfirm() {
    const cf = confirm;
    setConfirm(null);
    if (cf === "regenerate") {
      mutate((cur) => ({ ...cur, rows: buildListRows(cur.template, source!), overrides: {}, generatedAt: Date.now() }));
      notify.success("Regenerated from the live data.");
    } else if (cf === "clear") {
      mutate((cur) => ({ ...cur, ...defaultListView(cur.template) }));
    }
  }

  const current = editMode && !touch ? cellInfo(currentCell) : null;

  return (
    <div className="min-w-0">
      <style>{EDIT_CSS}</style>
      <ReportHeader title={title} onTitle={setTitle} typeLabel={info.title} semesterName={ctx.semesterName} />

      <EditorToolbar
        canUndo={history.canUndo}
        canRedo={history.canRedo}
        onUndo={() => undoRef.current(false)}
        onRedo={() => undoRef.current(true)}
        scale={scale}
        onZoomStep={(dir) => setZoom(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round((scale + dir * 0.1) * 10) / 10)))}
        onFit={() => setZoom("fit")}
        onActual={() => setZoom(1)}
        status={status}
        onSave={() => void saveNow()}
        settings={c.settings}
        onSettings={(settings) => mutate((cur) => ({ ...cur, settings }), "settings")}
        allowOrientation
        editMode={editMode}
        onEditMode={(on) => { setEditMode(on); setCurrentCell(null); setSheetCell(null); }}
        applyCount={pending.length}
        onApplyAll={() => setApplying(pending)}
        onReload={() => setConfirm("regenerate")}
        onClear={() => setConfirm("clear")}
        onPreview={() => setShowPreview(true)}
      />

      {stale && (
        <Alert className="mb-3">
          <AlertDescription className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            The system data has changed since this list was generated.
            <Button variant="outline" size="sm" onClick={() => setConfirm("regenerate")}>Regenerate</Button>
          </AlertDescription>
        </Alert>
      )}

      {editMode && (
        <p className="mb-2 text-xs text-muted-foreground">
          {touch ? "Tap a cell to edit it." : "Click a cell and type."} Edits change this report only and get a small dot. Reset a cell to go back to the system value, or use Apply to system where it's allowed.
        </p>
      )}

      <div className="grid min-w-0 gap-3 lg:grid-cols-[18rem_minmax(0,1fr)] lg:items-start">
        <details open={!touch} className="rounded-xl border bg-card p-3 text-sm">
          <summary className="cursor-pointer select-none py-1 font-medium pointer-coarse:py-2.5">
            Filters and columns ({shown} {shown === 1 ? "record" : "records"})
          </summary>

          <div className="mt-3 flex flex-col gap-4">
            <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-xs">
              <dt className="text-muted-foreground">Semester</dt>
              <dd className="min-w-0 break-words">{ctx.semesterName}</dd>
              <dt className="text-muted-foreground">Course</dt>
              <dd className="min-w-0 break-words">{ctx.programAbbreviation || ctx.programName || "None"}</dd>
            </dl>

            <section className="flex flex-col gap-3" aria-label="Filters">
              {templateFilters(template).map((f) => {
                const { options, hasBlank } = filterOptions(c, f.key);
                const value = c.filters[f.key] ?? "";
                return (
                  <label key={f.key} className={LABEL}>
                    {f.label}
                    <select className={SELECT} value={value} onChange={(e) => setFilter(f.key, e.target.value)}>
                      <option value="">All</option>
                      {(hasBlank || value === NONE) && <option value={NONE}>None</option>}
                      {value && value !== NONE && !options.includes(value) && <option value={value}>{value}</option>}
                      {options.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </label>
                );
              })}
            </section>

            <fieldset className="min-w-0">
              <legend className={LABEL}>Sort by</legend>
              <div className="mt-1 flex gap-2">
                <select
                  aria-label="Sort column"
                  className={cn(SELECT, "mt-0 w-auto min-w-0 flex-1")}
                  value={c.sort.key}
                  onChange={(e) => mutate((cur) => ({ ...cur, sort: { ...cur.sort, key: e.target.value } }))}
                >
                  {columns.map((col) => <option key={col.key} value={col.key}>{col.label}</option>)}
                </select>
                <select
                  aria-label="Sort direction"
                  className={cn(SELECT, "mt-0 w-24 shrink-0")}
                  value={c.sort.dir}
                  onChange={(e) => mutate((cur) => ({ ...cur, sort: { ...cur.sort, dir: e.target.value as "asc" | "desc" } }))}
                >
                  <option value="asc">A to Z</option>
                  <option value="desc">Z to A</option>
                </select>
              </div>
            </fieldset>

            <ColumnPicker columns={columns} selected={c.columns} onToggle={toggleColumn} />

            <label className={LABEL}>
              Header text
              <Textarea
                className="mt-1"
                rows={2}
                value={c.headerText}
                placeholder="Printed above the table"
                onChange={(e) => mutate((cur) => ({ ...cur, headerText: e.target.value }), "header")}
              />
            </label>
            <label className={LABEL}>
              Footer text
              <Textarea
                className="mt-1"
                rows={2}
                value={c.footerText}
                placeholder="Printed after the table, on the last page"
                onChange={(e) => mutate((cur) => ({ ...cur, footerText: e.target.value }), "footer")}
              />
            </label>
          </div>
        </details>

        <div className="min-w-0">
          {c.rows.length === 0 && (
            <p className="mb-2 text-sm text-muted-foreground">
              There are no records for this semester yet. Regenerate this list once there are.
            </p>
          )}
          {listLayout(c).tight && (
            <p className="mb-2 text-sm text-muted-foreground">
              These columns don't fit on this page without splitting words. Hide a column, or use landscape or a smaller font in Page settings.
            </p>
          )}
          <EditorContext.Provider value={api}>
            <PaperSurface paperWidth={paperWidth} zoom={zoom} onZoom={setZoom} onScale={setScale} gutter={8}>
              <div className={editMode ? "rp-edit" : undefined}>
                <ListSheet
                  content={c}
                  title={title}
                  context={ctx}
                  mode={editMode ? "edit" : "preview"}
                  edit={editMode ? bindings : undefined}
                />
              </div>
            </PaperSurface>
          </EditorContext.Provider>
          {current && currentCell && (
            <CellActionsBar info={current} onReset={() => resetCell(currentCell)} onApply={() => applyCell(currentCell)} />
          )}
        </div>
      </div>

      <CellSheet
        cells={cellDefs}
        openId={sheetCell}
        onClose={() => setSheetCell(null)}
        onCommit={(id, value) => {
          const { rowId, col } = parseCellId(id);
          setCell(rowId, col, value);
        }}
        onNavigate={(id) => { setSheetCell(id); setCurrentCell(id); }}
        renderExtra={(cell) => {
          const cellState = cellInfo(cell.id);
          return cellState && (
            <CellActions
              info={cellState}
              onReset={() => { resetCell(cell.id); setSheetCell(null); }}
              onApply={() => { applyCell(cell.id); setSheetCell(null); }}
            />
          );
        }}
      />

      <ReportPreviewDialog
        open={showPreview}
        onOpenChange={setShowPreview}
        title={`${title || info.title} preview`}
        fileName={`${(title || info.title).replace(/[^\w-]+/g, "-")}.pdf`}
        settings={c.settings}
        onSettings={(settings) => mutate((cur) => ({ ...cur, settings }), "settings")}
        allowOrientation
        onExcel={() => downloadExcel(listExcel(c, title || info.title, ctx))}
        renderSheet={(mode) => <ListSheet content={c} title={title} context={ctx} mode={mode} />}
      />

      {applying && (
        <ApplyToSystemDialog
          reportId={reportId}
          items={applying}
          source={source}
          onClose={() => setApplying(null)}
          onApplied={(fresh, items) => {
            setApplying(null);
            replaceSource(fresh);
            mutate((cur) => listAfterApply(cur, items, fresh));
          }}
        />
      )}

      <ConfirmDialog
        open={confirm !== null}
        title={confirmText.title}
        description={confirmText.description}
        confirmLabel={confirmText.label}
        onConfirm={doConfirm}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
