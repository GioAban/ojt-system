import { createContext, useContext } from "react";
import type { Semester } from "@/types/semester";

export interface SemesterContextValue {
  /** Mga hindi naka-archive na semester */
  semesters: Semester[];
  /** Ang napili sa top nav (default semester kung wala pang napipili) */
  semesterId: number | null;
  semester: Semester | null;
  setSemesterId: (id: number) => void;
  loaded: boolean;
  error: string;
  reload: () => void;
}

export const SemesterContext = createContext<SemesterContextValue | null>(null);

export function useSemester() {
  const value = useContext(SemesterContext);
  if (!value) {
    throw new Error("useSemester must be used inside <SemesterProvider>");
  }
  return value;
}
