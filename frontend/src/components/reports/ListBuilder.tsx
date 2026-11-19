import { useEffect, useMemo, useRef, useState } from "react";
import { notify } from "@/lib/notify";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSignatoryControls } from "@/hooks/useSignatoryControls";
import { useEditSession } from "@/hooks/useEditSession";
import { useReportDraft } from "@/hooks/useReportDraft";
import { useUndoRedo } from "@/hooks/useUndoRedo";
import {
  GROUP_BY_OPTIONS, LIST_PAGE_DEFAULTS, NONE, PERSONAL_COLUMNS, buildListContent, buildListRows, cellOf, defaultListView,
  filterOptions, parseListContent, templateColumns, templateFilters, templateGroupingLabel, templateInfo, visibleUnits,
} from "@/lib/listTemplates";
import { listLayout } from "@/lib/listLayout";
import { paperSize } from "@/lib/paperExport";
import { downloadExcel, listExcel } from "@/lib/reportExcel";
import { listCellSpec } from "@/lib/reportFields";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ListSheet, type ListEditBindings } from "@/components/reports/ListSheet";
import { ReportPreviewDialog } from "@/components/reports/ReportPreviewDialog";
import {
  AdvancedControl, ColumnsControl, FixedInfo, PageControl, ReportSettingsLayout, SelectField, SettingsSection,
  SignatoriesControl, TextAreaField, TextField,
} from "@/components/reports/settings/ReportSettingsSidebar";
import { EDIT_CSS } from "@/components/reports/editor/editCss";
import { EditorToolbar } from "@/components/reports/editor/EditorToolbar";
import { PaperSurface, MAX_ZOOM, MIN_ZOOM, type Zoom } from "@/components/reports/editor/PaperSurface";
import { ReportHeader, ReportLoadState } from "@/components/reports/editor/ReportHeader";
import { DEFAULT_DISPLAY, type ListContent, type ListGroupBy, type ListTemplate, type PendingChange, type ReportSource } from "@/types/reports";

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

/** Mga column na sumusunod sa company at department ng student */
const PLACEMENT_COLUMNS = ["company", "department", "supervisor", "supervisorPosition", "status", "deployment"];

/**
 * Pagkatapos maisulat sa system: binubuo ulit ang mga row mula sa bagong datos. Ang mga lumang edit sa report lang
 * (mula sa dating bersyon) sa mga cell na binago ay inaalis, para lumabas ang bagong halaga.
 */
function afterCommit(cur: ListContent, fresh: ReportSource, changes: PendingChange[]): ListContent {
  const students = new Set(changes.filter((x) => x.target === "student").map((x) => x.id));
  const recordsChanged = changes.some((x) => x.target !== "student");
  const rows = buildListRows(cur.template, fresh);
  const overrides: ListContent["overrides"] = {};
  for (const row of rows) {
    const edits = cur.overrides[row.id];
    if (!edits) continue;
    if (row.refs && students.has(row.refs.studentId)) continue;
    const kept = Object.fromEntries(Object.entries(edits).filter(([col]) => !(recordsChanged && PLACEMENT_COLUMNS.includes(col))));
    if (Object.keys(kept).length > 0) overrides[row.id] = kept;
  }
  return { ...cur, rows, overrides, generatedAt: Date.now() };
}

/** Tagabuo ng listahan: mga filter sa gilid, ang papel sa kanan (o sa ilalim sa telepono) */
export function ListBuilder({ template, reportId }: { template: ListTemplate; reportId: number }) {
  const { content, source, update, get, status, loadError, retry, gone, title, setTitle, replaceSource } =
    useReportDraft<ListContent>({ reportId, build: builderFor(template), parse: parseListContent });
  const history = useUndoRedo<ListContent>();
  const touch = useIsMobile();

  const [zoom, setZoom] = useState<Zoom>("fit");
  const [scale, setScale] = useState(1);
  const [confirm, setConfirm] = useState<"regenerate" | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  // Sidebar ng mga setting: bukas sa desktop, sarado (bottom sheet) sa telepono
  const [settingsOpen, setSettingsOpen] = useState(() => typeof window === "undefined" || window.innerWidth >= 768);
  // Pirmahan sa dulo: naka-save sa device lang
  const sign = useSignatoryControls(reportId, { hasBuiltIn: false, title: title || templateInfo(template).title });

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

  const session = useEditSession<ListContent>({
    reportId,
    source,
    get,
    mutate,
    onCommitted: (fresh, changes) => {
      replaceSource(fresh);
      mutate((cur) => afterCommit(cur, fresh, changes));
    },
  });

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
  const editedCount = Object.values(c.overrides).reduce((n, e) => n + Object.keys(e).length, 0);
  const editMode = session.editMode;
  const manual = { items: sign.items, showBuiltIn: false };
  const defaults = defaultListView(template);

  const setFilter = (key: string, value: string) =>
    mutate((cur) => {
      const filters = { ...cur.filters };
      if (value) filters[key] = value;
      else delete filters[key];
      return { ...cur, filters };
    });

  const setColumns = (columns: string[]) => mutate((cur) => ({ ...cur, columns }), "columns");

  /** Edit sa report lang ng isang cell; null o kapareho ng system = alisin */
  const setOverride = (rowId: string, col: string, value: string | null) =>
    mutate((cur) => {
      const row = cur.rows.find((r) => r.id === rowId);
      const edits = { ...(cur.overrides[rowId] ?? {}) };
      if (value === null || value === (row?.cells[col] ?? "")) delete edits[col];
      else edits[col] = value;
      const overrides = { ...cur.overrides };
      if (Object.keys(edits).length > 0) overrides[rowId] = edits;
      else delete overrides[rowId];
      return { ...cur, overrides };
    }, `override:${rowId}:${col}`);

  const labelOf = (col: string) => columns.find((x) => x.key === col)?.label ?? "Cell";

  const bindings: ListEditBindings = {
    spec: (row, col) => listCellSpec(c, row, col, source, labelOf(col), cellOf(c, row, col), (v) => setOverride(row.id, col, v)),
    pending: session.pending,
    problems: session.problems,
    saved: session.saved,
    labelOf: (row, col) => `${labelOf(col)}, ${row.cells.name ?? ""}`,
    onOpen: session.setOpenSpec,
  };

  const confirmText = confirm === "regenerate"
    ? {
        title: "Regenerate from live data?",
        description: editedCount > 0
          ? `The records will be replaced with the current system data, and your ${editedCount} report-only ${editedCount === 1 ? "edit" : "edits"} in the table will be replaced with the system values. Your title, header, footer, filters, columns, paper settings and unsaved changes to the system stay. You can undo this.`
          : "The records will be replaced with the current system data. Your title, header, footer, filters, columns, paper settings and unsaved changes to the system stay. You can undo this.",
        label: "Regenerate",
      }
    : { title: "", description: "", label: "" };

  function doConfirm() {
    const cf = confirm;
    setConfirm(null);
    if (cf === "regenerate") {
      mutate((cur) => ({ ...cur, rows: buildListRows(cur.template, source!), overrides: {}, generatedAt: Date.now() }));
      notify.success("Regenerated from the live data.");
    }
  }

  return (
    <div className="min-w-0">
      <style>{EDIT_CSS}</style>
      <ReportHeader title={title} typeLabel={info.title} semesterName={ctx.semesterName} />

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
        settingsOpen={settingsOpen}
        onToggleSettings={() => setSettingsOpen((o) => !o)}
        editMode={editMode}
        onEditMode={session.requestEditMode}
        pendingCount={session.count}
        onSaveToDatabase={session.openSave}
        onDiscardChanges={session.requestDiscard}
        reportOnlyCount={session.reportOnlyCount}
        onReload={() => setConfirm("regenerate")}
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

      {session.count > 0 && !editMode && (
        <Alert className="mb-3">
          <AlertDescription className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            {session.count} {session.count === 1 ? "change" : "changes"} to real records from your last edit session {session.count === 1 ? "isn't" : "aren't"} saved to the database yet.
            <span className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={session.requestDiscard}>Discard</Button>
              <Button size="sm" onClick={session.openSave}>Save changes to database</Button>
            </span>
          </AlertDescription>
        </Alert>
      )}

      <p className="mb-2 text-xs text-muted-foreground">
        {editMode
          ? `${touch ? "Tap" : "Click"} any cell to change it. Changes to real records get a dot and are written with Save changes to database. Tinted cells change this report only; they're saved automatically and can be reset to the system value.`
          : "This list is read-only. Turn on Edit mode to change the records in it."}
      </p>

      <ReportSettingsLayout
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        sidebar={
          <>
            <SettingsSection
              title="Report"
              onReset={() => mutate((cur) => ({ ...cur, subtitle: "", headerText: "", footerText: "" }))}
            >
              <TextField label="Title" value={title} onChange={setTitle} placeholder={info.title} />
              <TextField label="Subtitle" value={c.subtitle} onChange={(v) => mutate((cur) => ({ ...cur, subtitle: v }), "subtitle")} />
              <TextAreaField label="Header text" value={c.headerText} placeholder="Printed above the table"
                onChange={(v) => mutate((cur) => ({ ...cur, headerText: v }), "header")} />
              <TextAreaField label="Footer text" value={c.footerText} placeholder="Printed after the table, on the last page"
                onChange={(v) => mutate((cur) => ({ ...cur, footerText: v }), "footer")} />
            </SettingsSection>

            <SettingsSection title="Data and filters" count={shown} onReset={() => mutate((cur) => ({ ...cur, filters: {} }))}>
              <FixedInfo items={[
                { label: "Semester", value: ctx.semesterName },
                { label: "Course", value: ctx.programAbbreviation || ctx.programName },
              ]} />
              {templateFilters(template).map((f) => {
                const { options, hasBlank } = filterOptions(c, f.key);
                const value = c.filters[f.key] ?? "";
                return (
                  <SelectField
                    key={f.key}
                    label={f.label}
                    value={value}
                    onChange={(v) => setFilter(f.key, v)}
                    options={[
                      { value: "", label: "All" },
                      ...(hasBlank || value === NONE ? [{ value: NONE, label: "None" }] : []),
                      ...(value && value !== NONE && !options.includes(value) ? [{ value, label: value }] : []),
                      ...options.map((o) => ({ value: o, label: o })),
                    ]}
                  />
                );
              })}
            </SettingsSection>

            <SettingsSection title="Columns" count={c.columns.length} onReset={() => setColumns([...defaults.columns])}>
              <ColumnsControl groups={[{
                columns: columns.map((x) => ({ key: x.key, label: x.label })),
                selected: c.columns,
                personal: PERSONAL_COLUMNS,
                onChange: setColumns,
              }]} />
            </SettingsSection>

            <SettingsSection
              title="Sorting and grouping"
              onReset={() => mutate((cur) => ({ ...cur, sort: { ...defaults.sort }, groupBy: "template" }))}
            >
              <SelectField label="Sort by" value={c.sort.key}
                options={columns.map((col) => ({ value: col.key, label: col.label }))}
                onChange={(v) => mutate((cur) => ({ ...cur, sort: { ...cur.sort, key: v } }))} />
              <SelectField label="Order" value={c.sort.dir}
                options={[{ value: "asc", label: "A to Z" }, { value: "desc", label: "Z to A" }]}
                onChange={(v) => mutate((cur) => ({ ...cur, sort: { ...cur.sort, dir: v as "asc" | "desc" } }))} />
              <SelectField label="Group by" value={c.groupBy}
                options={GROUP_BY_OPTIONS.map((o) => (o.value === "template"
                  ? { value: o.value, label: `${o.label} (${templateGroupingLabel(template)})` }
                  : o))}
                onChange={(v) => mutate((cur) => ({ ...cur, groupBy: v as ListGroupBy }))} />
            </SettingsSection>

            <SettingsSection title="Page" onReset={() => mutate((cur) => ({ ...cur, settings: { ...LIST_PAGE_DEFAULTS } }), "settings")}>
              <PageControl settings={c.settings} onChange={(settings) => mutate((cur) => ({ ...cur, settings }), "settings")} />
            </SettingsSection>

            <SettingsSection title="Signatories" count={sign.items.length}>
              <SignatoriesControl items={sign.items} onAdd={sign.add} onEdit={sign.edit} onDelete={sign.remove} onManage={sign.manage} />
            </SettingsSection>

            <SettingsSection title="Advanced" defaultOpen={false}
              onReset={() => mutate((cur) => ({ ...cur, display: { ...DEFAULT_DISPLAY } }))}>
              <AdvancedControl display={c.display} onChange={(display) => mutate((cur) => ({ ...cur, display }))}
                show={{ rowNumbers: true, striped: true, dateFormat: true, blank: true }} />
            </SettingsSection>
          </>
        }
      >
        <div className="min-w-0">
          {c.rows.length === 0 && (
            <p className="mb-2 text-sm text-muted-foreground">
              There are no records for this semester yet. Regenerate this list once there are.
            </p>
          )}
          {listLayout(c).tight && (
            <p className="mb-2 text-sm text-muted-foreground">
              These columns don't fit on this page without splitting words. Hide a column, or use landscape or a smaller font in Page.
            </p>
          )}
          <PaperSurface paperWidth={paperWidth} zoom={zoom} onZoom={setZoom} onScale={setScale} gutter={8}>
            <div className={editMode ? "rp-edit" : undefined}>
              <ListSheet
                content={c}
                title={title}
                context={ctx}
                mode={editMode ? "edit" : "preview"}
                edit={editMode ? bindings : undefined}
                manual={{
                  ...manual,
                  onAdd: sign.add,
                  ...(editMode ? { onEdit: sign.edit, onDelete: sign.remove } : {}),
                }}
              />
            </div>
          </PaperSurface>
        </div>
      </ReportSettingsLayout>

      {session.dialogs}
      {sign.panel}

      <ReportPreviewDialog
        open={showPreview}
        onOpenChange={setShowPreview}
        title={`${title || info.title} preview`}
        fileName={`${(title || info.title).replace(/[^\w-]+/g, "-")}.pdf`}
        settings={c.settings}
        onSettings={(settings) => mutate((cur) => ({ ...cur, settings }), "settings")}
        allowOrientation
        onExcel={() => downloadExcel({ ...listExcel(c, title || info.title, ctx), signatories: manual.items })}
        renderSheet={(mode) => <ListSheet content={c} title={title} context={ctx} mode={mode} manual={manual} />}
      />

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
