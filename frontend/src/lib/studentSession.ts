import type { StudentProfile } from "@/types/studentProfile";

/** Alalahanin kung sino ang nakapag-verify na hindi na kailangang magpalit ng password */
export function passwordKey() {
  return `pw_ok:${localStorage.getItem("email") ?? ""}`;
}

export function markPasswordOk() {
  try {
    sessionStorage.setItem(passwordKey(), "1");
  } catch {
    // walang storage: titingnan na lang ulit
  }
}

export function isPasswordOk() {
  try {
    return sessionStorage.getItem(passwordKey()) === "1";
  } catch {
    return false;
  }
}

/** Itinatabi ang kailangan ng sidebar (anong mga link ang ipapakita) */
export function rememberProfile(p: StudentProfile) {
  try {
    localStorage.setItem("student_status", p.status ?? "");
    localStorage.setItem("has_company", String(Boolean(p.companyName)));
  } catch {
    // hindi kritikal
  }
}
