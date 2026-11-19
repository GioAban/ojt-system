import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { notify } from "@/lib/notify";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSignatoryControls } from "@/hooks/useSignatoryControls";
import { useEditSession } from "@/hooks/useEditSession";
import { useReportDraft } from "@/hooks/useReportDraft";
import { useSignatories } from "@/hooks/useSignatories";
import { useUndoRedo } from "@/hooks/useUndoRedo";
import {
  ISSUE_COLUMNS, SUMMARY_COLUMNS, annualCells, annualLiveIndex, applyAnnualCell, blankIssue, buildAnnualContent,
  parseAnnualContent, summaryHasEdits, summaryOf,
} from "@/lib/annualReport";
import { signatoryOf } from "@/lib/hteCells";
import { builtInAsSignatories } from "@/lib/manualSignatories";
import { displayOf } from "@/lib/reportDisplay";
import { paperSize } from "@/lib/paperExport";
import { annualCellSpec } from "@/lib/reportFields";
import { annualExcel, downloadExcel } from "@/lib/reportExcel";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { AnnualSheet, type AnnualEditBindings } from "@/components/reports/AnnualSheet";
import { ReportPreviewDialog } from "@/components/reports/ReportPreviewDialog";
import { CellActions, CellActionsBar, type CellInfo } from "@/components/reports/editor/CellActions";
import { CellSheet } from "@/components/reports/editor/CellSheet";
import {
  AdvancedControl, CheckField, ColumnsControl, FixedInfo, PageControl, ReportSettingsLayout, SettingsSection,
  SignatoriesControl, TextAreaField, TextField,
} from "@/components/reports/settings/ReportSettingsSidebar";
import { ANNUAL_PAGE_DEFAULTS, DEFAULT_ISSUE_COLUMNS, DEFAULT_SUMMARY_COLUMNS } from "@/lib/annualReport";
import { DEFAULT_DISPLAY } from "@/types/reports";
import { EDIT_CSS } from "@/components/reports/editor/editCss";
import { EditorContext, type ActiveCell, type CellFocusInfo, type EditorApi } from "@/components/reports/editor/editorContext";
import { EditorToolbar } from "@/components/reports/editor/EditorToolbar";
import { PaperSurface, MAX_ZOOM, MIN_ZOOM, type Zoom } from "@/components/reports/editor/PaperSurface";
import { ReportHeader, ReportLoadState } from "@/components/reports/editor/ReportHeader";
import { RowControls, type RowAction } from "@/components/reports/editor/RowControls";
import { setCaret } from "@/components/reports/editor/caret";
import type { AnnualContent, SignatoryOverrides } from "@/types/reports";

interface Snapshot {
  content: AnnualContent;
  sig: SignatoryOverrides | null;
}

type Confirm = "regenerate" | "clear" | { row: string } | { columns: string[] };

const noop = () => {};
const issueOf = (cellId: string) => (cellId.startsWith("i:") ? cellId.split(":")[1] : null);

/** Editor sa mismong papel ng Annual Report (Annex C) */
export function AnnualEditor({ reportId }: { reportId: number }) {
  const { content, source, update, get, status, loadError, retry, gone, title, setTitle, replaceSource } =
    useReportDraft<AnnualContent>({ reportId, build: buildAnnualContent, parse: parseAnnualContent });
  const sig = useSignatories(source?.context ?? null);
  const history = useUndoRedo<Snapshot>();
  const touch = useIsMobile();

  const [zoom, setZoom] = useState<Zoom>("fit");
  const [scale, setScale] = useState(1);
  const [activeRow, setActiveRow] = useState<string | null>(null);
  const [pin, setPin] = useState<{ key: string; page: number } | null>(null);
  const [sheetCell, setSheetCell] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  // Pirmahan sa dulo: naka-save sa device lang; pumapalit sa built-in kapag mayroon
  const sign = useSignatoryControls(reportId, { hasBuiltIn: true, title: title || "Annual Report" });
  // Sidebar ng mga setting: bukas sa desktop, sarado (bottom sheet) sa telepono
  const [settingsOpen, setSettingsOpen] = useState(() => typeof window === "undefined" || window.innerWidth >= 768);
  const [oversized, setOversized] = useState<string[]>([]);
  const [currentCell, setCurrentCell] = useState<string | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);
  const active = useRef<ActiveCell | null>(null);
  const pending = useRef<string | null>(null);
  const handlers = useRef({
    focus: noop as (info: CellFocusInfo) => void,
    blur: noop as () => void,
    open: noop as (id: string) => void,
    key: noop as (e: KeyboardEvent) => void,
  });

  const api = useMemo<EditorApi>(() => ({
    touch,
    onCellFocus: (info) => handlers.current.focus(info),
    onCellBlur: () => handlers.current.blur(),
    openSheet: (id) => handlers.current.open(id),
    focusControls: () => {
      rootRef.current?.querySelector<HTMLButtonElement>("[data-row-controls] button:not(:disabled)")?.focus();
    },
    getActive: () => active.current,
    setActive: (cell) => { active.current = cell; },
  }), [touch]);

  const ctx = source?.context ?? null;

  const mutate = (fn: (c: AnnualContent) => AnnualContent, key?: string) => {
    const cur = get();
    if (!cur) return;
    const next = fn(cur);
    if (next === cur) return;
    history.record({ content: cur, sig: sig.getSaved() }, key);
    update(next);
  };

  const onText = (id: string, value: string) => {
    // Ang pirmahan ay dumadaan sa "Save changes to database", hindi diretsong isine-save
    if (signatoryOf(id)) return;
    mutate((c) => applyAnnualCell(c, id, value), id);
  };

  const flushTyping = () => {
    const el = document.activeElement as HTMLElement | null;
    if (el && el.isContentEditable && el.closest("[data-editor-root]")) el.blur();
  };

  // Edit mode: lahat ng nasa Annual Report ay sa report lang (walang tunay na record na isinusulat dito)
  const session = useEditSession<AnnualContent>({
    reportId,
    source,
    get,
    mutate,
    onCommitted: (fresh, changes) => {
      replaceSource(fresh);
      // Pinalitang pangalan ng company o department: inaayon ang mga label sa buod (ang mga bilang ay hindi ginagalaw)
      const companyName = new Map(fresh.data.companies.map((x) => [x.id, x.name]));
      const deptName = new Map(fresh.data.departments.map((x) => [x.id, x.name]));
      const companies = new Set(changes.filter((x) => x.target === "company" && x.field === "name").map((x) => x.id));
      const depts = new Set(changes.filter((x) => x.target === "department" && x.field === "name").map((x) => x.id));
      if (companies.size > 0 || depts.size > 0) {
        mutate((cur) => ({
          ...cur,
          summary: cur.summary.map((r) => {
            const parts = r.key.split(":");
            const cid = Number(parts.find((p) => p.startsWith("c"))?.slice(1));
            const did = Number(parts.find((p) => p.startsWith("d"))?.slice(1));
            return {
              ...r,
              company: companies.has(cid) ? (companyName.get(cid) ?? r.company) : r.company,
              department: depts.has(did) ? (deptName.get(did) ?? r.department) : r.department,
            };
          }),
        }));
      }
      if (changes.some((x) => x.target === "signatory")) void sig.refresh();
    },
    onEditMode: () => {
      flushTyping();
      setActiveRow(null);
      setCurrentCell(null);
      setSheetCell(null);
    },
  });
  const editMode = session.editMode;
  const manual = { items: sign.items, showBuiltIn: sign.showBuiltIn };

  const apply = (s: Snapshot) => {
    update(s.content);
  };
  const undo = () => {
    flushTyping();
    const cur = get();
    if (!cur) return;
    const prev = history.undo({ content: cur, sig: sig.getSaved() });
    if (prev) apply(prev);
  };
  const redo = () => {
    flushTyping();
    const cur = get();
    if (!cur) return;
    const next = history.redo({ content: cur, sig: sig.getSaved() });
    if (next) apply(next);
  };

  const addRow = (afterId: string | null) => {
    const fresh = blankIssue();
    mutate((c) => {
      const at = afterId === null ? c.issues.length - 1 : c.issues.findIndex((r) => r.id === afterId);
      const issues = [...c.issues];
      issues.splice(at + 1, 0, fresh);
      return { ...c, issues };
    });
    setActiveRow(fresh.id);
    if (touch) setSheetCell(`i:${fresh.id}:issue`);
    else pending.current = `i:${fresh.id}:issue`;
  };
  const moveRow = (id: string, dir: -1 | 1) => {
    flushTyping();
    mutate((c) => {
      const i = c.issues.findIndex((r) => r.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= c.issues.length) return c;
      const issues = [...c.issues];
      [issues[i], issues[j]] = [issues[j], issues[i]];
      return { ...c, issues };
    });
  };
  const deleteRow = (id: string) => {
    mutate((c) => ({ ...c, issues: c.issues.filter((r) => r.id !== id) }));
    setActiveRow(null);
  };
  const requestDelete = (id: string) => {
    flushTyping();
    const r = get()?.issues.find((x) => x.id === id);
    if (!r) return;
    if (r.issue.trim() || r.solution.trim() || r.recommendation.trim()) setConfirm({ row: id });
    else deleteRow(id);
  };

  useEffect(() => {
    handlers.current = {
      focus: (info) => {
        setCurrentCell(info.id);
        setPin((p) => (info.rowKey
          ? (p && p.key === info.rowKey && p.page === info.page ? p : { key: info.rowKey, page: info.page })
          : null));
        const row = issueOf(info.id);
        if (row) setActiveRow(row);
      },
      blur: () => { if (!active.current) setPin(null); },
      open: (id) => {
        setCurrentCell(id);
        const row = issueOf(id);
        if (row) setActiveRow(row);
        setSheetCell(id);
      },
      key: (e) => {
        const t = e.target as HTMLElement | null;
        const inEditor = !t || t === document.body || !!t.closest?.("[data-editor-root]");
        if (!inEditor || showPreview || confirm || sheetCell) return;
        const mod = e.ctrlKey || e.metaKey;
        const k = e.key.toLowerCase();
        if (mod && !e.altKey && k === "z" && !e.shiftKey) { e.preventDefault(); undo(); return; }
        if (mod && (k === "y" || (k === "z" && e.shiftKey))) { e.preventDefault(); redo(); return; }
        if (!activeRow || !editMode) return;
        if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
          e.preventDefault();
          moveRow(activeRow, e.key === "ArrowUp" ? -1 : 1);
          return;
        }
        if (mod && e.key === "Enter") {
          e.preventDefault();
          addRow(activeRow);
        }
      },
    };
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => handlers.current.key(e);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Pagkatapos magdagdag ng row: i-focus ang unang cell nito kapag nasa pahina na
  useEffect(() => {
    const id = pending.current;
    if (!id) return;
    const el = rootRef.current?.querySelector<HTMLElement>(`[data-cell-id="${CSS.escape(id)}"]`);
    if (!el) return;
    pending.current = null;
    el.focus();
    setCaret(el, 0);
  });

  if (!content || !source || !ctx || !sig.values) {
    return <ReportLoadState gone={gone} loadError={loadError} onRetry={retry} />;
  }

  const c = content;
  const people = sig.values;
  const allCells = annualCells(c, people);
  // Ang mga bilang sa buod ay may sariling input (numero); ang iba ay tekstong diretsong nae-edit sa papel
  const cells = allCells.filter((x) => !x.id.startsWith("sum:") && !x.id.startsWith("sig:"));
  const labels = new Map(allCells.map((x) => [x.id, x.label]));
  const paperWidth = paperSize(c.settings.orientation, c.settings.paper).width;
  const live = annualLiveIndex(c, source);
  const valueOf = new Map(allCells.map((x) => [x.id, x.value]));

  /** Teksto sa papel na binago: itinatala rin para sa buod ng Edit mode (sa report lang ito) */
  const onTextNoted = (id: string, value: string) => {
    onText(id, value);
    session.noteReportOnly({ key: `annual:${id}`, label: labels.get(id) ?? "Text", who: "", system: live.get(id) ?? null, value });
  };

  const cellInfo = (id: string | null): CellInfo | null => {
    if (!id || !valueOf.has(id)) return null;
    return { label: labels.get(id) ?? "Text", value: valueOf.get(id) ?? "", live: live.get(id) ?? null };
  };
  const resetCell = (id: string) => {
    const value = live.get(id);
    if (value !== undefined) onTextNoted(id, value);
  };
  const current = editMode && !touch ? cellInfo(currentCell) : null;

  /** Ang Company at Department ang naghahati sa buod, kaya nagbabago ang mga row ng buod */
  const setSummaryColumns = (columns: string[]) => {
    mutate((cur) => {
      const next = { ...cur, summaryColumns: columns };
      const splitChanged = (["company", "department"] as const).some((k) => cur.summaryColumns.includes(k) !== columns.includes(k));
      return splitChanged ? { ...next, summary: summaryOf(next, source) } : next;
    });
  };
  const toggleSummary = (key: string, on: boolean) => {
    const columns = on ? [...c.summaryColumns, key] : c.summaryColumns.filter((k) => k !== key);
    const splits = key === "company" || key === "department";
    if (splits && summaryHasEdits(c, source)) setConfirm({ columns });
    else setSummaryColumns(columns);
  };

  const bindings: AnnualEditBindings = {
    onText: onTextNoted,
    typed: (id, kind) =>
      annualCellSpec(c, id, source, labels.get(id) ?? "Text", kind, valueOf.get(id) ?? "", live.get(id) ?? null, (v) => onText(id, v)),
    pending: session.pending,
    problems: session.problems,
    saved: session.saved,
    onOpen: session.setOpenSpec,
    labelOf: (id) => labels.get(id) ?? "Text",
    isEdited: (id) => live.has(id) && valueOf.has(id) && live.get(id) !== valueOf.get(id),
    selectedRow: activeRow,
    pin,
    onOversized: (keys) => setOversized((cur) => (cur.join() === keys.join() ? cur : keys)),
  };

  const pickRow = (e: PointerEvent<HTMLDivElement>) => {
    const key = (e.target as Element).closest("tr[data-unit-key]")?.getAttribute("data-unit-key");
    if (key) setActiveRow(key);
  };

  const confirmText = confirm === "regenerate"
    ? {
        title: "Regenerate from live data?",
        description: "The summary table will be rebuilt from the system data, replacing your edits to it. The issues, solutions and recommendations you typed stay. You can undo this.",
        label: "Regenerate",
      }
    : confirm === "clear"
      ? {
          title: "Clear this report?",
          description: "Everything goes back to the system data and the template wording, and the issues you typed are removed. Signatories are kept. You can undo this.",
          label: "Clear",
        }
      : typeof confirm === "object" && confirm !== null && "columns" in confirm
        ? {
            title: "Replace your edits in the summary?",
            description: "Changing the Company or Department column rebuilds the summary rows from the system data, so your edits to the summary table will be replaced. You can undo this.",
            label: "Replace",
          }
        : { title: "Delete this row?", description: "The row is removed from this report. You can undo this.", label: "Delete" };

  function doConfirm() {
    const cf = confirm;
    setConfirm(null);
    if (!cf || !source) return;
    if (cf === "regenerate") {
      mutate((cur) => ({ ...cur, summary: summaryOf(cur, source) }));
      notify.success("Regenerated from the live data.");
    } else if (cf === "clear") {
      mutate(() => buildAnnualContent(source));
      notify.success("Cleared. The report is back to the system data.");
    } else if ("columns" in cf) {
      setSummaryColumns(cf.columns);
    } else {
      deleteRow(cf.row);
    }
  }

  const selected = activeRow ? c.issues.findIndex((r) => r.id === activeRow) : -1;
  const rowActions: RowAction[] = selected < 0 ? [] : [
    { key: "add", label: "Add a row below (Ctrl+Enter)", icon: <Plus className="h-4 w-4" />, onClick: () => addRow(c.issues[selected].id) },
    { key: "up", label: "Move up (Alt+Up)", icon: <ArrowUp className="h-4 w-4" />, disabled: selected === 0, onClick: () => moveRow(c.issues[selected].id, -1) },
    { key: "down", label: "Move down (Alt+Down)", icon: <ArrowDown className="h-4 w-4" />, disabled: selected === c.issues.length - 1, onClick: () => moveRow(c.issues[selected].id, 1) },
    { key: "del", label: "Delete row", icon: <Trash2 className="h-4 w-4" />, destructive: true, onClick: () => requestDelete(c.issues[selected].id) },
  ];

  return (
    <div ref={rootRef} data-editor-root className="min-w-0">
      <style>{EDIT_CSS}</style>
      <ReportHeader title={title} typeLabel="Annual Report (Annex C)" semesterName={ctx.semesterName} />

      <EditorToolbar
        canUndo={history.canUndo}
        canRedo={history.canRedo}
        onUndo={undo}
        onRedo={redo}
        scale={scale}
        onZoomStep={(dir) => setZoom(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round((scale + dir * 0.1) * 10) / 10)))}
        onFit={() => setZoom("fit")}
        onActual={() => setZoom(1)}
        status={status}
        editMode={editMode}
        onEditMode={(on) => { flushTyping(); session.requestEditMode(on); }}
        pendingCount={session.count}
        onSaveToDatabase={session.openSave}
        onDiscardChanges={session.requestDiscard}
        reportOnlyCount={session.reportOnlyCount}
        settingsOpen={settingsOpen}
        onToggleSettings={() => setSettingsOpen((o) => !o)}
        onReload={() => setConfirm("regenerate")}
        onClear={() => setConfirm("clear")}
        onPreview={() => { flushTyping(); setShowPreview(true); }}
      />

      <p className="mb-2 text-xs text-muted-foreground">
        {!editMode
          ? "This report is read-only. Turn on Edit mode to change it. Add the Company or Department column to split the summary."
          : touch
            ? "Tap any text on the paper to edit it. Tap a row for its actions. Pinch to zoom. Edits get a small dot."
            : "Click any text on the paper and type. Point at an issue row for its controls. Edits change this report only and get a small dot."}
      </p>

      {oversized.length > 0 && (
        <Alert variant="destructive" className="mb-2">
          <AlertDescription>
            {oversized.length === 1 ? "One row is" : `${oversized.length} rows are`} longer than a full page and will be cut off when printed. Shorten the text or split it into more rows.
          </AlertDescription>
        </Alert>
      )}

      <ReportSettingsLayout
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        sidebar={
          <>
            <SettingsSection title="Report" onReset={() => mutate((cur) => ({ ...cur, subtitle: "", headerText: "", footerText: "" }))}>
              <TextField label="Title" value={title} onChange={setTitle} placeholder="Annual Report" />
              <TextField label="Subtitle" value={c.subtitle ?? ""} onChange={(v) => mutate((cur) => ({ ...cur, subtitle: v }), "subtitle")} />
              <TextAreaField label="Header text" value={c.headerText ?? ""} placeholder="Printed before the summary"
                onChange={(v) => mutate((cur) => ({ ...cur, headerText: v }), "header")} />
              <TextAreaField label="Footer text" value={c.footerText ?? ""} placeholder="Printed after the tables, on the last page"
                onChange={(v) => mutate((cur) => ({ ...cur, footerText: v }), "footer")} />
              <p className="text-xs text-muted-foreground">The title lines, HEI, address, degree program and narrative are edited on the paper.</p>
            </SettingsSection>

            <SettingsSection title="Data and filters">
              <FixedInfo items={[
                { label: "Semester", value: ctx.semesterName },
                { label: "Course", value: ctx.programAbbreviation || ctx.programName },
              ]} />
              <p className="text-xs text-muted-foreground">The summary counts every student. Use Regenerate to recount it from live data.</p>
            </SettingsSection>

            <SettingsSection title="Columns" onReset={() => {
              const split = c.summaryColumns.filter((k) => ["company", "department"].includes(k));
              mutate((cur) => ({ ...cur, summaryColumns: [...DEFAULT_SUMMARY_COLUMNS, ...split], issueColumns: [...DEFAULT_ISSUE_COLUMNS] }));
            }}>
              <ColumnsControl groups={[
                {
                  legend: "Summary table",
                  columns: SUMMARY_COLUMNS.filter((x) => !["company", "department"].includes(x.key)).map((x) => ({ key: x.key, label: x.label })),
                  selected: c.summaryColumns.filter((k) => !["company", "department"].includes(k)),
                  onChange: (next) => mutate((cur) => ({
                    ...cur,
                    summaryColumns: [...next, ...cur.summaryColumns.filter((k) => ["company", "department"].includes(k))],
                  }), "columns"),
                },
                {
                  legend: "Issues table",
                  columns: ISSUE_COLUMNS.map((x) => ({ key: x.key, label: x.label })),
                  selected: c.issueColumns,
                  onChange: (next) => mutate((cur) => ({ ...cur, issueColumns: next }), "columns"),
                },
              ]} />
            </SettingsSection>

            <SettingsSection title="Sorting and grouping" onReset={() => {
              if (c.summaryColumns.includes("company")) toggleSummary("company", false);
              else if (c.summaryColumns.includes("department")) toggleSummary("department", false);
            }}>
              <CheckField label="Split the summary by company" checked={c.summaryColumns.includes("company")}
                onChange={(v) => toggleSummary("company", v)} />
              <CheckField label="Split the summary by department" checked={c.summaryColumns.includes("department")}
                onChange={(v) => toggleSummary("department", v)}
                hint="Splitting rebuilds the summary rows from the system and asks first if you edited them." />
            </SettingsSection>

            <SettingsSection title="Page" onReset={() => mutate((cur) => ({ ...cur, settings: { ...ANNUAL_PAGE_DEFAULTS } }), "settings")}>
              <PageControl settings={c.settings} onChange={(settings) => mutate((cur) => ({ ...cur, settings }), "settings")} />
            </SettingsSection>

            <SettingsSection title="Signatories" count={sign.items.length}>
              <SignatoriesControl items={sign.items} onAdd={sign.add} onEdit={sign.edit} onDelete={sign.remove} onManage={sign.manage}
                builtIn={{ checked: sign.showBuiltIn, onChange: sign.setShowBuiltIn }} />
            </SettingsSection>

            <SettingsSection title="Advanced" defaultOpen={false} onReset={() => mutate((cur) => ({ ...cur, display: { ...DEFAULT_DISPLAY } }))}>
              <AdvancedControl display={displayOf(c.display)} onChange={(next) => mutate((cur) => ({ ...cur, display: next }))}
                show={{ striped: true, blank: true }} />
            </SettingsSection>
          </>
        }
      >
      <EditorContext.Provider value={api}>
        <PaperSurface
          paperWidth={paperWidth}
          zoom={zoom}
          onZoom={setZoom}
          onScale={setScale}
          gutter={touch ? 8 : 52}
          overlay={editMode && selected >= 0 && (
            <RowControls
              targetSelector={`tr[data-unit-key="${CSS.escape(c.issues[selected].id)}"]`}
              label={c.issues[selected].issue || `Row ${selected + 1}`}
              actions={rowActions}
              touch={touch}
              onClose={() => setActiveRow(null)}
            />
          )}
        >
          <div
            className={editMode ? "rp-edit" : undefined}
            onPointerOver={touch || !editMode ? undefined : pickRow}
            onPointerDown={touch && editMode ? pickRow : undefined}
          >
            <AnnualSheet
              content={c}
              context={ctx}
              signatories={people}
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
      </EditorContext.Provider>
      </ReportSettingsLayout>

      {current && currentCell && (
        <CellActionsBar info={current} onReset={() => resetCell(currentCell)} />
      )}
      {editMode && (
        <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => addRow(null)}>
          <Plus className="h-4 w-4" /> Add an issue row
        </Button>
      )}
      {/* Puwang para hindi matakpan ng action bar sa telepono */}
      {touch && editMode && selected >= 0 && <div className="h-28" aria-hidden />}

      <CellSheet
        cells={cells}
        openId={sheetCell}
        onClose={() => setSheetCell(null)}
        onCommit={onTextNoted}
        onNavigate={(id) => {
          setSheetCell(id);
          setCurrentCell(id);
          const row = issueOf(id);
          if (row) setActiveRow(row);
        }}
        renderExtra={(cell) => {
          const state = cellInfo(cell.id);
          return state && (
            <CellActions info={state} onReset={() => { resetCell(cell.id); setSheetCell(null); }} />
          );
        }}
      />

      {session.dialogs}

      {sign.panel}

      <ReportPreviewDialog
        open={showPreview}
        onOpenChange={setShowPreview}
        title={`${title || "Annual Report"} preview`}
        fileName={`Annual-Report-${(ctx.semesterName || "semester").replace(/[^\w-]+/g, "-")}.pdf`}
        settings={c.settings}
        onSettings={(settings) => mutate((cur) => ({ ...cur, settings }), "settings")}
        allowOrientation
        onExcel={() => downloadExcel({ ...annualExcel(c, title || "Annual Report", ctx), signatories: manual.items.length === 0 ? [] : manual.showBuiltIn ? [...builtInAsSignatories(people), ...manual.items] : manual.items })}
        renderSheet={(mode) => <AnnualSheet content={c} context={ctx} signatories={people} mode={mode} manual={manual} />}
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
