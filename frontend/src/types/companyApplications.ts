export type AppStatus = "pending" | "accepted" | "declined" | "cancelled";

export interface StudentApplication {
  id: number;
  departmentId: number;
  companyName: string;
  departmentName: string;
  status: AppStatus;
  declineReason: string | null;
  createdAt: string;
}

export interface StudentRequest {
  departmentId: number;
  companyName: string;
  departmentName: string;
  status: "pending" | "approved" | "declined";
  declineReason: string | null;
  createdAt: string | null;
}

export interface CompanyOverview {
  status: string;
  canApply: boolean;
  accepting: boolean;
  deployed: boolean;
  deployedCompany: string | null;
  deployedDepartment: string | null;
  maxApplications: number;
  applications: StudentApplication[];
  requests: StudentRequest[];
}

export interface MatchDepartment {
  id: number;
  name: string;
  status: string;
}

export interface MatchCompany {
  companyId: number;
  name: string;
  address: string;
  listed: boolean;
  sameDepartment: boolean;
  departments: MatchDepartment[];
}

export interface CheckResult {
  matches: MatchCompany[];
  exactDuplicate: boolean;
}

export interface CoordinatorApplication {
  id: number;
  status: AppStatus;
  createdAt: string;
  reviewedAt: string | null;
  declineReason: string | null;
  studentId: number;
  studentNumber: string;
  firstname: string;
  lastname: string;
  middleInitial: string | null;
  subjectCode: string | null;
  studentStatus: string | null;
  companyId: number;
  companyName: string;
  departmentName: string;
  slots: number;
  filled: number;
}

export interface CoordinatorApplicationsData {
  pendingCount: number;
  applications: CoordinatorApplication[];
}
