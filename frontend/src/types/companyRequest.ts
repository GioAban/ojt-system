export type RequestStatus = "pending" | "approved" | "declined";

export interface CompanyRequestRow {
  departmentId: number;
  status: RequestStatus;
  companyId: number;
  companyName: string;
  address: string;
  contactNumber: string;
  location: string | null;
  /** Bagong company ito (wala pang ibang department na galing sa coordinator) */
  newCompany: boolean;
  departmentName: string | null;
  slots: number;
  supervisorFullname: string | null;
  supervisorPosition: string | null;
  supervisorEmail: string | null;
  supervisorContactNumber: string | null;
  studentId: number | null;
  studentNumber: string | null;
  firstname: string | null;
  lastname: string | null;
  middleInitial: string | null;
  subjectCode: string | null;
  declineReason: string | null;
  reviewedAt: string | null;
  /** student | company_link | coordinator */
  source: string;
  /** Kailan pumayag ang company sa Data Privacy Notice (company_link lang) */
  consentAt: string | null;
}

export interface CompanyRequestsData {
  semesterId: number;
  accepting: boolean;
  /** Hiling ng student at hiling mula sa company link na naghihintay */
  pendingCount: number;
  requests: CompanyRequestRow[];
  /** Hiling mula sa company link: isa bawat company */
  linkRequests: LinkRequest[];
  natures: { id: number; name: string }[];
}

export interface LinkMoaFile {
  id: number;
  name: string;
  contentType: string;
  size: number;
}

export interface LinkDepartment {
  id: number;
  name: string;
  /** Ang N/A na department (walang department ang company) */
  na: boolean;
  slots: number;
  supervisorFullname: string | null;
  supervisorPosition: string | null;
  supervisorContactNumber: string | null;
  supervisorEmail: string | null;
  moaStart: string | null;
  moaExpiration: string | null;
  status: string;
  declineReason: string | null;
  moaFiles: LinkMoaFile[];
}

export interface LinkDuplicate {
  id: number;
  name: string;
  /** "company" = nasa listahan (puwedeng i-merge); "request" = ibang hiling na naghihintay */
  kind: "company" | "request";
}

export type LinkRequestStatus = "pending" | "approved" | "rejected" | "merged";

export interface LinkRequest {
  companyId: number;
  status: LinkRequestStatus;
  reason: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  companyName: string;
  natureId: number | null;
  nature: string | null;
  /** Paliwanag ng "Other" (para sa Edit); ang "nature" ay ang ipinapakita */
  natureOther: string | null;
  address: string;
  location: string | null;
  contactNumber: string;
  description: string | null;
  supervisorName: string | null;
  supervisorPosition: string | null;
  supervisorContactNumber: string | null;
  supervisorEmail: string | null;
  idType: string | null;
  idNumber: string | null;
  hasDepartments: boolean;
  departments: LinkDepartment[];
  /** Skills na tinype ng company; papasok lang sa catalog kapag na-approve o na-merge */
  skills: string[];
  consentAt: string | null;
  privacyVersion: string | null;
  duplicates: LinkDuplicate[];
}

/** Isang department sa form (public at review). Sa N/A, hindi ginagamit ang name. */
export interface LinkDepartmentForm {
  id: number | null;
  name: string;
  slots: string;
  supervisorFullname: string;
  supervisorPosition: string;
  supervisorContactNumber: string;
  supervisorEmail: string;
  moaStart: string;
  moaExpiration: string;
}

export function emptyLinkDepartment(): LinkDepartmentForm {
  return {
    id: null, name: "", slots: "1", supervisorFullname: "", supervisorPosition: "",
    supervisorContactNumber: "", supervisorEmail: "", moaStart: "", moaExpiration: "",
  };
}

/** Ang ipinapadala sa server (public na form at pag-edit ng coordinator) */
export function linkDepartmentPayload(d: LinkDepartmentForm) {
  return {
    id: d.id,
    name: d.name,
    slots: d.slots.trim() === "" ? null : Number(d.slots),
    supervisorFullname: d.supervisorFullname,
    supervisorPosition: d.supervisorPosition,
    supervisorContactNumber: d.supervisorContactNumber,
    supervisorEmail: d.supervisorEmail,
    moaStart: d.moaStart || null,
    moaExpiration: d.moaExpiration || null,
  };
}
