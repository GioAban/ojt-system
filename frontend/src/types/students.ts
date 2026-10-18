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

export interface ImportRow {
  line: number;
  studentNumber: string;
  lastname: string;
  firstname: string;
  middleInitial: string | null;
  gender: string;
  year: string | null;
  course: string | null;
  errors: string[];
}

export interface ImportPreview {
  total: number;
  valid: number;
  invalid: number;
  rows: ImportRow[];
}

export interface ImportCommitResult {
  created: number;
  skipped: number;
  errors: { line: number; message: string }[];
}

export interface EnrollmentLinkState {
  exists: boolean;
  token: string | null;
  open: boolean;
  dueDate: string | null;
  active: boolean;
  registered: number;
  total: number;
  pending: number;
}

export type AccountStatus = "pending" | "active" | "none";

/** Isang row sa Accounts tab */
export interface AccountRow {
  studentId: number;
  requestId: number | null;
  studentNumber: string;
  lastname: string;
  firstname: string;
  middleInitial: string | null;
  year: string | null;
  email: string | null;
  status: AccountStatus;
  requestedAt: string | null;
  mustChangePassword: boolean;
}

export interface AcceptAllResult {
  accepted: number;
  skipped: number;
}

/** temporaryPassword = default password (ID + initials) */
export interface ApprovalResult {
  studentId: number;
  name: string;
  email: string;
  temporaryPassword: string;
}
