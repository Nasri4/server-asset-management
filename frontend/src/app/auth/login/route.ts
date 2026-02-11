import { NextResponse, type NextRequest } from "next/server";

import { proxyToBackend } from "../_proxy";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  // Users sometimes land on /auth/login via old bookmarks.
  // The actual UI login page is /login.
  const current = new URL(req.url);
  const dest = new URL("/login", current);
  dest.search = current.search;
  return NextResponse.redirect(dest);
}

export async function POST(req: NextRequest) {
  return proxyToBackend(req, "/auth/login");
}
