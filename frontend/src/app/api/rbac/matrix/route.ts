import { NextResponse } from "next/server";
import { getStore } from "../../_sam-mem-store";

export async function GET() {
  const store = getStore();
  return NextResponse.json({ ok: true, data: store.rbac.matrix });
}

export async function PUT(req: Request) {
  const store = getStore();
  const body = (await req.json().catch(() => ({}))) as { grants?: unknown };
  if (!body?.grants || typeof body.grants !== "object") {
    return NextResponse.json({ ok: false, error: { message: "Invalid grants" } }, { status: 400 });
  }

  store.rbac.matrix.grants = body.grants as any;
  return NextResponse.json({ ok: true, data: { ok: true } });
}
