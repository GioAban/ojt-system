import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

function BackLink() {
  return (
    <Link
      to="/coordinator/reports"
      className="mb-2 inline-flex items-center gap-1 py-1 text-sm text-muted-foreground hover:text-foreground pointer-coarse:py-2.5"
    >
      <ArrowLeft className="h-4 w-4" /> Reports
    </Link>
  );
}

/** Itaas ng editor: pabalik, pamagat, uri at semester (ang pamagat ay binabago sa sidebar, section na Report) */
export function ReportHeader({ title, typeLabel, semesterName }: {
  title: string;
  typeLabel: string;
  semesterName: string;
}) {
  return (
    <div className="mb-3">
      <BackLink />
      <h1 className="break-words text-lg font-semibold tracking-tight sm:text-xl">{title || typeLabel}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{typeLabel} · {semesterName}</p>
    </div>
  );
}

/** Habang naglo-load, may error, o nabura na ang report */
export function ReportLoadState({ gone, loadError, onRetry }: { gone: boolean; loadError: string; onRetry: () => void }) {
  if (gone) {
    return (
      <>
        <BackLink />
        <Alert>
          <AlertDescription>This report no longer exists. It may have been deleted on another device.</AlertDescription>
        </Alert>
      </>
    );
  }
  if (loadError) {
    return (
      <>
        <BackLink />
        <Alert variant="destructive">
          <AlertDescription className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            {loadError}
            <Button variant="outline" size="sm" onClick={onRetry}>Retry</Button>
          </AlertDescription>
        </Alert>
      </>
    );
  }
  return (
    <>
      <BackLink />
      <div className="flex flex-col gap-3" aria-busy="true" aria-label="Loading report">
        <Skeleton className="h-11 w-full rounded-xl" />
        <Skeleton className="h-[60vh] w-full rounded-xl" />
      </div>
    </>
  );
}
