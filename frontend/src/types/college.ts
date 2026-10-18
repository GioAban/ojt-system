export interface College {
  id: number;
  name: string;
  abbreviation: string;
  dean: string;
  logo: string | null;
  isArchived: boolean;
  programsCount: number;
  createdAt: string | null;
  updatedAt: string | null;
}
