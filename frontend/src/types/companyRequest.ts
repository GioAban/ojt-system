export type RequestStatus = "pending" | "approved" | "declined";

export interface CompanyRequestRow {
  departmentId: number;
  status: RequestStatus;
  companyId: number;
  companyName: string;
  address: string;
  contactNumber: string;
  location: string | null;
  /** Bagong company ito (wala pang ibang department na galing sa coordinator) */
  newCompany: boolean;
  departmentName: string | null;
  slots: number;
  supervisorFullname: string | null;
  supervisorPosition: string | null;
  supervisorEmail: string | null;
  supervisorContactNumber: string | null;
  studentId: number | null;
  studentNumber: string | null;
  firstname: string | null;
  lastname: string | null;
  middleInitial: string | null;
  subjectCode: string | null;
  declineReason: string | null;
  reviewedAt: string | null;
}

export interface CompanyRequestsData {
  semesterId: number;
  accepting: boolean;
  pendingCount: number;
  requests: CompanyRequestRow[];
}
