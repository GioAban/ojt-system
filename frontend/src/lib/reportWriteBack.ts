// "Apply to system": mga field lang na ito ang pwedeng isulat pabalik; ang server pa rin ang huling nagpapasya.

import api from "@/lib/api";
import { buildListRows } from "@/lib/listTemplates";
import type { HteContent, ListContent, ListRow, ReportSource } from "@/types/reports";

export type WriteField = "assignment" | "section" | "year" | "supervisorName" | "supervisorPosition";

export interface ApplyItem {
  key: string;
  target: "student" | "department";
  id: number;
  field: WriteField;
  fieldLabel: string;
  who: string;
  /** assignment: department id; blangko = kailangan pang pumili */
  value: string;
  expectedOld: string;
  /** assignment: ang tina-type ng coordinator */
  wanted?: string;
}

export interface ApplyPreviewRow {
  who: string;
  field: string;
  oldValue: string;
  newValue: string;
  affected: number;
  problem: string | null;
}

const toChange = (i: ApplyItem) => ({ target: i.target, id: i.id, field: i.field, value: i.value, expectedOld: i.expectedOld });

export async function previewApply(reportId: number, items: ApplyItem[]) {
  const res = await api.post<{ rows: ApplyPreviewRow[]; ok: boolean }>(
    `/coordinator/reports/saved/${reportId}/apply/preview`, { changes: items.map(toChange) });
  return res.data;
}

export type ApplyOutcome = { kind: "done"; source: ReportSource } | { kind: "blocked"; rows: ApplyPreviewRow[] };

export async function commitApply(reportId: number, items: ApplyItem[]): Promise<ApplyOutcome> {
  try {
    const res = await api.post<{ source: ReportSource }>(`/coordinator/reports/saved/${reportId}/apply`, { changes: items.map(toChange) });
    return { kind: "done", source: res.data.source };
  } catch (err) {
    const r = (err as { response?: { status?: number; data?: { rows?: ApplyPreviewRow[] } } }).response;
    if (r?.status === 409 && r.data?.rows) return { kind: "blocked", rows: r.data.rows };
    throw err;
  }
}

/** Mga department na mapagpipilian; ang huling salita ay sa server (slots, approved, atbp.) */
export function departmentOptions(source: ReportSource) {
  const companies = new Map(source.data.companies.map((c) => [c.id, c.name]));
  return source.data.departments
    .map((d) => ({ id: d.id, label: `${companies.get(d.companyId) ?? ""} – ${d.name}`, used: d.students, slots: d.slots }))
    .map((d) => ({ id: d.id, label: `${d.label} (${d.used} of ${d.slots} slots used)` }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Hinahanap ang department na tugma sa tina-type. Kung company lang ang binago at iisa ang department nito,
 * iyon na; kapag may tina-type na department na walang katugma, ang coordinator ang pipili.
 */
function matchDepartment(source: ReportSource, companyText: string | null, departmentText: string, departmentEdited = true): string {
  const companies = new Map(source.data.companies.map((c) => [c.id, c.name]));
  let pool = source.data.departments;
  if (companyText !== null) pool = pool.filter((d) => same(companies.get(d.companyId) ?? "", companyText));
  const named = pool.filter((d) => same(d.name, departmentText));
  if (named.length === 1) return String(named[0].id);
  if (!departmentEdited && companyText !== null && pool.length === 1) return String(pool[0].id);
  return "";
}

// ---- Mga listahan ------------------------------------------------------------

const LIST_FIELDS: Record<string, { target: ApplyItem["target"]; field: WriteField; label: string }> = {
  section: { target: "student", field: "section", label: "Section / Subject code" },
  year: { target: "student", field: "year", label: "Year" },
  supervisor: { target: "department", field: "supervisorName", label: "Supervisor name" },
  supervisorPosition: { target: "department", field: "supervisorPosition", label: "Supervisor position" },
  company: { target: "student", field: "assignment", label: "Company and department" },
  department: { target: "student", field: "assignment", label: "Company and department" },
};

/** Null kung pwede; kung hindi, ang dahilan. Hindi kasama ang mga field na wala sa listahan. */
export function listApplyBlock(row: ListRow, col: string): string | null {
  const def = LIST_FIELDS[col];
  if (!def) return "This field can't be written to the system.";
  if (!row.refs) return "Regenerate this list first to apply changes.";
  if (def.target === "department" && row.refs.departmentId === null) return "This student has no department yet.";
  if (def.field === "assignment" && row.refs.departmentId === null) {
    return "This student has no company yet. Assign the first one on the Students page.";
  }
  return null;
}

/** Mga pagbabagong pwedeng isulat; only = iisang cell lang */
export function listApplyItems(c: ListContent, source: ReportSource, only?: { rowId: string; col: string }): ApplyItem[] {
  const out = new Map<string, ApplyItem>();
  for (const row of c.rows) {
    const edits = c.overrides[row.id];
    if (!edits) continue;
    for (const [col, value] of Object.entries(edits)) {
      if (only && (only.rowId !== row.id || only.col !== col)) continue;
      const def = LIST_FIELDS[col];
      if (!def || value === row.cells[col] || listApplyBlock(row, col) !== null) continue;
      const refs = row.refs!;
      const id = def.target === "student" ? refs.studentId : refs.departmentId!;
      const key = `${def.target}:${id}:${def.field}`;
      if (out.has(key)) continue;
      if (def.field === "assignment") {
        const companyText = edits.company ?? row.cells.company ?? "";
        const departmentText = edits.department ?? row.cells.department ?? "";
        out.set(key, {
          key, target: "student", id, field: "assignment", fieldLabel: def.label, who: row.cells.name ?? "",
          value: matchDepartment(source, companyText, departmentText, edits.department !== undefined),
          expectedOld: String(refs.departmentId),
          wanted: [companyText, departmentText].filter(Boolean).join(" – "),
        });
      } else {
        out.set(key, {
          key, target: def.target, id, field: def.field, fieldLabel: def.label,
          who: def.target === "student" ? (row.cells.name ?? "") : [row.cells.company, row.cells.department].filter(Boolean).join(" – "),
          value, expectedOld: row.cells[col] ?? "",
        });
      }
    }
  }
  return [...out.values()];
}

/** Pagkatapos maisulat: ina-update lang ang mga row na apektado, at inaalis ang mga edit na naisulat na */
export function listAfterApply(c: ListContent, items: ApplyItem[], source: ReportSource): ListContent {
  const built = new Map(buildListRows(c.template, source).map((r) => [r.id, r]));
  const students = new Set(items.filter((i) => i.target === "student").map((i) => i.id));
  const moved = new Set(items.filter((i) => i.field === "assignment").map((i) => i.id));
  const departments = new Set(items.filter((i) => i.target === "department").map((i) => i.id));
  const overrides = { ...c.overrides };

  const rows = c.rows.map((row) => {
    const refs = row.refs;
    if (!refs) return row;
    const hit = students.has(refs.studentId) || (refs.departmentId !== null && departments.has(refs.departmentId));
    if (!hit) return row;
    const next = built.get(row.id) ?? row;
    const edits = overrides[row.id];
    if (edits) {
      const kept = { ...edits };
      for (const [col, value] of Object.entries(kept)) {
        const assigned = moved.has(refs.studentId) && (col === "company" || col === "department");
        if (assigned || next.cells[col] === value) delete kept[col];
      }
      if (Object.keys(kept).length > 0) overrides[row.id] = kept;
      else delete overrides[row.id];
    }
    return next;
  });
  return { ...c, rows, overrides };
}

// ---- Annex D at List of HTEs --------------------------------------------------

const liveDepartmentId = (source: ReportSource, studentId: number | null) =>
  studentId === null ? null : (source.data.students.find((s) => s.id === studentId)?.departmentId ?? null);

export function hteApplyBlock(source: ReportSource, studentId: number | null): string | null {
  if (studentId === null) return "This row was added to the report and isn't a system record.";
  if (liveDepartmentId(source, studentId) === null) {
    return "This student has no company yet. Assign the first one on the Students page.";
  }
  return null;
}

export function hteApplyItems(c: HteContent, source: ReportSource, liveDepartment: Map<number, string>, onlyRow?: string): ApplyItem[] {
  const out: ApplyItem[] = [];
  for (const g of c.groups) {
    for (const s of g.students) {
      if (onlyRow && s.id !== onlyRow) continue;
      if (s.studentId === null || hteApplyBlock(source, s.studentId) !== null) continue;
      if ((s.department ?? "") === (liveDepartment.get(s.studentId) ?? "")) continue;
      const company = source.data.students.find((x) => x.id === s.studentId)?.companyId ?? null;
      const companyName = source.data.companies.find((x) => x.id === company)?.name ?? null;
      const value = matchDepartment(source, companyName, s.department ?? "") || matchDepartment(source, null, s.department ?? "");
      out.push({
        key: `student:${s.studentId}:assignment`, target: "student", id: s.studentId, field: "assignment",
        fieldLabel: "Company and department", who: s.name,
        value, expectedOld: String(liveDepartmentId(source, s.studentId)), wanted: s.department ?? "",
      });
    }
  }
  return out;
}
