import { NextResponse } from "next/server";

export async function POST() {
  // This endpoint is used by the UI as a "refresh server config" action.
  // In local-dev fallback mode, there is nothing to sync.
  return NextResponse.json({ ok: true, data: { ok: true } });
}
