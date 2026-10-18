import type { TrackingStatus } from "@/types/tracking";
import type { WeeklyRating } from "@/types/trackingSections";

export type RequirementKind = "document" | "weekly" | "dtr";

export interface RequirementStats {
  total: number;
  checked: number;
  forChecking: number;
  invalid: number;
}

export interface DocumentItem {
  id: number;
  title: string;
  instructions: string | null;
  dueDate: string | null;
  createdAt: string | null;
  archived: boolean;
  stats: RequirementStats;
}

export interface WeeklyItem {
  id: number;
  dateFrom: string;
  dateTo: string;
  dueDate: string | null;
  createdAt: string | null;
  archived: boolean;
  stats: RequirementStats;
}

export interface DtrItem {
  id: number;
  month: string;
  dueDate: string | null;
  createdAt: string | null;
  archived: boolean;
  stats: RequirementStats;
}

/** Attachment na inilagay ng coordinator sa requirement */
export interface MaterialItem {
  id: number;
  kind: "FILE" | "LINK";
  name: string;
  url: string | null;
  size: number | null;
  contentType: string | null;
}

/** Link na hindi pa nase-save */
export interface PendingLink {
  url: string;
  name: string;
}

export interface SubmissionFile {
  id: number;
  kind: "FILE" | "LINK";
  name: string;
  url: string | null;
}

export interface SubmissionStudent {
  studentId: number;
  studentNumber: string;
  firstname: string;
  lastname: string;
  middleInitial: string | null;
  status: TrackingStatus;
  files: SubmissionFile[];
  /** Weekly report lang */
  rating?: WeeklyRating | null;
  /** DTR lang */
  hours?: number | null;
  /** Weekly report lang: comment ng supervisor */
  comment?: string | null;
}

export interface SubmissionsData {
  kind?: RequirementKind;
  requirementId: number;
  title: string;
  instructions?: string | null;
  dueDate: string | null;
  archived: boolean;
  type?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  materials?: MaterialItem[];
  students: SubmissionStudent[];
}

export interface CommentItem {
  id: number;
  senderType: "COORDINATOR" | "COORDINATOR_STAFF" | "STUDENT";
  senderName: string;
  message: string;
  createdAt: string | null;
  mine: boolean;
}
