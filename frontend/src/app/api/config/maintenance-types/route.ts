import { NextResponse } from "next/server";
import { getStore } from "../../_sam-mem-store";

export async function GET() {
  const store = getStore();
  return NextResponse.json({ ok: true, data: store.config["maintenance-types"] });
}

export async function POST(req: Request) {
  const store = getStore();
  const body = (await req.json().catch(() => ({}))) as { name?: string };
  const name = String(body?.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ ok: false, error: { message: "Name is required" } }, { status: 400 });
  }

  const existing = store.config["maintenance-types"].find((t) => t.name.toLowerCase() === name.toLowerCase());
  if (existing) {
    return NextResponse.json({ ok: false, error: { message: "Already exists" } }, { status: 409 });
  }

  const item = { id: store._seq.configId++, name };
  store.config["maintenance-types"].push(item);
  return NextResponse.json({ ok: true, data: { id: item.id } }, { status: 201 });
}
