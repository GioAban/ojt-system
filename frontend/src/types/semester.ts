export interface Semester {
  id: number;
  semester: string;
  isDefault: boolean;
  isArchived: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}
