import { Badge } from "@/components/ui/badge";

function normalize(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

export function StatusBadge({ value }: { value: unknown }) {
  const v = normalize(value);

  if (!v) return <Badge variant="secondary">Unknown</Badge>;

  if (["active", "up", "online", "running", "ok"].includes(v)) {
    return <Badge variant="soft-success">Active</Badge>;
  }

  if (["maintenance"].includes(v)) {
    return <Badge variant="soft-warning">Maintenance</Badge>;
  }

  if (["degraded"].includes(v)) {
    return <Badge variant="soft-warning">Degraded</Badge>;
  }

  if (["issue"].includes(v)) {
    return <Badge variant="soft-warning">Issue</Badge>;
  }

  if (["warning"].includes(v)) {
    return <Badge variant="soft-warning">Warning</Badge>;
  }

  if (["down", "critical", "failed", "offline"].includes(v)) {
    return <Badge variant="soft-danger">Down</Badge>;
  }

  return <Badge variant="secondary">{String(value)}</Badge>;
}
