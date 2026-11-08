// Mga simpleng listahan: bawat template ay bumubuo ng mga row mula sa datos ng system.
// Lahat ng column ay nasa bawat row; ang filter, pag-ayos, pagtago at mga edit ay sa pagpapakita lang.

import { bandFor } from "@/lib/evaluationForm";
import { formatGender, formatLongDate, formatStudentName } from "@/lib/hteReport";
import {
  DEFAULT_PAGE_SETTINGS,
  type ListContent, type ListRow, type ListTemplate, type ReportSource, type ReportStudent, type TrackingStatus,
} from "@/types/reports";

export interface ListColumn {
  key: string;
  label: string;
  /** Hati sa lapad ng table */
  weight: number;
  center?: boolean;
  kind?: "text" | "number" | "date";
}

const NO_HTE = "No HTE yet";

/** Halaga ng filter para sa blangkong cell */
export const NONE = "__none__";

const COL: Record<string, ListColumn> = {
  name: { key: "name", label: "NAME OF STUDENT", weight: 26 },
  studentNumber: { key: "studentNumber", label: "STUDENT NO.", weight: 12, center: true },
  section: { key: "section", label: "SECTION / SUBJECT CODE", weight: 13, center: true },
  program: { key: "program", label: "COURSE", weight: 12, center: true },
  year: { key: "year", label: "YEAR", weight: 9, center: true },
  gender: { key: "gender", label: "GENDER", weight: 13, center: true },
  company: { key: "company", label: "COMPANY", weight: 24 },
  department: { key: "department", label: "DEPARTMENT", weight: 16 },
  supervisor: { key: "supervisor", label: "SUPERVISOR", weight: 18 },
  supervisorPosition: { key: "supervisorPosition", label: "SUPERVISOR POSITION", weight: 16 },
  status: { key: "status", label: "STATUS", weight: 13, center: true },
  deployment: { key: "deployment", label: "DEPLOYMENT", weight: 13, center: true },
  startDate: { key: "startDate", label: "START OF TRAINING", weight: 14, center: true, kind: "date" },
  requirement: { key: "requirement", label: "REQUIREMENT", weight: 24 },
  result: { key: "result", label: "RESULT", weight: 13, center: true },
  required: { key: "required", label: "REQUIRED HOURS", weight: 11, center: true, kind: "number" },
  rendered: { key: "rendered", label: "HOURS RENDERED", weight: 11, center: true, kind: "number" },
  remaining: { key: "remaining", label: "HOURS REMAINING", weight: 11, center: true, kind: "number" },
  midterm: { key: "midterm", label: "MIDTERM", weight: 14, center: true },
  midtermScore: { key: "midtermScore", label: "MIDTERM SCORE (%)", weight: 10, center: true, kind: "number" },
  final: { key: "final", label: "FINAL", weight: 14, center: true },
  finalScore: { key: "finalScore", label: "FINAL SCORE (%)", weight: 10, center: true, kind: "number" },
  finalBand: { key: "finalBand", label: "FINAL BAND", weight: 12, center: true },
};

/** Laging kasama sa picker ng bawat listahan */
const COMMON = ["name", "studentNumber", "section", "program", "year", "gender", "company", "department", "supervisor", "supervisorPosition", "status"];

interface TemplateDef {
  title: string;
  description: string;
  /** Mga dagdag sa COMMON */
  extra: string[];
  defaults: string[];
  filters: string[];
  build: (source: ReportSource) => ListRow[];
}

const num = (n: number) => String(Math.round(n * 100) / 100);

const isDeployed = (status: string) => {
  const s = status.trim().toLowerCase();
  return s === "deployed" || s === "completed";
};

/** "N/A" na department: walang department talaga, kaya blangko */
const cleanDepartment = (name: string | undefined) => {
  const v = (name ?? "").trim();
  return v.toUpperCase() === "N/A" ? "" : v;
};

/** Mga karaniwang cell ng isang student (lahat ng template) */
function studentCells(source: ReportSource) {
  const companies = new Map(source.data.companies.map((c) => [c.id, c.name]));
  const departments = new Map(source.data.departments.map((d) => [d.id, d]));
  const extra = new Map(source.lists.students.map((s) => [s.id, s]));
  return (s: ReportStudent): Record<string, string> => {
    const d = s.departmentId === null ? undefined : departments.get(s.departmentId);
    return {
      name: formatStudentName(s),
      studentNumber: extra.get(s.id)?.studentNumber ?? "",
      section: extra.get(s.id)?.subjectCode ?? "",
      program: s.program,
      year: s.year,
      gender: formatGender(s.gender),
      company: s.companyId === null ? "" : (companies.get(s.companyId) ?? ""),
      department: cleanDepartment(d?.name),
      supervisor: d?.supervisor ?? "",
      supervisorPosition: d?.supervisorPosition ?? "",
      status: s.status || "For Approval",
    };
  };
}

const refsOf = (s: ReportStudent) => ({ studentId: s.id, departmentId: s.departmentId });

function requirementResult(status: TrackingStatus, type: string, placement: string): string {
  switch (status) {
    case "CHECKED": return "Evaluated";
    case "FOR_CHECKING": return "Submitted";
    case "INVALID": return "Invalid or returned";
    // Bukas lang ang post-deployment sa mga na-deploy na: hindi pa ito kulang ng iba
    default: return type === "post" && !isDeployed(placement) ? "Not yet available" : "Missing";
  }
}

/** Ang tunay na status ng evaluation; ang una sa listahang ito na tugma ang nananaig */
export function evaluationResult(status: TrackingStatus, open: boolean, started: boolean): string {
  switch (status) {
    case "CHECKED": return "Evaluated";
    case "INVALID": return "Invalid or returned";
    case "FOR_CHECKING": return "Turned in";
    default:
      if (started) return "Draft or in progress";
      return open ? "Assigned" : "Not assigned or not opened yet";
  }
}

const REQUIREMENT_TYPE: Record<string, string> = { initial: "Initial", pre: "Pre-Deployment", post: "Post-Deployment" };

const TEMPLATES: Record<ListTemplate, TemplateDef> = {
  "list-students": {
    title: "List of Students",
    description: "Students with their course, section, company and status.",
    extra: [],
    defaults: ["name", "program", "section", "company", "status"],
    filters: ["section", "company", "status"],
    build: (source) => {
      const cells = studentCells(source);
      return source.data.students.map((s) => ({ id: String(s.id), group: "", groupOrder: 0, refs: refsOf(s), cells: cells(s) }));
    },
  },
  "list-per-hte": {
    title: "Students per HTE",
    description: "Students grouped by company or host training establishment.",
    extra: [],
    defaults: ["name", "section", "program", "gender", "department", "status"],
    filters: ["section", "company", "status"],
    build: (source) => {
      const cells = studentCells(source);
      return source.data.students.map((s) => {
        const c = cells(s);
        return {
          id: String(s.id), refs: refsOf(s), cells: c,
          group: s.companyId === null ? NO_HTE : (c.company || "Unnamed company"),
          groupOrder: s.companyId === null ? 1 : 0,
        };
      });
    },
  },
  "list-deployment": {
    title: "Deployed and Not Yet Deployed Students",
    description: "Who has been deployed and who hasn't. Completed students count as deployed.",
    extra: ["deployment", "startDate"],
    defaults: ["name", "section", "company", "status", "startDate"],
    filters: ["deployment", "section", "company", "status"],
    build: (source) => {
      const cells = studentCells(source);
      return source.data.students.map((s) => {
        const deployed = isDeployed(s.status);
        const deployment = deployed ? "Deployed" : "Not yet deployed";
        return {
          id: String(s.id), group: deployment, groupOrder: deployed ? 0 : 1, refs: refsOf(s),
          cells: { ...cells(s), deployment, startDate: formatLongDate(s.startDate) },
        };
      });
    },
  },
  "list-requirements": {
    title: "Requirements Status",
    description: "Per requirement: who submitted, who is evaluated and who is missing.",
    extra: ["requirement", "result"],
    defaults: ["name", "section", "company", "result"],
    filters: ["requirement", "result", "section", "company", "status"],
    build: (source) => {
      const cells = studentCells(source);
      const extra = new Map(source.lists.students.map((s) => [s.id, s]));
      const rows: ListRow[] = [];
      source.lists.requirements.forEach((r, order) => {
        const requirement = `${REQUIREMENT_TYPE[r.type] ?? r.type}: ${r.title}`;
        for (const s of source.data.students) {
          const status = extra.get(s.id)?.requirementStatuses[String(r.id)] ?? "ASSIGNED";
          rows.push({
            id: `${s.id}-${r.id}`, group: requirement, groupOrder: order, refs: refsOf(s),
            cells: { ...cells(s), requirement, result: requirementResult(status, r.type, s.status) },
          });
        }
      });
      return rows;
    },
  },
  "list-dtr": {
    title: "DTR Hours Rendered and Required",
    description: "Hours rendered against the required training hours.",
    extra: ["required", "rendered", "remaining"],
    defaults: ["name", "section", "company", "required", "rendered", "remaining"],
    filters: ["section", "company", "status"],
    build: (source) => {
      const cells = studentCells(source);
      const extra = new Map(source.lists.students.map((s) => [s.id, s]));
      return source.data.students.map((s) => {
        const e = extra.get(s.id);
        const rendered = Number(e?.renderedHours ?? 0);
        const required = e?.requiredHours === null || e?.requiredHours === undefined ? null : Number(e.requiredHours);
        return {
          id: String(s.id), group: "", groupOrder: 0, refs: refsOf(s),
          cells: {
            ...cells(s),
            required: required === null ? "" : num(required),
            rendered: num(rendered),
            remaining: required === null ? "" : num(Math.max(0, required - rendered)),
          },
        };
      });
    },
  },
  "list-evaluation": {
    title: "Evaluation Status",
    description: "Midterm and Final evaluations with each student's real status, score and band.",
    extra: ["midterm", "midtermScore", "final", "finalScore", "finalBand"],
    defaults: ["name", "section", "company", "midterm", "final"],
    filters: ["midterm", "final", "section", "company", "status"],
    build: (source) => {
      const cells = studentCells(source);
      const extra = new Map(source.lists.students.map((s) => [s.id, s]));
      return source.data.students.map((s) => {
        const e = extra.get(s.id);
        const midtermScore = e?.midtermScore ?? null;
        const finalScore = e?.finalScore ?? null;
        return {
          id: String(s.id), group: "", groupOrder: 0, refs: refsOf(s),
          cells: {
            ...cells(s),
            midterm: evaluationResult(e?.midtermStatus ?? "ASSIGNED", e?.midtermOpen ?? false, e?.midtermStarted ?? false),
            midtermScore: midtermScore === null ? "" : num(Number(midtermScore)),
            final: evaluationResult(e?.finalStatus ?? "ASSIGNED", e?.finalOpen ?? false, e?.finalStarted ?? false),
            finalScore: finalScore === null ? "" : num(Number(finalScore)),
            finalBand: finalScore === null ? "" : (bandFor(Number(finalScore))?.range ?? ""),
          },
        };
      });
    },
  },
};

export const LIST_TEMPLATES = Object.keys(TEMPLATES) as ListTemplate[];

export const isListTemplate = (t: string): t is ListTemplate => t in TEMPLATES;

export function templateInfo(t: ListTemplate) {
  const d = TEMPLATES[t];
  return { title: d.title, description: d.description };
}

const columnKeys = (t: ListTemplate) => [...COMMON, ...TEMPLATES[t].extra];

export const templateColumns = (t: ListTemplate): ListColumn[] => columnKeys(t).map((k) => COL[k]);

export const templateFilters = (t: ListTemplate): ListColumn[] => TEMPLATES[t].filters.map((k) => COL[k]);

export const buildListRows = (t: ListTemplate, source: ReportSource): ListRow[] => TEMPLATES[t].build(source);

/** Ang mga setting ng builder na ibinabalik ng "Reset" */
export function defaultListView(t: ListTemplate): Pick<ListContent, "filters" | "columns" | "sort" | "headerText" | "footerText"> {
  return { filters: {}, columns: [...TEMPLATES[t].defaults], sort: { key: "name", dir: "asc" }, headerText: "", footerText: "" };
}

export function buildListContent(t: ListTemplate, source: ReportSource): ListContent {
  return {
    template: t,
    ...defaultListView(t),
    rows: buildListRows(t, source),
    overrides: {},
    generatedAt: Date.now(),
    settings: { ...DEFAULT_PAGE_SETTINGS, orientation: "portrait", margins: "narrow" },
  };
}

/** Sinusuri ang na-load na laman; pinupunan ang kulang na bahagi */
export function parseListContent(raw: unknown): ListContent | null {
  if (!raw || typeof raw !== "object") return null;
  const c = raw as Partial<ListContent>;
  if (!c.template || !isListTemplate(c.template) || !Array.isArray(c.rows)) return null;
  const known = new Set(columnKeys(c.template));
  const d = defaultListView(c.template);
  return {
    template: c.template,
    filters: c.filters && typeof c.filters === "object" ? c.filters : d.filters,
    columns: Array.isArray(c.columns) ? c.columns.filter((k) => known.has(k)) : d.columns,
    sort: c.sort && known.has(c.sort.key) ? c.sort : d.sort,
    headerText: typeof c.headerText === "string" ? c.headerText : "",
    footerText: typeof c.footerText === "string" ? c.footerText : "",
    rows: c.rows,
    overrides: c.overrides && typeof c.overrides === "object" ? c.overrides : {},
    generatedAt: typeof c.generatedAt === "number" ? c.generatedAt : 0,
    settings: { ...DEFAULT_PAGE_SETTINGS, ...(c.settings ?? {}) },
  };
}

export const listCellId = (rowId: string, col: string) => `l:${rowId}:${col}`;

/** Ang ipinapakita: ang edit ng coordinator kung mayroon, kung wala ay ang datos */
export const cellOf = (c: ListContent, row: ListRow, key: string) => c.overrides[row.id]?.[key] ?? row.cells[key] ?? "";

/** Mga pagpipilian ng isang filter, mula sa mga row mismo */
export function filterOptions(c: ListContent, key: string): { options: string[]; hasBlank: boolean } {
  const values = new Set<string>();
  let hasBlank = false;
  for (const r of c.rows) {
    const v = cellOf(c, r, key);
    if (v) values.add(v);
    else hasBlank = true;
  }
  return { options: [...values].sort((a, b) => a.localeCompare(b)), hasBlank };
}

export type ListUnit =
  | { kind: "group"; key: string; label: string; count: number }
  | { kind: "row"; key: string; row: ListRow; number: number };

/** Ang mga ipi-print: naka-filter, naka-ayos at naka-pangkat, gamit ang mga edit */
export function visibleUnits(c: ListContent): ListUnit[] {
  const filters = Object.entries(c.filters).filter(([, v]) => v);
  const rows = c.rows.filter((r) => filters.every(([k, v]) => {
    const value = cellOf(c, r, k);
    return v === NONE ? !value : value === v;
  }));
  const dir = c.sort.dir === "asc" ? 1 : -1;
  const sorted = [...rows].sort((a, b) =>
    a.groupOrder - b.groupOrder
    || a.group.localeCompare(b.group)
    || dir * cellOf(c, a, c.sort.key).localeCompare(cellOf(c, b, c.sort.key), undefined, { numeric: true })
    || cellOf(c, a, "name").localeCompare(cellOf(c, b, "name")));

  const counts = new Map<string, number>();
  for (const r of sorted) counts.set(r.group, (counts.get(r.group) ?? 0) + 1);

  const units: ListUnit[] = [];
  let group: string | null = null;
  let number = 0;
  sorted.forEach((row) => {
    if (row.group !== group) {
      group = row.group;
      number = 0;
      if (row.group) units.push({ kind: "group", key: `g:${row.group}`, label: row.group, count: counts.get(row.group) ?? 0 });
    }
    units.push({ kind: "row", key: row.id, row, number: ++number });
  });
  return units;
}
