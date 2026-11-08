// Lahat ng uri ng report na maaaring gawin: pangalan, paliwanag, at paano bubuuin ang unang laman.

import { buildAnnualContent } from "@/lib/annualReport";
import { buildHteContent } from "@/lib/hteReport";
import { LIST_TEMPLATES, buildListContent, isListTemplate, templateInfo } from "@/lib/listTemplates";
import type { ReportSource, ReportType } from "@/types/reports";

export interface ReportTypeInfo {
  type: ReportType;
  title: string;
  description: string;
  group: "Official reports" | "Printable lists";
}

export const REPORT_TYPES: ReportTypeInfo[] = [
  {
    type: "annual",
    title: "Annual Report (Annex C)",
    description: "Summary of interns, issues and concerns, solutions and recommendations.",
    group: "Official reports",
  },
  {
    type: "hte-report",
    title: "Report on the List of HTEs and Student Interns (Annex D)",
    description: "Host training establishments with their student interns and the period of training.",
    group: "Official reports",
  },
  {
    type: "hte-list",
    title: "List of HTEs",
    description: "The same list of HTEs and students, without the period of training.",
    group: "Official reports",
  },
  ...LIST_TEMPLATES.map((type): ReportTypeInfo => ({ type, ...templateInfo(type), group: "Printable lists" })),
];

export const isReportType = (t: string): t is ReportType => REPORT_TYPES.some((r) => r.type === t);

export const reportTypeTitle = (t: ReportType) => REPORT_TYPES.find((r) => r.type === t)?.title ?? t;

/** Ang unang laman ng bagong report mula sa datos ng system */
export function buildReportContent(type: ReportType, source: ReportSource): unknown {
  if (type === "annual") return buildAnnualContent(source);
  if (isListTemplate(type)) return buildListContent(type, source);
  return buildHteContent(source);
}
