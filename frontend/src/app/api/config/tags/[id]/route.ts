import { NextResponse } from "next/server";
import { getStore } from "../../../_sam-mem-store";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  const store = getStore();
  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isFinite(numericId)) {
    return NextResponse.json({ ok: false, error: { message: "Invalid id" } }, { status: 400 });
  }

  const body = (await req.json().catch(() => ({}))) as { name?: string };
  const name = String(body?.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ ok: false, error: { message: "Name is required" } }, { status: 400 });
  }

  const list = store.config.tags;
  const item = list.find((x) => x.id === numericId);
  if (!item) {
    return NextResponse.json({ ok: false, error: { message: "Not found" } }, { status: 404 });
  }

  item.name = name;
  return NextResponse.json({ ok: true, data: { ok: true } });
}

export async function DELETE(_req: Request, { params }: Params) {
  const store = getStore();
  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isFinite(numericId)) {
    return NextResponse.json({ ok: false, error: { message: "Invalid id" } }, { status: 400 });
  }

  const list = store.config.tags;
  const idx = list.findIndex((x) => x.id === numericId);
  if (idx === -1) {
    return NextResponse.json({ ok: false, error: { message: "Not found" } }, { status: 404 });
  }

  list.splice(idx, 1);
  return NextResponse.json({ ok: true, data: { ok: true } });
}
