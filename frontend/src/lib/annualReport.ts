// Annual Report (Annex C): buod mula sa datos ng system at mga isyung tina-type ng coordinator.

import { displayOf } from "@/lib/reportDisplay";
import { newId } from "@/lib/hteReport";
import { signatoryLive, type CellDef } from "@/lib/hteCells";
import {
  DEFAULT_DISPLAY, DEFAULT_PAGE_SETTINGS,
  type AnnualContent, type AnnualIssue, type AnnualSummaryRow, type ReportContext, type ReportSource,
  type SignatoryRole, type SignatorySet,
} from "@/types/reports";

const SIG_LABEL: Record<SignatoryRole, string> = {
  prepared: "Prepared by",
  programHead: "Noted, program head",
  dean: "Noted, dean",
  chair: "Certified true and correct",
};

type SummaryField = keyof Omit<AnnualSummaryRow, "id" | "key">;

export const SUMMARY_COLUMNS: { key: SummaryField; label: string; kind: "text" | "number" }[] = [
  { key: "program", label: "PROGRAM", kind: "text" },
  { key: "company", label: "COMPANY", kind: "text" },
  { key: "department", label: "DEPARTMENT", kind: "text" },
  { key: "male", label: "MALE", kind: "number" },
  { key: "female", label: "FEMALE", kind: "number" },
  { key: "total", label: "TOTAL INTERNS", kind: "number" },
  { key: "deployed", label: "DEPLOYED", kind: "number" },
  { key: "completed", label: "COMPLETED", kind: "number" },
  { key: "htes", label: "NO. OF HTEs", kind: "number" },
  { key: "hours", label: "HOURS RENDERED", kind: "number" },
];

const DEFAULT_SUMMARY = ["program", "male", "female", "total", "deployed", "completed", "htes", "hours"];

export const ISSUE_COLUMNS: { key: keyof Omit<AnnualIssue, "id">; label: string; placeholder: string }[] = [
  { key: "issue", label: "ISSUES AND CONCERNS ENCOUNTERED", placeholder: "Issue or concern" },
  { key: "solution", label: "SOLUTIONS", placeholder: "How it was addressed" },
  { key: "recommendation", label: "RECOMMENDATIONS", placeholder: "Recommendation" },
];

/** Ang mga napiling column ng dalawang table, sa ayos na pinili ng coordinator */
export function annualColumns(c: AnnualContent) {
  return {
    summary: c.summaryColumns.map((k) => SUMMARY_COLUMNS.find((col) => col.key === k)).filter((x) => x !== undefined),
    issues: c.issueColumns.map((k) => ISSUE_COLUMNS.find((col) => col.key === k)).filter((x) => x !== undefined),
  };
}

export const DEFAULT_SUMMARY_COLUMNS = DEFAULT_SUMMARY;
export const DEFAULT_ISSUE_COLUMNS = ISSUE_COLUMNS.map((col) => col.key as string);
/** Default ng papel ng Annual Report */
export const ANNUAL_PAGE_DEFAULTS = { ...DEFAULT_PAGE_SETTINGS, orientation: "landscape" as const };

export const blankIssue = (): AnnualIssue => ({ id: newId(), issue: "", solution: "", recommendation: "" });

const isDeployed = (status: string) => {
  const s = status.trim().toLowerCase();
  return s === "deployed" || s === "completed";
};

// "N/A" kapag walang department ang company (pareho sa ibang report)
const cleanDepartment = (name: string | undefined) => {
  if (name === undefined) return "";
  const v = name.trim();
  return !v || v.toUpperCase() === "N/A" ? "N/A" : v;
};

/** Hinahati ng Company at Department ang buod: isang row bawat company o department; kung wala, isang kabuuan */
export function buildSummary(source: ReportSource, byCompany = false, byDepartment = false): AnnualSummaryRow[] {
  const { students, companies, departments } = source.data;
  const companyName = new Map(companies.map((c) => [c.id, c.name]));
  const departmentName = new Map(departments.map((d) => [d.id, d.name]));
  const hours = new Map(source.lists.students.map((s) => [s.id, Number(s.renderedHours ?? 0)]));

  const groups = new Map<string, typeof students>();
  for (const s of students) {
    const parts = [byCompany ? `c${s.companyId ?? ""}` : "", byDepartment ? `d${s.departmentId ?? ""}` : ""].filter(Boolean);
    const key = parts.join(":") || "all";
    groups.set(key, [...(groups.get(key) ?? []), s]);
  }
  if (groups.size === 0) groups.set("all", []);

  const rows = [...groups.entries()].map(([key, mine]): AnnualSummaryRow => {
    const first = mine[0];
    const gender = (g: string) => mine.filter((s) => s.gender.trim().toUpperCase().startsWith(g)).length;
    const total = mine.reduce((sum, s) => sum + (hours.get(s.id) ?? 0), 0);
    return {
      id: newId(),
      key,
      program: source.context.programAbbreviation,
      company: byCompany && first?.companyId != null ? (companyName.get(first.companyId) ?? "") : "",
      department: byDepartment && first?.departmentId != null ? cleanDepartment(departmentName.get(first.departmentId)) : "",
      male: String(gender("M")),
      female: String(gender("F")),
      total: String(mine.length),
      deployed: String(mine.filter((s) => isDeployed(s.status)).length),
      completed: String(mine.filter((s) => s.status.trim().toLowerCase() === "completed").length),
      htes: String(new Set(mine.flatMap((s) => (s.companyId === null ? [] : [s.companyId]))).size),
      hours: String(Math.round(total * 100) / 100),
    };
  });
  // Ang mga walang company o department ay nasa huli
  return rows.sort((a, b) =>
    Number(!a.company) - Number(!b.company) || a.company.localeCompare(b.company)
    || Number(!a.department) - Number(!b.department) || a.department.localeCompare(b.department));
}

export const summaryOf = (c: Pick<AnnualContent, "summaryColumns">, source: ReportSource) =>
  buildSummary(source, c.summaryColumns.includes("company"), c.summaryColumns.includes("department"));

function defaultHeader(c: ReportContext) {
  return {
    annexLabel: "ANNEX “C”",
    titleLines: ["ANNUAL REPORT ON THE", "STUDENT INTERNSHIP PROGRAM IN THE PHILIPPINES (SIPP)"],
    semesterLine: `AY ${[c.term, c.schoolYear].filter(Boolean).join(" ")}`,
    hei: c.hei,
    address: c.address,
    degreeProgram: c.programName,
  };
}

export function buildAnnualContent(source: ReportSource): AnnualContent {
  return {
    ...defaultHeader(source.context),
    summary: buildSummary(source),
    summaryColumns: [...DEFAULT_SUMMARY],
    issues: [blankIssue(), blankIssue(), blankIssue()],
    issueColumns: ISSUE_COLUMNS.map((col) => col.key),
    settings: { ...DEFAULT_PAGE_SETTINGS, orientation: "landscape" },
    subtitle: "",
    headerText: "",
    footerText: "",
    display: { ...DEFAULT_DISPLAY },
  };
}

const text = (v: unknown) => (typeof v === "string" ? v : "");

/** Sinusuri ang na-load na laman; pinupunan ang kulang na bahagi */
export function parseAnnualContent(raw: unknown): AnnualContent | null {
  if (!raw || typeof raw !== "object") return null;
  const c = raw as Partial<AnnualContent>;
  if (!Array.isArray(c.summary) || !Array.isArray(c.issues)) return null;
  return {
    annexLabel: text(c.annexLabel),
    titleLines: Array.isArray(c.titleLines) ? c.titleLines.map(text) : [],
    semesterLine: text(c.semesterLine),
    hei: text(c.hei),
    address: text(c.address),
    degreeProgram: text(c.degreeProgram),
    summary: c.summary.map((r) => ({
      id: r.id || newId(), key: r.key || "all", program: text(r.program), company: text(r.company), department: text(r.department),
      male: text(r.male), female: text(r.female), total: text(r.total),
      deployed: text(r.deployed), completed: text(r.completed), htes: text(r.htes), hours: text(r.hours),
    })),
    summaryColumns: Array.isArray(c.summaryColumns) ? c.summaryColumns : [...DEFAULT_SUMMARY],
    issues: c.issues.map((r) => ({
      id: r.id || newId(), issue: text(r.issue), solution: text(r.solution), recommendation: text(r.recommendation),
    })),
    issueColumns: Array.isArray(c.issueColumns) ? c.issueColumns : ISSUE_COLUMNS.map((col) => col.key),
    settings: { ...DEFAULT_PAGE_SETTINGS, ...(c.settings ?? {}) },
    pending: c.pending && typeof c.pending === "object" ? c.pending : {},
    subtitle: text(c.subtitle),
    headerText: text(c.headerText),
    footerText: text(c.footerText),
    display: displayOf(c.display),
  };
}

/** Lahat ng nae-edit na teksto, ayon sa pagbasa; para sa accessibility at bottom sheet */
export function annualCells(c: AnnualContent, people: SignatorySet): CellDef[] {
  const { summary, issues } = annualColumns(c);
  const cells: CellDef[] = [
    { id: "h:annex", label: "Annex label", value: c.annexLabel },
    ...c.titleLines.map((l, i) => ({ id: `h:title:${i}`, label: `Title line ${i + 1}`, value: l })),
    { id: "h:sem", label: "School year line", value: c.semesterLine },
    { id: "h:hei", label: "HEI", value: c.hei },
    { id: "h:address", label: "Address", value: c.address },
    { id: "h:degree", label: "Degree program", value: c.degreeProgram },
  ];
  c.summary.forEach((r, i) => {
    for (const col of summary) {
      cells.push({ id: `sum:${r.id}:${col.key}`, label: `${col.label}, summary row ${i + 1}`, value: r[col.key] });
    }
  });
  c.issues.forEach((r, i) => {
    for (const col of issues) {
      cells.push({ id: `i:${r.id}:${col.key}`, label: `${col.label}, row ${i + 1}`, value: r[col.key], multiline: true });
    }
  });
  for (const role of Object.keys(SIG_LABEL) as SignatoryRole[]) {
    cells.push({ id: `sig:${role}:name`, label: `${SIG_LABEL[role]}, name`, value: people[role].name });
    cells.push({ id: `sig:${role}:title`, label: `${SIG_LABEL[role]}, title`, value: people[role].title });
  }
  return cells;
}

/** Ang halaga sa system o template ng bawat cell na mayroon nito; ang mga isyu ay wala */
export function annualLiveIndex(c: AnnualContent, source: ReportSource): Map<string, string> {
  const live = new Map<string, string>();
  const h = defaultHeader(source.context);
  live.set("h:annex", h.annexLabel);
  h.titleLines.forEach((l, i) => live.set(`h:title:${i}`, l));
  live.set("h:sem", h.semesterLine);
  live.set("h:hei", h.hei);
  live.set("h:address", h.address);
  live.set("h:degree", h.degreeProgram);
  const built = new Map(summaryOf(c, source).map((r) => [r.key, r]));
  for (const r of c.summary) {
    const b = built.get(r.key);
    if (!b) continue;
    for (const col of SUMMARY_COLUMNS) live.set(`sum:${r.id}:${col.key}`, b[col.key]);
  }
  signatoryLive(source.context, live);
  return live;
}

/** May binago ba ang coordinator sa buod? Para magtanong bago ito palitan. */
export function summaryHasEdits(c: AnnualContent, source: ReportSource) {
  const built = new Map(summaryOf(c, source).map((r) => [r.key, r]));
  return c.summary.some((r) => {
    const b = built.get(r.key);
    return !b || SUMMARY_COLUMNS.some((col) => b[col.key] !== r[col.key]);
  });
}

/** Isinusulat ang teksto ng isang cell (hindi kasama ang pirmahan) */
export function applyAnnualCell(c: AnnualContent, id: string, value: string): AnnualContent {
  const [kind, ref, field] = id.split(":");
  if (kind === "h") {
    switch (ref) {
      case "annex": return { ...c, annexLabel: value };
      case "sem": return { ...c, semesterLine: value };
      case "hei": return { ...c, hei: value };
      case "address": return { ...c, address: value };
      case "degree": return { ...c, degreeProgram: value };
      case "title": return { ...c, titleLines: c.titleLines.map((l, i) => (i === Number(field) ? value : l)) };
      default: return c;
    }
  }
  if (kind === "sum") return { ...c, summary: c.summary.map((r) => (r.id === ref ? { ...r, [field]: value } : r)) };
  if (kind === "i") return { ...c, issues: c.issues.map((r) => (r.id === ref ? { ...r, [field]: value } : r)) };
  return c;
}
