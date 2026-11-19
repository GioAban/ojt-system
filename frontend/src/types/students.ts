export interface StudentRow {
  id: number;
  studentNumber: string;
  lastname: string;
  firstname: string;
  middleInitial: string | null;
  gender: string;
  year: string | null;
  contact: string | null;
  email: string | null;
  birthday: string | null;
  address: string | null;
  subjectCode: string;
  status: string;
  archived: boolean;
  companyName: string | null;
  departmentName: string | null;
  registered: boolean;
}

export interface StudentListData {
  semesterId: number;
  programName: string | null;
  programAbbreviation: string | null;
  students: StudentRow[];
}

export interface StudentDetail {
  student: StudentRow;
  parent: string | null;
  guardian: string | null;
  moaStatus: string | null;
  deployedDate: string | null;
  startTrainingDate: string | null;
  completedDate: string | null;
  renderedHours: number | null;
  trainingDuration: number | null;
  companyAddress: string | null;
  supervisorName: string | null;
  supervisorPosition: string | null;
  employabilityLevel: string | null;
  requirements: Record<string, number>;
}

export interface StudentForm {
  studentNumber: string;
  lastname: string;
  firstname: string;
  middleInitial: string;
  gender: string;
  year: string;
  course: string;
}

/** Bilang ng registration bawat status */
export interface EnrollmentLinkState {
  exists: boolean;
  token: string | null;
  open: boolean;
  dueDate: string | null;
  active: boolean;
  pending: number;
  verified: number;
  rejected: number;
  total: number;
  /** "Also require my approval" */
  requireApproval: boolean;
  /** Hindi pa na-verify ang email */
  awaitingEmail: number;
  revoked: number;
}

/**
 * EMAIL_PENDING = hinihintay ang link sa email; PENDING = hinihintay ang approval ng coordinator;
 * VERIFIED = may account na; REJECTED; REVOKED = inalis ang account
 */
export type RegistrationStatus = "EMAIL_PENDING" | "PENDING" | "VERIFIED" | "REJECTED" | "REVOKED";

/** Isang row sa Pending registrations tab */
export interface RegistrationRow {
  id: number;
  studentNumber: string;
  lastname: string;
  firstname: string;
  middleInitial: string | null;
  year: string | null;
  gender: string;
  course: string;
  email: string;
  status: RegistrationStatus;
  rejectReason: string | null;
  createdAt: string | null;
  decidedAt: string | null;
  /** Na-verify ng student ang email (false sa mga registration bago nagkaroon ng email) */
  emailVerified: boolean;
  /** Kailan huling naipadala ang verification link */
  linkSentAt: string | null;
  /** Ang account na nagawa (para sa Revoke) */
  studentId: number | null;
}

export interface BulkResult {
  done: number;
  skipped: number;
  problems: string[];
}

/** temporaryPassword = default password (ID + initials) */
export interface ApprovalResult {
  studentId: number;
  name: string;
  email: string;
  temporaryPassword: string;
}
