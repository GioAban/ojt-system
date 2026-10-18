import axios from "axios";
import api from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";

export const ALLOWED_EXTENSIONS = [
  "pdf",
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "ppt",
  "pptx",
  "txt",
  "csv",
  "zip",
];
export const ACCEPT = ALLOWED_EXTENSIONS.map((e) => `.${e}`).join(",");
export const MAX_FILE_BYTES = 20 * 1024 * 1024;
export const MAX_FILES_PER_UPLOAD = 10;
export const MAX_ATTACHMENTS = 20;

export function extensionOf(name: string) {
  const dot = name.lastIndexOf(".");
  return dot < 0 ? "" : name.slice(dot + 1).toLowerCase();
}

export function formatFileSize(bytes: number | null | undefined) {
  if (bytes === null || bytes === undefined) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function errorText(err: unknown, fallback: string) {
  // Sa blob na request, nasa Blob ang mensahe ng server
  if (axios.isAxiosError(err) && err.response?.data instanceof Blob) {
    try {
      const text = await err.response.data.text();
      if (text) return text;
    } catch {
      // gamitin ang fallback
    }
  }
  return getErrorMessage(err, fallback);
}

function previewable(type: string) {
  return (
    type.startsWith("image/") ||
    type === "application/pdf" ||
    type === "text/plain"
  );
}

/**
 * Binubuksan ang file na nasa likod ng login (kailangan ng token, kaya hindi pwede ang simpleng link).
 * Larawan at PDF ay bubukas sa bagong tab; ang iba ay ida-download.
 */
export async function openProtectedFile(path: string, name: string) {
  // Buksan agad ang tab habang hawak pa ang click, para hindi harangin ng browser
  const popup = window.open("", "_blank");

  try {
    const res = await api.get<Blob>(path, { responseType: "blob" });
    const url = URL.createObjectURL(res.data);

    if (previewable(res.data.type) && popup) {
      popup.opener = null;
      popup.location.href = url;
    } else {
      const link = document.createElement("a");
      link.href = url;
      link.download = name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      popup?.close();
    }

    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (err) {
    popup?.close();
    throw new Error(await errorText(err, "Couldn't open the file."));
  }
}

export function openExternalLink(url: string) {
  if (!/^https?:\/\//i.test(url)) return false;
  window.open(url, "_blank", "noopener,noreferrer");
  return true;
}
