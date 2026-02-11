import axios from "axios";
import { toast } from "sonner";

function getBaseURL() {
  // Prefer explicit baseURL, but allow same-origin (rewrites) when unset.
  const explicit = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  return explicit || "";
}

function getToken() {
  if (typeof window === "undefined") return null;
  // Support both a product-specific key and a generic one.
  return window.localStorage.getItem("sam.token") || window.localStorage.getItem("token");
}

export const api = axios.create({
  baseURL: getBaseURL(),
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers = config.headers ?? {};
    // Do not overwrite explicit Authorization headers.
    if (!("Authorization" in config.headers)) {
      (config.headers as any).Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status as number | undefined;
    const silent = Boolean(error?.config?.headers?.["x-sam-silent"]);

    const message =
      (error?.response?.data?.error?.message as string | undefined) ||
      (error?.response?.data?.error as string | undefined) ||
      (error?.response?.data?.message as string | undefined) ||
      (error?.message as string | undefined) ||
      "Request failed";

    if (status === 401 && typeof window !== "undefined") {
      // Preserve next destination for a better UX.
      const next = window.location.pathname && window.location.pathname !== "/login"
        ? `?next=${encodeURIComponent(window.location.pathname)}`
        : "";
      window.location.href = `/login${next}`;
    }

    if (!silent) toast.error(message);

    return Promise.reject(error);
  }
);

export type ApiOk<T> = { ok: true; data: T };

export function unwrap<T>(payload: any): T {
  // backend uses ok(res, data) wrapper -> { ok: true, data: ... }
  if (payload && typeof payload === "object" && "data" in payload) return payload.data as T;
  return payload as T;
}
