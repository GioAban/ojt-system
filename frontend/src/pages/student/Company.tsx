import { useCallback, useEffect, useState, type ElementType, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, Compass, Layers, RefreshCw, UserRound } from "lucide-react";
import api from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Galing sa /student/company/mine. Ang supervisor ay ang sa department, o ang immediate supervisor
 * ng company kapag wala (SupervisorResolver sa server). Ang N/A na department ay "N/A" na mula sa server.
 */
interface MyCompany {
  assigned: boolean;
  companyName: string | null;
  departmentName: string | null;
  supervisorFullname: string | null;
}

const NOT_PROVIDED = "Not provided yet";

function clean(v: string | null | undefined) {
  return v && v.trim() ? v.trim() : null;
}

/** Hanggang dalawang letra mula sa pangalan ng company (hindi pinapansin ang Inc., Corp., atbp.) */
function monogram(name: string | null) {
  const skip = new Set(["inc", "inc.", "corp", "corp.", "co", "co.", "ltd", "ltd.", "the", "of", "and", "&"]);
  const words = (name ?? "")
    .split(/\s+/)
    .map((w) => w.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter((w) => w && !skip.has(w.toLowerCase()));
  const letters = words.length >= 2 ? words[0][0] + words[1][0] : (words[0] ?? "").slice(0, 2);
  return letters.toUpperCase() || "?";
}

/** Maliit na label + icon sa itaas ng malaking halaga */
function Eyebrow({ icon: Icon, children, className }: { icon: ElementType; children: ReactNode; className?: string }) {
  return (
    <p className={cn("flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground", className)}>
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {children}
    </p>
  );
}

/** Halagang malaki; "Not provided yet" kapag wala */
function BigValue({ value, className }: { value: string | null; className?: string }) {
  if (!value) {
    return <p className="text-xl font-medium text-muted-foreground/80 italic sm:text-2xl">{NOT_PROVIDED}</p>;
  }
  return (
    <p className={cn("font-semibold leading-tight tracking-tight text-pretty break-words [overflow-wrap:anywhere] hyphens-auto", className)}>
      {value}
    </p>
  );
}

function HeroSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading your company" className="overflow-hidden rounded-3xl border bg-card">
      <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:p-10">
        <div className="flex flex-col items-center gap-4 text-center lg:items-start lg:text-left">
          <Skeleton className="h-20 w-20 rounded-full sm:h-24 sm:w-24" />
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-10 w-4/5 sm:h-12" />
          <Skeleton className="h-10 w-3/5 sm:h-12" />
        </div>
        <div className="flex flex-col gap-4">
          {[0, 1].map((i) => (
            <div key={i} className="flex flex-col items-center gap-3 rounded-2xl border p-5 lg:items-start">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-8 w-3/4" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function StudentMyCompany() {
  const [data, setData] = useState<MyCompany | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    api
      .get<MyCompany>("/student/company/mine")
      .then((res) => {
        if (cancelled) return;
        setData(res.data);
        setError("");
        try {
          localStorage.setItem("has_company", String(res.data.assigned));
        } catch {
          // hindi kritikal
        }
      })
      .catch((err) => !cancelled && setError(getErrorMessage(err, "Couldn't load your company.")));
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const retry = useCallback(() => {
    setError("");
    setAttempt((n) => n + 1);
  }, []);

  const company = clean(data?.companyName);
  const department = clean(data?.departmentName);
  const supervisor = clean(data?.supervisorFullname);

  return (
    <DashboardLayout>
      <div className="mx-auto w-full max-w-5xl">
        <h1 className="sr-only">My Company</h1>

        {error && (
          <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed px-6 py-14 text-center">
            <p className="text-sm text-destructive">{error}</p>
            <Button type="button" variant="outline" size="sm" onClick={retry}>
              <RefreshCw className="h-4 w-4" /> Try again
            </Button>
          </div>
        )}

        {!data && !error && <HeroSkeleton />}

        {data && !data.assigned && (
          <div className="flex flex-col items-center gap-4 rounded-3xl border border-dashed bg-card px-6 py-16 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Compass className="h-8 w-8" aria-hidden="true" />
            </span>
            <div className="max-w-sm">
              <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">No company yet</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Once your coordinator places you, your company, department and supervisor will show up here.
              </p>
            </div>
            <Button type="button" onClick={() => navigate("/student/companies")}>
              Browse companies
            </Button>
          </div>
        )}

        {data && data.assigned && (
          <div>
            {/* Hero: company, department, supervisor */}
            <section
              aria-label="Your OJT placement"
              className="relative overflow-hidden rounded-3xl border bg-card shadow-sm"
            >
              {/* Malambot na gradient mula sa kulay ng theme (gumagana sa light at dark) */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent"
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-primary/10 blur-3xl"
              />

              <div className="relative grid gap-8 p-6 sm:p-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:items-center lg:gap-10 lg:p-10">
                {/* Company */}
                <div className="flex min-w-0 flex-col items-center gap-4 text-center lg:items-start lg:text-left">
                  <span
                    aria-hidden="true"
                    className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-primary text-2xl font-bold tracking-tight text-primary-foreground shadow-md ring-4 ring-background sm:h-24 sm:w-24 sm:text-3xl"
                  >
                    {monogram(company)}
                  </span>
                  <div className="flex min-w-0 max-w-full flex-col items-center gap-2 lg:items-start">
                    <Eyebrow icon={Building2}>Company</Eyebrow>
                    <BigValue value={company} className="text-3xl sm:text-4xl lg:text-5xl" />
                  </div>
                </div>

                {/* Department at supervisor */}
                <div className="flex min-w-0 flex-col gap-3 sm:gap-4">
                  <div className="flex min-w-0 flex-col items-center gap-2 rounded-2xl border bg-background/70 p-5 text-center backdrop-blur-sm sm:p-6 lg:items-start lg:text-left">
                    <Eyebrow icon={Layers}>Department</Eyebrow>
                    <BigValue value={department} className="text-2xl sm:text-3xl" />
                  </div>
                  <div className="flex min-w-0 flex-col items-center gap-2 rounded-2xl border bg-background/70 p-5 text-center backdrop-blur-sm sm:p-6 lg:items-start lg:text-left">
                    <Eyebrow icon={UserRound}>Supervisor</Eyebrow>
                    <BigValue value={supervisor} className="text-2xl sm:text-3xl" />
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
