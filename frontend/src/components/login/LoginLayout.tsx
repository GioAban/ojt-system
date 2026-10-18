import type { ReactNode } from "react";
import {
  ClipboardCheck,
  FileText,
  Clock,
  Building2,
  Users,
  BellRing,
} from "lucide-react";
import { CoordinatorDirectory } from "./CoordinatorDirectory";

const FEATURES = [
  { icon: Building2, title: "Company placement", text: "Track your host company, supervisor and deployment details." },
  { icon: Clock, title: "Hours & attendance", text: "Log daily hours and see your progress toward the required OJT hours." },
  { icon: FileText, title: "Documents & reports", text: "Submit requirements, journals and reports in one place." },
  { icon: ClipboardCheck, title: "Evaluations", text: "View supervisor and coordinator evaluations as they are released." },
  { icon: Users, title: "Coordinator support", text: "Your OJT coordinator manages your class, account and requirements." },
  { icon: BellRing, title: "Updates", text: "Stay current on deadlines and announcements for your semester." },
];

const PROGRAMS = [
  "Bachelor of Science in Information Technology (BSIT)",
  "Bachelor of Library and Information Science (BLIS)",
];

/** Minimalist na login page: logo, features, login card, CITE info, coordinators at footer */
export function LoginLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <img src="/logos/ucu-logo.png" alt="Urdaneta City University" className="h-10 w-10 object-contain" />
          <div className="leading-tight">
            <p className="text-sm font-semibold">Urdaneta City University</p>
            <p className="text-xs text-muted-foreground">College of Information and Technology Education</p>
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl gap-12 px-4 py-12 lg:grid-cols-[1.2fr_1fr] lg:items-center lg:py-20">
          <div>
            <p className="text-sm font-medium text-primary">OJT / Practicum System</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
              Your on-the-job training, organized in one place.
            </h1>
            <p className="mt-3 max-w-xl text-muted-foreground">
              Built for CITE students, OJT coordinators and staff of Urdaneta City University.
            </p>
            <ul className="mt-8 grid gap-5 sm:grid-cols-2">
              {FEATURES.map(({ icon: Icon, title, text }) => (
                <li key={title} className="flex gap-3">
                  <Icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
                  <div>
                    <p className="text-sm font-medium">{title}</p>
                    <p className="text-sm text-muted-foreground">{text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="w-full max-w-md justify-self-center rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
            <div className="mb-6 flex flex-col items-center text-center">
              <img src="/logos/cite-seal.png" alt="CITE seal" className="h-16 w-16 object-contain" />
              <h2 className="mt-3 text-xl font-semibold">Sign in</h2>
              <p className="text-sm text-muted-foreground">Use your Gmail or Student ID.</p>
            </div>
            {children}
          </div>
        </section>

        <section className="border-t bg-muted/30">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 lg:grid-cols-2">
            <div>
              <div className="flex items-center gap-3">
                <img src="/logos/cite-seal.png" alt="" className="h-12 w-12 object-contain" />
                <h2 className="text-2xl font-semibold tracking-tight">About CITE</h2>
              </div>
              <p className="mt-4 text-muted-foreground">
                The College of Information and Technology Education (CITE) of Urdaneta City University prepares
                students for careers in computing and information science through quality instruction, research and
                community engagement.
              </p>
              <h3 className="mt-6 text-sm font-semibold">Programs</h3>
              <ul className="mt-2 list-disc pl-5 text-sm text-muted-foreground">
                {PROGRAMS.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
              <h3 className="mt-6 text-sm font-semibold">Contact</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                cite@ucu.edu.ph · (075) 204 9020 local 2120
                <br />
                San Vicente West, Urdaneta City, Pangasinan
              </p>
              <p className="mt-3 text-xs text-muted-foreground">
                Source: <a className="underline" href="https://ucu.edu.ph" target="_blank" rel="noreferrer">ucu.edu.ph</a>.
                Please confirm vision, mission and goals with the college.
              </p>
            </div>

            <div className="flex flex-col gap-4 rounded-2xl border bg-card p-6">
              <img src="/logos/ucu-60-years.png" alt="UCU 60 years" className="h-24 w-auto self-start object-contain" />
              <h2 className="text-xl font-semibold tracking-tight">Urdaneta City University</h2>
              <p className="text-sm text-muted-foreground">
                Founded in 1966 as Urdaneta Community College by Dr. Pedro T. Orata, the institution became a city
                university in 2006 and continues to serve Pangasinan and nearby provinces from its campus in San
                Vicente West, Urdaneta City.
              </p>
            </div>
          </div>
        </section>

        <CoordinatorDirectory />
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-xs text-muted-foreground">
          <div className="flex items-center gap-3">
            <img src="/logos/ucu-logo.png" alt="" className="h-8 w-8 object-contain" />
            <img src="/logos/cite-seal.png" alt="" className="h-8 w-8 object-contain" />
            <img src="/logos/ucu-60-years.png" alt="" className="h-8 w-auto object-contain" />
          </div>
          <p>© {new Date().getFullYear()} Urdaneta City University · CITE OJT System</p>
        </div>
      </footer>
    </div>
  );
}
