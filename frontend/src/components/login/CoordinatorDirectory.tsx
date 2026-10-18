import { useEffect, useState } from "react";
import api from "@/lib/api";
import { cn } from "@/lib/utils";

interface Person {
  name: string;
  titles: string;
  role: string;
}

interface ProgramEntry {
  college: string;
  collegeAbbreviation: string;
  program: string;
  programAbbreviation: string;
  programHead: string;
  people: Person[];
}

function initials(name: string) {
  const parts = name.replace(/[^A-Za-z\s]/g, " ").split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

/** Mga OJT coordinator at staff kada program; kinukuha mula sa public endpoint */
export function CoordinatorDirectory() {
  const [programs, setPrograms] = useState<ProgramEntry[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .get<ProgramEntry[]>("/public/directory")
      .then((res) => !cancelled && setPrograms(res.data))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, []);

  // Walang ipapakitang section kung walang laman o hindi maabot; hindi dapat masira ang login page
  if (failed || (programs && programs.length === 0)) return null;

  return (
    <section className="border-t">
      <div className="mx-auto max-w-6xl px-4 py-14">
        <h2 className="text-2xl font-semibold tracking-tight">Your OJT coordinators and staff</h2>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          No account yet? Reach out to the coordinator of your program. They will enroll you and give you access.
        </p>

        {!programs ? (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-36 animate-pulse rounded-xl border bg-muted/40" />
            ))}
          </div>
        ) : (
          <div className="mt-8 flex flex-col gap-8">
            {programs.map((p) => (
              <div key={`${p.program}-${p.programAbbreviation}`}>
                <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h3 className="font-semibold">
                    {p.program}
                    {p.programAbbreviation && <span className="ml-1.5 text-muted-foreground">({p.programAbbreviation})</span>}
                  </h3>
                  {p.programHead && <span className="text-sm text-muted-foreground">Program head: {p.programHead}</span>}
                </div>
                <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {p.people.map((person) => (
                    <li key={`${person.role}-${person.name}`} className="flex items-center gap-3 rounded-xl border bg-card p-4">
                      <div
                        className={cn(
                          "flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                          person.role === "OJT Coordinator" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                        )}
                        aria-hidden="true"
                      >
                        {initials(person.name)}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-medium">{person.name}</p>
                        {person.titles && <p className="truncate text-xs text-muted-foreground">{person.titles}</p>}
                        <p className="text-xs text-muted-foreground">{person.role}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
