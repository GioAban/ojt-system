import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  BadgeCheck,
  Briefcase,
  Building,
  Building2,
  CalendarClock,
  Clock,
  FileWarning,
  Moon,
  PieChart,
  RefreshCw,
  TrendingUp,
  UserX,
  Users,
} from "lucide-react";
import api from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { useSemester } from "@/contexts/semesterContext";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Section, StatCard, EmptyNote } from "@/components/dashboard/Section";
import { StudentList } from "@/components/dashboard/StudentList";
import { BarList, Meter, StackedBar, type Segment } from "@/components/dashboard/charts";
import type { CoordinatorDashboard as Data, Timeliness } from "@/types/dashboard";
import { cn } from "@/lib/utils";

/** Pareho ng nasa backend (CoordinatorDashboardController) */
const LOW = 40;
const HIGH = 80;
const INACTIVE_DAYS = 7;

const OVERALL = (
  <p>
    Overall progress is the same number students see on their Progress page: the average of the parts that have at
    least one item. The parts are initial, preliminary and post requirements (checked ÷ total), DTR (hours rendered ÷
    training duration, or months with hours ÷ DTR months if there's no duration) and weekly reports (rated ÷ total).
  </p>
);

interface Result {
  semesterId: number;
  key: string;
  data?: Data;
  error?: string;
  receivedAt: Date;
}

function hours(n: number) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

function sinceLabel(iso: string | null) {
  if (!iso) return "No activity yet";
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  const date = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `Last active ${date}${days >= 1 ? ` · ${days} day${days === 1 ? "" : "s"} ago` : ""}`;
}

function timelinessSegments(t: Timeliness): Segment[] {
  return [
    { label: "On time", value: t.onTime, tone: "good" },
    { label: "Late", value: t.late, tone: "warning" },
    { label: "Missing", value: t.missing, tone: "critical" },
    { label: "Not yet due", value: t.notYetDue, tone: "neutral" },
  ];
}

function percentTone(p: number) {
  return p < LOW ? "text-destructive" : p >= HIGH ? "text-emerald-700 dark:text-emerald-400" : "";
}

export function CoordinatorDashboard() {
  const fullname = localStorage.getItem("fullname");
  const { semesterId, semester, loaded, error: semesterError, reload: reloadSemesters } = useSemester();
  const [nonce, setNonce] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const key = `${semesterId}:${nonce}`;

  // Kumukuha lang kapag binuksan ang page, nagpalit ng semester, o pinindot ang Refresh (walang polling)
  useEffect(() => {
    if (semesterId === null) return;
    let alive = true;
    api
      .get<Data>("/coordinator/dashboard", { params: { semesterId } })
      .then((res) => {
        if (alive) setResult({ semesterId, key, data: res.data, receivedAt: new Date() });
      })
      .catch((err) => {
        if (alive) {
          setResult((prev) => ({
            semesterId,
            key,
            // panatilihin ang lumang laman ng parehong semester habang may error
            data: prev?.semesterId === semesterId ? prev.data : undefined,
            error: getErrorMessage(err, "Couldn't load the dashboard."),
            receivedAt: prev?.receivedAt ?? new Date(),
          }));
        }
      });
    return () => {
      alive = false;
    };
  }, [semesterId, key]);

  const current = result && result.semesterId === semesterId ? result : null;
  const data = current?.data;
  const loading = semesterId !== null && result?.key !== key;
  const error = current?.key === key ? current.error : undefined;
  const refresh = () => setNonce((n) => n + 1);

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="break-words text-xl font-bold tracking-tight sm:text-2xl">Welcome, {fullname}!</h1>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
            <CalendarClock className="h-4 w-4 shrink-0" aria-hidden />
            <span className="min-w-0 truncate">
              {semester ? semester.semester : loaded ? "No semester selected" : "Loading semester…"}
            </span>
          </p>
        </div>
        {semesterId !== null && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {data && current && (
              <span aria-live="polite">
                Updated at{" "}
                {current.receivedAt.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
              </span>
            )}
            <Button type="button" variant="outline" size="sm" onClick={refresh} disabled={loading}>
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
              Refresh
            </Button>
          </div>
        )}
      </div>

      {semesterError && (
        <Alert variant="destructive">
          <AlertDescription className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            {semesterError}
            <Button variant="outline" size="sm" onClick={reloadSemesters}>Retry</Button>
          </AlertDescription>
        </Alert>
      )}

      {loaded && semesterId === null && !semesterError && (
        <EmptyNote>Choose a semester at the top of the page to see its dashboard.</EmptyNote>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertDescription className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            {error}
            <Button variant="outline" size="sm" onClick={refresh}>Retry</Button>
          </AlertDescription>
        </Alert>
      )}

      {!data && (loading || !loaded) && <DashboardSkeleton />}

      {data && <DashboardBody data={data} />}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading dashboard">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-[88px] rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-64 rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    </div>
  );
}

function DashboardBody({ data }: { data: Data }) {
  const { totals, hours: h, submissions } = data;
  const noStudents = totals.students === 0;

  return (
    <>
      {/* Mga pangunahing bilang */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Total students"
          value={String(totals.students)}
          icon={Users}
          info={<p>Students assigned to you in this semester who aren't archived.</p>}
        />
        <StatCard
          label="Partner companies"
          value={String(totals.companies)}
          icon={Building2}
          info={<p>Your host training establishments for this semester that aren't archived.</p>}
        />
        <StatCard
          label="Departments"
          value={String(totals.departments)}
          icon={Building}
          info={<p>Approved departments under your partner companies that aren't archived.</p>}
        />
      </div>

      {noStudents ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed bg-card px-4 py-14 text-center">
          <Users className="h-8 w-8 text-muted-foreground" aria-hidden />
          <p className="text-sm text-muted-foreground">No students in this semester yet.</p>
          <Link to="/coordinator/students" className={buttonVariants({ variant: "outline", size: "sm" })}>
            Go to Students
          </Link>
        </div>
      ) : (
        <>
          {/* Pinaka-kailangang gawin */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Section
              title="Needs attention"
              icon={AlertTriangle}
              count={data.needsAttentionCount}
              tone="alert"
              info={
                <>
                  <p>
                    Students with overall progress <strong>below {LOW}%</strong>, lowest first.
                  </p>
                  <p>
                    Only students who have started are included: status is <strong>Deployed</strong> and they have a
                    company and department. For Approval and Approved students are left out, so new students at 0%
                    don't fill the list. Students without a company or department appear only in “Not yet assigned”.
                  </p>
                  <p>
                    The short reason comes from their weakest parts: no DTR hours, requirements returned as invalid,
                    weekly reports not rated yet, or requirements not checked yet.
                  </p>
                  {OVERALL}
                </>
              }
            >
              {data.needsAttention.length === 0 ? (
                <EmptyNote>No started student is below {LOW}% right now.</EmptyNote>
              ) : (
                <StudentList
                  rows={data.needsAttention}
                  detail={(r) => r.reasons.join(" · ") || "Low overall progress"}
                  aside={(r) => <span className="font-semibold text-destructive">{r.overall}%</span>}
                />
              )}
            </Section>

            <Section
              title="Not yet assigned"
              icon={UserX}
              count={data.deployment.unassigned}
              tone="alert"
              info={
                <>
                  <p>Students who don't have a department yet, so they have no company either.</p>
                  <p>
                    Assigned means the student has a department; every department belongs to a company. Assign them
                    from the Tracking page or accept their company application.
                  </p>
                </>
              }
            >
              <div className="mb-3">
                <StackedBar
                  label="Deployment"
                  segments={[
                    { label: "Assigned", value: data.deployment.assigned, tone: "good" },
                    { label: "Not assigned", value: data.deployment.unassigned, tone: "neutral" },
                  ]}
                />
              </div>
              {data.unassigned.length === 0 ? (
                <EmptyNote>Every student has a company and department.</EmptyNote>
              ) : (
                <StudentList
                  rows={data.unassigned}
                  detail={(r) => r.status}
                  aside={() => null}
                />
              )}
            </Section>

            <Section
              title={`Inactive (${INACTIVE_DAYS} days)`}
              icon={Moon}
              count={data.inactiveCount}
              tone="alert"
              info={
                <>
                  <p>
                    Students with no activity in the <strong>last {INACTIVE_DAYS} days</strong>. Activity means
                    uploading a file or link, or saving a DTR or weekly report draft.
                  </p>
                  <p>
                    Completed students are left out. The longest without activity are listed first; “No activity
                    yet” means nothing was ever recorded.
                  </p>
                </>
              }
            >
              {data.inactive.length === 0 ? (
                <EmptyNote>Everyone was active in the last {INACTIVE_DAYS} days.</EmptyNote>
              ) : (
                <StudentList
                  rows={data.inactive}
                  detail={(r) => sinceLabel(r.lastActivity)}
                  aside={() => null}
                />
              )}
            </Section>
          </div>

          {/* Malapit nang matapos at oras */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Section
              title="Almost done"
              icon={BadgeCheck}
              count={data.almostDoneCount}
              info={
                <>
                  <p>
                    Students with overall progress <strong>{HIGH}% and above</strong>, highest first.
                  </p>
                  <p>
                    Remaining hours = training duration − DTR hours rendered (never below 0). It shows “No duration
                    set” when the student has no training duration.
                  </p>
                  {OVERALL}
                </>
              }
            >
              {data.almostDone.length === 0 ? (
                <EmptyNote>No student is at {HIGH}% or above yet.</EmptyNote>
              ) : (
                <StudentList
                  rows={data.almostDone}
                  detail={(r) =>
                    r.remainingHours === null
                      ? "No duration set"
                      : r.remainingHours === 0
                        ? "All hours done"
                        : `${hours(r.remainingHours)} hours left`
                  }
                  aside={(r) => <span className={cn("font-semibold", percentTone(r.overall))}>{r.overall}%</span>}
                />
              )}
            </Section>

            <Section
              title="Hours overview"
              icon={Clock}
              info={
                <>
                  <p>
                    <strong>Rendered</strong> is the total DTR hours of all your students this semester.{" "}
                    <strong>Required</strong> is the sum of their training durations.
                  </p>
                  <p>
                    Students without a training duration are not counted in Required
                    {h.studentsWithoutDuration > 0 ? ` (${h.studentsWithoutDuration} right now).` : "."}
                  </p>
                  <p>
                    <strong>Average progress</strong> is the average overall progress of all your students.
                  </p>
                  {OVERALL}
                </>
              }
            >
              <div className="flex flex-col gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Hours rendered</p>
                  <p className="mb-2 text-2xl font-bold tabular-nums">
                    {hours(h.rendered)}
                    <span className="text-base font-normal text-muted-foreground"> / {hours(h.required)} hrs</span>
                  </p>
                  <Meter value={h.rendered} max={h.required} label="Hours rendered out of required hours" />
                  <p className="mt-1 text-xs text-muted-foreground">
                    {h.required > 0
                      ? `${Math.min(100, Math.round((h.rendered / h.required) * 100))}% of required hours`
                      : "No training durations set yet"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Average progress</p>
                  <p className="mb-2 text-2xl font-bold tabular-nums">{data.averageProgress}%</p>
                  <Meter value={data.averageProgress} max={100} label="Average overall progress" />
                </div>
                {h.studentsWithoutDuration > 0 && (
                  <p className="rounded-lg bg-muted/60 p-2.5 text-xs text-muted-foreground">
                    <strong className="font-medium text-foreground">
                      {h.studentsWithoutDuration} without a training duration:
                    </strong>{" "}
                    {h.withoutDuration.map((s) => s.name).join("; ")}
                    {h.studentsWithoutDuration > h.withoutDuration.length ? "; …" : ""}
                  </p>
                )}
              </div>
            </Section>
          </div>

          {/* Mga ipinasa */}
          <Section
            title="Submissions overview"
            icon={FileWarning}
            info={
              <>
                <p>Counted per student for every requirement and DTR month that you created this semester.</p>
                <p>
                  <strong>On time:</strong> turned in (For Checking or Checked) and the last upload was on or before
                  the due date. <strong>Late:</strong> turned in, but the last upload was after the due date.{" "}
                  <strong>Missing:</strong> the due date has passed and it isn't turned in (Assigned or Invalid).{" "}
                  <strong>Not yet due:</strong> not turned in and the due date hasn't come yet.
                </p>
                <p>
                  “Late” is based on the student's <strong>last upload time</strong>, because the exact time they
                  turned it in isn't recorded.
                </p>
                <p>
                  Items without a due date count as on time once turned in. Post requirements and DTR only count for
                  Deployed or Completed students, since others can't submit them yet. Weekly reports aren't included.
                </p>
              </>
            }
          >
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_1fr_minmax(0,0.9fr)]">
              <div>
                <h3 className="mb-2 text-sm font-medium">Requirements</h3>
                <StackedBar label="Requirements" segments={timelinessSegments(submissions.requirements)} />
              </div>
              <div>
                <h3 className="mb-2 text-sm font-medium">DTR</h3>
                <StackedBar label="DTR" segments={timelinessSegments(submissions.dtr)} />
              </div>
              <div>
                <h3 className="mb-2 text-sm font-medium">Most missing</h3>
                {submissions.mostMissing.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nothing is missing.</p>
                ) : (
                  <ul className="flex flex-col gap-1.5 text-sm">
                    {submissions.mostMissing.map((m) => (
                      <li key={`${m.kind}-${m.title}`} className="flex items-baseline justify-between gap-3">
                        <span className="min-w-0 truncate" title={m.title}>{m.title}</span>
                        <span className="shrink-0 tabular-nums text-muted-foreground">
                          <span className="font-medium text-destructive">{m.missing}</span> missing
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </Section>

          {/* Iba pang buod */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Section
              title="Progress distribution"
              icon={TrendingUp}
              info={
                <>
                  <p>How many students fall in each overall progress range: 0–25%, 26–50%, 51–75% and 76–100%.</p>
                  <p>All your students this semester are counted.</p>
                  {OVERALL}
                </>
              }
            >
              <BarList label="Progress distribution" items={data.progressBuckets.map((b) => ({ label: b.label, value: b.count }))} />
            </Section>

            <Section
              title="Student status"
              icon={PieChart}
              info={<p>Students grouped by their status on the Tracking page (For Approval, Approved, Deployed, Completed).</p>}
            >
              <BarList label="Student status" items={data.status.map((b) => ({ label: b.label, value: b.count }))} />
            </Section>

            <Section
              title="Gender"
              icon={Users}
              info={<p>Students grouped by the gender on their profile. “Not set” means it's empty.</p>}
            >
              <BarList label="Gender" items={data.gender.map((b) => ({ label: b.label, value: b.count }))} />
            </Section>

            <Section
              title="Top companies"
              icon={Building2}
              info={
                <>
                  <p>The five companies with the most of your students, counted through each student's department.</p>
                  <p>“Departments” is the number of approved departments the company has.</p>
                </>
              }
            >
              {data.topCompanies.length === 0 ? (
                <EmptyNote>No student is placed in a company yet.</EmptyNote>
              ) : (
                <BarList
                  label="Top companies"
                  showPercent={false}
                  items={data.topCompanies.map((c) => ({
                    label: c.name,
                    value: c.students,
                    note: `${c.departments} dept${c.departments === 1 ? "" : "s"}`,
                  }))}
                />
              )}
            </Section>

            {data.employability.length > 0 && (
              <Section
                title="Predicted employability"
                icon={Briefcase}
                info={
                  <p>
                    Students grouped by their predicted employability level. Only students who already have a
                    prediction are counted.
                  </p>
                }
              >
                <BarList label="Predicted employability" items={data.employability.map((b) => ({ label: b.label, value: b.count }))} />
              </Section>
            )}
          </div>
        </>
      )}
    </>
  );
}
