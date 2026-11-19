export interface CompanyInfoRow {
  id: number;
  studentNumber: string;
  firstname: string;
  lastname: string;
  middleInitial: string | null;
  subjectCode: string;
  companyId: number;
  companyName: string;
  departmentId: number;
  departmentName: string | null;
  address: string | null;
  contactNumber: string | null;
  location: string | null;
  supervisorName: string | null;
  supervisorPosition: string | null;
  startDate: string | null;
  /** Saan isusulat ang pagbabago ng supervisor: sariling supervisor ng department, o immediate supervisor ng company */
  supervisorEditTarget: "department" | "company";
}

export interface CompanyInfoData {
  semesterId: number;
  students: CompanyInfoRow[];
}

export interface CompanyInfoEditResult {
  value: string | null;
  affected: number;
}
