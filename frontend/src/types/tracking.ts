export type RequirementType = "initial" | "pre" | "post";

export type TrackingStatus =
  | "ASSIGNED"
  | "FOR_CHECKING"
  | "CHECKED"
  | "INVALID";

export type JobRelated = "RELATED" | "SOMEWHAT_RELATED" | "UNRELATED";

export type EmployabilityLevel = "HIGH" | "AVERAGE" | "LOW";

export interface TrackingRequirement {
  id: number;
  title: string;
  dueDate: string | null;
}

export interface TrackingStudent {
  id: number;
  studentNumber: string;
  firstname: string;
  lastname: string;
  middleInitial: string | null;
  subjectCode: string;
  moaStatus: string | null;
  companyName: string | null;
  departmentName: string | null;
  status: string;
  completedDate: string | null;
  hiredDate: string | null;
  jobRelated: JobRelated | null;
  employabilityLevel: EmployabilityLevel | null;
  predictedLevel: EmployabilityLevel | null;
  predictionConfidence: number | null;
  predictedAt: string | null;
  statuses: Record<string, TrackingStatus>;
}

export type EvaluationKey = "MIDTERM_EVALUATION" | "FINAL_EVALUATION";

export interface EvaluationStudent {
  id: number;
  studentNumber: string;
  firstname: string;
  lastname: string;
  middleInitial: string | null;
  subjectCode: string;
  status: TrackingStatus;
  open: boolean;
}

export interface EvaluationTrackingData {
  semesterId: number;
  key: EvaluationKey;
  /** Null lang kung hindi pa ito nagawa para sa semester */
  requirement: TrackingRequirement | null;
  students: EvaluationStudent[];
}

export interface TrackingData {
  semesterId: number;
  type: RequirementType;
  requirements: TrackingRequirement[];
  students: TrackingStudent[];
}
