// Pagbuo ng laman ng "Report on the List of HTEs and Student Interns" at "List of HTEs" mula sa datos ng system.

import { displayOf } from "@/lib/reportDisplay";
import {
  DEFAULT_DISPLAY, DEFAULT_PAGE_SETTINGS, type HteStudentSort,
  type HteContent, type HteGroup, type HteStudent, type PageSettings, type PendingChange, type ReportSource, type ReportStudent,
} from "@/types/reports";

export const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** "2023-10-11" (o iba pang petsa) → "October 11, 2023"; blangko kung hindi mabasa */
export function formatLongDate(raw: string): string {
  const s = raw.trim();
  if (!s) return "";
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  if (m) return `${MONTHS[Number(m[2]) - 1] ?? ""} ${Number(m[3])}, ${m[1]}`.trim();
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "";
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

/** "October 11, 2023 - January 18, 2024"; kung simula lang ang alam: "October 11, 2023 -"; blangko kung walang simula */
export function formatPeriod(start: string, end: string): string {
  const a = formatLongDate(start);
  if (!a) return "";
  const b = formatLongDate(end);
  return b ? `${a} - ${b}` : `${a} -`;
}

/** LASTNAME,FIRSTNAME M. */
export function formatStudentName(s: Pick<ReportStudent, "lastname" | "firstname" | "middleInitial">): string {
  const last = s.lastname.trim().toUpperCase();
  const first = s.firstname.trim().toUpperCase();
  const mi = s.middleInitial.trim().replace(/\.+$/, "").toUpperCase();
  return `${last},${first}${mi ? ` ${mi}.` : ""}`;
}

export function formatGender(raw: string): string {
  const g = raw.trim().toUpperCase();
  if (g.startsWith("F")) return "FEMALE";
  if (g.startsWith("M")) return "MALE";
  return g;
}

/** Placeholder na department ng company na walang department (blangko o "N/A") */
export const isPlaceholderDepartment = (name: string | null | undefined) => {
  const v = (name ?? "").trim();
  return !v || v.toUpperCase() === "N/A";
};

/** Pangalan ng department para sa report: "N/A" kapag walang department ang company; blangko kung hindi alam */
export function departmentLabel(name: string | undefined): string {
  if (name === undefined) return "";
  return isPlaceholderDepartment(name) ? "N/A" : name.trim();
}

function toStudent(s: ReportStudent, deptName: Map<number, string>): HteStudent {
  return {
    id: newId(),
    studentId: s.id,
    name: formatStudentName(s),
    program: s.program,
    gender: formatGender(s.gender),
    period: formatPeriod(s.startDate, s.endDate),
    department: s.departmentId === null ? "" : departmentLabel(deptName.get(s.departmentId)),
  };
}

const bySurname = (a: ReportStudent, b: ReportStudent) =>
  a.lastname.localeCompare(b.lastname) || a.firstname.localeCompare(b.firstname);

/** Mga grupo mula sa system: bawat company na may student (A–Z), saka ang "No HTE yet" */
export function buildGroups(source: ReportSource): HteGroup[] {
  const { students, companies, departments } = source.data;
  const deptName = new Map(departments.map((d) => [d.id, d.name]));
  const groups: HteGroup[] = [];

  for (const c of [...companies].sort((a, b) => a.name.localeCompare(b.name))) {
    const mine = students.filter((s) => s.companyId === c.id).sort(bySurname);
    if (mine.length === 0) continue;
    const depts: string[] = [];
    for (const s of mine) {
      const name = s.departmentId === null ? "" : (deptName.get(s.departmentId) ?? "");
      if (name && name.toUpperCase() !== "N/A" && !depts.includes(name)) depts.push(name);
    }
    groups.push({ id: newId(), companyId: c.id, name: c.name, departments: depts.sort(), students: mine.map((s) => toStudent(s, deptName)) });
  }

  // May company na hindi kasama sa listahan (hal. naka-archive): isama pa rin ang mga student nito sa sariling grupo
  const known = new Set(companies.map((c) => c.id));
  const orphans = students.filter((s) => s.companyId !== null && !known.has(s.companyId));
  for (const id of [...new Set(orphans.map((s) => s.companyId as number))]) {
    groups.push({
      id: newId(), companyId: id, name: "", departments: [],
      students: orphans.filter((s) => s.companyId === id).sort(bySurname).map((s) => toStudent(s, deptName)),
    });
  }

  const none = students.filter((s) => s.companyId === null).sort(bySurname);
  if (none.length > 0) {
    groups.push({ id: newId(), companyId: null, noHte: true, name: "No HTE yet", departments: [], students: none.map((s) => toStudent(s, deptName)) });
  }
  return groups;
}

export function buildHteContent(source: ReportSource): HteContent {
  const c = source.context;
  return {
    hei: c.hei,
    address: c.address,
    degreeProgram: c.programName,
    groups: buildGroups(source),
    settings: { ...HTE_PAGE_DEFAULTS },
    pending: {},
    subtitle: "",
    headerText: "",
    footerText: "",
    filters: {},
    studentSort: "manual",
    display: { ...DEFAULT_DISPLAY },
  };
}

/** Default ng papel ng HTE report: landscape gaya ng Annex D (pwede nang palitan) */
export const HTE_PAGE_DEFAULTS: PageSettings = { ...DEFAULT_PAGE_SETTINGS, orientation: "landscape" };

const SORTS: HteStudentSort[] = ["manual", "asc", "desc"];

/** Sinusuri ang na-load na draft; pinupunan ang kulang na bahagi */
export function parseHteContent(raw: unknown): HteContent | null {
  if (!raw || typeof raw !== "object") return null;
  const c = raw as Partial<HteContent>;
  if (!Array.isArray(c.groups)) return null;
  // Dati ay laging landscape; ngayon ay pwedeng palitan (landscape pa rin ang default ng mga luma)
  const settings: PageSettings = { ...HTE_PAGE_DEFAULTS, ...(c.settings ?? {}) };
  return {
    hei: c.hei ?? "",
    address: c.address ?? "",
    degreeProgram: c.degreeProgram ?? "",
    settings,
    ...(typeof c.annexLabel === "string" ? { annexLabel: c.annexLabel } : {}),
    ...(Array.isArray(c.titleLines) ? { titleLines: c.titleLines.map((l) => String(l ?? "")) } : {}),
    ...(typeof c.semesterLine === "string" ? { semesterLine: c.semesterLine } : {}),
    ...(Array.isArray(c.columns) ? { columns: c.columns.map(String) } : {}),
    pending: c.pending && typeof c.pending === "object" ? c.pending : {},
    subtitle: typeof c.subtitle === "string" ? c.subtitle : "",
    headerText: typeof c.headerText === "string" ? c.headerText : "",
    footerText: typeof c.footerText === "string" ? c.footerText : "",
    filters: c.filters && typeof c.filters === "object" ? c.filters : {},
    studentSort: SORTS.includes(c.studentSort as HteStudentSort) ? (c.studentSort as HteStudentSort) : "manual",
    display: displayOf(c.display),
    groups: c.groups.map((g) => ({
      id: g.id || newId(),
      companyId: g.companyId ?? null,
      noHte: Boolean(g.noHte),
      name: g.name ?? "",
      departments: Array.isArray(g.departments) ? g.departments : [],
      students: Array.isArray(g.students)
        ? g.students.map((s) => ({
            id: s.id || newId(),
            studentId: s.studentId ?? null,
            name: s.name ?? "",
            program: s.program ?? "",
            gender: s.gender ?? "",
            period: s.period ?? "",
            department: s.department ?? "",
          }))
        : [],
    })),
  };
}

/** Mga student sa system na wala pa sa report (hal. na-enroll pagkatapos ma-save) */
export function missingStudents(content: HteContent, source: ReportSource): ReportStudent[] {
  const inReport = new Set<number>();
  for (const g of content.groups) for (const s of g.students) if (s.studentId !== null) inReport.add(s.studentId);
  return source.data.students.filter((s) => !inReport.has(s.id));
}

/** Idinadagdag ang mga bagong student sa grupo ng kanilang company (o bagong grupo / "No HTE yet") nang hindi ginagalaw ang mga edit */
export function addMissingStudents(content: HteContent, source: ReportSource): HteContent {
  const missing = missingStudents(content, source).sort(bySurname);
  if (missing.length === 0) return content;
  const groups = content.groups.map((g) => ({ ...g, students: [...g.students], departments: [...g.departments] }));
  const companyName = new Map(source.data.companies.map((c) => [c.id, c.name]));
  const deptName = new Map(source.data.departments.map((d) => [d.id, d.name]));

  for (const s of missing) {
    let target = groups.find((g) => (s.companyId === null ? g.noHte : g.companyId === s.companyId));
    if (!target) {
      target = s.companyId === null
        ? { id: newId(), companyId: null, noHte: true, name: "No HTE yet", departments: [], students: [] }
        : { id: newId(), companyId: s.companyId, name: companyName.get(s.companyId) ?? "", departments: [], students: [] };
      // Bagong company: bago ang "No HTE yet"; ang "No HTE yet" ay laging huli
      const noHteIndex = groups.findIndex((g) => g.noHte);
      if (target.noHte || noHteIndex < 0) groups.push(target);
      else groups.splice(noHteIndex, 0, target);
    }
    const dept = s.departmentId === null ? "" : (deptName.get(s.departmentId) ?? "");
    if (dept && dept.toUpperCase() !== "N/A" && !target.departments.includes(dept)) target.departments.push(dept);
    target.students.push(toStudent(s, deptName));
  }
  return { ...content, groups };
}

/** Pinupunan ang department ng mga lumang kopya kapag unang ipinakita ang column */
export function backfillDepartments(content: HteContent, source: ReportSource): HteContent {
  const deptName = new Map(source.data.departments.map((d) => [d.id, d.name]));
  const live = new Map(source.data.students.map((s) => [s.id, s.departmentId === null ? "" : departmentLabel(deptName.get(s.departmentId))]));
  return {
    ...content,
    groups: content.groups.map((g) => ({
      ...g,
      students: g.students.map((s) => (s.department || s.studentId === null ? s : { ...s, department: live.get(s.studentId) ?? "" })),
    })),
  };
}

/** Pagkatapos maisulat ang paglipat: inililipat din ang student sa grupo ng bagong company, kasama ang mga edit */
export function moveStudentsToLive(content: HteContent, studentIds: number[], source: ReportSource): HteContent {
  const live = new Map(source.data.students.map((s) => [s.id, s]));
  const deptName = new Map(source.data.departments.map((d) => [d.id, d.name]));
  const companyName = new Map(source.data.companies.map((c) => [c.id, c.name]));
  let groups = content.groups.map((g) => ({ ...g, students: [...g.students] }));
  for (const id of studentIds) {
    const row = live.get(id);
    if (!row) continue;
    const from = groups.find((g) => g.students.some((s) => s.studentId === id));
    const student = from?.students.find((s) => s.studentId === id);
    if (!from || !student) continue;
    const moved = { ...student, department: row.departmentId === null ? "" : departmentLabel(deptName.get(row.departmentId)) };
    let to = groups.find((g) => g.companyId === row.companyId && !g.noHte);
    if (!to) {
      to = { id: newId(), companyId: row.companyId, name: companyName.get(row.companyId as number) ?? "", departments: [], students: [] };
      const noHte = groups.findIndex((g) => g.noHte);
      if (noHte < 0) groups.push(to);
      else groups.splice(noHte, 0, to);
    }
    from.students = from.students.filter((s) => s.studentId !== id);
    to.students.push(moved);
  }
  groups = groups.filter((g) => g.students.length > 0 || g.companyId === null);
  return { ...content, groups };
}

/**
 * Pagkatapos maisulat ang mga pagbabago mula sa Edit mode: inililipat ang mga student na nagpalit ng company,
 * at kinukuha ulit sa system ang department, panahon ng training at pangalan ng company na binago.
 */
export function hteAfterCommit(content: HteContent, source: ReportSource, changes: PendingChange[]): HteContent {
  const moved = changes.filter((x) => x.target === "student" && x.field === "assignment").map((x) => x.id);
  const next = moveStudentsToLive(content, moved, source);
  const students = new Set(changes.filter((x) => x.target === "student").map((x) => x.id));
  const companies = new Set(changes.filter((x) => x.target === "company" && x.field === "name").map((x) => x.id));
  // Pinalitang pangalan ng department: lumang pangalan (maliliit na titik) -> bago
  const renamed = new Map<string, string>();
  for (const x of changes) {
    if (x.target !== "department" || x.field !== "name" || !x.expectedOld) continue;
    const fresh = source.data.departments.find((d) => d.id === x.id);
    if (fresh) renamed.set(x.expectedOld.trim().toLowerCase(), departmentLabel(fresh.name));
  }
  const rename = (text: string) => renamed.get(text.trim().toLowerCase()) ?? text;
  const live = new Map(source.data.students.map((s) => [s.id, s]));
  const deptName = new Map(source.data.departments.map((d) => [d.id, d.name]));
  const companyName = new Map(source.data.companies.map((c) => [c.id, c.name]));
  return {
    ...next,
    groups: next.groups.map((g) => ({
      ...g,
      name: g.companyId !== null && companies.has(g.companyId) ? (companyName.get(g.companyId) ?? g.name) : g.name,
      departments: g.departments.map(rename),
      students: g.students.map((st) => {
        const row = st.studentId === null || !students.has(st.studentId) ? undefined : live.get(st.studentId);
        if (!row) return { ...st, department: rename(st.department) };
        return {
          ...st,
          name: formatStudentName(row),
          gender: formatGender(row.gender),
          department: row.departmentId === null ? "" : departmentLabel(deptName.get(row.departmentId)),
          period: formatPeriod(row.startDate, row.endDate),
        };
      }),
    })),
  };
}

// ---- Mga filter at ayos mula sa sidebar (sa pagpapakita lang) -----------------------

export const HTE_FILTERS = [
  { key: "section", label: "Section" },
  { key: "company", label: "Company" },
  { key: "department", label: "Department" },
  { key: "status", label: "Status" },
] as const;

/** Mga pagpipilian ng bawat filter, mula sa datos ng system */
export function hteFilterOptions(source: ReportSource): Record<string, { value: string; label: string }[]> {
  const extra = new Map(source.lists.students.map((s) => [s.id, s]));
  const sections = [...new Set(source.data.students.map((s) => extra.get(s.id)?.subjectCode ?? "").filter(Boolean))].sort();
  const statuses = [...new Set(source.data.students.map((s) => s.status || "For Approval"))].sort();
  const usedCompanies = new Set(source.data.students.map((s) => s.companyId).filter((x): x is number => x !== null));
  const usedDepartments = new Set(source.data.students.map((s) => s.departmentId).filter((x): x is number => x !== null));
  const companyName = new Map(source.data.companies.map((c) => [c.id, c.name]));
  return {
    section: sections.map((v) => ({ value: v, label: v })),
    company: source.data.companies.filter((c) => usedCompanies.has(c.id))
      .map((c) => ({ value: String(c.id), label: c.name || "Unnamed company" }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    department: source.data.departments.filter((d) => usedDepartments.has(d.id) && !isPlaceholderDepartment(d.name))
      .map((d) => ({ value: String(d.id), label: `${companyName.get(d.companyId) ?? ""} – ${departmentLabel(d.name)}` }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    status: statuses.map((v) => ({ value: v, label: v })),
  };
}

/**
 * Ang ipapakita: may filter (para sa mga student mula sa system lang; laging kasama ang mga idinagdag sa report)
 * at ayos ng mga student sa loob ng bawat company. Hindi nito binabago ang laman ng report.
 */
export function visibleHte(content: HteContent, source: ReportSource): HteContent {
  const filters = Object.entries(content.filters ?? {}).filter(([, v]) => v);
  const sort = content.studentSort ?? "manual";
  if (filters.length === 0 && sort === "manual") return content;

  const live = new Map(source.data.students.map((s) => [s.id, s]));
  const extra = new Map(source.lists.students.map((s) => [s.id, s]));
  const keep = (studentId: number | null) => {
    if (studentId === null) return true;
    const s = live.get(studentId);
    if (!s) return filters.length === 0;
    return filters.every(([k, v]) => {
      if (k === "section") return (extra.get(s.id)?.subjectCode ?? "") === v;
      if (k === "company") return String(s.companyId ?? "") === v;
      if (k === "department") return String(s.departmentId ?? "") === v;
      if (k === "status") return (s.status || "For Approval") === v;
      return true;
    });
  };
  const dir = sort === "desc" ? -1 : 1;
  const groups: HteGroup[] = [];
  for (const g of content.groups) {
    let students = g.students.filter((s) => keep(s.studentId));
    // Grupong naubos dahil sa filter: hindi na ipinapakita (ang grupong walang student talaga ay naiiwan)
    if (g.students.length > 0 && students.length === 0) continue;
    if (sort !== "manual") students = [...students].sort((a, b) => dir * a.name.localeCompare(b.name));
    groups.push({ ...g, students });
  }
  return { ...content, groups };
}
