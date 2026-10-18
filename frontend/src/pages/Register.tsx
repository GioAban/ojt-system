import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Register() {
  const [formData, setFormData] = useState({
    programId: "",
    employeeNumber: "",
    fullname: "",
    email: "",
    password: "",
  });
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      const response = await api.post("/auth/register", {
        ...formData,
        programId: Number(formData.programId),
      });
      localStorage.setItem("token", response.data.token);
      localStorage.setItem("email", response.data.email);
      localStorage.setItem("fullname", response.data.fullname);
      localStorage.setItem("role", response.data.role);
      navigate("/dashboard", { replace: true });
    } catch (err: any) {
      setError(err.response?.data || "Registration failed. Please try again.");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">Register</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="programId">Program ID</Label>
              <Input
                id="programId"
                name="programId"
                type="number"
                value={formData.programId}
                onChange={handleChange}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="employeeNumber">Student/Employee Number</Label>
              <Input
                id="employeeNumber"
                name="employeeNumber"
                value={formData.employeeNumber}
                onChange={handleChange}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="fullname">Full Name</Label>
              <Input
                id="fullname"
                name="fullname"
                value={formData.fullname}
                onChange={handleChange}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                value={formData.password}
                onChange={handleChange}
                required
              />
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <Button type="submit" className="w-full">
              Register
            </Button>
          </form>
          <p className="mt-4 text-center text-sm">
            Already have an account?{" "}
            <Link to="/login" className="underline">
              Login
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
