/**
 * Notification Service (Placeholder Implementation)
 * 
 * Sends incident alerts to teams via SMS/Email
 * Currently in MOCK mode - logs to console + audit
 * 
 * Future integrations:
 * - SMS: Twilio, AWS SNS, local SMS gateway
 * - Email: SendGrid, AWS SES, SMTP
 * - Push: FCM, APNs
 * - Slack/Teams: Webhooks
 */

import { audit } from "../utils/audit";

type NotifyMode = "mock" | "local_sms" | "email_smtp";

interface IncidentNotification {
	incident_id: number;
	server_id: number;
	server_code: string | null;
	hostname: string | null;
	incident_type: string;
	severity: string;
	description: string;
	status: string;
	team_id: number | null;
	team_name: string | null;
	oncall_phone: string | null;
	oncall_email: string | null;
}

interface NotificationResult {
	sent: number;
	skipped: number;
	mode: string;
	channels: {
		sms?: boolean;
		email?: boolean;
	};
}

/**
 * Get notification mode from environment
 */
function getNotifyMode(): NotifyMode {
	const mode = (process.env.NOTIFY_MODE || "mock").toLowerCase();
	if (!["mock", "local_sms", "email_smtp"].includes(mode)) {
		console.warn(`[notification] Invalid NOTIFY_MODE="${mode}", falling back to "mock"`);
		return "mock";
	}
	return mode as NotifyMode;
}

/**
 * Format incident message for notifications
 */
function formatIncidentMessage(incident: IncidentNotification): string {
	const serverLabel = [incident.server_code, incident.hostname]
		.filter(Boolean)
		.join(" ")
		.trim() || `Server #${incident.server_id}`;

	const severityEmoji = {
		Critical: "🔴",
		Warning: "🟡",
		Info: "🔵",
	}[incident.severity] || "⚪";

	return [
		`${severityEmoji} INCIDENT ALERT`,
		`Server: ${serverLabel}`,
		`Type: ${incident.incident_type}`,
		`Severity: ${incident.severity}`,
		`Status: ${incident.status}`,
		`Details: ${incident.description.substring(0, 200)}`,
	].join(" | ");
}

/**
 * Send incident alert notification (MOCK mode)
 */
async function sendIncidentAlertMock(
	incident: IncidentNotification
): Promise<NotificationResult> {
	const message = formatIncidentMessage(incident);

	console.log("");
	console.log("┌─────────────────────────────────────────────────");
	console.log("│ 📢 INCIDENT NOTIFICATION (MOCK MODE)");
	console.log("├─────────────────────────────────────────────────");
	console.log(`│ Incident ID: ${incident.incident_id}`);
	console.log(`│ Team: ${incident.team_name || "Unassigned"}`);
	console.log(`│ OnCall Phone: ${incident.oncall_phone || "Not set"}`);
	console.log(`│ OnCall Email: ${incident.oncall_email || "Not set"}`);
	console.log("├─────────────────────────────────────────────────");
	console.log(`│ Message:`);
	console.log(`│ ${message}`);
	console.log("└─────────────────────────────────────────────────");
	console.log("");

	// Log to audit
	await audit({
		actor: "system",
		action: "NOTIFICATION_MOCK",
		entity: "server_incidents",
		entityId: incident.incident_id,
		details: {
			team_id: incident.team_id,
			team_name: incident.team_name,
			oncall_phone: incident.oncall_phone,
			oncall_email: incident.oncall_email,
			message,
		},
	});

	return {
		sent: 1,
		skipped: 0,
		mode: "mock",
		channels: { sms: true, email: true },
	};
}

/**
 * Send incident alert notification (Local SMS)
 * Placeholder for future SMS gateway integration
 */
async function sendIncidentAlertSMS(
	incident: IncidentNotification
): Promise<NotificationResult> {
	const message = formatIncidentMessage(incident);
	const phone = incident.oncall_phone;

	if (!phone) {
		console.warn(`[notification] No oncall phone for team_id=${incident.team_id}`);
		return { sent: 0, skipped: 1, mode: "local_sms", channels: { sms: false } };
	}

	const smsApiUrl = process.env.SMS_LOCAL_API_URL || "";
	if (!smsApiUrl) {
		console.warn("[notification] SMS_LOCAL_API_URL not configured, falling back to mock");
		return sendIncidentAlertMock(incident);
	}

	try {
		// TODO: Implement actual SMS API call
		console.log(`[notification] Would send SMS to ${phone}: ${message}`);

		await audit({
			actor: "system",
			action: "NOTIFICATION_SMS",
			entity: "server_incidents",
			entityId: incident.incident_id,
			details: {
				phone,
				message,
				api_url: smsApiUrl,
			},
		});

		return { sent: 1, skipped: 0, mode: "local_sms", channels: { sms: true } };
	} catch (error) {
		console.error("[notification] SMS send failed:", error);
		return { sent: 0, skipped: 1, mode: "local_sms", channels: { sms: false } };
	}
}

/**
 * Send incident alert notification (Email SMTP)
 * Placeholder for future email integration
 */
async function sendIncidentAlertEmail(
	incident: IncidentNotification
): Promise<NotificationResult> {
	const message = formatIncidentMessage(incident);
	const email = incident.oncall_email;

	if (!email) {
		console.warn(`[notification] No oncall email for team_id=${incident.team_id}`);
		return { sent: 0, skipped: 1, mode: "email_smtp", channels: { email: false } };
	}

	const smtpHost = process.env.EMAIL_SMTP_HOST || "";
	if (!smtpHost) {
		console.warn("[notification] EMAIL_SMTP_HOST not configured, falling back to mock");
		return sendIncidentAlertMock(incident);
	}

	try {
		// TODO: Implement actual SMTP email send
		console.log(`[notification] Would send email to ${email}: ${message}`);

		await audit({
			actor: "system",
			action: "NOTIFICATION_EMAIL",
			entity: "server_incidents",
			entityId: incident.incident_id,
			details: {
				email,
				message,
				smtp_host: smtpHost,
			},
		});

		return { sent: 1, skipped: 0, mode: "email_smtp", channels: { email: true } };
	} catch (error) {
		console.error("[notification] Email send failed:", error);
		return { sent: 0, skipped: 1, mode: "email_smtp", channels: { email: false } };
	}
}

/**
 * Main notification dispatcher
 */
export async function sendIncidentAlert(
	incident: IncidentNotification
): Promise<NotificationResult> {
	const mode = getNotifyMode();

	switch (mode) {
		case "local_sms":
			return sendIncidentAlertSMS(incident);
		case "email_smtp":
			return sendIncidentAlertEmail(incident);
		case "mock":
		default:
			return sendIncidentAlertMock(incident);
	}
}

/**
 * Send recovery notification
 */
export async function sendRecoveryAlert(incident: IncidentNotification): Promise<NotificationResult> {
	// Similar to incident alert but with recovery message
	const mode = getNotifyMode();
	
	if (mode === "mock") {
		console.log(`[notification] 🟢 RECOVERY: Incident #${incident.incident_id} resolved`);
	}

	await audit({
		actor: "system",
		action: "NOTIFICATION_RECOVERY",
		entity: "server_incidents",
		entityId: incident.incident_id,
		details: {
			team_id: incident.team_id,
			mode,
		},
	});

	return { sent: 1, skipped: 0, mode, channels: { sms: true, email: true } };
}
