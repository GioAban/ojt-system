import { Navigate, useParams } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { AnnualEditor } from "@/components/reports/AnnualEditor";
import { HteEditor } from "@/components/reports/HteEditor";
import { ListBuilder } from "@/components/reports/ListBuilder";
import { isListTemplate } from "@/lib/listTemplates";
import { isReportType } from "@/lib/reportCatalog";

/** Bubuksan ang editor ng napiling naka-save na report; ang lumang link na walang id ay babalik sa Reports */
export default function ReportEditor() {
  const { type, id } = useParams();
  const reportId = Number(id);
  if (!type || !isReportType(type) || !Number.isInteger(reportId) || reportId <= 0) {
    return <Navigate to="/coordinator/reports" replace />;
  }
  // key: bagong editor kapag lumipat sa ibang report
  return (
    <DashboardLayout>
      {type === "annual" && <AnnualEditor key={reportId} reportId={reportId} />}
      {(type === "hte-report" || type === "hte-list") && (
        <HteEditor key={reportId} reportId={reportId} variant={type === "hte-report" ? "report" : "list"} />
      )}
      {isListTemplate(type) && <ListBuilder key={reportId} reportId={reportId} template={type} />}
    </DashboardLayout>
  );
}
