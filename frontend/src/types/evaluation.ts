import type { SubmissionFile } from "@/types/requirements";
import type { TrackingStatus } from "@/types/tracking";

export interface EvaluationCriterion {
  id: number;
  category: string | null;
  name: string;
  /** Final lang: bahagi nito sa 100 */
  weight: number | null;
  score: number | null;
}

export interface EvaluationFormData {
  key: "MIDTERM_EVALUATION" | "FINAL_EVALUATION";
  info: {
    studentName: string;
    course: string | null;
    companyName: string | null;
    companyAddress: string | null;
    department: string | null;
    semester: string | null;
  };
  criteria: EvaluationCriterion[];
  strongPoints: string | null;
  needsImprovement: string | null;
  discussed: boolean;
  supervisorName: string | null;
  supervisorPosition: string | null;
  date: string | null;
  periodFrom: string | null;
  periodTo: string | null;
  contactNo: string | null;
  originalScore: number;
  normalizedScore: number;
  editedBy: string | null;
  editedAt: string | null;
  editable: boolean;
}

export interface EvaluationReviewData {
  form: EvaluationFormData;
  status: TrackingStatus;
  files: SubmissionFile[];
}
