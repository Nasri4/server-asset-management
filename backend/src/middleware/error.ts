import { Request, Response, NextFunction } from "express";

export class HttpError extends Error {
  status: number;
  code?: string;
  details?: any;
  constructor(status: number, message: string, code?: string, details?: any) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function pickSqlServerErrorNumber(err: any): number | undefined {
  const candidates = [
    err?.number,
    err?.originalError?.number,
    err?.originalError?.info?.number,
    err?.cause?.number,
    err?.cause?.originalError?.info?.number
  ];

  for (const n of candidates) {
    if (typeof n === "number") return n;
  }
  return undefined;
}

function parseSqlServerDuplicateDetails(message?: string): { constraint?: string; object?: string; index?: string } {
  if (!message) return {};
  const constraint = /constraint\s+'([^']+)'/i.exec(message)?.[1];
  const object = /object\s+'([^']+)'/i.exec(message)?.[1];
  const index = /unique index\s+'([^']+)'/i.exec(message)?.[1];
  return { constraint, object, index };
}

function normalizeSqlIdent(v?: string): string {
  if (!v) return "";
  return v
    .toLowerCase()
    .replace(/[\[\]"']/g, "")
    .trim();
}

function includesAny(haystack: string, needles: string[]): boolean {
  for (const n of needles) {
    if (haystack.includes(n)) return true;
  }
  return false;
}

function friendlyDuplicateMessage(details: { constraint?: string; object?: string; index?: string }, rawMessage?: string): {
  message: string;
  field?: string;
} {
  const constraintRaw = normalizeSqlIdent(details.constraint);
  const constraint = constraintRaw.startsWith("df__") ? "" : constraintRaw;
  const object = normalizeSqlIdent(details.object);
  const index = normalizeSqlIdent(details.index);
  const msg = normalizeSqlIdent(rawMessage);

  // Heuristics: match by constraint name first (best), then by object/table name,
  // then by keywords in the raw SQL message.

  if (includesAny(constraint + " " + index + " " + msg, ["server_code", "uq_servers", "servers_server_code"]) || includesAny(object, ["servers"])) {
    return { message: "Server code already exists. Please choose a unique server code.", field: "server_code" };
  }

  if (includesAny(constraint + " " + index + " " + msg, ["team", "teams_name", "uq_teams"]) || includesAny(object, ["teams"])) {
    return { message: "Team name already exists. Please choose a unique team name.", field: "name" };
  }

  if (includesAny(constraint + " " + index + " " + msg, ["location", "locations_name", "uq_locations"]) || includesAny(object, ["locations"])) {
    return { message: "Location name already exists. Please choose a unique location name.", field: "name" };
  }

  if (includesAny(constraint + " " + index + " " + msg, ["rack", "rack_code", "rack_name", "uq_racks"]) || includesAny(object, ["racks"])) {
    return { message: "Rack already exists. Please use a unique rack code/name.", field: "rack_code" };
  }

  if (includesAny(constraint + " " + index + " " + msg, ["hardware", "serial", "asset", "uq_hardware"]) || includesAny(object, ["hardware"])) {
    if (includesAny(constraint + " " + index + " " + msg, ["serial"])) {
      return { message: "Hardware serial number already exists. Please use a unique serial number.", field: "serial_number" };
    }
    if (includesAny(constraint + " " + index + " " + msg, ["asset"])) {
      return { message: "Hardware asset tag already exists. Please use a unique asset tag.", field: "asset_tag" };
    }
    return { message: "Hardware record already exists with the same unique field.", field: "serial_number" };
  }

  if (includesAny(constraint + " " + index + " " + msg, ["network", "ip", "mac", "uq_network"]) || includesAny(object, ["network"])) {
    if (includesAny(constraint + " " + index + " " + msg, ["mac"])) {
      return { message: "MAC address already exists. Please use a unique MAC address.", field: "mac_address" };
    }
    if (includesAny(constraint + " " + index + " " + msg, ["ip"])) {
      return { message: "IP address already exists. Please use a unique IP address.", field: "ip_address" };
    }
    return { message: "Network record already exists with the same unique field.", field: "ip_address" };
  }

  if (includesAny(constraint + " " + index + " " + msg, ["monitor", "monitoring", "uq_monitoring"]) || includesAny(object, ["monitoring"])) {
    return { message: "Monitoring record already exists with the same unique field.", field: "name" };
  }

  if (includesAny(constraint + " " + index + " " + msg, ["incident", "incidents", "uq_incidents"]) || includesAny(object, ["incidents"])) {
    return { message: "Incident already exists with the same unique field.", field: "incident_number" };
  }

  if (includesAny(constraint + " " + index + " " + msg, ["application", "applications", "uq_applications"]) || includesAny(object, ["applications"])) {
    return { message: "Application already exists. Please choose a unique application name.", field: "name" };
  }

  if (includesAny(constraint + " " + index + " " + msg, ["maintenance", "uq_maintenance"]) || includesAny(object, ["maintenance"])) {
    return { message: "Maintenance record already exists for the same server/time/type.", field: "server_id" };
  }

  if (includesAny(constraint + " " + index + " " + msg, ["security", "uq_security"]) || includesAny(object, ["security"])) {
    return { message: "Security record already exists for this server.", field: "server_id" };
  }

  if (includesAny(constraint + " " + index + " " + msg, ["server_credentials", "pk_server_credentials"]) || includesAny(object, ["server_credentials"])) {
    return { message: "Credentials already exist for this server.", field: "server_id" };
  }

  if (includesAny(constraint + " " + index + " " + msg, ["visit", "visits", "uq_visits"]) || includesAny(object, ["visits"])) {
    return { message: "Visit already exists with the same unique field.", field: "visit_id" };
  }

  return {
    message: "Duplicate value: a record with the same unique field already exists."
  };
}

function mapDuplicateError(err: any): { status: number; message: string; code: string; details?: any } | null {
  const number = pickSqlServerErrorNumber(err);

  const msg = typeof err?.message === "string" ? err.message : undefined;

  // SQL Server duplicate key errors:
  //  - 2627: Violation of PRIMARY KEY / UNIQUE constraint
  //  - 2601: Cannot insert duplicate key row in object with unique index
  const msgLooksDuplicate =
    typeof msg === "string" && /duplicate key|unique (?:index|constraint)|cannot insert duplicate key/i.test(msg);

  if (number !== 2627 && number !== 2601 && !msgLooksDuplicate) return null;

  const details = parseSqlServerDuplicateDetails(msg);
  const friendly = friendlyDuplicateMessage(details, msg);

  return {
    status: 409,
    message: friendly.message,
    code: "DUPLICATE_RESOURCE",
    details: {
      ...(Object.keys(details).length ? details : {}),
      ...(friendly.field ? { field: friendly.field } : {})
    }
  };
}

function mapMigrationRequired(err: any): { status: number; message: string; code: string; details?: any } | null {
  const number = pickSqlServerErrorNumber(err);
  const msgRaw = typeof err?.message === "string" ? err.message : "";
  const msg = normalizeSqlIdent(msgRaw);

  // SQL Server schema mismatch errors:
  //  - 208: Invalid object name
  //  - 207: Invalid column name
  const looksSchemaMismatch = number === 208 || number === 207 || /invalid (?:object|column) name/i.test(msgRaw);
  if (!looksSchemaMismatch) return null;

  // Only specialize for the maintenance multi-type migration to avoid changing behavior elsewhere.
  const isMaintenanceMultiType = includesAny(msg, [
    "maintenance_schedule_types",
    "maintenance_type_checklist_items",
    "maintenance_run_checklist_progress"
  ]);
  if (!isMaintenanceMultiType) return null;

  const missing: string[] = [];
  if (msg.includes("maintenance_schedule_types")) missing.push("dbo.maintenance_schedule_types");
  if (msg.includes("maintenance_type_checklist_items") && msg.includes("schedule_id")) {
    missing.push("dbo.maintenance_type_checklist_items.schedule_id");
  }
  if (msg.includes("maintenance_type_checklist_items") && msg.includes("is_custom")) {
    missing.push("dbo.maintenance_type_checklist_items.is_custom");
  }

  return {
    status: 500,
    code: "MIGRATION_REQUIRED",
    message:
      "Database schema is out of date for maintenance operations. Apply migration: backend/sql/migrations/2026-02-02_multi-maintenance-types-and-custom-checklists.sql",
    details: missing.length ? { missing } : undefined
  };
}

function mapFkViolation(err: any): { status: number; message: string; code: string; details?: any } | null {
  const number = pickSqlServerErrorNumber(err);
  const msg = typeof err?.message === "string" ? err.message : "";

  // SQL Server FK violation: 547
  const looksFk = number === 547 || /foreign key constraint/i.test(msg);
  if (!looksFk) return null;

  return {
    status: 400,
    message: "Invalid reference: the related record does not exist or is not allowed.",
    code: "FK_VIOLATION"
  };
}

function safeErrorLog(err: any) {
  const number = pickSqlServerErrorNumber(err);
  const message = typeof err?.message === "string" ? err.message : String(err);
  return {
    message,
    code: err?.code,
    number
  };
}

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  const mappedMigrationRequired = mapMigrationRequired(err);
  const mappedDuplicate = mapDuplicateError(err);
  const mappedFk = mapFkViolation(err);

  const mapped = mappedMigrationRequired ?? mappedDuplicate ?? mappedFk;

  const status = mapped?.status ?? err?.status ?? 500;
  const message = mapped?.message ?? err?.message ?? "Internal Server Error";
  const code = mapped?.code ?? err?.code;
  const details = mapped?.details;

  if (status >= 500) {
    console.error("ERROR:", safeErrorLog(err));
  }

  res.status(status).json({
    error: {
      message,
      code: code ?? undefined,
      details: details ?? undefined
    }
  });
}
