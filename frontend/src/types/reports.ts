// Mga naka-save na report ng coordinator: /api/coordinator/reports/saved

export type ListTemplate =
  | "list-students" | "list-per-hte" | "list-deployment" | "list-requirements" | "list-dtr" | "list-evaluation";

export type ReportType = "annual" | "hte-report" | "hte-list" | ListTemplate;

export interface Signatory {
  name: string;
  title: string;
}

export type SignatoryRole = "prepared" | "programHead" | "dean" | "chair";

export type SignatorySet = Record<SignatoryRole, Signatory>;

/** Mga binago ng coordinator; wala = gamitin ang default ng system */
export type SignatoryOverrides = Partial<Record<SignatoryRole, Partial<Signatory>>>;

export interface ReportContext {
  semesterId: number;
  semesterName: string;
  term: string;
  schoolYear: string;
  hei: string;
  address: string;
  collegeName: string;
  collegeAbbreviation: string;
  collegeLogoPath: string;
  programName: string;
  programAbbreviation: string;
  defaults: SignatorySet;
  /** JSON ng SignatoryOverrides, o null */
  savedSignatories: string | null;
}

export interface ReportStudent {
  id: number;
  lastname: string;
  firstname: string;
  middleInitial: string;
  program: string;
  year: string;
  gender: string;
  status: string;
  startDate: string;
  endDate: string;
  departmentId: number | null;
  companyId: number | null;
}

export interface ReportCompany {
  id: number;
  name: string;
  address: string;
}

export interface ReportDepartment {
  id: number;
  companyId: number;
  name: string;
  supervisor: string;
  supervisorPosition: string;
  slots: number;
  students: number;
}

export interface ReportData {
  students: ReportStudent[];
  companies: ReportCompany[];
  departments: ReportDepartment[];
}

export interface ListRequirement {
  id: number;
  title: string;
  /** initial, pre o post */
  type: string;
}

export type TrackingStatus = "ASSIGNED" | "FOR_CHECKING" | "CHECKED" | "INVALID";

export interface ListStudent {
  id: number;
  studentNumber: string;
  subjectCode: string;
  renderedHours: number | null;
  requiredHours: number | null;
  midtermStatus: TrackingStatus;
  midtermOpen: boolean;
  midtermStarted: boolean;
  /** Percent; kasama lang kapag Checked na */
  midtermScore: number | null;
  finalStatus: TrackingStatus;
  finalOpen: boolean;
  finalStarted: boolean;
  finalScore: number | null;
  /** requirement id -> status */
  requirementStatuses: Record<string, TrackingStatus>;
}

export interface ListData {
  requirements: ListRequirement[];
  students: ListStudent[];
}

/** Konteksto at datos mula sa system (iniimbak din sa device para magamit offline) */
export interface ReportSource {
  context: ReportContext;
  data: ReportData;
  lists: ListData;
}

export interface SavedReportSummary {
  id: number;
  type: ReportType;
  title: string;
  semesterId: number;
  clientUpdatedAt: number;
  lastEditedBy: string | null;
}

export interface SavedReportDetail extends SavedReportSummary {
  content: string;
  source: ReportSource;
}

export type FontSize = "small" | "normal" | "large";
export type Margins = "narrow" | "normal" | "wide";
export type Orientation = "landscape" | "portrait";
export type PaperKind = "long" | "a4";

export interface PageSettings {
  /** 0 = awtomatikong pagkasyahin */
  rowsPerPage: number;
  repeatHeader: boolean;
  pageNumbers: boolean;
  fontSize: FontSize;
  margins: Margins;
  orientation: Orientation;
  paper: PaperKind;
}

export const DEFAULT_PAGE_SETTINGS: PageSettings = {
  rowsPerPage: 0,
  repeatHeader: true,
  pageNumbers: true,
  fontSize: "normal",
  margins: "normal",
  orientation: "landscape",
  paper: "long",
};

// ---- Report 2 at 3: listahan ng HTE at mga student -----------------------

export interface HteStudent {
  id: string;
  /** Galing sa system; null kung idinagdag ng coordinator */
  studentId: number | null;
  name: string;
  program: string;
  gender: string;
  period: string;
  /** Department ng student mismo; blangko kung wala */
  department: string;
}

export interface HteGroup {
  id: string;
  /** Company sa system; null kung idinagdag ng coordinator o "No HTE yet" */
  companyId: number | null;
  /** Grupo ng mga student na wala pang company */
  noHte?: boolean;
  name: string;
  departments: string[];
  students: HteStudent[];
}

export interface HteContent {
  hei: string;
  address: string;
  degreeProgram: string;
  groups: HteGroup[];
  settings: PageSettings;
  /** Mga binago sa pamagat; wala = gamitin ang salita ng template (tugma pa rin sa mga lumang draft) */
  annexLabel?: string;
  titleLines?: string[];
  semesterLine?: string;
  /** Mga napiling column; wala = gaya ng template */
  columns?: string[];
}

export type HteVariant = "report" | "list";

// ---- Annual Report ---------------------------------------------------------

export interface AnnualSummaryRow {
  id: string;
  /** Susi ng pangkat: "all", o ang company at department; para mahanap ang halaga sa system */
  key: string;
  program: string;
  company: string;
  department: string;
  male: string;
  female: string;
  total: string;
  deployed: string;
  completed: string;
  htes: string;
  hours: string;
}

export interface AnnualIssue {
  id: string;
  issue: string;
  solution: string;
  recommendation: string;
}

export interface AnnualContent {
  annexLabel: string;
  titleLines: string[];
  semesterLine: string;
  hei: string;
  address: string;
  degreeProgram: string;
  summary: AnnualSummaryRow[];
  summaryColumns: string[];
  issues: AnnualIssue[];
  issueColumns: string[];
  settings: PageSettings;
}

// ---- Mga simpleng listahan -------------------------------------------------

export interface ListRow {
  id: string;
  /** Pangalan ng pangkat; blangko kung walang pangkat ang listahan */
  group: string;
  groupOrder: number;
  /** Mga record sa system; wala sa mga lumang kopya, kaya kailangan munang i-regenerate bago mag-apply */
  refs?: { studentId: number; departmentId: number | null };
  cells: Record<string, string>;
}

export interface ListContent {
  template: ListTemplate;
  /** column key -> napiling value; wala = lahat */
  filters: Record<string, string>;
  /** Mga column na ipinapakita */
  columns: string[];
  sort: { key: string; dir: "asc" | "desc" };
  headerText: string;
  footerText: string;
  /** Kopya ng datos noong binuo (lahat ng row, bago i-filter) para bumukas ito kung paano iniwan */
  rows: ListRow[];
  /** Mga binago sa report lang: row id -> column -> teksto */
  overrides: Record<string, Record<string, string>>;
  generatedAt: number;
  settings: PageSettings;
}
