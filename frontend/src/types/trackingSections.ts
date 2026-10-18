export type WeeklyRating = "EXCELLENT" | "VERY_GOOD" | "GOOD" | "POOR" | "NONE";

export interface WeeklyColumn {
  id: number;
  dateFrom: string;
  dateTo: string;
  dueDate: string | null;
}

export interface WeeklyStudent {
  id: number;
  studentNumber: string;
  firstname: string;
  lastname: string;
  middleInitial: string | null;
  subjectCode: string;
  ratings: Record<string, WeeklyRating>;
}

export interface WeeklyTrackingData {
  semesterId: number;
  columns: WeeklyColumn[];
  students: WeeklyStudent[];
}

export interface DtrColumn {
  id: number;
  month: string;
  dueDate: string | null;
}

export interface DtrStudent {
  id: number;
  studentNumber: string;
  firstname: string;
  lastname: string;
  middleInitial: string | null;
  subjectCode: string;
  startedDate: string | null;
  trainingDuration: number | null;
  hours: Record<string, number | null>;
}

export interface DtrTrackingData {
  semesterId: number;
  months: DtrColumn[];
  students: DtrStudent[];
}
