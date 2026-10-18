export type CoordinatorType = "ADMIN" | "STAFF";

export interface Coordinator {
  id: number;
  userId: number;
  fullname: string;
  email: string;
  programId: number;
  programName: string;
  programAbbreviation: string;
  programArchived: boolean;
  collegeAbbreviation: string;
  type: CoordinatorType;
  employeeNumber: string;
  professionalTitles: string | null;
  isArchived: boolean;
  studentsCount: number;
  createdAt: string | null;
}
