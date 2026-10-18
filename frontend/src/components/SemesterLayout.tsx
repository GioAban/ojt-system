import { Outlet } from "react-router-dom";
import { SemesterProvider } from "@/contexts/SemesterProvider";

export default function SemesterLayout() {
  return (
    <SemesterProvider>
      <Outlet />
    </SemesterProvider>
  );
}
