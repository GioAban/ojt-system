import axios from "axios";

export function getErrorMessage(
  err: unknown,
  fallback = "Something went wrong.",
): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data;
    if (typeof data === "string" && data) return data;
    if (err.response?.status === 403)
      return "You don't have permission to do that.";
  }
  return fallback;
}
