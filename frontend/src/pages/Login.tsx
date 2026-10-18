import { Navigate, useNavigate } from "react-router-dom";
import axios from "axios";
import api from "@/lib/api";
import { LoginForm } from "@/components/login/LoginForm";
import { LoginLayout } from "@/components/login/LoginLayout";

const LOGIN_ENDPOINTS = [
  "/auth/login",
  "/auth/director/login",
  "/auth/student/login",
];

function homeFor(role: string | null) {
  return role === "STUDENT" ? "/student/home" : "/dashboard";
}

export default function Login() {
  const navigate = useNavigate();

  if (localStorage.getItem("token")) {
    return <Navigate to={homeFor(localStorage.getItem("role"))} replace />;
  }

  // identifier = email O Student ID. Ipinapasa sa "email" field; ang backend ang nagre-resolve.
  async function handleLogin(identifier: string, password: string) {
    let blockedMessage = "";
    let sawNetworkError = false;

    for (const endpoint of LOGIN_ENDPOINTS) {
      try {
        const response = await api.post(endpoint, { email: identifier, password });
        localStorage.setItem("token", response.data.token);
        localStorage.setItem("email", response.data.email);
        localStorage.setItem("fullname", response.data.fullname);
        localStorage.setItem("role", response.data.role);
        localStorage.setItem("coordinatorType", response.data.coordinatorType ?? "");
        // Kapag default password pa ang gamit ng student, ipapalit muna
        if (response.data.mustChangePassword) {
          navigate("/change-password", { replace: true });
        } else {
          navigate(homeFor(response.data.role), { replace: true });
        }
        return;
      } catch (err) {
        if (axios.isAxiosError(err)) {
          if (!err.response) {
            sawNetworkError = true;
          } else if (err.response.status === 403 && typeof err.response.data === "string") {
            blockedMessage = err.response.data;
          }
        }
      }
    }

    throw new Error(
      blockedMessage ||
        (sawNetworkError
          ? "Unable to reach the server. Please try again in a moment."
          : "Wrong email, Student ID, or password."),
    );
  }

  return (
    <LoginLayout>
      <LoginForm onSubmit={handleLogin} />
    </LoginLayout>
  );
}
