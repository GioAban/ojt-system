export interface DepartmentOption {
  id: number;
  name: string | null;
  slots: number;
  filled: number;
  current: boolean;
  supervisorFullname: string | null;
  supervisorPosition: string | null;
  supervisorContactNumber: string | null;
  supervisorEmail: string | null;
  status: string;
  moaStart: string | null;
  moaExpiration: string | null;
}

export interface CompanyOption {
  id: number;
  name: string;
  address: string;
  location: string | null;
  contactNumber: string;
  nature: string | null;
  description: string | null;
  supervisorName: string;
  supervisorPosition: string;
  departments: DepartmentOption[];
}

export interface AssignmentResult {
  departmentId: number;
  departmentName: string | null;
  companyName: string;
}
