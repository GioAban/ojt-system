// Pagbuo ng laman ng "Report on the List of HTEs and Student Interns" at "List of HTEs" mula sa datos ng system.

import {
  DEFAULT_PAGE_SETTINGS,
  type HteContent, type HteGroup, type HteStudent, type PageSettings, type ReportSource, type ReportStudent,
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

/** Pangalan ng department para sa report; "N/A" ay walang department talaga */
export function departmentLabel(name: string | undefined): string {
  const v = (name ?? "").trim();
  return v.toUpperCase() === "N/A" ? "" : v;
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
    settings: { ...DEFAULT_PAGE_SETTINGS, orientation: "landscape" },
  };
}

/** Sinusuri ang na-load na draft; pinupunan ang kulang na bahagi */
export function parseHteContent(raw: unknown): HteContent | null {
  if (!raw || typeof raw !== "object") return null;
  const c = raw as Partial<HteContent>;
  if (!Array.isArray(c.groups)) return null;
  const settings: PageSettings = { ...DEFAULT_PAGE_SETTINGS, ...(c.settings ?? {}), orientation: "landscape" };
  return {
    hei: c.hei ?? "",
    address: c.address ?? "",
    degreeProgram: c.degreeProgram ?? "",
    settings,
    ...(typeof c.annexLabel === "string" ? { annexLabel: c.annexLabel } : {}),
    ...(Array.isArray(c.titleLines) ? { titleLines: c.titleLines.map((l) => String(l ?? "")) } : {}),
    ...(typeof c.semesterLine === "string" ? { semesterLine: c.semesterLine } : {}),
    ...(Array.isArray(c.columns) ? { columns: c.columns.map(String) } : {}),
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
