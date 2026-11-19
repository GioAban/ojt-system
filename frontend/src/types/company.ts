export interface DepartmentItem {
  id: number;
  name: string | null;
  slots: number;
  filled: number;
  supervisorFullname: string | null;
  supervisorPosition: string | null;
  supervisorContactNumber: string | null;
  supervisorEmail: string | null;
  status: string;
  moaStart: string | null;
  moaExpiration: string | null;
  archived: boolean;
  moaFiles: MoaFileItem[];
}

export interface CompanyItem {
  id: number;
  name: string;
  address: string;
  location: string | null;
  contactNumber: string;
  natureId: number | null;
  /** Ang ipinapakita: ang paliwanag kapag "Other" at may laman, kung hindi ang pangalan */
  nature: string | null;
  /** Paliwanag ng "Other" (para sa Edit); null kapag hindi Other o wala pa */
  natureOther: string | null;
  description: string | null;
  /** Immediate supervisor ng company; null kapag wala */
  supervisorName: string | null;
  supervisorPosition: string | null;
  supervisorContactNumber: string | null;
  supervisorEmail: string | null;
  idType: string | null;
  idNumber: string | null;
  archived: boolean;
  placed: number;
  slots: number;
  departments: DepartmentItem[];
  /** Skills na kailangan ng company (para sa pagtutugma sa students) */
  skills: string[];
}

export interface MoaFileItem {
  id: number;
  name: string;
  contentType: string;
  size: number;
  uploadedAt: string | null;
}

export interface NatureItem {
  id: number;
  name: string;
}

export interface CompaniesData {
  semesterId: number;
  companies: CompanyItem[];
  natures: NatureItem[];
}

/** Isang row ng Company & department list */
export interface ListingRow {
  key: string;
  company: CompanyItem;
  department: DepartmentItem | null;
}
