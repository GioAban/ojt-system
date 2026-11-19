// Edit mode ng mga report: bawat cell ay nae-edit.
//  - Nakakabit sa tunay na record (FieldSpec): naghihintay, saka isinusulat kapag pinatay ang Edit mode at kinumpirma.
//  - Hindi maisusulat sa system (OverrideSpec): binabago lang sa report na ito, may marka at Reset to system value.
//  - Panahon ng training sa HTE (PeriodSpec): simula at katapusan, parehong petsa sa kalendaryo.
// Ang server pa rin ang huling nagpapasya sa mga isinusulat.

import { CONTACT_MAX, EMAIL_PATTERN, contactError, validateSupervisor } from "@/lib/company";
import { FINAL_BANDS } from "@/lib/evaluationForm";
import { departmentLabel, formatGender, isPlaceholderDepartment, formatLongDate, formatPeriod, formatStudentName } from "@/lib/hteReport";
import { REQUIREMENT_TYPE } from "@/lib/listTemplates";
import type {
  ChangeTarget, HteContent, HteVariant, ListContent, ListRow, ListStudent, PendingChange, PendingMap,
  ReportCompany, ReportDepartment, ReportSource, ReportStudent, TrackingStatus,
} from "@/types/reports";

export type EditorKind = "assignment" | "select" | "date" | "text";

export interface FieldOption {
  value: string;
  label: string;
  disabled?: boolean;
  hint?: string;
}

/** Isang cell na nakakabit sa tunay na record */
export interface FieldSpec {
  type: "field";
  key: string;
  target: ChangeTarget;
  id: number;
  field: string;
  refId: number | null;
  label: string;
  who: string;
  kind: EditorKind;
  /** Ang kasalukuyang halaga, sa anyo ng input (hal. "For Approval", "open", department id) */
  live: string;
  /** Ang nakaimbak na halaga na ipapadala bilang expectedOld; null kung hindi alam (lumang kopya ng datos) */
  expected: string | null;
  options?: FieldOption[];
  /** Para sa text: email o telepono (tamang keyboard sa telepono) */
  inputType?: "text" | "email" | "tel";
  maxLength?: number;
  /** Ilan ang tatamaan, para sa paalala sa editor */
  affects?: number;
  note?: string;
  validate: (value: string, pending: PendingMap) => string | null;
  /** Ang ipapakita sa papel para sa halagang ito */
  show: (value: string) => string;
  /** Pagkatapos itabi ang pagbabago (hal. alisin ang lumang edit sa report lang sa cell na ito) */
  afterSave?: (value: string | null) => void;
}

export type OverrideInput = "text" | "number" | "date" | "select";

/** Cell na hindi maisusulat sa system: binabago lang sa report na ito */
export interface OverrideSpec {
  type: "override";
  /** Natatanging susi ng cell (para sa buod ng Edit mode) */
  key: string;
  label: string;
  who: string;
  input: OverrideInput;
  options?: FieldOption[];
  min?: number;
  max?: number;
  /** Ang halaga sa system o template; null kung walang katumbas */
  system: string | null;
  /** Ang nasa report ngayon */
  value: string;
  /** Bakit sa report lang */
  reason: string;
  /** Itinatabi sa report; null = ibalik sa nasa system */
  apply: (value: string | null) => void;
}

/** Panahon ng training (HTE): simula at katapusan */
export interface PeriodSpec {
  type: "period";
  key: string;
  label: string;
  who: string;
  start: FieldSpec;
  /** null kapag hindi pa tapos ang OJT (ang katapusan ay itinatakda ng Complete OJT) */
  end: FieldSpec | null;
  endNote: string;
  show: (start: string, end: string) => string;
}

/** Pangalan ng student: apelyido, pangalan at gitnang inisyal (tatlong field ng iisang record) */
export interface NameSpec {
  type: "name";
  key: string;
  label: string;
  who: string;
  last: FieldSpec;
  first: FieldSpec;
  middle: FieldSpec;
  show: (last: string, first: string, middle: string) => string;
}

export type CellSpec = FieldSpec | OverrideSpec | PeriodSpec | NameSpec;

/** Panloob: hindi maisusulat at ang dahilan */
interface Locked {
  locked: string;
}

type Built = FieldSpec | Locked;

const isLockedBuilt = (b: Built): b is Locked => "locked" in b;

export const changeKey = (target: ChangeTarget, id: number, field: string, refId: number | null = null) =>
  `${target}:${id}:${field}${refId === null ? "" : `:${refId}`}`;

const REGENERATE = "Regenerate this report to edit the system record. Until then this changes the report only.";
const COMPUTED = "Computed by the system.";

export const YEAR_OPTIONS = ["1st Year", "2nd Year", "3rd Year", "4th Year", "5th Year"];
const PLACEMENT_LABELS = ["For Approval", "Approved", "Deployed", "Completed"];
const REQUIREMENT_LABELS = ["Missing", "Submitted", "Evaluated", "Invalid or returned", "Not yet available"];
const EVALUATION_LABELS = [
  "Not assigned or not opened yet", "Assigned", "Draft or in progress", "Turned in", "Evaluated", "Invalid or returned",
];

// ---- Mga index ng datos (isang beses bawat source) ----------------------------

interface SourceIndex {
  students: Map<number, ReportStudent>;
  extra: Map<number, ListStudent>;
  companies: Map<number, ReportCompany>;
  departments: Map<number, ReportDepartment>;
  departmentsOf: Map<number, ReportDepartment[]>;
  studentsPerCompany: Map<number, number>;
}

const INDEX = new WeakMap<ReportSource, SourceIndex>();

function indexOf(source: ReportSource): SourceIndex {
  let ix = INDEX.get(source);
  if (ix) return ix;
  const departmentsOf = new Map<number, ReportDepartment[]>();
  for (const d of source.data.departments) {
    const list = departmentsOf.get(d.companyId) ?? [];
    list.push(d);
    departmentsOf.set(d.companyId, list);
  }
  const studentsPerCompany = new Map<number, number>();
  for (const s of source.data.students) {
    if (s.companyId !== null) studentsPerCompany.set(s.companyId, (studentsPerCompany.get(s.companyId) ?? 0) + 1);
  }
  ix = {
    students: new Map(source.data.students.map((s) => [s.id, s])),
    extra: new Map(source.lists.students.map((s) => [s.id, s])),
    companies: new Map(source.data.companies.map((c) => [c.id, c])),
    departments: new Map(source.data.departments.map((d) => [d.id, d])),
    departmentsOf,
    studentsPerCompany,
  };
  INDEX.set(source, ix);
  return ix;
}

// ---- Pending ---------------------------------------------------------------

/** Ang halaga ngayon: ang naghihintay kung mayroon, kung wala ay ang nasa system */
export const valueOf = (spec: FieldSpec, pending: PendingMap) => pending[spec.key]?.value ?? spec.live;

export const isPending = (spec: FieldSpec, pending: PendingMap) => spec.key in pending;

/** Itinatabi o inaalis (kapag bumalik sa nasa system) ang isang pagbabago */
export function withPending(pending: PendingMap, spec: FieldSpec, value: string | null): PendingMap {
  const next = { ...pending };
  if (value === null || value === spec.live) {
    delete next[spec.key];
    return next;
  }
  const change: PendingChange = {
    key: spec.key, target: spec.target, id: spec.id, field: spec.field, refId: spec.refId,
    value, expectedOld: spec.expected, label: spec.label, who: spec.who,
  };
  next[spec.key] = change;
  return next;
}

export const pendingList = (pending: PendingMap | undefined) => Object.values(pending ?? {});

/** Ang ipinapakita ng isang cell ngayon, kasama ang naghihintay na pagbabago */
export function shownValue(spec: CellSpec, pending: PendingMap, fallback: string): string {
  if (spec.type === "override") return spec.value;
  if (spec.type === "name") {
    if (![spec.last, spec.first, spec.middle].some((x) => isPending(x, pending))) return fallback;
    return spec.show(valueOf(spec.last, pending), valueOf(spec.first, pending), valueOf(spec.middle, pending));
  }
  if (spec.type === "period") {
    if (!isPending(spec.start, pending) && !(spec.end && isPending(spec.end, pending))) return fallback;
    return spec.show(valueOf(spec.start, pending), spec.end ? valueOf(spec.end, pending) : "");
  }
  return isPending(spec, pending) ? spec.show(valueOf(spec, pending)) : fallback;
}

/** Mga key ng pagbabago ng cell (para sa error mula sa server) */
export function changeKeysOf(spec: CellSpec): string[] {
  if (spec.type === "field") return [spec.key];
  if (spec.type === "period") return spec.end ? [spec.start.key, spec.end.key] : [spec.start.key];
  if (spec.type === "name") return [spec.last.key, spec.first.key, spec.middle.key];
  return [];
}

// ---- Petsa ---------------------------------------------------------------------

/** YYYY-MM-DD, taong 2000 hanggang 2100; blangko ay pinapayagan kung optional */
export function validDate(v: string): string | null {
  if (!v) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) return "Pick a date from the calendar.";
  const year = Number(m[1]);
  if (year < 2000 || year > 2100) return "Please enter a year between 2000 and 2100.";
  const d = new Date(`${v}T00:00:00`);
  if (Number.isNaN(d.getTime()) || d.getDate() !== Number(m[3])) return "That date doesn't exist.";
  return null;
}

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

/** "August 1, 2025" o "2025-08-01" -> "2025-08-01"; blangko kung hindi petsa */
export function toIsoDate(raw: string): string {
  const s = raw.trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /^([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})$/.exec(s);
  if (!m) return "";
  const month = MONTHS.indexOf(m[1].toLowerCase());
  if (month < 0) return "";
  return `${m[3]}-${String(month + 1).padStart(2, "0")}-${m[2].padStart(2, "0")}`;
}

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// ---- Student ---------------------------------------------------------------

const whoOf = (s: ReportStudent) => formatStudentName(s);

/** Company at department ng student; iisang pagbabago (assignment) para sa dalawang column */
function assignmentField(source: ReportSource, studentId: number, show: "company" | "department"): Built {
  const ix = indexOf(source);
  const s = ix.students.get(studentId);
  if (!s) return { locked: REGENERATE };
  if (s.status.trim().toLowerCase() === "completed") {
    return { locked: "This student has completed the OJT, so the company can't be changed in the system." };
  }
  const live = s.departmentId === null ? "" : String(s.departmentId);
  return {
    type: "field",
    key: changeKey("student", s.id, "assignment"),
    target: "student", id: s.id, field: "assignment", refId: null,
    label: "Company and department", who: whoOf(s),
    kind: "assignment", live, expected: live,
    note: "Same rules as Assign company on the Students page: approved department, open slots.",
    validate: (value) => {
      if (!value) return "Choose a company.";
      const d = ix.departments.get(Number(value));
      if (!d) return "Choose a department.";
      if (d.assignable === false) return "That department can't take students right now.";
      if (String(d.id) !== live && d.students >= d.slots) return "This department has no slots left.";
      return null;
    },
    show: (value) => {
      const d = value ? ix.departments.get(Number(value)) : undefined;
      if (!d) return "";
      return show === "company" ? (ix.companies.get(d.companyId)?.name ?? "") : departmentLabel(d.name);
    },
  };
}

/** Mga company na pwedeng piliin (aktibo, may department na pwedeng pag-assign-an) */
export function companyOptions(source: ReportSource, current: string): FieldOption[] {
  const ix = indexOf(source);
  const currentCompany = current ? ix.departments.get(Number(current))?.companyId : undefined;
  return source.data.companies
    .filter((c) => c.assignable !== false || c.id === currentCompany)
    .map((c) => {
      const usable = (ix.departmentsOf.get(c.id) ?? []).filter((d) => d.assignable !== false);
      return {
        value: String(c.id),
        label: c.name || "Unnamed company",
        disabled: usable.length === 0,
        hint: usable.length === 0 ? "No approved department to place students in" : undefined,
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
}

/** Mga department ng company; ang "N/A" ay ang placeholder (walang department talaga) */
export function departmentOptions(source: ReportSource, companyId: number, current: string): FieldOption[] {
  const ix = indexOf(source);
  return (ix.departmentsOf.get(companyId) ?? [])
    .filter((d) => d.assignable !== false || String(d.id) === current)
    .map((d) => {
      const full = String(d.id) !== current && d.students >= d.slots;
      return {
        value: String(d.id),
        label: isPlaceholderDepartment(d.name) ? "N/A (no department)" : departmentLabel(d.name),
        disabled: full,
        hint: `${d.students} of ${d.slots} slots used${full ? " · full" : ""}`,
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
}

/** Ang department na awtomatikong pipiliin pagkapili ng company: ang placeholder na N/A, o ang nag-iisa */
export function defaultDepartment(source: ReportSource, companyId: number): string | null {
  const options = departmentOptions(source, companyId, "").filter((o) => !o.disabled);
  const placeholder = options.find((o) => o.label.startsWith("N/A"));
  if (placeholder) return placeholder.value;
  return options.length === 1 ? options[0].value : null;
}

export const companyOfDepartment = (source: ReportSource, departmentId: string): number | null =>
  departmentId ? (indexOf(source).departments.get(Number(departmentId))?.companyId ?? null) : null;

function sectionField(source: ReportSource, studentId: number): Built {
  const ix = indexOf(source);
  const s = ix.students.get(studentId);
  const e = ix.extra.get(studentId);
  if (!s || !e) return { locked: REGENERATE };
  const live = e.subjectCode;
  // Lumang kopya ng datos na walang listahan: ang mga section ng mga student mismo
  const sections = source.lists.sections
    ?? [...new Set(source.lists.students.map((x) => x.subjectCode).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const options = sections.map((v) => ({ value: v, label: v }));
  if (live && !sections.includes(live)) options.unshift({ value: live, label: live });
  return {
    type: "field",
    key: changeKey("student", s.id, "section"), target: "student", id: s.id, field: "section", refId: null,
    label: "Section / Subject code", who: whoOf(s), kind: "select", live, expected: live, options,
    note: "Only sections already used by your students can be chosen.",
    validate: (v) => (!v ? "Choose a section." : !sections.includes(v) ? "Choose one of the existing sections." : null),
    show: (v) => v,
  };
}

function yearField(source: ReportSource, studentId: number): Built {
  const s = indexOf(source).students.get(studentId);
  if (!s) return { locked: REGENERATE };
  const live = s.year;
  return {
    type: "field",
    key: changeKey("student", s.id, "year"), target: "student", id: s.id, field: "year", refId: null,
    label: "Year", who: whoOf(s), kind: "select", live, expected: live,
    options: YEAR_OPTIONS.map((v) => ({ value: v, label: v })),
    validate: (v) => (YEAR_OPTIONS.includes(v) ? null : "Choose a year from 1st Year to 5th Year."),
    show: (v) => v,
  };
}

function startDateField(source: ReportSource, studentId: number): Built {
  const s = indexOf(source).students.get(studentId);
  if (!s) return { locked: REGENERATE };
  // Lumang kopya ng datos: hindi alam ang nakaimbak, kaya ang ipinapakitang petsa ang simula at walang expectedOld
  const known = s.startTrainingDate !== undefined;
  const live = known ? (s.startTrainingDate as string).slice(0, 10) : toIsoDate(s.startDate);
  return {
    type: "field",
    key: changeKey("student", s.id, "startDate"), target: "student", id: s.id, field: "startDate", refId: null,
    label: "Start of training", who: whoOf(s), kind: "date", live, expected: known ? live : null,
    note: "Leave it empty to use the deployed date.",
    validate: validDate,
    show: (v) => formatLongDate(v || s.startDate),
  };
}

/** Katapusan ng training: para lang sa tapos nang OJT (parehong tuntunin ng Complete OJT) */
function completedDateField(source: ReportSource, studentId: number): FieldSpec | null {
  const s = indexOf(source).students.get(studentId);
  if (!s || s.status.trim().toLowerCase() !== "completed") return null;
  const live = s.endDate.slice(0, 10);
  const start = (s.startDate || "").slice(0, 10);
  return {
    type: "field",
    key: changeKey("student", s.id, "completedDate"), target: "student", id: s.id, field: "completedDate", refId: null,
    label: "End of training", who: whoOf(s), kind: "date", live, expected: s.endDate,
    validate: (v) => {
      if (!v) return "Please enter the completion date.";
      const bad = validDate(v);
      if (bad) return bad;
      if (v > today()) return "The completion date can't be in the future.";
      if (start && v < start) return `The completion date can't be earlier than the start date (${start}).`;
      return null;
    },
    show: (v) => formatLongDate(v),
  };
}

const PLACEMENT = ["For Approval", "Approved"];

function statusField(source: ReportSource, studentId: number): Built {
  const s = indexOf(source).students.get(studentId);
  if (!s) return { locked: REGENERATE };
  const raw = s.status.trim();
  if (raw.toLowerCase() === "completed") return { locked: "Completed in the system. Use Complete OJT on the Students page to change it there." };
  if (s.departmentId !== null) return { locked: "Deployed in the system, from assigning a company. Remove the company on the Students page to change it there." };
  const live = PLACEMENT.find((p) => p.toLowerCase() === raw.toLowerCase()) ?? "For Approval";
  return {
    type: "field",
    key: changeKey("student", s.id, "status"), target: "student", id: s.id, field: "status", refId: null,
    label: "Status", who: whoOf(s), kind: "select", live, expected: raw,
    options: [
      { value: "For Approval", label: "For Approval" },
      { value: "Approved", label: "Approved" },
      { value: "Deployed", label: "Deployed", disabled: true, hint: "Set by assigning a company" },
      { value: "Completed", label: "Completed", disabled: true, hint: "Use Complete OJT on the Students page" },
    ],
    validate: (v) => (PLACEMENT.includes(v) ? null : "Only For Approval or Approved can be set here."),
    show: (v) => v,
  };
}

const REQUIREMENT_LABEL: Record<TrackingStatus, string> = {
  ASSIGNED: "Missing", FOR_CHECKING: "Submitted", CHECKED: "Evaluated", INVALID: "Invalid or returned",
};

/** Status ng requirement: mula sa report, Submitted -> Evaluated o Invalid lang */
function requirementField(source: ReportSource, studentId: number, requirementId: number): Built {
  const ix = indexOf(source);
  const s = ix.students.get(studentId);
  const e = ix.extra.get(studentId);
  const r = source.lists.requirements.find((x) => x.id === requirementId);
  if (!s || !e || !r) return { locked: REGENERATE };
  const live = (e.requirementStatuses[String(requirementId)] ?? "ASSIGNED") as TrackingStatus;
  if (live === "CHECKED") return { locked: "Evaluated in the system. Correct it on the review screen." };
  if (live === "ASSIGNED") return { locked: "Missing in the system. It changes when the student submits." };
  if (live === "INVALID") return { locked: "Returned in the system. It changes when the student submits again." };
  return {
    type: "field",
    key: changeKey("student", s.id, "requirement", requirementId),
    target: "student", id: s.id, field: "requirement", refId: requirementId,
    label: r.title, who: whoOf(s), kind: "select", live, expected: live,
    options: [
      { value: "FOR_CHECKING", label: "Submitted", disabled: true, hint: "Current status" },
      { value: "CHECKED", label: "Evaluated" },
      { value: "INVALID", label: "Invalid or returned" },
    ],
    note: "Once Evaluated, it can only be corrected on the review screen.",
    validate: (v) => (v === "CHECKED" || v === "INVALID" ? null : "Choose Evaluated or Invalid."),
    show: (v) => REQUIREMENT_LABEL[v as TrackingStatus] ?? v,
  };
}

/** Pagbukas o pagsara ng Midterm o Final; hindi kailanman sa turned in o Evaluated */
function evaluationField(source: ReportSource, studentId: number, which: "midterm" | "final"): Built {
  const ix = indexOf(source);
  const s = ix.students.get(studentId);
  const e = ix.extra.get(studentId);
  if (!s || !e) return { locked: REGENERATE };
  const status = which === "midterm" ? e.midtermStatus : e.finalStatus;
  const open = which === "midterm" ? e.midtermOpen : e.finalOpen;
  const started = which === "midterm" ? e.midtermStarted : e.finalStarted;
  const title = which === "midterm" ? "Midterm Evaluation" : "Final Evaluation";
  if (status === "CHECKED") return { locked: "Evaluated in the system. Change it on the review screen." };
  if (status === "FOR_CHECKING") return { locked: "Turned in. Review it on the review screen." };
  if (status === "INVALID") return { locked: "Returned. Review it on the review screen." };
  if (open && started) return { locked: "The student already started this evaluation, so it can't be closed in the system." };
  const live = open ? "open" : "closed";
  return {
    type: "field",
    key: changeKey("student", s.id, which), target: "student", id: s.id, field: which, refId: null,
    label: title, who: whoOf(s), kind: "select", live, expected: live,
    options: [
      { value: "closed", label: "Not assigned or not opened yet" },
      { value: "open", label: "Assigned (open for the student)" },
    ],
    note: "Opening it notifies the student, the same as opening it on the Requirements page.",
    validate: (v) => (v === "open" || v === "closed" ? null : "Choose open or not opened."),
    show: (v) => (v === "open" ? "Assigned" : "Not assigned or not opened yet"),
  };
}

// ---- Department at company --------------------------------------------------

function supervisorField(source: ReportSource, departmentId: number, field: "supervisorName" | "supervisorPosition"): Built {
  const ix = indexOf(source);
  const d = ix.departments.get(departmentId);
  if (!d) return { locked: REGENERATE };
  // Walang sariling supervisor ang department at ang sa company ang lumalabas: ang sa company ang babaguhin
  if (d.supervisorSource === "company") return companySupervisorField(source, d.companyId, field, d);
  const company = ix.companies.get(d.companyId)?.name ?? "";
  const dept = departmentLabel(d.name);
  // Lumang kopya ng datos: ang ipinapakitang supervisor ang simula at walang expectedOld
  const known = d.ownSupervisor !== undefined && d.ownSupervisorPosition !== undefined;
  const ownName = known ? (d.ownSupervisor as string) : d.supervisor;
  const ownPosition = known ? (d.ownSupervisorPosition as string) : d.supervisorPosition;
  const live = field === "supervisorName" ? ownName : ownPosition;
  const partnerKey = changeKey("department", d.id, field === "supervisorName" ? "supervisorPosition" : "supervisorName");
  const partnerLive = field === "supervisorName" ? ownPosition : ownName;
  const fallback = field === "supervisorName" ? d.supervisor : d.supervisorPosition;
  return {
    type: "field",
    key: changeKey("department", d.id, field), target: "department", id: d.id, field, refId: null,
    label: field === "supervisorName" ? "Supervisor name" : "Supervisor position",
    who: dept ? `${company} – ${dept}` : company,
    kind: "text", live, expected: known ? live : null, affects: d.students,
    note: "Optional. If you enter a name, also enter the position. Blank uses the company's immediate supervisor.",
    validate: (v, pending) => {
      if (v.length > 255) return "Too long (max 255 characters).";
      const partner = pending[partnerKey]?.value ?? partnerLive;
      const errors = field === "supervisorName"
        ? validateSupervisor({ name: v, position: partner, contact: "", email: "" })
        : validateSupervisor({ name: partner, position: v, contact: "", email: "" });
      return field === "supervisorName" ? (errors.name ?? errors.position ?? null) : (errors.position ?? errors.name ?? null);
    },
    // Blangko sa department: ang immediate supervisor ng company ang lalabas
    show: (v) => v || (live ? "" : fallback),
  };
}

export function companyField(source: ReportSource, companyId: number, field: "name" | "address"): FieldSpec | null {
  const ix = indexOf(source);
  const c = ix.companies.get(companyId);
  if (!c) return null;
  const known = field === "name" || c.addressValue !== undefined;
  const live = field === "name" ? c.name : (c.addressValue ?? c.address);
  const others = new Set(source.data.companies.filter((x) => x.id !== c.id).map((x) => x.name.trim().toLowerCase()));
  return {
    type: "field",
    key: changeKey("company", c.id, field), target: "company", id: c.id, field, refId: null,
    label: field === "name" ? "Company name" : "Company address", who: c.name,
    kind: "text", live, expected: known ? live : null, affects: ix.studentsPerCompany.get(c.id) ?? 0,
    note: field === "name" ? "Renames this company everywhere in the system." : undefined,
    validate: (v) => {
      const t = v.trim();
      if (!t) return field === "name" ? "Company name is required." : "Address is required.";
      if (t.length > 255) return "Too long (max 255 characters).";
      if (field === "name" && others.has(t.toLowerCase())) return "You already have a company with that name in this semester.";
      return null;
    },
    show: (v) => v,
  };
}

/** Immediate supervisor ng company (ginagamit ng mga department na walang sariling supervisor) */
function companySupervisorField(
  source: ReportSource, companyId: number, field: "supervisorName" | "supervisorPosition", shownBy?: ReportDepartment,
): Built {
  const ix = indexOf(source);
  const c = ix.companies.get(companyId);
  if (!c) return { locked: REGENERATE };
  const known = c.imsupName !== undefined && c.imsupPosition !== undefined;
  const name = known ? (c.imsupName as string) : (shownBy?.supervisor ?? "");
  const position = known ? (c.imsupPosition as string) : (shownBy?.supervisorPosition ?? "");
  const live = field === "supervisorName" ? name : position;
  const partnerKey = changeKey("company", c.id, field === "supervisorName" ? "supervisorPosition" : "supervisorName");
  const partnerLive = field === "supervisorName" ? position : name;
  return {
    type: "field",
    key: changeKey("company", c.id, field), target: "company", id: c.id, field, refId: null,
    label: field === "supervisorName" ? "Company's immediate supervisor" : "Company's immediate supervisor position",
    who: c.name, kind: "text", live, expected: known ? live : null, maxLength: 255,
    affects: ix.studentsPerCompany.get(c.id) ?? 0,
    note: "This department has no supervisor of its own, so this changes the company's immediate supervisor, used by every department without one.",
    validate: (v, pending) => {
      if (v.length > 255) return "Too long (max 255 characters).";
      const partner = pending[partnerKey]?.value ?? partnerLive;
      const errors = field === "supervisorName"
        ? validateSupervisor({ name: v, position: partner, contact: "", email: "" })
        : validateSupervisor({ name: partner, position: v, contact: "", email: "" });
      return field === "supervisorName" ? (errors.name ?? errors.position ?? null) : (errors.position ?? errors.name ?? null);
    },
    show: (v) => v,
  };
}

/** Pangalan ng department (hindi ang placeholder na N/A) */
export function departmentNameField(source: ReportSource, departmentId: number): Built {
  const ix = indexOf(source);
  const d = ix.departments.get(departmentId);
  if (!d) return { locked: REGENERATE };
  if (isPlaceholderDepartment(d.name)) return { locked: "N/A means the company has no department, so there's no department name to change." };
  const company = ix.companies.get(d.companyId)?.name ?? "";
  const siblings = new Set((ix.departmentsOf.get(d.companyId) ?? []).filter((x) => x.id !== d.id).map((x) => x.name.trim().toLowerCase()));
  return {
    type: "field",
    key: changeKey("department", d.id, "name"), target: "department", id: d.id, field: "name", refId: null,
    label: "Department name", who: company, kind: "text", live: d.name, expected: d.name, maxLength: 255, affects: d.students,
    note: "Renames this department everywhere in the system.",
    validate: (v) => {
      const t = v.trim();
      if (!t) return "Department name is required.";
      if (t.length > 255) return "Department name is too long (max 255 characters).";
      if (siblings.has(t.toLowerCase())) return "This company already has a department with that name.";
      return null;
    },
    show: (v) => departmentLabel(v),
  };
}

const NUMBER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9\-/]{2,49}$/;

/** Field ng student na binabago sa Students page: parehong tuntunin at mensahe */
function profileField(source: ReportSource, studentId: number, field: string): Built {
  const ix = indexOf(source);
  const s = ix.students.get(studentId);
  const e = ix.extra.get(studentId);
  if (!s) return { locked: REGENERATE };
  const base = { type: "field" as const, target: "student" as const, id: s.id, field, refId: null, who: whoOf(s) };
  const raw = (v: string | undefined) => ({ live: v ?? "", expected: v === undefined ? null : v });

  switch (field) {
    case "studentNumber": {
      if (!e) return { locked: REGENERATE };
      const others = new Set(source.lists.students.filter((x) => x.id !== s.id).map((x) => x.studentNumber.trim().toLowerCase()));
      return {
        ...base, key: changeKey("student", s.id, field), label: "Student number", kind: "text", maxLength: 50,
        live: e.studentNumber, expected: e.studentNumber,
        validate: (v) => {
          const t = v.trim();
          if (!t) return "Student number is required.";
          if (!NUMBER_PATTERN.test(t)) return "Student number can only have letters, numbers, - and /.";
          if (others.has(t.toLowerCase())) return "That student number already exists in this semester.";
          return null;
        },
        show: (v) => v,
      };
    }
    case "lastname":
    case "firstname": {
      const label = field === "lastname" ? "Last name" : "First name";
      const v0 = field === "lastname" ? s.lastname : s.firstname;
      return {
        ...base, key: changeKey("student", s.id, field), label, kind: "text", maxLength: 100, live: v0, expected: v0,
        validate: (v) => (!v.trim() ? `${label} is required.` : v.trim().length > 100 ? `${label} is too long (max 100 characters).` : null),
        show: (v) => v,
      };
    }
    case "middleInitial":
      return {
        ...base, key: changeKey("student", s.id, field), label: "Middle initial", kind: "text", maxLength: 4,
        live: s.middleInitial, expected: s.middleInitial,
        validate: (v) => (v.replace(/\./g, "").trim().length > 3 ? "Middle initial is too long." : null),
        show: (v) => v,
      };
    case "gender": {
      const g = s.gender.trim().toLowerCase();
      const live = g.startsWith("f") ? "Female" : g.startsWith("m") ? "Male" : s.gender;
      return {
        ...base, key: changeKey("student", s.id, field), label: "Gender", kind: "select", live, expected: s.gender,
        options: [{ value: "Male", label: "Male" }, { value: "Female", label: "Female" }],
        validate: (v) => (v === "Male" || v === "Female" ? null : "Gender must be Male or Female."),
        show: (v) => formatGender(v),
      };
    }
    case "contact":
      return {
        ...base, key: changeKey("student", s.id, field), label: "Contact number", kind: "text", maxLength: CONTACT_MAX,
        ...raw(s.contact),
        validate: (v) => contactError(v),
        show: (v) => v,
      };
    case "email": {
      if (s.hasAccount === false) return { locked: "Email can be changed only after the student's account is created (Students page)." };
      const others = new Set(source.data.students.filter((x) => x.id !== s.id).map((x) => (x.email ?? "").toLowerCase()).filter(Boolean));
      return {
        ...base, key: changeKey("student", s.id, field), label: "Email", kind: "text", inputType: "email", maxLength: 255,
        ...raw(s.email),
        validate: (v) => {
          const t = v.trim().toLowerCase();
          if (!t) return "Email is required.";
          if (t.length > 255 || !EMAIL_PATTERN.test(t)) return "Enter a valid email.";
          if (others.has(t)) return "That email is already used by another student.";
          return null;
        },
        show: (v) => v,
      };
    }
    case "birthday":
      return {
        ...base, key: changeKey("student", s.id, field), label: "Birthday", kind: "date",
        live: (s.birthday ?? "").slice(0, 10), expected: s.birthday === undefined ? null : s.birthday,
        validate: (v) => {
          if (!v) return null;
          if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return "Birthday must look like 2003-05-14.";
          if (Number(v.slice(0, 4)) < 1950 || v > today()) return "Birthday is out of range.";
          return null;
        },
        show: (v) => formatLongDate(v),
      };
    case "address":
    case "parent":
    case "guardian": {
      const label = field === "address" ? "Address" : field === "parent" ? "Parent" : "Guardian";
      return {
        ...base, key: changeKey("student", s.id, field), label, kind: "text", maxLength: 255,
        ...raw(field === "address" ? s.address : field === "parent" ? s.parent : s.guardian),
        validate: (v) => (v.trim().length > 255 ? `${label} is too long (max 255 characters).` : null),
        show: (v) => v,
      };
    }
    default:
      return { locked: COMPUTED };
  }
}

/** Pangalan ng student bilang tatlong field */
export function nameSpec(source: ReportSource, studentId: number, afterSave?: () => void): NameSpec | null {
  const parts = (["lastname", "firstname", "middleInitial"] as const).map((f) => profileField(source, studentId, f));
  if (parts.some(isLockedBuilt)) return null;
  const [last, first, middle] = (parts as FieldSpec[]).map((p) => (afterSave ? { ...p, afterSave } : p));
  return {
    type: "name",
    key: changeKey("student", studentId, "name"),
    label: "Name of student",
    who: last.who,
    last, first, middle,
    show: (l, f, m) => formatStudentName({ lastname: l, firstname: f, middleInitial: m }),
  };
}

/** Pamagat ng requirement (hindi ang built-in na Midterm at Final) */
function requirementTitleField(source: ReportSource, requirementId: number): Built {
  const r = source.lists.requirements.find((x) => x.id === requirementId);
  if (!r) return { locked: REGENERATE };
  if (r.builtIn) return { locked: "Built-in requirements can't be renamed." };
  const prefix = REQUIREMENT_TYPE[r.type] ?? r.type;
  const sameTab = new Set(source.lists.requirements.filter((x) => x.id !== r.id && x.type === r.type).map((x) => x.title.trim().toLowerCase()));
  return {
    type: "field",
    key: changeKey("requirement", r.id, "title"), target: "requirement", id: r.id, field: "title", refId: null,
    label: "Requirement title", who: `${prefix} requirement`, kind: "text", maxLength: 255,
    live: r.title, expected: r.title, affects: source.data.students.length,
    note: "Renames this requirement for every student, the same as on the Requirements page.",
    validate: (v) => {
      const t = v.trim();
      if (!t) return "Title is required.";
      if (t.length > 255) return "Title is too long (max 255 characters).";
      if (sameTab.has(t.toLowerCase())) return "You already have a requirement with that title in this tab.";
      return null;
    },
    show: (v) => `${prefix}: ${v}`,
  };
}

const SIGNATORY_LABEL: Record<string, string> = {
  prepared: "Prepared by", programHead: "Noted, program head", dean: "Noted, dean", chair: "Certified true and correct",
};

/** Pangalan o titulo sa pirmahan: naka-save sa coordinator (para sa lahat ng report niya) */
export function signatoryField(id: string, value: string): FieldSpec | null {
  const m = /^sig:(\w+):(name|title)$/.exec(id);
  if (!m || !(m[1] in SIGNATORY_LABEL)) return null;
  const field = `${m[1]}.${m[2]}`;
  return {
    type: "field",
    key: changeKey("signatory", 0, field), target: "signatory", id: 0, field, refId: null,
    label: `${SIGNATORY_LABEL[m[1]]}, ${m[2]}`, who: "Signatories (all your reports)",
    kind: "text", maxLength: 255, live: value, expected: value,
    note: "Signatories are shared by all your reports.",
    validate: (v) => (v.trim().length > 255 ? "Too long (max 255 characters)." : null),
    show: (v) => v,
  };
}

// ---- Mga listahan --------------------------------------------------------------

/** Paano ine-edit sa report lang ang isang column ng listahan */
function listOverrideInput(col: string, source: ReportSource, c: ListContent): Pick<OverrideSpec, "input" | "options" | "min" | "max"> {
  const fixed = (values: string[]) => ({ input: "select" as const, options: values.map((v) => ({ value: v, label: v })) });
  const distinct = (key: string) => [...new Set(c.rows.map((r) => r.cells[key] ?? "").filter(Boolean))].sort((a, b) => a.localeCompare(b));
  switch (col) {
    case "required":
    case "rendered":
    case "remaining": return { input: "number", min: 0, max: 5000 };
    case "midtermScore":
    case "finalScore": return { input: "number", min: 0, max: 100 };
    case "startDate":
    case "birthday": return { input: "date" };
    case "status": return fixed(PLACEMENT_LABELS);
    case "deployment": return fixed(["Deployed", "Not yet deployed"]);
    case "result": return fixed(REQUIREMENT_LABELS);
    case "midterm":
    case "final": return fixed(EVALUATION_LABELS);
    case "finalBand": return fixed(FINAL_BANDS.map((b) => b.range));
    case "gender": return fixed(["MALE", "FEMALE"]);
    case "year": return fixed(YEAR_OPTIONS);
    case "section": return fixed(source.lists.sections ?? distinct("section"));
    case "program": return fixed(distinct("program"));
    case "company": return fixed(source.data.companies.map((x) => x.name).filter(Boolean).sort((a, b) => a.localeCompare(b)));
    case "department": return fixed([...new Set(source.data.departments.map((d) => departmentLabel(d.name)).filter(Boolean))].sort((a, b) => a.localeCompare(b)));
    case "requirement": return fixed(distinct("requirement"));
    default: return { input: "text" };
  }
}

const LIST_REASONS: Record<string, string> = {
  program: "The course is your program, which only the director can edit.",
  deployment: "Computed from the student's status and company. Change the Status or Company cell instead.",
  required: "Required hours come from the program.", rendered: "Rendered hours are the total of Evaluated DTRs.",
  remaining: COMPUTED, midtermScore: "Scores come from the evaluation form.", finalScore: "Scores come from the evaluation form.",
  finalBand: COMPUTED,
};

/** Bumubuo ng record na cell ng listahan, o ang dahilan kung bakit hindi */
function listField(c: ListContent, row: ListRow, col: string, source: ReportSource): Built {
  if (col in LIST_REASONS) return { locked: LIST_REASONS[col] };
  if (!row.refs) return { locked: REGENERATE };
  const sid = row.refs.studentId;
  switch (col) {
    case "studentNumber":
    case "gender":
    case "contact":
    case "email":
    case "birthday":
    case "address":
    case "parent":
    case "guardian": return profileField(source, sid, col);
    case "requirement": {
      if (c.template !== "list-requirements") return { locked: COMPUTED };
      const rid = Number(row.id.split("-")[1]);
      return Number.isInteger(rid) ? requirementTitleField(source, rid) : { locked: REGENERATE };
    }
    case "company": return assignmentField(source, sid, "company");
    case "department": return assignmentField(source, sid, "department");
    case "section": return sectionField(source, sid);
    case "year": return yearField(source, sid);
    case "startDate": return startDateField(source, sid);
    case "status": return statusField(source, sid);
    case "midterm": return evaluationField(source, sid, "midterm");
    case "final": return evaluationField(source, sid, "final");
    case "result": {
      if (c.template !== "list-requirements") return { locked: COMPUTED };
      const rid = Number(row.id.split("-")[1]);
      return Number.isInteger(rid) ? requirementField(source, sid, rid) : { locked: REGENERATE };
    }
    case "supervisor":
    case "supervisorPosition": {
      const dept = indexOf(source).students.get(sid)?.departmentId ?? null;
      if (dept === null) return { locked: "This student has no company yet, so there's no supervisor record." };
      return supervisorField(source, dept, col === "supervisor" ? "supervisorName" : "supervisorPosition");
    }
    default: return { locked: COMPUTED };
  }
}

/**
 * Ano ang cell ng isang listahan sa Edit mode. Ang may lumang edit sa report lang ay nananatiling ganoon
 * hangga't hindi nire-Reset, para hindi matakpan ang nakikita ng coordinator.
 *
 * @param display ang ipinapakita ngayon (kasama ang edit sa report lang)
 * @param setOverride itinatabi (o inaalis kapag null) ang edit sa report lang
 */
export function listCellSpec(
  c: ListContent, row: ListRow, col: string, source: ReportSource, label: string, display: string,
  setOverride: (value: string | null) => void,
): CellSpec {
  const system = row.cells[col] ?? "";
  const hasOverride = c.overrides[row.id]?.[col] !== undefined;
  if (col === "name" && row.refs) {
    const spec = nameSpec(source, row.refs.studentId, hasOverride ? () => setOverride(null) : undefined);
    if (spec) return spec;
  }
  const built = listField(c, row, col, source);
  // Ang field na may tunay na record ay laging nagiging pagbabago sa database, kahit may lumang edit sa report lang:
  // pagkatapos itabi, inaalis ang lumang edit para lumabas ang bago
  if (!isLockedBuilt(built)) return hasOverride ? { ...built, afterSave: () => setOverride(null) } : built;
  const input = listOverrideInput(col, source, c);
  return {
    type: "override",
    key: `list:${row.id}:${col}`,
    label,
    who: row.cells.name ?? "",
    ...input,
    system,
    value: display,
    reason: built.locked,
    apply: setOverride,
  };
}

// ---- HTE ---------------------------------------------------------------------

/**
 * Ano ang cell ng HTE report sa Edit mode. null = teksto ng report lang na diretsong nae-edit sa papel
 * (pamagat, HEI, idinagdag na row, atbp.), may Reset to system value.
 *
 * @param value ang nasa report ngayon
 * @param system ang nasa system (null kung wala)
 * @param setText itinatabi ang teksto sa report
 */
export function hteCellSpec(
  content: HteContent, id: string, source: ReportSource, variant: HteVariant,
  label: string, value: string, system: string | null, setText: (value: string) => void,
): CellSpec | null {
  const parts = id.split(":");
  const override = (input: OverrideSpec["input"], reason: string, options?: FieldOption[]): OverrideSpec => ({
    type: "override", key: `hte:${id}`, label, who: "", input, options, system, value, reason,
    apply: (v) => setText(v === null ? (system ?? "") : v),
  });

  const sig = signatoryField(id, value);
  if (sig) return sig;
  // Linya ng department sa ilalim ng company: ang tugmang department ng company na iyon
  if (parts[0] === "g" && parts[2] === "dept") {
    const g = content.groups.find((x) => x.id === parts[1]);
    if (!g || g.companyId === null) return null;
    const line = value.trim().toLowerCase();
    const d = source.data.departments.find((x) => x.companyId === g.companyId && x.name.trim().toLowerCase() === line);
    if (!d) return null;
    const built = departmentNameField(source, d.id);
    return isLockedBuilt(built) ? null : built;
  }
  if (parts[0] === "g" && parts[2] === "name") {
    const g = content.groups.find((x) => x.id === parts[1]);
    if (!g || g.companyId === null) return null;
    const field = companyField(source, g.companyId, "name");
    if (!field) return override("text", REGENERATE);
    // Kapag ibinalik sa nasa system, inaayon din ang teksto ng report
    return { ...field, afterSave: (v) => { if (v === null || v === field.live) setText(field.live); } };
  }
  if (parts[0] !== "s") return null;
  const student = content.groups.flatMap((g) => g.students).find((s) => s.id === parts[1]);
  if (!student || student.studentId === null) return null;
  const sid = student.studentId;

  switch (parts[2]) {
    case "department": {
      const built = assignmentField(source, sid, "department");
      if (isLockedBuilt(built)) {
        const depts = [...new Set(source.data.departments.map((d) => departmentLabel(d.name)).filter(Boolean))].sort((a, b) => a.localeCompare(b));
        return override("select", built.locked, ["", ...depts].map((d) => ({ value: d, label: d || "(none)" })));
      }
      return { ...built, afterSave: (v) => { if (v === null || v === built.live) setText(built.show(built.live)); } };
    }
    case "period": {
      if (variant !== "report") return null;
      const start = startDateField(source, sid);
      if (isLockedBuilt(start)) return override("text", start.locked);
      const end = completedDateField(source, sid);
      const s = indexOf(source).students.get(sid);
      return {
        type: "period",
        key: `hte:${id}`,
        label: "Period of training",
        who: start.who,
        start,
        end,
        endNote: "The end date is set when the OJT is completed (Complete OJT on the Students page).",
        show: (a, b) => formatPeriod(a || s?.startDate || "", b || s?.endDate || ""),
      };
    }
    case "name": return nameSpec(source, sid) ?? override("text", REGENERATE);
    case "gender": {
      const built = profileField(source, sid, "gender");
      return isLockedBuilt(built) ? override("select", built.locked, ["MALE", "FEMALE"].map((v) => ({ value: v, label: v }))) : built;
    }
    case "program": {
      const programs = [...new Set([source.context.programAbbreviation, value].filter(Boolean))];
      return override("select", "The program is managed by the director, so it can't be changed here.", programs.map((v) => ({ value: v, label: v })));
    }
    default: return null;
  }
}

// ---- Annual ------------------------------------------------------------------

/**
 * Cell ng Annual Report. Ang Company at Department sa buod ay ang pangalan ng tunay na company o department
 * (nasa key ng row ang id); ang pirmahan ay naka-save sa coordinator. Ang iba sa buod ay bilang (report lang).
 * null = tekstong diretsong nae-edit sa papel (pamagat, salaysay).
 */
export function annualCellSpec(
  content: { summary: { id: string; key: string }[] }, id: string, source: ReportSource,
  label: string, kind: "text" | "number" | null, value: string, system: string | null, setText: (value: string) => void,
): CellSpec | null {
  const sig = signatoryField(id, value);
  if (sig) return sig;
  const m = /^sum:([^:]+):(\w+)$/.exec(id);
  if (!m) return null;
  const row = content.summary.find((r) => r.id === m[1]);
  const col = m[2];
  const idOf = (prefix: string) => {
    const part = row?.key.split(":").find((p) => p.startsWith(prefix));
    const n = part ? Number(part.slice(1)) : NaN;
    return Number.isInteger(n) && part!.length > 1 ? n : null;
  };
  if (col === "company") {
    const cid = idOf("c");
    const field = cid === null ? null : companyField(source, cid, "name");
    if (field) return field;
  }
  if (col === "department") {
    const did = idOf("d");
    if (did !== null) {
      const built = departmentNameField(source, did);
      if (!isLockedBuilt(built)) return built;
    }
  }
  return annualSummarySpec(id, label, kind ?? "text", value, system, setText, col === "program"
    ? "The program is managed by the director, so it can't be changed here."
    : col === "company" || col === "department"
      ? "This row isn't tied to one company or department."
      : undefined);
}

/** Bilang sa buod ng Annual Report: laging sa report lang (kinukuwenta ng system) */
export function annualSummarySpec(
  id: string, label: string, kind: "text" | "number", value: string, system: string | null, setText: (value: string) => void,
  reason?: string,
): OverrideSpec {
  return {
    type: "override", key: `annual:${id}`, label, who: "", input: kind === "number" ? "number" : "text",
    min: kind === "number" ? 0 : undefined, max: kind === "number" ? 100000 : undefined,
    system, value,
    reason: reason ?? "Summary numbers are computed from the system. Regenerate to refresh them.",
    apply: (v) => setText(v === null ? (system ?? "") : v),
  };
}

/** Sinusuri ang input ng edit sa report lang */
export function validateOverride(spec: OverrideSpec, v: string): string | null {
  if (spec.input === "number" && v.trim() !== "") {
    const n = Number(v);
    if (!Number.isFinite(n)) return "Enter a number.";
    if (spec.min !== undefined && n < spec.min) return `Enter ${spec.min} or more.`;
    if (spec.max !== undefined && n > spec.max) return `Enter ${spec.max} or less.`;
  }
  if (spec.input === "date") return validDate(v);
  if (v.length > 2000) return "Too long.";
  return null;
}

// ---- Pagkatapos maisulat ------------------------------------------------------

/** Mga student na lumipat ng company o department sa mga naisulat */
export const movedStudents = (changes: PendingChange[]) =>
  changes.filter((x) => x.target === "student" && x.field === "assignment").map((x) => x.id);
