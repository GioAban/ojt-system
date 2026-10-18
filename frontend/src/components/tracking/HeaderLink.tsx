import type { ReactNode } from "react";
import { Link } from "react-router-dom";

interface Props {
  to: string;
  title: string;
  children: ReactNode;
}

/** Header ng column na pumupunta sa mga isinumite ng mga student */
export function HeaderLink({ to, title, children }: Props) {
  return (
    <Link
      to={to}
      state={{ from: "tracking" }}
      title={title}
      className="block rounded px-0.5 outline-none hover:bg-muted hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring"
    >
      {children}
    </Link>
  );
}
