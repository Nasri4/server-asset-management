import { NextResponse } from "next/server";
import { getStore, type RbacPermission } from "../../_sam-mem-store";

export async function POST(req: Request) {
  const store = getStore();
  const body = (await req.json().catch(() => ({}))) as Partial<RbacPermission>;

  const key = String(body.key ?? "").trim();
  const label = String(body.label ?? "").trim();
  const group = body.group == null ? null : String(body.group).trim();
  const description = body.description == null ? null : String(body.description).trim();

  if (!key || key.length < 3) {
    return NextResponse.json({ ok: false, error: { message: "Key is required" } }, { status: 400 });
  }
  if (!label) {
    return NextResponse.json({ ok: false, error: { message: "Label is required" } }, { status: 400 });
  }

  const exists = store.rbac.matrix.permissions.some((p) => p.key === key);
  if (exists) {
    return NextResponse.json({ ok: false, error: { message: "Permission already exists" } }, { status: 409 });
  }

  store.rbac.matrix.permissions.push({ key, label, group, description });
  store.rbac.matrix.grants[key] = {
    Admin: true,
    TeamLead: false,
    Engineer: false,
  };

  return NextResponse.json({ ok: true, data: { ok: true } });
}
