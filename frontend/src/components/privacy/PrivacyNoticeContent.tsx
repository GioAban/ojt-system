import type { ReactNode } from "react";
import { usePrivacyInfo } from "@/lib/privacy";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-base font-semibold">{title}</h2>
      <div className="flex flex-col gap-2 text-sm leading-relaxed text-muted-foreground">
        {children}
      </div>
    </section>
  );
}

/** Ang buong teksto ng Privacy Notice (RA 10173). Ginagamit sa /privacy page. */
export function PrivacyNoticeContent() {
  const info = usePrivacyInfo();

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm leading-relaxed text-muted-foreground">
        Urdaneta City University uses this system to manage On-the-Job Training
        (OJT) and practicum. We follow the Data Privacy Act of 2012 (Republic
        Act No. 10173). This notice explains what we collect, why, and what you
        can do about it.
      </p>

      <Section title="What we collect">
        <p className="font-medium text-foreground">About students</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Profile: name, student number, email, contact number, address, birthday, sex, year level, and parent or guardian details</li>
          <li>Course, program and the semester you are enrolled in</li>
          <li>Your host training establishment (company) and department</li>
          <li>Daily Time Records (DTR) and rendered hours</li>
          <li>Weekly reports</li>
          <li>Evaluations from your supervisor and coordinator</li>
          <li>Files you upload for requirements</li>
        </ul>
        <p className="font-medium text-foreground">About company supervisors</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Name, position, contact number and email</li>
        </ul>
      </Section>

      <Section title="Why we use it">
        <ul className="list-disc space-y-1 pl-5">
          <li>To place and monitor students during OJT and practicum</li>
          <li>To check requirements, DTRs and weekly reports</li>
          <li>To evaluate and grade students</li>
          <li>To prepare reports for the college and for CHED</li>
          <li>To contact supervisors about the students they supervise</li>
        </ul>
        <p>We do not sell your data or use it for advertising.</p>
      </Section>

      <Section title="Who can see it">
        <ul className="list-disc space-y-1 pl-5">
          <li>You (the student) can see your own records</li>
          <li>Your OJT coordinator</li>
          <li>Your program head</li>
          <li>System administrators, only when needed to run the system</li>
        </ul>
        <p>
          Companies and supervisors do not have accounts in this system. We
          share information outside the university only when the law requires
          it, such as reports to CHED.
        </p>
      </Section>

      <Section title="How long we keep it">
        <p>
          We keep your records for{" "}
          <span className="font-medium text-foreground">{info.retention}</span>.
          After that, we delete or anonymize them, unless the law requires us
          to keep them longer.
        </p>
      </Section>

      <Section title="How we protect it">
        <ul className="list-disc space-y-1 pl-5">
          <li>Access needs a login, and each role sees only what it needs</li>
          <li>Passwords are stored hashed, never as plain text</li>
          <li>Connections to the system use HTTPS</li>
          <li>Uploaded requirement files open only through private, time-limited links</li>
        </ul>
      </Section>

      <Section title="Your rights">
        <p>Under the Data Privacy Act, you have the right to:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Be informed about how your data is used</li>
          <li>Access your data and get a copy</li>
          <li>Correct data that is wrong or incomplete</li>
          <li>Object to processing, where allowed</li>
          <li>Ask us to delete or block your data, where allowed by law and school rules</li>
          <li>
            File a complaint with the National Privacy Commission (
            <a
              className="underline underline-offset-2 hover:text-foreground"
              href="https://privacy.gov.ph"
              target="_blank"
              rel="noreferrer"
            >
              privacy.gov.ph
            </a>
            )
          </li>
        </ul>
      </Section>

      <Section title="Contact our Data Protection Officer">
        <p>
          For questions or requests about your data, contact:
        </p>
        <div className="rounded-lg border bg-muted/40 px-4 py-3 text-foreground">
          <p className="font-medium">{info.dpoName}</p>
          <p className="text-sm">Data Protection Officer, Urdaneta City University</p>
          <p className="text-sm break-all">{info.dpoEmail}</p>
        </div>
      </Section>

      {info.version && (
        <p className="text-xs text-muted-foreground">Notice version {info.version}</p>
      )}
    </div>
  );
}
