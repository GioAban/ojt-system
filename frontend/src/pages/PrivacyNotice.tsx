import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { PrivacyNoticeContent } from "@/components/privacy/PrivacyNoticeContent";
import { Button } from "@/components/ui/button";

/** Pampublikong Privacy Notice page; nababasa kahit hindi naka-login */
export default function PrivacyNotice() {
  const navigate = useNavigate();
  const loggedIn = Boolean(localStorage.getItem("token"));

  return (
    <div className="min-h-dvh bg-background">
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:py-12">
        <div>
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2"
            onClick={() => (window.history.length > 1 ? navigate(-1) : navigate(loggedIn ? "/dashboard" : "/login"))}
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </div>

        <header className="flex items-start gap-3">
          <ShieldCheck className="mt-1 h-6 w-6 shrink-0 text-primary" />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Privacy Notice</h1>
            <p className="text-sm text-muted-foreground">
              Urdaneta City University · OJT and Practicum System
            </p>
          </div>
        </header>

        <PrivacyNoticeContent />

        {!loggedIn && (
          <p className="text-sm">
            <Link to="/login" className="text-primary underline underline-offset-2">
              Go to login
            </Link>
          </p>
        )}
      </main>
    </div>
  );
}
