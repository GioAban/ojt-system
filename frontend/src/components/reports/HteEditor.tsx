import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent } from "react";
import {
  ArrowDown, ArrowUp, ListPlus, Pencil, Plus, Trash2, UserPlus,
} from "lucide-react";
import { notify } from "@/lib/notify";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSignatoryControls } from "@/hooks/useSignatoryControls";
import { useEditSession } from "@/hooks/useEditSession";
import { useReportDraft } from "@/hooks/useReportDraft";
import { useSignatories } from "@/hooks/useSignatories";
import { useUndoRedo } from "@/hooks/useUndoRedo";
import {
  addMissingStudents, backfillDepartments, buildGroups, buildHteContent, hteAfterCommit, missingStudents, newId,
  parseHteContent,
} from "@/lib/hteReport";
import { HTE_COLUMNS, applyCell, hteCells, hteColumnsOf, hteLiveIndex, signatoryOf } from "@/lib/hteCells";
import { builtInAsSignatories } from "@/lib/manualSignatories";
import { paperSize } from "@/lib/paperExport";
import { downloadExcel, hteExcel } from "@/lib/reportExcel";
import { hteCellSpec } from "@/lib/reportFields";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { HteSheet, type HteEditBindings } from "@/components/reports/HteSheet";
import { ReportPreviewDialog } from "@/components/reports/ReportPreviewDialog";
import { EditorContext, type ActiveCell, type CellFocusInfo, type EditorApi } from "@/components/reports/editor/editorContext";
import { EditorToolbar } from "@/components/reports/editor/EditorToolbar";
import { PaperSurface, MAX_ZOOM, MIN_ZOOM, type Zoom } from "@/components/reports/editor/PaperSurface";
import { RowControls, type RowAction } from "@/components/reports/editor/RowControls";
import { CellSheet } from "@/components/reports/editor/CellSheet";
import { CellActions, CellActionsBar, type CellInfo } from "@/components/reports/editor/CellActions";
import {
  AdvancedControl, ColumnsControl, FixedInfo, PageControl, ReportSettingsLayout, SelectField, SettingsSection,
  SignatoriesControl, TextAreaField, TextField,
} from "@/components/reports/settings/ReportSettingsSidebar";
import { DEFAULT_HTE_COLUMNS } from "@/lib/hteCells";
import { HTE_FILTERS, HTE_PAGE_DEFAULTS, hteFilterOptions, visibleHte } from "@/lib/hteReport";
import { DEFAULT_DISPLAY, type HteStudentSort } from "@/types/reports";
import { displayOf } from "@/lib/reportDisplay";
import { EDIT_CSS } from "@/components/reports/editor/editCss";
import { ReportHeader, ReportLoadState } from "@/components/reports/editor/ReportHeader";
import { type TextControl } from "@/components/reports/editor/EditableText";
import { focusSibling, setCaret } from "@/components/reports/editor/caret";
import type { HteContent, HteGroup, HteStudent, HteVariant, SignatoryOverrides } from "@/types/reports";

const TITLES: Record<HteVariant, { title: string; file: string }> = {
  report: { title: "Report on the List of HTEs and Student Interns", file: "Report-on-HTEs-and-Student-Interns" },
  list: { title: "List of HTEs", file: "List-of-HTEs" },
};

interface Snapshot {
  content: HteContent;
  sig: SignatoryOverrides | null;
}

type ActiveRow =
  | { kind: "student"; groupId: string; studentId: string }
  | { kind: "group"; groupId: string };

type Confirm =
  | { kind: "clear" }
  | { kind: "reload" }
  | { kind: "student"; studentId: string }
  | { kind: "group"; groupId: string };

type Pending = { id: string; caret: "start" | "end" | number };

interface Handlers {
  focus: (info: CellFocusInfo) => void;
  blur: (id: string) => void;
  open: (id: string) => void;
  controls: () => void;
  key: (e: KeyboardEvent) => void;
}

const noop = () => {};

function blankStudent(program: string): HteStudent {
  return { id: newId(), studentId: null, name: "", program, gender: "", period: "", department: "" };
}

function locate(c: HteContent, studentId: string) {
  for (let gi = 0; gi < c.groups.length; gi++) {
    const si = c.groups[gi].students.findIndex((s) => s.id === studentId);
    if (si >= 0) return { gi, si };
  }
  return null;
}

function rowFromCellId(c: HteContent, id: string): ActiveRow | null {
  const [kind, ref] = id.split(":");
  if (kind === "g") return { kind: "group", groupId: ref };
  if (kind === "s") {
    const at = locate(c, ref);
    return at ? { kind: "student", groupId: c.groups[at.gi].id, studentId: ref } : null;
  }
  return null;
}

const sameRow = (a: ActiveRow | null, b: ActiveRow | null) =>
  a === b || (!!a && !!b && a.kind === b.kind && a.groupId === b.groupId
    && (a.kind === "group" || (b.kind === "student" && a.studentId === b.studentId)));

/** Editor sa mismong papel ng Report 2 (may period of training) at Report 3 (wala), iisang component */
export function HteEditor({ variant, reportId }: { variant: HteVariant; reportId: number }) {
  const draft = useReportDraft<HteContent>({
    reportId,
    build: buildHteContent,
    parse: parseHteContent,
  });
  const { content, source, update, get, status, loadError, retry, gone, title, setTitle, replaceSource } = draft;
  const sig = useSignatories(source?.context ?? null);
  const history = useUndoRedo<Snapshot>();
  const touch = useIsMobile();

  const [zoom, setZoom] = useState<Zoom>("fit");
  const [scale, setScale] = useState(1);
  const [activeRow, setActiveRow] = useState<ActiveRow | null>(null);
  const [pin, setPin] = useState<{ key: string; page: number } | null>(null);
  const [sheetCell, setSheetCell] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  // Pirmahan sa dulo: naka-save sa device lang; pumapalit sa built-in kapag mayroon
  const sign = useSignatoryControls(reportId, { hasBuiltIn: true, title: title || TITLES[variant].title });
  // Sidebar ng mga setting: bukas sa desktop, sarado (bottom sheet) sa telepono
  const [settingsOpen, setSettingsOpen] = useState(() => typeof window === "undefined" || window.innerWidth >= 768);
  const [currentCell, setCurrentCell] = useState<string | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);
  const active = useRef<ActiveCell | null>(null);
  const lastCell = useRef<string | null>(null);
  const pending = useRef<Pending | null>(null);
  const handlers = useRef<Handlers>({ focus: noop, blur: noop, open: noop, controls: noop, key: noop });

  const api = useMemo<EditorApi>(() => ({
    touch,
    onCellFocus: (info) => handlers.current.focus(info),
    onCellBlur: (id) => handlers.current.blur(id),
    openSheet: (id) => handlers.current.open(id),
    focusControls: () => handlers.current.controls(),
    getActive: () => active.current,
    setActive: (cell) => { active.current = cell; },
  }), [touch]);

  const meta = TITLES[variant];
  const ctx = source?.context ?? null;

  // ---- mga pagbabago: laging may tala para sa Undo; hindi ginagalaw ang datos ng system ----
  const mutate = (fn: (c: HteContent) => HteContent, key?: string) => {
    const cur = get();
    if (!cur) return;
    const next = fn(cur);
    if (next === cur) return;
    history.record({ content: cur, sig: sig.getSaved() }, key);
    update(next);
  };

  const onText = (id: string, value: string) => {
    if (!ctx) return;
    // Ang pirmahan ay dumadaan sa "Save changes to database", hindi diretsong isine-save
    if (signatoryOf(id)) return;
    mutate((c) => applyCell(c, id, value, variant, ctx), id);
  };

  const flushTyping = () => {
    const el = document.activeElement as HTMLElement | null;
    if (el && el.isContentEditable && el.closest("[data-editor-root]")) el.blur();
  };

  // Edit mode (R6): ang mga cell na nakakabit sa tunay na record ay naghihintay hanggang patayin at kumpirmahin
  const session = useEditSession<HteContent>({
    reportId,
    source,
    get,
    mutate,
    onCommitted: (fresh, changes) => {
      replaceSource(fresh);
      mutate((cur) => hteAfterCommit(cur, fresh, changes));
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

  const focusLater = (p: Pending) => {
    if (touch) setSheetCell(p.id);
    else pending.current = p;
  };

  // ---- mga row at grupo ----
  const setGroupsOf = (c: HteContent, groups: HteGroup[]) => ({ ...c, groups });

  const addBelow = (studentId: string) => {
    if (!ctx) return;
    const fresh = blankStudent(ctx.programAbbreviation);
    mutate((c) => {
      const at = locate(c, studentId);
      if (!at) return c;
      return setGroupsOf(c, c.groups.map((g, i) => {
        if (i !== at.gi) return g;
        const list = [...g.students];
        list.splice(at.si + 1, 0, fresh);
        return { ...g, students: list };
      }));
    });
    setActiveRow((r) => (r ? { kind: "student", groupId: r.groupId, studentId: fresh.id } : r));
    focusLater({ id: `s:${fresh.id}:name`, caret: "start" });
  };
  const moveStudent = (studentId: string, dir: -1 | 1) => {
    flushTyping();
    mutate((c) => {
      const at = locate(c, studentId);
      if (!at) return c;
      const list = [...c.groups[at.gi].students];
      const j = at.si + dir;
      if (j < 0 || j >= list.length) return c;
      [list[at.si], list[j]] = [list[j], list[at.si]];
      return setGroupsOf(c, c.groups.map((g, i) => (i === at.gi ? { ...g, students: list } : g)));
    });
    if (lastCell.current?.startsWith(`s:${studentId}:`)) focusLater({ id: lastCell.current, caret: "end" });
  };
  const moveStudentTo = (studentId: string, groupId: string) => {
    flushTyping();
    mutate((c) => {
      const at = locate(c, studentId);
      if (!at) return c;
      const s = c.groups[at.gi].students[at.si];
      return setGroupsOf(c, c.groups.map((g, i) => {
        if (i === at.gi) return { ...g, students: g.students.filter((_, k) => k !== at.si) };
        if (g.id === groupId) return { ...g, students: [...g.students, s] };
        return g;
      }));
    });
    setActiveRow({ kind: "student", groupId, studentId });
  };
  const deleteStudent = (studentId: string) => {
    mutate((c) => setGroupsOf(c, c.groups.map((g) => ({ ...g, students: g.students.filter((s) => s.id !== studentId) }))));
    setActiveRow(null);
  };
  const requestDeleteStudent = (studentId: string) => {
    flushTyping();
    const c = get();
    const at = c ? locate(c, studentId) : null;
    if (!c || !at) return;
    const s = c.groups[at.gi].students[at.si];
    if ([s.name, s.program, s.gender, s.period].some((v) => v.trim())) setConfirm({ kind: "student", studentId });
    else deleteStudent(studentId);
  };

  const moveGroup = (groupId: string, dir: -1 | 1) => {
    flushTyping();
    mutate((c) => {
      const i = c.groups.findIndex((g) => g.id === groupId);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= c.groups.length) return c;
      const next = [...c.groups];
      [next[i], next[j]] = [next[j], next[i]];
      return setGroupsOf(c, next);
    });
  };
  const deleteGroup = (groupId: string) => {
    mutate((c) => setGroupsOf(c, c.groups.filter((g) => g.id !== groupId)));
    setActiveRow(null);
  };
  const requestDeleteGroup = (groupId: string) => {
    flushTyping();
    const g = get()?.groups.find((x) => x.id === groupId);
    if (!g) return;
    if (g.students.length > 0 || g.name.trim() || g.departments.some((d) => d.trim())) setConfirm({ kind: "group", groupId });
    else deleteGroup(groupId);
  };
  const addStudentTo = (groupId: string) => {
    if (!ctx) return;
    const fresh = blankStudent(ctx.programAbbreviation);
    mutate((c) => setGroupsOf(c, c.groups.map((g) => (g.id === groupId ? { ...g, students: [...g.students, fresh] } : g))));
    setActiveRow({ kind: "student", groupId, studentId: fresh.id });
    focusLater({ id: `s:${fresh.id}:name`, caret: "start" });
  };
  const addDepartment = (groupId: string) => {
    const g = get()?.groups.find((x) => x.id === groupId);
    if (!g || g.noHte) return;
    mutate((c) => setGroupsOf(c, c.groups.map((x) => (x.id === groupId ? { ...x, departments: [...x.departments, ""] } : x))));
    focusLater({ id: `g:${groupId}:dept:${g.departments.length}`, caret: "start" });
  };
  const addGroup = () => {
    const group: HteGroup = { id: newId(), companyId: null, name: "", departments: [], students: [] };
    mutate((c) => {
      const noHte = c.groups.findIndex((g) => g.noHte);
      const next = [...c.groups];
      if (noHte < 0) next.push(group);
      else next.splice(noHte, 0, group);
      return setGroupsOf(c, next);
    });
    setActiveRow({ kind: "group", groupId: group.id });
    focusLater({ id: `g:${group.id}:name`, caret: "start" });
  };

  // Enter: bagong bullet; Backspace sa simula: isama sa nauna; arrow: lumipat ng bullet
  const onBulletKey = (groupId: string, index: number, e: ReactKeyboardEvent<HTMLDivElement>, ctl: TextControl) => {
    const g = get()?.groups.find((x) => x.id === groupId);
    if (!g) return false;
    const plain = !e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey;
    const sel = window.getSelection();
    const collapsed = !sel || sel.isCollapsed;
    if (e.key === "Enter" && plain) {
      e.preventDefault();
      const before = ctl.text.slice(0, ctl.caret);
      const after = ctl.text.slice(ctl.caret);
      ctl.setText(before);
      mutate((c) => setGroupsOf(c, c.groups.map((x) => {
        if (x.id !== groupId) return x;
        const list = [...x.departments];
        list.splice(index, 1, before, after);
        return { ...x, departments: list };
      })));
      focusLater({ id: `g:${groupId}:dept:${index + 1}`, caret: "start" });
      return true;
    }
    if (e.key === "Backspace" && plain && collapsed && ctl.caret === 0) {
      e.preventDefault();
      const prev = index > 0 ? g.departments[index - 1] : null;
      // Ang element na ito ay magpapakita na ng susunod na bullet: isabay na para walang maling commit
      ctl.setText(g.departments[index + 1] ?? "");
      mutate((c) => setGroupsOf(c, c.groups.map((x) => {
        if (x.id !== groupId) return x;
        const list = [...x.departments];
        if (prev !== null) list.splice(index - 1, 2, prev + ctl.text);
        else list.splice(index, 1);
        return { ...x, departments: list };
      })));
      if (prev !== null) focusLater({ id: `g:${groupId}:dept:${index - 1}`, caret: prev.length });
      else focusLater({ id: `g:${groupId}:name`, caret: "end" });
      return true;
    }
    if (e.key === "ArrowUp" && plain && ctl.caret === 0) {
      e.preventDefault();
      focusSibling(ctl.el, -1);
      return true;
    }
    if (e.key === "ArrowDown" && plain && ctl.caret >= ctl.text.length) {
      e.preventDefault();
      focusSibling(ctl.el, 1);
      return true;
    }
    return false;
  };

  // ---- mga handler na kailangang laging bago (tinatawag mula sa context at sa window) ----
  useEffect(() => {
    handlers.current = {
      focus: (info) => {
        lastCell.current = info.id;
        setCurrentCell(info.id);
        setPin((p) => (info.rowKey
          ? (p && p.key === info.rowKey && p.page === info.page ? p : { key: info.rowKey, page: info.page })
          : null));
        const c = get();
        const row = c ? rowFromCellId(c, info.id) : null;
        if (row) setActiveRow((r) => (sameRow(r, row) ? r : row));
      },
      blur: (id) => {
        if (!active.current) setPin(null);
        // Walang lamang bullet ng department: alisin paglabas (hindi kapag lumipat lang sa ibang bullet nito)
        const m = /^g:([^:]+):dept:(\d+)$/.exec(id);
        if (m && !active.current?.id.startsWith(`g:${m[1]}:dept:`)) {
          const g = get()?.groups.find((x) => x.id === m[1]);
          const i = Number(m[2]);
          if (g && g.departments[i] !== undefined && !g.departments[i].trim()) {
            mutate((c) => setGroupsOf(c, c.groups.map((x) => (x.id === m[1]
              ? { ...x, departments: x.departments.filter((_, k) => k !== i) } : x))));
          }
        }
      },
      open: (id) => {
        lastCell.current = id;
        setCurrentCell(id);
        const c = get();
        const row = c ? rowFromCellId(c, id) : null;
        if (row) setActiveRow(row);
        setSheetCell(id);
      },
      controls: () => {
        rootRef.current?.querySelector<HTMLButtonElement>("[data-row-controls] button:not(:disabled)")?.focus();
      },
      key: (e) => {
        const t = e.target as HTMLElement | null;
        const inEditor = !t || t === document.body || !!t.closest?.("[data-editor-root]");
        if (!inEditor || showPreview || confirm || sheetCell) return;
        const mod = e.ctrlKey || e.metaKey;
        const k = e.key.toLowerCase();
        if (mod && !e.altKey && k === "z" && !e.shiftKey) { e.preventDefault(); undo(); return; }
        if (mod && (k === "y" || (k === "z" && e.shiftKey))) { e.preventDefault(); redo(); return; }
        if (e.key === "Escape" && t?.closest?.("[data-row-controls]")) {
          const id = lastCell.current;
          const el = id ? rootRef.current?.querySelector<HTMLElement>(`[data-cell-id="${CSS.escape(id)}"]`) : null;
          if (el) { e.preventDefault(); el.focus(); }
          return;
        }
        if (!activeRow || !editMode) return;
        if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
          e.preventDefault();
          const dir = e.key === "ArrowUp" ? -1 : 1;
          if (activeRow.kind === "student") moveStudent(activeRow.studentId, dir);
          else moveGroup(activeRow.groupId, dir);
          return;
        }
        if (mod && e.key === "Enter" && activeRow.kind === "student") {
          e.preventDefault();
          addBelow(activeRow.studentId);
        }
      },
    };
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => handlers.current.key(e);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Pagkatapos magdagdag o maglipat: i-focus ang tamang cell kapag nasa pahina na ito
  useEffect(() => {
    const p = pending.current;
    if (!p) return;
    const el = rootRef.current?.querySelector<HTMLElement>(`[data-cell-id="${CSS.escape(p.id)}"]`);
    if (!el) return;
    pending.current = null;
    el.focus();
    setCaret(el, p.caret === "start" ? 0 : p.caret === "end" ? (el.textContent ?? "").length : p.caret);
  });

  // ---- render ----
  if (!content || !source || !ctx || !sig.values) {
    return <ReportLoadState gone={gone} loadError={loadError} onRetry={retry} />;
  }

  const c = content;
  const people = sig.values;
  const cells = hteCells(c, ctx, variant, people);
  const labels = new Map(cells.map((x) => [x.id, x.label]));
  const missing = editMode ? missingStudents(c, source) : [];
  const live = hteLiveIndex(c, source, variant);
  const cols = hteColumnsOf(c);
  const valueOf = new Map(cells.map((x) => [x.id, x.value]));
  const isEdited = (id: string) => live.has(id) && valueOf.has(id) && live.get(id) !== valueOf.get(id);
  /** Teksto sa papel na binago: itinatala rin para sa buod ng Edit mode (sa report lang ito) */
  const onTextNoted = (id: string, value: string) => {
    onText(id, value);
    session.noteReportOnly({ key: `hte:${id}`, label: labels.get(id) ?? "Text", who: "", system: live.get(id) ?? null, value });
  };
  const typed = (id: string) =>
    hteCellSpec(c, id, source, variant, labels.get(id) ?? "Text", valueOf.get(id) ?? "", live.get(id) ?? null, (v) => onText(id, v));
  const cellInfo = (id: string | null): CellInfo | null => {
    if (!id || !valueOf.has(id) || typed(id) !== null) return null;
    return { label: labels.get(id) ?? "Text", value: valueOf.get(id) ?? "", live: live.get(id) ?? null };
  };
  const resetCell = (id: string) => {
    const value = live.get(id);
    if (value !== undefined) onTextNoted(id, value);
  };
  const current = editMode && !touch ? cellInfo(currentCell) : null;
  // Ang bottom sheet at Tab ay para sa teksto ng report lang; ang mga cell ng record ay may sariling input
  const textCells = cells.filter((x) => typed(x.id) === null);

  const shownContent = visibleHte(c, source);
  const filterOptions = hteFilterOptions(source);
  const display = displayOf(c.display);
  /** Bagong napiling column (sa ayos); pinupunan ang department ng mga lumang kopya kapag unang ipinakita */
  const setColumns = (next: string[]) =>
    mutate((cur) => {
      const updated = { ...cur, columns: next };
      return next.includes("department") && !hteColumnsOf(cur).includes("department") ? backfillDepartments(updated, source) : updated;
    }, "columns");
  const paperWidth = paperSize(c.settings.orientation, c.settings.paper).width;

  const bindings: HteEditBindings = {
    onText: onTextNoted,
    onBulletKey,
    labelOf: (id) => labels.get(id) ?? "Text",
    isEdited,
    selectedRow: activeRow?.kind === "student" ? activeRow.studentId : null,
    pin,
    typed,
    pending: session.pending,
    problems: session.problems,
    saved: session.saved,
    onOpen: session.setOpenSpec,
  };

  const pickRow = (e: PointerEvent<HTMLDivElement>) => {
    const t = (e.target as Element).closest("[data-row-kind]");
    if (!t) return;
    const groupId = t.getAttribute("data-group-id");
    if (!groupId) return;
    const kind = t.getAttribute("data-row-kind");
    const studentId = t.getAttribute("data-student-id");
    const row: ActiveRow = kind === "student" && studentId ? { kind: "student", groupId, studentId } : { kind: "group", groupId };
    setActiveRow((r) => (sameRow(r, row) ? r : row));
  };

  const confirmText = (() => {
    switch (confirm?.kind) {
      case "reload":
        return {
          title: "Regenerate from live data?",
          description: "The HTE groups and students will be rebuilt from the system data. Your edits to names, departments, periods and order in this report will be replaced. The title lines, HEI, address, degree program, page settings and signatories stay. You can undo this.",
          label: "Regenerate",
        };
      case "clear":
        return {
          title: "Clear this report?",
          description: "Everything in this report goes back to the system data and the template wording, including the title lines, HEI, address and degree program. Signatories are kept. You can undo this.",
          label: "Clear",
        };
      case "student":
        return { title: "Delete this row?", description: "The student is removed from this report only, not from the system. You can undo this.", label: "Delete" };
      case "group":
        return {
          title: "Delete this company group?",
          description: "The company and all its students in this group are removed from this report only, not from the system. You can undo this.",
          label: "Delete",
        };
      default:
        return { title: "", description: "", label: "" };
    }
  })();

  function doConfirm() {
    const cf = confirm;
    setConfirm(null);
    if (!cf || !source) return;
    if (cf.kind === "clear") {
      mutate(() => buildHteContent(source));
      notify.success("Cleared. The report is back to the system data.");
    } else if (cf.kind === "reload") {
      mutate((cur) => ({ ...cur, groups: buildGroups(source) }));
      notify.success("Regenerated from the live data.");
    } else if (cf.kind === "student") {
      deleteStudent(cf.studentId);
    } else {
      deleteGroup(cf.groupId);
    }
  }

  const zoomStep = (dir: 1 | -1) =>
    setZoom(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round((scale + dir * 0.1) * 10) / 10)));

  return (
    <div ref={rootRef} data-editor-root className="min-w-0">
      <style>{EDIT_CSS}</style>
      <ReportHeader title={title} typeLabel={meta.title} semesterName={ctx.semesterName} />

      <EditorToolbar
        canUndo={history.canUndo}
        canRedo={history.canRedo}
        onUndo={undo}
        onRedo={redo}
        scale={scale}
        onZoomStep={zoomStep}
        onFit={() => setZoom("fit")}
        onActual={() => setZoom(1)}
        status={status}
        editMode={editMode}
        onEditMode={session.requestEditMode}
        pendingCount={session.count}
        onSaveToDatabase={() => { flushTyping(); session.openSave(); }}
        onDiscardChanges={session.requestDiscard}
        reportOnlyCount={session.reportOnlyCount}
        settingsOpen={settingsOpen}
        onToggleSettings={() => setSettingsOpen((o) => !o)}
        missingCount={missing.length}
        onAddMissing={() => {
          mutate((cur) => addMissingStudents(cur, source));
          notify.success(`Added ${missing.length} student${missing.length === 1 ? "" : "s"}. Your edits were kept.`);
        }}
        onReload={() => setConfirm({ kind: "reload" })}
        onClear={() => setConfirm({ kind: "clear" })}
        onPreview={() => { flushTyping(); setShowPreview(true); }}
      />

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
        {!editMode
          ? "This report is read-only. Turn on Edit mode to change it."
          : touch
            ? "Tap text on the paper to edit it. Tap a row for its actions. Company names, departments and training dates are written to the real records with Save changes to database. Other text changes this report only and can be reset."
            : "Click text on the paper to edit it. Point at a row or a company for its controls. Company names, departments and training dates are written to the real records with Save changes to database. Other text changes this report only and can be reset."}
        {variant === "list" && " The Period of Training column stays empty in this list."}
      </p>

      <ReportSettingsLayout
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        sidebar={
          <>
            <SettingsSection title="Report" onReset={() => mutate((cur) => ({ ...cur, subtitle: "", headerText: "", footerText: "" }))}>
              <TextField label="Title" value={title} onChange={setTitle} placeholder={meta.title} />
              <TextField label="Subtitle" value={c.subtitle ?? ""} onChange={(v) => mutate((cur) => ({ ...cur, subtitle: v }), "subtitle")} />
              <TextAreaField label="Header text" value={c.headerText ?? ""} placeholder="Printed above the table"
                onChange={(v) => mutate((cur) => ({ ...cur, headerText: v }), "header")} />
              <TextAreaField label="Footer text" value={c.footerText ?? ""} placeholder="Printed after the table, on the last page"
                onChange={(v) => mutate((cur) => ({ ...cur, footerText: v }), "footer")} />
              <p className="text-xs text-muted-foreground">The title lines, HEI, address and degree program are edited on the paper.</p>
            </SettingsSection>

            <SettingsSection title="Data and filters" onReset={() => mutate((cur) => ({ ...cur, filters: {} }))}>
              <FixedInfo items={[
                { label: "Semester", value: ctx.semesterName },
                { label: "Course", value: ctx.programAbbreviation || ctx.programName },
              ]} />
              {HTE_FILTERS.map((f) => (
                <SelectField
                  key={f.key}
                  label={f.label}
                  value={c.filters?.[f.key] ?? ""}
                  options={[{ value: "", label: "All" }, ...(filterOptions[f.key] ?? [])]}
                  onChange={(v) => mutate((cur) => {
                    const filters = { ...(cur.filters ?? {}) };
                    if (v) filters[f.key] = v;
                    else delete filters[f.key];
                    return { ...cur, filters };
                  })}
                />
              ))}
              <p className="text-xs text-muted-foreground">Filters apply to students from the system. Rows you added always show.</p>
            </SettingsSection>

            <SettingsSection title="Columns" count={cols.length} onReset={() => setColumns([...DEFAULT_HTE_COLUMNS])}>
              <ColumnsControl groups={[{
                columns: HTE_COLUMNS.map((x) => ({ key: x.key, label: x.label })),
                selected: cols,
                required: ["name"],
                pinned: ["company"],
                onChange: setColumns,
              }]} />
            </SettingsSection>

            <SettingsSection title="Sorting and grouping" onReset={() => mutate((cur) => ({ ...cur, studentSort: "manual" }))}>
              <SelectField label="Students in each company" value={c.studentSort ?? "manual"}
                options={[
                  { value: "manual", label: "As arranged on the paper" },
                  { value: "asc", label: "Name, A to Z" },
                  { value: "desc", label: "Name, Z to A" },
                ]}
                onChange={(v) => mutate((cur) => ({ ...cur, studentSort: v as HteStudentSort }))} />
              <p className="text-xs text-muted-foreground">Students are grouped by host training establishment.</p>
            </SettingsSection>

            <SettingsSection title="Page" onReset={() => mutate((cur) => ({ ...cur, settings: { ...HTE_PAGE_DEFAULTS } }), "settings")}>
              <PageControl settings={c.settings} onChange={(settings) => mutate((cur) => ({ ...cur, settings }), "settings")} />
            </SettingsSection>

            <SettingsSection title="Signatories" count={sign.items.length}>
              <SignatoriesControl items={sign.items} onAdd={sign.add} onEdit={sign.edit} onDelete={sign.remove} onManage={sign.manage}
                builtIn={{ checked: sign.showBuiltIn, onChange: sign.setShowBuiltIn }} />
            </SettingsSection>

            <SettingsSection title="Advanced" defaultOpen={false} onReset={() => mutate((cur) => ({ ...cur, display: { ...DEFAULT_DISPLAY } }))}>
              <AdvancedControl display={display} onChange={(next) => mutate((cur) => ({ ...cur, display: next }))}
                show={{ rowNumbers: true, striped: true, dateFormat: variant === "report", blank: true }} />
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
          overlay={
            editMode && activeRow && (
              <HteRowControls
                content={c}
                row={activeRow}
                touch={touch}
                onClose={() => setActiveRow(null)}
                onAddBelow={addBelow}
                onMoveStudent={moveStudent}
                onMoveStudentTo={moveStudentTo}
                onDeleteStudent={requestDeleteStudent}
                onRename={(gid) => focusLater({ id: `g:${gid}:name`, caret: "end" })}
                onAddDepartment={addDepartment}
                onAddStudent={addStudentTo}
                onMoveGroup={moveGroup}
                onDeleteGroup={requestDeleteGroup}
              />
            )
          }
        >
          <div
            className={editMode ? "rp-edit" : undefined}
            onPointerOver={touch || !editMode ? undefined : pickRow}
            onPointerDown={touch && editMode ? pickRow : undefined}
          >
            <HteSheet
              content={shownContent}
              context={ctx}
              variant={variant}
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

      {current && currentCell && <CellActionsBar info={current} onReset={() => resetCell(currentCell)} />}
      {editMode && (
        <Button type="button" variant="outline" size="sm" className="mt-3" onClick={addGroup}>
          <Plus className="h-4 w-4" /> Add a company group
        </Button>
      )}
      {/* Puwang para hindi matakpan ng action bar sa telepono */}
      {touch && editMode && activeRow && <div className="h-28" aria-hidden />}

      <CellSheet
        cells={textCells}
        openId={sheetCell}
        onClose={() => setSheetCell(null)}
        onCommit={onTextNoted}
        onNavigate={(id) => {
          setSheetCell(id);
          const row = rowFromCellId(c, id);
          if (row) setActiveRow(row);
          setCurrentCell(id);
        }}
        renderExtra={(cell) => {
          const state = cellInfo(cell.id);
          return state && <CellActions info={state} onReset={() => { resetCell(cell.id); setSheetCell(null); }} />;
        }}
      />

      {session.dialogs}

      {sign.panel}

      <ReportPreviewDialog
        open={showPreview}
        onOpenChange={setShowPreview}
        title={`${meta.title} preview`}
        fileName={`${meta.file}-${(ctx.semesterName || "semester").replace(/[^\w-]+/g, "-")}.pdf`}
        settings={c.settings}
        onSettings={(settings) => mutate((cur) => ({ ...cur, settings }), "settings")}
        onExcel={() => downloadExcel({ ...hteExcel(shownContent, title || meta.title, ctx, variant), signatories: manual.items.length === 0 ? [] : manual.showBuiltIn ? [...builtInAsSignatories(people), ...manual.items] : manual.items })}
        renderSheet={(mode) => (
          <HteSheet content={shownContent} context={ctx} variant={variant} signatories={people} mode={mode} manual={manual} />
        )}
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

interface HteRowControlsProps {
  content: HteContent;
  row: ActiveRow;
  touch: boolean;
  onClose: () => void;
  onAddBelow: (studentId: string) => void;
  onMoveStudent: (studentId: string, dir: -1 | 1) => void;
  onMoveStudentTo: (studentId: string, groupId: string) => void;
  onDeleteStudent: (studentId: string) => void;
  onRename: (groupId: string) => void;
  onAddDepartment: (groupId: string) => void;
  onAddStudent: (groupId: string) => void;
  onMoveGroup: (groupId: string, dir: -1 | 1) => void;
  onDeleteGroup: (groupId: string) => void;
}

/** Mga control ng napiling row (student) o grupo (company), sa screen lang */
function HteRowControls(p: HteRowControlsProps) {
  const c = p.content;
  const group = c.groups.find((g) => g.id === p.row.groupId);
  if (!group) return null;
  const gi = c.groups.indexOf(group);

  if (p.row.kind === "student") {
    const si = group.students.findIndex((s) => s.id === (p.row as { studentId: string }).studentId);
    if (si < 0) return null;
    const s = group.students[si];
    const actions: RowAction[] = [
      { key: "add", label: "Add a row below (Ctrl+Enter)", icon: <Plus className="h-4 w-4" />, onClick: () => p.onAddBelow(s.id) },
      { key: "up", label: "Move up (Alt+Up)", icon: <ArrowUp className="h-4 w-4" />, disabled: si === 0, onClick: () => p.onMoveStudent(s.id, -1) },
      { key: "down", label: "Move down (Alt+Down)", icon: <ArrowDown className="h-4 w-4" />, disabled: si === group.students.length - 1, onClick: () => p.onMoveStudent(s.id, 1) },
      { key: "del", label: "Delete row", icon: <Trash2 className="h-4 w-4" />, destructive: true, onClick: () => p.onDeleteStudent(s.id) },
    ];
    return (
      <RowControls
        targetSelector={`tr[data-unit-key="${CSS.escape(s.id)}"]`}
        label={s.name || `Row ${si + 1}`}
        actions={actions}
        moveTargets={s.studentId !== null ? undefined : c.groups.filter((g) => g.id !== group.id).map((g) => ({
          id: g.id, label: g.noHte ? "No HTE yet" : g.name || "Unnamed company",
        }))}
        onMove={(gid) => p.onMoveStudentTo(s.id, gid)}
        touch={p.touch}
        onClose={p.onClose}
      />
    );
  }

  const actions: RowAction[] = [
    ...(!group.noHte
      ? [
          { key: "rename", label: "Rename company", icon: <Pencil className="h-4 w-4" />, onClick: () => p.onRename(group.id) },
          { key: "dept", label: "Add a department line", icon: <ListPlus className="h-4 w-4" />, onClick: () => p.onAddDepartment(group.id) },
        ]
      : []),
    { key: "student", label: "Add a student to this company", icon: <UserPlus className="h-4 w-4" />, onClick: () => p.onAddStudent(group.id) },
    { key: "up", label: "Move company up", icon: <ArrowUp className="h-4 w-4" />, disabled: gi === 0, onClick: () => p.onMoveGroup(group.id, -1) },
    { key: "down", label: "Move company down", icon: <ArrowDown className="h-4 w-4" />, disabled: gi === c.groups.length - 1, onClick: () => p.onMoveGroup(group.id, 1) },
    { key: "del", label: "Delete company group", icon: <Trash2 className="h-4 w-4" />, destructive: true, onClick: () => p.onDeleteGroup(group.id) },
  ];
  return (
    <RowControls
      targetSelector={`td[data-row-kind="group"][data-group-id="${CSS.escape(group.id)}"]`}
      label={group.noHte ? "No HTE yet" : group.name || `HTE ${gi + 1}`}
      actions={actions}
      touch={p.touch}
      onClose={p.onClose}
    />
  );
}
