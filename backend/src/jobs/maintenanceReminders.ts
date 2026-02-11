import axios from "axios";

import { env } from "../config/env";
import { query } from "../db/sql";
import { audit } from "../utils/audit";

type EngineerRecipient = {
  engineer_id: number;
  full_name: string;
  phone: string | null;
};

type MaintenanceSummary = {
  maintenance_id: number;
  server_id: number;
  server_code: string | null;
  hostname: string | null;
  maintenance_type: string | null;
  maintenance_frequency: string | null;
  next_maintenance: string | null;
};

function buildSmsMessage(m: MaintenanceSummary) {
  const serverLabel = [m.server_code, m.hostname].filter(Boolean).join(" ").trim() || `Server #${m.server_id}`;
  const typeLabel = m.maintenance_type ? `Type: ${m.maintenance_type}` : "";
  const freqLabel = m.maintenance_frequency ? `Frequency: ${m.maintenance_frequency}` : "";
  const nextLabel = m.next_maintenance ? `Next: ${m.next_maintenance}` : "";

  return [
    "SAM Maintenance Reminder",
    serverLabel,
    typeLabel,
    freqLabel,
    nextLabel,
  ]
    .filter(Boolean)
    .join(" | ");
}

async function getMaintenanceSummary(maintenanceId: number): Promise<MaintenanceSummary | null> {
  const hasFrequencyRows = await query<{ len: number | null }>(
    "SELECT COL_LENGTH('dbo.server_maintenance', 'maintenance_frequency') AS len"
  );
  const hasFrequency = hasFrequencyRows?.[0]?.len != null;

  const rows = await query<MaintenanceSummary>(
    `
    SELECT TOP 1
      m.maintenance_id,
      m.server_id,
      s.server_code,
      s.hostname,
      m.maintenance_type,
      ${hasFrequency ? "m.maintenance_frequency" : "CAST(NULL AS nvarchar(20)) AS maintenance_frequency"},
      m.next_maintenance
    FROM dbo.server_maintenance m
    JOIN dbo.servers s ON s.server_id = m.server_id
    WHERE m.maintenance_id = @id
    `,
    (r) => r.input("id", maintenanceId)
  );

  return rows[0] ?? null;
}

async function getActiveRecipients(maintenanceId: number): Promise<EngineerRecipient[]> {
  const rows = await query<EngineerRecipient>(
    `
    SELECT
      e.engineer_id,
      e.full_name,
      e.phone
    FROM dbo.maintenance_assignments ma
    JOIN dbo.engineers e ON e.engineer_id = ma.engineer_id
    WHERE ma.maintenance_id = @id
      AND ma.is_active = 1
    ORDER BY e.full_name ASC
    `,
    (r) => r.input("id", maintenanceId)
  );

  return (rows ?? []).filter((r) => r && r.engineer_id);
}

async function sendSms(to: string, message: string) {
  const url = (env.notifications.smsApiUrl ?? "").trim();
  if (!url) {
    // Placeholder mode: no outbound call.
    if (env.nodeEnv !== "production") {
      console.log(`[maintenance-reminder] SMS (placeholder) to=${to}`);
    }
    return;
  }

  await axios.post(
    url,
    {
      to,
      message,
      source: "SAM",
      kind: "maintenance_reminder",
    },
    {
      timeout: 10_000,
    }
  );
}

export async function sendReminderForMaintenance(params: {
  maintenanceId: number;
  mode: "AUTO" | "MANUAL";
  actor: string;
  reminderId?: number | null;
}) {
  const summary = await getMaintenanceSummary(params.maintenanceId);
  if (!summary) return { sent: 0, skipped: 0 };

  const recipients = await getActiveRecipients(params.maintenanceId);
  const message = buildSmsMessage(summary);

  let sent = 0;
  let skipped = 0;

  for (const r of recipients) {
    const phone = (r.phone ?? "").trim();
    if (!phone) {
      skipped += 1;
      continue;
    }

    try {
      await sendSms(phone, message);
      sent += 1;
    } catch (e) {
      // Do not mark reminder as sent if sending fails.
      console.warn(`[maintenance-reminder] SMS failed to engineer_id=${r.engineer_id}:`, e);
    }
  }

  await audit({
    actor: params.actor,
    action: params.mode === "AUTO" ? "SMS_SENT" : "SMS_SENT_MANUAL",
    entity: "maintenance_reminders",
    entityId: params.reminderId ?? params.maintenanceId,
    details: {
      maintenance_id: params.maintenanceId,
      reminder_id: params.reminderId ?? null,
      recipients: recipients.map((r) => ({ engineer_id: r.engineer_id, phone: r.phone })),
      sent,
      skipped,
      sms_api_url_configured: Boolean((env.notifications.smsApiUrl ?? "").trim()),
    },
  });

  return { sent, skipped };
}

export async function processDueMaintenanceReminders() {
  const remindersTable = await query<{ obj: number | null }>(
    "SELECT OBJECT_ID('dbo.maintenance_reminders') AS obj"
  );
  const assignmentsTable = await query<{ obj: number | null }>(
    "SELECT OBJECT_ID('dbo.maintenance_assignments') AS obj"
  );

  if (!remindersTable?.[0]?.obj || !assignmentsTable?.[0]?.obj) return;

  const due = await query<{ reminder_id: number; maintenance_id: number }>(
    `
    SELECT TOP 500 reminder_id, maintenance_id
    FROM dbo.maintenance_reminders
    WHERE is_sent = 0
      AND CAST(reminder_date AS date) = CAST(GETDATE() AS date)
    ORDER BY reminder_date ASC
    `
  );

  for (const r of due) {
    const result = await sendReminderForMaintenance({
      maintenanceId: r.maintenance_id,
      reminderId: r.reminder_id,
      mode: "AUTO",
      actor: "system",
    });

    // Mark sent if at least one recipient SMS was sent, or if there are no recipients.
    // This prevents re-sending endlessly when there is no engineer assigned.
    if (result.sent > 0 || result.skipped > 0) {
      await query(
        `UPDATE dbo.maintenance_reminders SET is_sent = 1 WHERE reminder_id = @id`,
        (q) => q.input("id", r.reminder_id)
      );
    }
  }
}

export function startMaintenanceReminderScheduler() {
  // Lightweight “cron-like” job: run on startup and then every hour.
  // This avoids adding extra runtime deps while meeting the daily-job requirement.
  void processDueMaintenanceReminders();
  setInterval(() => {
    void processDueMaintenanceReminders();
  }, 60 * 60 * 1000);
}
