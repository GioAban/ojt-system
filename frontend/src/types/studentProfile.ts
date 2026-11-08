import type { MaterialItem } from "@/types/requirements";

export interface StudentProfile {
  id: number;
  studentNumber: string;
  firstname: string;
  lastname: string;
  email: string;
  status: string;
  semester: string | null;
  coordinatorName: string | null;
  companyName: string | null;
  departmentName: string | null;
  renderedHours: number | null;
  trainingDuration: number | null;
  mustChangePassword: boolean;
  /** Nakilala na ang kasalukuyang bersyon ng Privacy Notice */
  privacyAcknowledged: boolean;
}

export interface StudentCompanyDepartment {
  id: number;
  name: string;
  slots: number;
  filled: number;
}

export interface StudentCompany {
  id: number;
  name: string;
  address: string;
  location: string | null;
  contactNumber: string;
  nature: string | null;
  departments: StudentCompanyDepartment[];
}

export interface StudentCompaniesData {
  status: string;
  canApply: boolean;
  companies: StudentCompany[];
}

export type WorkScope = "requirement" | "weekly" | "dtr";

/** Isang card sa Home: requirement, weekly report o DTR */
export interface WorkCard {
  scope: WorkScope;
  id: number;
  title: string;
  subtitle: string | null;
  type: string;
  instructions: string | null;
  dueDate: string | null;
  status: string;
  hasWork: boolean;
  /** Evaluation na isinara ng coordinator */
  closed: boolean;
  /** Sarado at walang ginawa ang student: "Not open yet" */
  locked: boolean;
  /** May laman lang sa Midterm at Final Evaluation; may sariling tab ang mga ito */
  systemKey: string | null;
}

export interface StudentHomeData {
  studentStatus: string;
  items: WorkCard[];
}

export interface SubmissionItem {
  id: number;
  kind: "FILE" | "LINK";
  name: string;
  url: string | null;
  sizeBytes: number | null;
}

export interface WorkDetail {
  scope: WorkScope;
  id: number;
  title: string;
  subtitle: string | null;
  type: string;
  instructions: string | null;
  dueDate: string | null;
  status: string;
  templateName: string | null;
  templateUrl: string | null;
  canEdit: boolean;
  canTurnIn: boolean;
  canUnsubmit: boolean;
  needsHours: boolean;
  hours: number | null;
  items: SubmissionItem[];
  closed: boolean;
  locked: boolean;
  canComment: boolean;
  /** Mga attachment ng coordinator */
  materials: MaterialItem[];
  systemKey: string | null;
}

export interface CommentItem {
  id: number;
  author: "STUDENT" | "COORDINATOR";
  authorName: string | null;
  body: string;
  createdAt: string;
  mine: boolean;
}

export interface NotificationItem {
  key: string;
  type: string;
  title: string;
  message: string | null;
  createdAt: string;
  unread: boolean;
  link: string | null;
}

export interface NotificationsData {
  unread: number;
  items: NotificationItem[];
}
