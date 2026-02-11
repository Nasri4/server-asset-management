import { NextResponse } from "next/server";
import { getStore } from "../../_sam-mem-store";

export async function GET() {
  const store = getStore();
  return NextResponse.json({ ok: true, data: store.settings.audit });
}

export async function PATCH(req: Request) {
  const store = getStore();
  const body = (await req.json().catch(() => ({}))) as Partial<typeof store.settings.audit>;
  store.settings.audit = {
    ...store.settings.audit,
    ...body,
  };
  return NextResponse.json({ ok: true, data: { ok: true } });
}
