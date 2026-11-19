// Mga pirmahang tina-type ng coordinator sa dulo ng report. Naka-save sa device lang (IndexedDB):
// hindi ipinapadala sa server at walang table sa database.

import {
  MANUAL_SIGNATORIES, SIGNATORY_PEOPLE, deleteRecord, getRecord, putRecord,
} from "@/lib/reportDraftStore";
import type { SignatorySet } from "@/types/reports";

export type SignAlign = "left" | "center" | "right";

export interface ManualSignatory {
  id: string;
  /** Hal. Prepared by, Noted by; opsyonal */
  label: string;
  name: string;
  position: string;
  align: SignAlign;
  /** May "Date: ______" sa ilalim */
  dateLine: boolean;
}

/** Ang pirmahan ng isang report, at kung ipapakita pa rin ang built-in na pirmahan */
export interface ReportSignatories {
  items: ManualSignatory[];
  /** Annual at HTE lang: ipakita rin ang Prepared by / Noted / Certified bago ang mga ito */
  showBuiltIn: boolean;
}

export interface SignatoryPerson {
  name: string;
  position: string;
  align: SignAlign;
}

interface StoredReportSignatories extends ReportSignatories {
  /** <email>:saved:<report id> */
  key: string;
  updatedAt: number;
}

interface StoredPeople {
  /** email ng coordinator */
  key: string;
  people: SignatoryPerson[];
}

export const EMPTY_SIGNATORIES: ReportSignatories = { items: [], showBuiltIn: false };

const owner = () => localStorage.getItem("email") ?? "";

export const signatoriesKey = (reportId: number, email = owner()) => `${email}:saved:${reportId}`;

export const newSignatoryId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

// ---- Imbakan -------------------------------------------------------------------

export async function loadReportSignatories(reportId: number): Promise<ReportSignatories> {
  const stored = await getRecord<StoredReportSignatories>(MANUAL_SIGNATORIES, signatoriesKey(reportId));
  if (!stored) return EMPTY_SIGNATORIES;
  return { items: cleanItems(stored.items), showBuiltIn: Boolean(stored.showBuiltIn) };
}

export function saveReportSignatories(reportId: number, value: ReportSignatories) {
  const record: StoredReportSignatories = { key: signatoriesKey(reportId), ...value, updatedAt: Date.now() };
  return putRecord(MANUAL_SIGNATORIES, record);
}

export function deleteReportSignatories(reportId: number) {
  return deleteRecord(MANUAL_SIGNATORIES, signatoriesKey(reportId));
}

/** Kapag dinoble ang report: kopya ng pirmahan sa bagong report (bagong id ng bawat isa) */
export async function copyReportSignatories(fromId: number, toId: number) {
  const from = await loadReportSignatories(fromId);
  if (from.items.length === 0 && !from.showBuiltIn) return;
  await saveReportSignatories(toId, { ...from, items: from.items.map((s) => ({ ...s, id: newSignatoryId() })) });
}

export async function loadPeople(): Promise<SignatoryPerson[]> {
  const stored = await getRecord<StoredPeople>(SIGNATORY_PEOPLE, owner());
  return cleanPeople(stored?.people ?? []);
}

export function savePeople(people: SignatoryPerson[]) {
  return putRecord(SIGNATORY_PEOPLE, { key: owner(), people } satisfies StoredPeople);
}

/** Idinadagdag o ina-update ang isang tao (ayon sa pangalan) sa listahan ng mungkahi */
export function rememberPerson(people: SignatoryPerson[], person: SignatoryPerson): SignatoryPerson[] {
  const name = person.name.trim();
  if (!name) return people;
  const rest = people.filter((p) => p.name.trim().toLowerCase() !== name.toLowerCase());
  return [{ name, position: person.position.trim(), align: person.align }, ...rest].slice(0, 200);
}

// ---- Ayos sa papel ----------------------------------------------------------------

const ORDER: Record<SignAlign, number> = { left: 0, center: 1, right: 2 };

/**
 * Hinahati sa mga hanay ayon sa ayos: bagong hanay kapag ang posisyon ay pareho o nasa kaliwa ng huling
 * nailagay sa hanay. Kaya ang Left, Right, Center ay "Left + Right", saka "Center".
 */
export function signatoryRows(items: ManualSignatory[]): ManualSignatory[][] {
  const rows: ManualSignatory[][] = [];
  let row: ManualSignatory[] = [];
  let last = -1;
  for (const s of items) {
    const at = ORDER[s.align];
    if (row.length > 0 && at <= last) {
      rows.push(row);
      row = [];
    }
    row.push(s);
    last = at;
  }
  if (row.length > 0) rows.push(row);
  return rows;
}

/** Ang built-in na pirmahan bilang mga signatory (para sa Excel kapag naka-on ang "Also show the built-in section") */
export function builtInAsSignatories(people: SignatorySet): ManualSignatory[] {
  const make = (id: string, label: string, p: { name: string; title: string }, align: SignAlign): ManualSignatory =>
    ({ id, label, name: p.name, position: p.title, align, dateLine: false });
  return [
    make("b-prepared", "Prepared by:", people.prepared, "left"),
    make("b-head", "Noted:", people.programHead, "center"),
    make("b-dean", "", people.dean, "right"),
    make("b-chair", "Certified True and Correct:", people.chair, "left"),
  ];
}

// ---- Export at import --------------------------------------------------------------

export interface SignatoriesFile {
  kind: "practicum-signatories";
  version: 1;
  people: SignatoryPerson[];
  signatories: ManualSignatory[];
}

export function exportFile(people: SignatoryPerson[], items: ManualSignatory[]): Blob {
  const file: SignatoriesFile = { kind: "practicum-signatories", version: 1, people, signatories: items };
  return new Blob([JSON.stringify(file, null, 2)], { type: "application/json" });
}

/** Sinusuri ang na-import na file; null kung hindi ito file ng pirmahan */
export function parseFile(text: string): { people: SignatoryPerson[]; signatories: ManualSignatory[] } | null {
  try {
    const raw = JSON.parse(text) as Partial<SignatoriesFile>;
    if (!raw || raw.kind !== "practicum-signatories") return null;
    return {
      people: cleanPeople(Array.isArray(raw.people) ? raw.people : []),
      signatories: cleanItems(Array.isArray(raw.signatories) ? raw.signatories : []).map((s) => ({ ...s, id: newSignatoryId() })),
    };
  } catch {
    return null;
  }
}

// ---- Paglilinis ng nabasang datos ----------------------------------------------------

const ALIGNS: SignAlign[] = ["left", "center", "right"];
const text = (v: unknown, max = 255) => (typeof v === "string" ? v.slice(0, max) : "");
const align = (v: unknown): SignAlign => (ALIGNS.includes(v as SignAlign) ? (v as SignAlign) : "left");

function cleanItems(list: unknown[]): ManualSignatory[] {
  return list.filter((x): x is Record<string, unknown> => !!x && typeof x === "object").slice(0, 50).map((x) => ({
    id: text(x.id, 40) || newSignatoryId(),
    label: text(x.label),
    name: text(x.name),
    position: text(x.position),
    align: align(x.align),
    dateLine: Boolean(x.dateLine),
  }));
}

function cleanPeople(list: unknown[]): SignatoryPerson[] {
  return list.filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
    .map((x) => ({ name: text(x.name), position: text(x.position), align: align(x.align) }))
    .filter((p) => p.name.trim())
    .slice(0, 200);
}
