export interface Program {
  id: number;
  collegeId: number;
  collegeName: string;
  collegeAbbreviation: string;
  collegeArchived: boolean;
  name: string;
  abbreviation: string;
  trainingDuration: number;
  programHead: string;
  isArchived: boolean;
  coordinatorsCount: number;
  createdAt: string | null;
  updatedAt: string | null;
}
