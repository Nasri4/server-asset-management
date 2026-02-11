import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as null | { targets?: unknown; confirm?: unknown };
  const confirm = String(body?.confirm ?? "").trim();
  if (confirm !== "RESET") {
    return NextResponse.json(
      { ok: false, error: { message: "Confirmation phrase invalid" } },
      { status: 400 }
    );
  }

  // Stub: in production this would enqueue a background job.
  const job_id = `dev-${Date.now()}`;
  return NextResponse.json({ ok: true, data: { ok: true, job_id } });
}
