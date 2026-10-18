import type { TrackingStatus } from "@/types/tracking";
import type { DtrColumn, WeeklyColumn } from "@/types/trackingSections";

export type ReviewKind = "weekly" | "dtr" | "requirement";

export type ReviewRating = "EXCELLENT" | "VERY_GOOD" | "GOOD" | "POOR";

/** Isang cell: status, evaluation (weekly), hours (DTR) */
export interface ReviewCell {
  status: TrackingStatus;
  rating: ReviewRating | null;
  hours: number | null;
  hasFile: boolean;
}

interface ReviewStudentBase {
  id: number;
  studentNumber: string;
  firstname: string;
  lastname: string;
  middleInitial: string | null;
  subjectCode: string;
}

export interface WeeklyReviewStudent extends ReviewStudentBase {
  cells: Record<string, ReviewCell>;
}

export interface WeeklyReviewData {
  semesterId: number;
  columns: WeeklyColumn[];
  students: WeeklyReviewStudent[];
}

export interface DtrReviewStudent extends ReviewStudentBase {
  startDate: string | null;
  trainingDuration: number | null;
  renderedHours: number | null;
  cells: Record<string, ReviewCell>;
}

export interface DtrReviewData {
  semesterId: number;
  columns: DtrColumn[];
  students: DtrReviewStudent[];
}

export interface CellDetail {
  status: TrackingStatus;
  rating: ReviewRating | null;
  hours: number | null;
  files: string[];
  updatedAt: string | null;
}

export interface CellResult {
  cell: ReviewCell;
  renderedHours: number | null;
}
