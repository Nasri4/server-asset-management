import { NextResponse } from "next/server";
import { getStore } from "../../_sam-mem-store";

export async function GET() {
  const store = getStore();
  return NextResponse.json({ ok: true, data: store.config.environments });
}

export async function POST(req: Request) {
  const store = getStore();
  const body = (await req.json().catch(() => ({}))) as { name?: string };
  const name = String(body?.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ ok: false, error: { message: "Name is required" } }, { status: 400 });
  }

  const existing = store.config.environments.find(
    (e) => e.name.toLowerCase() === name.toLowerCase(),
  );
  if (existing) {
    return NextResponse.json({ ok: false, error: { message: "Already exists" } }, { status: 409 });
  }

  const item = { id: store.config._idSeq++, name };
  store.config.environments.push(item);
  return NextResponse.json({ ok: true, data: item }, { status: 201 });
}
