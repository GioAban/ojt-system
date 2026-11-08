// Laman ng GET /api/coordinator/dashboard?semesterId=

export interface DashboardCount {
  label: string;
  count: number;
}

export interface AttentionRow {
  id: number;
  name: string;
  overall: number;
  reasons: string[];
}

export interface AlmostDoneRow {
  id: number;
  name: string;
  overall: number;
  /** null kapag walang training duration */
  remainingHours: number | null;
}

export interface UnassignedRow {
  id: number;
  name: string;
  status: string;
}

export interface InactiveRow {
  id: number;
  name: string;
  status: string;
  /** null = wala pang activity */
  lastActivity: string | null;
}

export interface Timeliness {
  onTime: number;
  late: number;
  missing: number;
  notYetDue: number;
}

export interface MissingItem {
  kind: "requirement" | "dtr";
  title: string;
  missing: number;
}

export interface CoordinatorDashboard {
  semester: { id: number; name: string };
  generatedAt: string;
  totals: { students: number; companies: number; departments: number };
  averageProgress: number;
  needsAttention: AttentionRow[];
  needsAttentionCount: number;
  almostDone: AlmostDoneRow[];
  almostDoneCount: number;
  unassigned: UnassignedRow[];
  deployment: { assigned: number; unassigned: number };
  inactive: InactiveRow[];
  inactiveCount: number;
  gender: DashboardCount[];
  status: DashboardCount[];
  progressBuckets: DashboardCount[];
  topCompanies: { id: number; name: string; students: number; departments: number }[];
  submissions: { requirements: Timeliness; dtr: Timeliness; mostMissing: MissingItem[] };
  hours: {
    rendered: number;
    required: number;
    studentsWithoutDuration: number;
    withoutDuration: { id: number; name: string }[];
  };
  employability: DashboardCount[];
}
