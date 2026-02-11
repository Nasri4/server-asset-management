import axios from "axios";
import { toast } from "sonner";

function getBaseURL() {
  // In the browser, always use same-origin requests.
  // Next.js proxies /api/* via rewrites and /auth/* via route handlers.
  // This avoids CORS/cookie issues and prevents hard dependency on backend host/port.
  if (typeof window !== "undefined") return "";

  const explicit = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  if (explicit) return explicit;

  // SSR / server actions: axios requires an absolute URL.
  // Keep a dev fallback to the backend port.
  if (process.env.NODE_ENV === "development") return "http://localhost:5000";

  return "";
}

export const api = axios.create({
  baseURL: getBaseURL(),
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

// Backwards-compatible alias (some pages/components import apiClient).
export const apiClient = api;

// Note: in the browser we intentionally use an empty baseURL (same-origin + rewrites).
// Only warn if we're server-side and have no backend URL in production.
const isNextBuildPhase = process.env.NEXT_PHASE === "phase-production-build";

if (!api.defaults.baseURL && typeof window === "undefined" && process.env.NODE_ENV === "production" && !isNextBuildPhase) {
  // eslint-disable-next-line no-console
  console.warn("Missing NEXT_PUBLIC_API_BASE_URL (SSR cannot reach backend)");
}

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status as number | undefined;
    const url = typeof window !== "undefined" ? window.location.pathname : "";
    const requestUrl = String(error?.config?.url ?? "");
    const silent = Boolean(error?.config?.headers?.["x-sam-silent"]);

    // Only force-redirect to /login when our session probe fails.
    // Other endpoints may return 401 for reasons unrelated to auth (misconfigured route, proxy issues, etc).
    const isAuthMe = requestUrl === "/auth/me" || requestUrl.endsWith("/auth/me");
    if (status === 401 && isAuthMe && typeof window !== "undefined" && !url.startsWith("/login")) {
      window.location.href = "/login";
      return Promise.reject(error);
    }

    const message =
      (error?.response?.data?.error?.message as string | undefined) ||
      (error?.response?.data?.error as string | undefined) ||
      (error?.response?.data?.message as string | undefined) ||
      (error?.message as string | undefined) ||
      "Request failed";

    // Avoid noisy toasts for explicit auth redirects.
    if (!silent && !(status === 401 && isAuthMe)) toast.error(message);

    return Promise.reject(error);
  }
);
