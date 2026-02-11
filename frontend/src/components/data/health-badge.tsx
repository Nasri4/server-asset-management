import { Badge } from "@/components/ui/badge";

function normalize(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

export function HealthBadge({ value }: { value: unknown }) {
  const v = normalize(value);

  if (!v) return <Badge variant="secondary">—</Badge>;

  if (["healthy", "ok", "good"].includes(v)) {
    return <Badge className="bg-sam-success text-white hover:bg-sam-success">Healthy</Badge>;
  }

  if (["maintenance"].includes(v)) {
    return <Badge className="bg-sam-warning text-black hover:bg-sam-warning">Maintenance</Badge>;
  }

  if (["warning", "degraded", "issue"].includes(v)) {
    return <Badge className="bg-sam-warning text-black hover:bg-sam-warning">Attention</Badge>;
  }

  if (["critical", "down", "failed", "offline"].includes(v)) {
    return <Badge variant="destructive">Down</Badge>;
  }

  return <Badge variant="secondary">{String(value)}</Badge>;
}
