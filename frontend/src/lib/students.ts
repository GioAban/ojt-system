import { PHONE_PATTERN } from "@/lib/company";
import type { StudentForm, StudentRow } from "@/types/students";

export const YEARS = [
  "1st Year",
  "2nd Year",
  "3rd Year",
  "4th Year",
  "5th Year",
] as const;
export const GENDERS = ["Male", "Female"] as const;

export const EMPTY_FORM: StudentForm = {
  studentNumber: "",
  lastname: "",
  firstname: "",
  middleInitial: "",
  gender: "",
  year: "",
  course: "",
};

const NUMBER = /^[A-Za-z0-9][A-Za-z0-9\-/]{2,49}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function required(label: string) {
  return (v: string) => (v.trim() ? null : `${label} is required.`);
}

export function validNumber(v: string) {
  if (!v.trim()) return "Student number is required.";
  return NUMBER.test(v.trim())
    ? null
    : "Use letters, numbers, - or / (3 to 50 characters).";
}

export function validEmail(v: string) {
  if (!v.trim()) return "Email is required.";
  return EMAIL.test(v.trim()) ? null : "Enter a valid email.";
}

export function validOptionalPhone(v: string) {
  if (!v.trim()) return null;
  return PHONE_PATTERN.test(v.trim())
    ? null
    : "Use digits, spaces, +, -, or parentheses (7 to 20 characters).";
}

/** Nagbabalik ng error bawat field para sa add form */
export function validateForm(f: StudentForm): Partial<Record<keyof StudentForm, string>> {
  const e: Partial<Record<keyof StudentForm, string>> = {};
  const n = validNumber(f.studentNumber);
  if (n) e.studentNumber = n;
  if (!f.lastname.trim()) e.lastname = "Required.";
  if (!f.firstname.trim()) e.firstname = "Required.";
  if (!f.gender) e.gender = "Required.";
  return e;
}

export function fullName(s: Pick<StudentRow, "lastname" | "firstname" | "middleInitial">) {
  const mi = s.middleInitial ? ` ${s.middleInitial}.` : "";
  return `${s.lastname}, ${s.firstname}${mi}`;
}

/** Default password: Student ID + unang letra ng last name + huling letra ng first name (lowercase) */
export function defaultPassword(studentNumber: string, lastname: string, firstname: string) {
  const letters = (v: string) => Array.from(v).filter((c) => c.toLowerCase() !== c.toUpperCase());
  const last = letters(lastname)[0] ?? "";
  const first = letters(firstname).slice(-1)[0] ?? "";
  return `${studentNumber.trim()}${last}${first}`.toLowerCase();
}

export const DEFAULT_PASSWORD_RULE =
  "Student ID + first letter of the last name + last letter of the first name, all lowercase (example: 2021-00123dn).";
