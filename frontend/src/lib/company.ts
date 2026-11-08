import { parseIsoDate, todayIso } from "@/lib/dates";

export const PHONE_PATTERN = /^[0-9+()\-\s]{7,20}$/;
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
  if (contact && !PHONE_PATTERN.test(contact)) {
    errors.contact = "Use digits, spaces, +, -, or parentheses (7 to 20 characters).";
  }
  if (email && !EMAIL_PATTERN.test(email)) errors.email = "Enter a valid email address.";
  return errors;
}
