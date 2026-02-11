import type { NextRequest } from "next/server";

import { proxyToBackend } from "../_proxy";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  return proxyToBackend(req, "/auth/me");
}
