import { Navigate, Route, RouterProvider, createBrowserRouter, createRoutesFromElements } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { UpdatePrompt } from "@/components/offline/UpdatePrompt";
import ProtectedRoute from "@/components/ProtectedRoute";
import RoleRoute from "@/components/RoleRoute";
import SemesterLayout from "@/components/SemesterLayout";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Dashboard from "@/pages/Dashboard";
import StudentHome from "@/pages/StudentHome";
import ComingSoon from "@/pages/ComingSoon";
import Semesters from "@/pages/admin/Semesters";
import Colleges from "@/pages/admin/Colleges";
import Programs from "@/pages/admin/Programs";
import Coordinators from "@/pages/admin/Coordinators";
import Tracking from "@/pages/coordinator/Tracking";
import Requirements from "@/pages/coordinator/Requirements";
import RequirementSubmissions from "@/pages/coordinator/RequirementSubmissions";
import HostTraining from "@/pages/coordinator/HostTraining";
import Students from "@/pages/coordinator/Students";
import Join from "@/pages/Join";
import CompanyRequestPublic from "@/pages/CompanyRequestPublic";
import PrivacyNotice from "@/pages/PrivacyNotice";
import ChangePassword from "@/pages/ChangePassword";
import VerifyEmail from "@/pages/VerifyEmail";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import StudentCompanies from "@/pages/student/Companies";
import ProfilePage from "@/pages/Profile";
import WorkPage from "@/pages/student/Work";
import StudentNotifications from "@/pages/student/Notifications";
import StudentMyCompany from "@/pages/student/Company";
import CoordinatorAnnouncements from "@/pages/coordinator/Announcements";
import StudentAnnouncements from "@/pages/student/Announcements";
import StudentProgress from "@/pages/student/Progress";
import CoordinatorReports from "@/pages/coordinator/Reports";
import CoordinatorReportEditor from "@/pages/coordinator/ReportEditor";

// Data router: kailangan ng useBlocker (hal. babala bago umalis sa report na may hindi pa naisusulat na pagbabago)
const router = createBrowserRouter(
  createRoutesFromElements(
    <>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* LAHAT ng protektadong route ay nasa loob nito, bago ang </Route> */}
      <Route element={<SemesterLayout />}>
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/student/home"
          element={
            <ProtectedRoute>
              <StudentHome />
            </ProtectedRoute>
          }
        />
        <Route
          path="/student/work/:scope/:id"
          element={
            <ProtectedRoute>
              <RoleRoute roles={["STUDENT"]}>
                <WorkPage />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/student/notifications"
          element={
            <ProtectedRoute>
              <RoleRoute roles={["STUDENT"]}>
                <StudentNotifications />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/student/companies"
          element={
            <ProtectedRoute>
              <RoleRoute roles={["STUDENT"]}>
                <StudentCompanies />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <ComingSoon title="Settings" />
            </ProtectedRoute>
          }
        />

        {/* Director */}
        <Route
          path="/admin/semesters"
          element={
            <ProtectedRoute>
              <RoleRoute roles={["ADMIN"]}>
                <Semesters />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/colleges"
          element={
            <ProtectedRoute>
              <RoleRoute roles={["ADMIN"]}>
                <Colleges />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/programs"
          element={
            <ProtectedRoute>
              <RoleRoute roles={["ADMIN"]}>
                <Programs />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/coordinators"
          element={
            <ProtectedRoute>
              <RoleRoute roles={["ADMIN"]}>
                <Coordinators />
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        {/* Coordinator */}
        <Route
          path="/coordinator/tracking"
          element={
            <ProtectedRoute>
              <RoleRoute roles={["COORDINATOR"]}>
                <Tracking />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/coordinator/document-requirements"
          element={
            <ProtectedRoute>
              <RoleRoute roles={["COORDINATOR"]}>
                <Requirements />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/coordinator/document-requirements/:requirementId/submissions"
          element={
            <ProtectedRoute>
              <RoleRoute roles={["COORDINATOR"]}>
                <RequirementSubmissions kind="document" />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/coordinator/document-requirements/weekly/:requirementId/submissions"
          element={
            <ProtectedRoute>
              <RoleRoute roles={["COORDINATOR"]}>
                <RequirementSubmissions kind="weekly" />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/coordinator/document-requirements/dtr/:requirementId/submissions"
          element={
            <ProtectedRoute>
              <RoleRoute roles={["COORDINATOR"]}>
                <RequirementSubmissions kind="dtr" />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/coordinator/host-training-establishments"
          element={
            <ProtectedRoute>
              <RoleRoute roles={["COORDINATOR"]}>
                <HostTraining />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/coordinator/announcements"
          element={
            <ProtectedRoute>
              <RoleRoute roles={["COORDINATOR"]}>
                <CoordinatorAnnouncements />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/student/announcements"
          element={
            <ProtectedRoute>
              <RoleRoute roles={["STUDENT"]}>
                <StudentAnnouncements />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/coordinator/students"
          element={
            <ProtectedRoute>
              <RoleRoute roles={["COORDINATOR"]}>
                <Students />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/student/progress"
          element={
            <ProtectedRoute>
              <RoleRoute roles={["STUDENT"]}>
                <StudentProgress />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/coordinator/reports"
          element={
            <ProtectedRoute>
              <RoleRoute roles={["COORDINATOR"]}>
                <CoordinatorReports />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/coordinator/reports/:type"
          element={
            <ProtectedRoute>
              <RoleRoute roles={["COORDINATOR"]}>
                <CoordinatorReportEditor />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/coordinator/reports/:type/:id"
          element={
            <ProtectedRoute>
              <RoleRoute roles={["COORDINATOR"]}>
                <CoordinatorReportEditor />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/student/company"
          element={
            <ProtectedRoute>
              <RoleRoute roles={["STUDENT"]}>
                <StudentMyCompany />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
      </Route>
      <Route path="/join" element={<Join />} />
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/hte-request" element={<CompanyRequestPublic />} />
      <Route path="/privacy" element={<PrivacyNotice />} />
      <Route path="/change-password" element={<ChangePassword />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </>,
  ),
);

function App() {
  return (
    <TooltipProvider>
      <RouterProvider router={router} />
      <Toaster theme="light" position="bottom-right" richColors closeButton />
      <UpdatePrompt />
    </TooltipProvider>
  );
}
export default App;
