import { NextResponse } from "next/server";
import { getStore } from "../../_sam-mem-store";

export async function GET() {
  const store = getStore();
  return NextResponse.json({ ok: true, data: store.settings.security });
}

export async function PATCH(req: Request) {
  const store = getStore();
  const body = (await req.json().catch(() => ({}))) as Partial<typeof store.settings.security>;
  store.settings.security = {
    ...store.settings.security,
    ...body,
  };
  return NextResponse.json({ ok: true, data: { ok: true } });
}
