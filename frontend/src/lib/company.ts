import { parseIsoDate, todayIso } from "@/lib/dates";

/**
 * Contact number: malayang teksto (anumang format, puwedeng higit sa isang numero, hal. "0917 555 6666 / 0998 123 4567").
 * Ang tanging tseke: haba (at may laman kung kailangan). Trim lang ang ginagawa sa server.
 */
export const CONTACT_MAX = 255;
export const CONTACT_HINT = "You can enter more than one number.";
export const CONTACT_TOO_LONG = `Keep it under ${CONTACT_MAX} characters.`;

/** null = walang mali. required: kailangang may laman. */
export function contactError(v: string, required = false, emptyMessage = "Enter a contact number.") {
  const t = v.trim();
  if (!t) return required ? emptyMessage : null;
  return t.length > CONTACT_MAX ? CONTACT_TOO_LONG : null;
}

/**
 * Nature of business: kapag "Other", kailangan ang paliwanag (max 100). Hindi ito idinadagdag sa listahan.
 */
export const NATURE_OTHER_MAX = 100;
export const NATURE_OTHER_LABEL = "Please specify the nature of business";

export function isOtherNature(natures: { id: number; name: string }[], natureId: string | number | null | undefined) {
  if (natureId === null || natureId === undefined || natureId === "") return false;
  const n = natures.find((x) => String(x.id) === String(natureId));
  return Boolean(n && n.name.trim().toLowerCase() === "other");
}

export function natureOtherError(isOther: boolean, v: string) {
  if (!isOther) return null;
  const t = v.trim();
  if (!t) return "Please specify the nature of business.";
  return t.length > NATURE_OTHER_MAX ? `Keep it under ${NATURE_OTHER_MAX} characters.` : null;
}

export const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export type MoaState = "none" | "expired" | "soon" | "valid";

/** Kalagayan ng MOA: expired, malapit nang mag-expire (30 araw), o valid pa */
export function moaState(expiration: string | null): MoaState {
  if (!expiration) return "none";

  const end = parseIsoDate(expiration.slice(0, 10));
  if (Number.isNaN(end.getTime())) return "none";

  const today = parseIsoDate(todayIso());
  const days = Math.round((end.getTime() - today.getTime()) / 86_400_000);

  if (days < 0) return "expired";
  if (days <= 30) return "soon";
  return "valid";
}

export function isApproved(status: string) {
  return status.trim().toUpperCase() === "APPROVED";
}

/**
 * Pinagsasaluhang tseke ng supervisor (company at department).
 * Lahat opsyonal; kapag may pangalan, kailangan ang posisyon, at baliktad.
 * Ibinabalik ang mga error na naka-key sa "name", "position", "contact" at "email".
 */
export interface SupervisorValue {
  name: string;
  position: string;
  contact: string;
  email: string;
}

export type SupervisorErrors = Partial<Record<keyof SupervisorValue, string>>;

export const EMPTY_SUPERVISOR: SupervisorValue = { name: "", position: "", contact: "", email: "" };

/** May laman ba kahit isang field ng supervisor */
export function hasSupervisor(s: SupervisorValue) {
  return Boolean(s.name.trim() || s.position.trim() || s.contact.trim() || s.email.trim());
}

/** Itinuturing na blangko ang lumang placeholder na "N/A" */
export function cleanSupervisorText(v: string | null | undefined) {
  const t = (v ?? "").trim();
  return t.toUpperCase() === "N/A" ? "" : t;
}

/**
 * Inaalis ang error ng field na binago. Magkapares ang pangalan at posisyon, kaya parehong inaalis.
 */
export function clearSupervisorError(errors: SupervisorErrors, key: keyof SupervisorValue): SupervisorErrors {
  const next = { ...errors };
  delete next[key];
  if (key === "name" || key === "position") {
    delete next.name;
    delete next.position;
  }
  return next;
}

export function validateSupervisor(s: SupervisorValue): SupervisorErrors {
  const errors: SupervisorErrors = {};
  const name = s.name.trim();
  const position = s.position.trim();
  const contact = s.contact.trim();
  const email = s.email.trim();

  if (name && !position) errors.position = "Enter the supervisor's position.";
  if (!name && position) errors.name = "Enter the supervisor's name.";
  const contactProblem = contactError(contact);
  if (contactProblem) errors.contact = contactProblem;
  if (email && !EMAIL_PATTERN.test(email)) errors.email = "Enter a valid email address.";
  return errors;
}

/** Immediate supervisor ng company: kailangan lahat (pangalan, posisyon, contact number at email), may format */
export function validateSupervisorRequired(s: SupervisorValue): SupervisorErrors {
  const errors: SupervisorErrors = {};
  if (!s.name.trim()) errors.name = "Enter the immediate supervisor's name.";
  if (!s.position.trim()) errors.position = "Enter the immediate supervisor's position.";
  const contactProblem = contactError(s.contact, true, "Enter the immediate supervisor's contact number.");
  if (contactProblem) errors.contact = contactProblem;
  if (!s.email.trim()) errors.email = "Enter the immediate supervisor's email.";
  else if (!EMAIL_PATTERN.test(s.email.trim())) errors.email = "Enter a valid email address.";
  return errors;
}

/**
 * Ang ipinapakitang sariling supervisor ng department (null = ang immediate supervisor ng company ang gamit).
 * Kapareho ng SupervisorResolver: ang N/A ay walang sariling supervisor, maliban sa lumang datos kapag walang
 * immediate supervisor ang company.
 */
export function ownDepartmentSupervisor<D extends { name: string | null; supervisorFullname: string | null }>(
  company: { supervisorName: string | null },
  d: D,
): D | null {
  const own = cleanSupervisorText(d.supervisorFullname);
  if (!own) return null;
  const na = !d.name || !d.name.trim() || d.name.trim().toUpperCase() === "N/A";
  if (na && cleanSupervisorText(company.supervisorName)) return null;
  return d;
}

/** Wala o kulang ang immediate supervisor ng company (para sa badge na "Supervisor info missing") */
export function supervisorMissing(c: { supervisorName: string | null; supervisorPosition: string | null; supervisorContactNumber: string | null; supervisorEmail: string | null }) {
  const blank = (v: string | null) => !v || !v.trim() || v.trim().toUpperCase() === "N/A";
  return blank(c.supervisorName) || blank(c.supervisorPosition) || blank(c.supervisorContactNumber) || blank(c.supervisorEmail);
}
