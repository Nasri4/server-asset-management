/**
 * Monitoring Routes
 * 
 * - GET /api/monitoring - List all monitoring data
 * - PATCH /api/monitoring/:id - Update monitoring thresholds
 * - POST /api/monitoring/webhook/incident - Create incident from monitoring alert
 * - POST /api/monitoring/webhook/recovery - Auto-resolve incident
 */

import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../utils/asyncHandler";
import { validateBody } from "../middleware/validate";
import { verifyWebhookSecret, webhookRateLimit } from "../middleware/webhookAuth";
import { requirePermission } from "../middleware/permissions";
import { HttpError } from "../middleware/error";
import { ok } from "../utils/response";
import { query, queryRaw } from "../db/sql";
import { sendIncidentAlert, sendRecoveryAlert } from "../services/notificationService";
import { audit } from "../utils/audit";

export const monitoringRouter = Router();

// =====================================================
// MONITORING CRUD ENDPOINTS
// =====================================================

/**
 * GET /api/monitoring
 * Permission: monitoring.read
 */
monitoringRouter.get(
	"/",
	requirePermission("monitoring.read"),
	asyncHandler(async (req, res) => {
		const serverId = req.query.server_id ? Number(req.query.server_id) : null;
		const rows = await query(`
			SELECT 
				m.monitoring_id,
				m.server_id,
				s.server_code,
				s.hostname,
				l.site_name AS location_name,
				t.team_name,
				m.monitoring_tool,
				m.cpu_threshold,
				m.ram_threshold,
				m.disk_threshold,
				m.health_status,
				m.uptime_percent,
				m.last_health_check,
				m.created_at,
				m.updated_at
			FROM dbo.server_monitoring m
			INNER JOIN dbo.servers s ON s.server_id = m.server_id
			LEFT JOIN dbo.locations l ON l.location_id = s.location_id
			LEFT JOIN dbo.teams t ON t.team_id = s.team_id
			WHERE (@server_id IS NULL OR m.server_id = @server_id)
			ORDER BY m.monitoring_id DESC
		`, (r) => r.input("server_id", serverId));
		return ok(res, rows);
	})
);

const updateSchema = z.object({
	monitoring_tool: z.string().trim().optional(),
	cpu_threshold: z.number().min(0).max(100).optional(),
	ram_threshold: z.number().min(0).max(100).optional(),
	disk_threshold: z.number().min(0).max(100).optional(),
	health_status: z.enum(["Healthy", "Warning", "Critical", "Unknown"]).optional(),
	uptime_percent: z.number().min(0).max(100).optional(),
});

/**
 * PATCH /api/monitoring/:id
 * Permission: monitoring.update
 */
monitoringRouter.patch(
	"/:id",
	requirePermission("monitoring.update"),
	validateBody(updateSchema),
	asyncHandler(async (req, res) => {
		const id = Number(req.params.id);
		const body = req.body as z.infer<typeof updateSchema>;

		// Build SET clause dynamically
		const updates: string[] = [];
		const params: any = { id };

		if (body.monitoring_tool !== undefined) {
			updates.push("monitoring_tool = @monitoring_tool");
			params.monitoring_tool = body.monitoring_tool || null;
		}
		if (body.cpu_threshold !== undefined) {
			updates.push("cpu_threshold = @cpu_threshold");
			params.cpu_threshold = body.cpu_threshold;
		}
		if (body.ram_threshold !== undefined) {
			updates.push("ram_threshold = @ram_threshold");
			params.ram_threshold = body.ram_threshold;
		}
		if (body.disk_threshold !== undefined) {
			updates.push("disk_threshold = @disk_threshold");
			params.disk_threshold = body.disk_threshold;
		}
		if (body.health_status !== undefined) {
			updates.push("health_status = @health_status");
			params.health_status = body.health_status;
		}
		if (body.uptime_percent !== undefined) {
			updates.push("uptime_percent = @uptime_percent");
			params.uptime_percent = body.uptime_percent;
		}

		if (updates.length > 0) {
			updates.push("last_health_check = GETDATE()");
			updates.push("updated_at = GETDATE()");

			await query(
				`UPDATE dbo.server_monitoring SET ${updates.join(", ")} WHERE monitoring_id = @id`,
				(r) => {
					r.input("id", id);
					Object.keys(params).forEach((key) => {
						if (key !== "id") r.input(key, params[key]);
					});
				}
			);
		}

		await audit({
			actor: req.user!.username,
			action: "UPDATE",
			entity: "monitoring",
			entityId: id,
			details: body,
		});

		return ok(res, true);
	})
);

// =====================================================
// WEBHOOK ENDPOINTS
// =====================================================

// =====================================================
// WEBHOOK PAYLOAD SCHEMAS
// =====================================================

const incidentWebhookSchema = z.object({
	source: z.string().trim().min(1).max(100),
	server_id: z.number().int().positive().optional(),
	server_code: z.string().trim().min(1).max(50).optional(),
	metric: z.string().trim().min(1).max(100),
	severity: z.enum(["Info", "Warning", "Critical"]).optional(),
	message: z.string().trim().min(1).max(500),
	timestamp: z.string().datetime().optional(),
	fingerprint: z.string().trim().max(255).optional(),
});

const recoveryWebhookSchema = z.object({
	server_id: z.number().int().positive().optional(),
	server_code: z.string().trim().min(1).max(50).optional(),
	metric: z.string().trim().min(1).max(100),
	message: z.string().trim().min(1).max(500),
	timestamp: z.string().datetime().optional(),
});

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Resolve server_id from server_code if needed
 */
async function resolveServerId(server_id?: number, server_code?: string): Promise<number> {
	if (server_id) {
		return server_id;
	}

	if (!server_code) {
		throw new HttpError(400, "Either server_id or server_code is required", "MISSING_SERVER_ID");
	}

	const rows = await query<{ server_id: number }>(
		`SELECT TOP 1 server_id FROM dbo.servers WHERE server_code = @server_code`,
		(r) => r.input("server_code", server_code)
	);

	if (!rows[0]) {
		throw new HttpError(404, `Server not found with code: ${server_code}`, "SERVER_NOT_FOUND");
	}

	return rows[0].server_id;
}

/**
 * Auto-map severity based on metric
 */
function autoMapSeverity(metric: string, severity?: string): string {
	if (severity) {
		return severity;
	}

	const metricLower = metric.toLowerCase();

	// Critical patterns
	if (
		metricLower.includes("down") ||
		metricLower.includes("offline") ||
		metricLower.includes("failed") ||
		metricLower.includes("ping") ||
		metricLower.includes("unreachable")
	) {
		return "Critical";
	}

	// Warning patterns
	if (
		metricLower.includes("cpu") ||
		metricLower.includes("ram") ||
		metricLower.includes("memory") ||
		metricLower.includes("disk") ||
		metricLower.includes("storage") ||
		metricLower.includes("high") ||
		metricLower.includes("threshold")
	) {
		return "Warning";
	}

	// Default
	return "Info";
}

/**
 * Fetch server and team info for notifications
 */
async function getServerNotificationInfo(incident_id: number) {
	const rows = await query(
		`
		SELECT TOP 1
			i.incident_id,
			i.server_id,
			s.server_code,
			s.hostname,
			i.incident_type,
			i.severity,
			i.description,
			i.status,
			s.team_id,
			t.team_name,
			t.oncall_phone,
			t.oncall_email
		FROM dbo.server_incidents i
		JOIN dbo.servers s ON s.server_id = i.server_id
		LEFT JOIN dbo.teams t ON t.team_id = s.team_id
		WHERE i.incident_id = @incident_id
		`,
		(r) => r.input("incident_id", incident_id)
	);

	return rows[0] || null;
}

// =====================================================
// WEBHOOK ENDPOINTS
// =====================================================

/**
 * POST /api/monitoring/webhook/incident
 * Create or update incident from monitoring alert
 */
monitoringRouter.post(
	"/webhook/incident",
	verifyWebhookSecret,
	webhookRateLimit(100, 1), // 100 requests per minute
	validateBody(incidentWebhookSchema),
	asyncHandler(async (req, res) => {
		const body = req.body as z.infer<typeof incidentWebhookSchema>;

		// Resolve server ID
		const serverId = await resolveServerId(body.server_id, body.server_code);

		// Auto-map severity
		const severity = autoMapSeverity(body.metric, body.severity);

		// Get dedup window from env
		const dedupWindowMinutes = parseInt(process.env.INCIDENT_DEDUP_WINDOW_MINUTES || "30", 10);

		// Call stored procedure for auto-upsert
		const result = await queryRaw(
			`EXEC dbo.sp_incident_auto_upsert
				@server_id = @server_id,
				@incident_type = @incident_type,
				@severity = @severity,
				@description = @description,
				@source = @source,
				@fingerprint = @fingerprint,
				@dedup_window_minutes = @dedup_window_minutes,
				@actor = @actor`,
			(r) => {
				r.input("server_id", serverId);
				r.input("incident_type", body.metric);
				r.input("severity", severity);
				r.input("description", body.message);
				r.input("source", body.source);
				r.input("fingerprint", body.fingerprint || null);
				r.input("dedup_window_minutes", dedupWindowMinutes);
				r.input("actor", "monitoring-webhook");
			}
		);

		const incidentId = result.recordset[0]?.incident_id;
		const wasCreated = result.recordset[0]?.was_created;

		if (!incidentId) {
			throw new HttpError(500, "Failed to create/update incident", "INCIDENT_UPSERT_FAILED");
		}

		// Send notification if incident was created (not deduplicated)
		if (wasCreated) {
			try {
				const notificationInfo = await getServerNotificationInfo(incidentId);
				if (notificationInfo) {
					await sendIncidentAlert(notificationInfo);
				}
			} catch (notifyError) {
				console.error("[monitoring-webhook] Notification failed:", notifyError);
				// Don't fail the request if notification fails
			}
		}

		return ok(res, {
			incident_id: incidentId,
			was_created: Boolean(wasCreated),
			action: wasCreated ? "created" : "deduplicated",
			server_id: serverId,
		});
	})
);

/**
 * POST /api/monitoring/webhook/recovery
 * Auto-resolve incident when monitoring recovers
 */
monitoringRouter.post(
	"/webhook/recovery",
	verifyWebhookSecret,
	webhookRateLimit(100, 1),
	validateBody(recoveryWebhookSchema),
	asyncHandler(async (req, res) => {
		const body = req.body as z.infer<typeof recoveryWebhookSchema>;

		// Resolve server ID
		const serverId = await resolveServerId(body.server_id, body.server_code);

		// Call stored procedure for auto-resolve
		const result = await queryRaw(
			`EXEC dbo.sp_incident_auto_resolve
				@server_id = @server_id,
				@incident_type = @incident_type,
				@message = @message,
				@actor = @actor`,
			(r) => {
				r.input("server_id", serverId);
				r.input("incident_type", body.metric);
				r.input("message", body.message);
				r.input("actor", "monitoring-webhook");
			}
		);

		const resolvedIncidentId = result.recordset[0]?.resolved_incident_id;

		if (!resolvedIncidentId) {
			// No open incident found - this is OK
			return ok(res, {
				resolved: false,
				message: "No open incident found for this server and metric",
				server_id: serverId,
			});
		}

		// Send recovery notification
		try {
			const notificationInfo = await getServerNotificationInfo(resolvedIncidentId);
			if (notificationInfo) {
				await sendRecoveryAlert(notificationInfo);
			}
		} catch (notifyError) {
			console.error("[monitoring-webhook] Recovery notification failed:", notifyError);
		}

		return ok(res, {
			resolved: true,
			incident_id: resolvedIncidentId,
			server_id: serverId,
		});
	})
);

// =====================================================
// MONITORING DATA MANAGEMENT ENDPOINTS
// =====================================================

/**
 * GET /api/monitoring
 * List all server monitoring data
 * Permission: monitoring.read
 */
monitoringRouter.get(
	"/",
	asyncHandler(async (_req, res) => {
		const rows = await query(`
			SELECT 
				m.monitoring_id,
				m.server_id,
				s.server_code,
				s.hostname,
				l.site_name AS location_name,
				t.team_name,
				m.monitoring_tool,
				m.cpu_threshold,
				m.ram_threshold,
				m.disk_threshold,
				m.health_status,
				m.uptime_percent,
				m.last_health_check,
				m.created_at,
				m.updated_at
			FROM dbo.server_monitoring m
			LEFT JOIN dbo.servers s ON s.server_id = m.server_id
			LEFT JOIN dbo.locations l ON l.location_id = s.location_id
			LEFT JOIN dbo.teams t ON t.team_id = s.team_id
			ORDER BY m.monitoring_id DESC
		`);

		return ok(res, rows);
	})
);

/**
 * POST /api/monitoring
 * Create new monitoring record
 * Permission: monitoring.update
 */
const createMonitoringSchema = z.object({
	server_id: z.number().int().positive(),
	monitoring_tool: z.string().trim().optional(),
	cpu_threshold: z.number().min(0).max(100).default(80),
	ram_threshold: z.number().min(0).max(100).default(80),
	disk_threshold: z.number().min(0).max(100).default(90),
	health_status: z.enum(["Healthy", "Warning", "Critical", "Unknown"]).default("Healthy"),
	uptime_percent: z.number().min(0).max(100).default(99.9),
});

monitoringRouter.post(
	"/",
	validateBody(createMonitoringSchema),
	asyncHandler(async (req, res) => {
		const body = req.body as z.infer<typeof createMonitoringSchema>;

		// Check if monitoring already exists for this server
		const existing = await query<{ monitoring_id: number }>(
			`SELECT TOP 1 monitoring_id FROM dbo.server_monitoring WHERE server_id = @server_id`,
			(r) => r.input("server_id", body.server_id)
		);

		if (existing[0]) {
			throw new HttpError(409, "Monitoring already exists for this server", "MONITORING_EXISTS");
		}

		const rows = await query<{ monitoring_id: number }>(
			`
			INSERT INTO dbo.server_monitoring 
				(server_id, monitoring_tool, cpu_threshold, ram_threshold, disk_threshold, health_status, uptime_percent, last_health_check)
			OUTPUT INSERTED.monitoring_id
			VALUES (@server_id, @monitoring_tool, @cpu_threshold, @ram_threshold, @disk_threshold, @health_status, @uptime_percent, GETDATE())
			`,
			(r) => {
				r.input("server_id", body.server_id);
				r.input("monitoring_tool", body.monitoring_tool || null);
				r.input("cpu_threshold", body.cpu_threshold);
				r.input("ram_threshold", body.ram_threshold);
				r.input("disk_threshold", body.disk_threshold);
				r.input("health_status", body.health_status);
				r.input("uptime_percent", body.uptime_percent);
			}
		);

		return ok(res, { monitoring_id: rows[0]?.monitoring_id });
	})
);

/**
 * PATCH /api/monitoring/:id
 * Update monitoring configuration
 * Permission: monitoring.update
 */
const updateMonitoringSchema = z.object({
	monitoring_tool: z.string().trim().optional(),
	cpu_threshold: z.number().min(0).max(100).optional(),
	ram_threshold: z.number().min(0).max(100).optional(),
	disk_threshold: z.number().min(0).max(100).optional(),
	health_status: z.enum(["Healthy", "Warning", "Critical", "Unknown"]).optional(),
	uptime_percent: z.number().min(0).max(100).optional(),
});

monitoringRouter.patch(
	"/:id",
	validateBody(updateMonitoringSchema),
	asyncHandler(async (req, res) => {
		const id = Number(req.params.id);
		const body = req.body as z.infer<typeof updateMonitoringSchema>;

		// Build SET clause dynamically
		const updates: string[] = [];
		const params: Record<string, any> = { id };

		if (body.monitoring_tool !== undefined) {
			updates.push("monitoring_tool = @monitoring_tool");
			params.monitoring_tool = body.monitoring_tool || null;
		}
		if (body.cpu_threshold !== undefined) {
			updates.push("cpu_threshold = @cpu_threshold");
			params.cpu_threshold = body.cpu_threshold;
		}
		if (body.ram_threshold !== undefined) {
			updates.push("ram_threshold = @ram_threshold");
			params.ram_threshold = body.ram_threshold;
		}
		if (body.disk_threshold !== undefined) {
			updates.push("disk_threshold = @disk_threshold");
			params.disk_threshold = body.disk_threshold;
		}
		if (body.health_status !== undefined) {
			updates.push("health_status = @health_status");
			params.health_status = body.health_status;
		}
		if (body.uptime_percent !== undefined) {
			updates.push("uptime_percent = @uptime_percent");
			params.uptime_percent = body.uptime_percent;
		}

		if (updates.length === 0) {
			return ok(res, { message: "No changes" });
		}

		updates.push("updated_at = GETDATE()");

		await query(
			`UPDATE dbo.server_monitoring SET ${updates.join(", ")} WHERE monitoring_id = @id`,
			(r) => {
				Object.entries(params).forEach(([key, value]) => {
					r.input(key, value);
				});
			}
		);

		return ok(res, { message: "Updated" });
	})
);

/**
 * GET /api/monitoring/webhook/health
 * Health check endpoint (no auth required)
 */
monitoringRouter.get("/webhook/health", (_req, res) => {
	return ok(res, {
		status: "healthy",
		timestamp: new Date().toISOString(),
		webhook_configured: Boolean(process.env.MONITORING_WEBHOOK_SECRET),
		notify_mode: process.env.NOTIFY_MODE || "mock",
	});
});
