/**
 * Webhook Authentication Middleware
 * 
 * Validates incoming webhook requests using a shared secret
 * Prevents unauthorized incident creation from external sources
 */

import { Request, Response, NextFunction } from "express";
import { HttpError } from "./error";
import { audit } from "../utils/audit";

/**
 * Verify webhook secret from request header
 */
export function verifyWebhookSecret(req: Request, res: Response, next: NextFunction) {
	const providedSecret = req.headers["x-webhook-secret"] as string | undefined;
	const expectedSecret = process.env.MONITORING_WEBHOOK_SECRET;

	// If no secret is configured, log warning and allow (development mode)
	if (!expectedSecret) {
		console.warn(
			"[webhook-auth] WARNING: MONITORING_WEBHOOK_SECRET not configured. Webhook is unprotected!"
		);
		return next();
	}

	// Validate secret
	if (!providedSecret) {
		void audit({
			actor: "webhook",
			action: "WEBHOOK_AUTH_FAILED",
			entity: "monitoring_webhook",
			entityId: null,
			details: {
				reason: "Missing x-webhook-secret header",
				ip: req.ip,
				path: req.path,
			},
		});

		throw new HttpError(
			401,
			"Missing x-webhook-secret header",
			"WEBHOOK_AUTH_MISSING"
		);
	}

	if (providedSecret !== expectedSecret) {
		void audit({
			actor: "webhook",
			action: "WEBHOOK_AUTH_FAILED",
			entity: "monitoring_webhook",
			entityId: null,
			details: {
				reason: "Invalid webhook secret",
				ip: req.ip,
				path: req.path,
			},
		});

		throw new HttpError(
			401,
			"Invalid webhook secret",
			"WEBHOOK_AUTH_INVALID"
		);
	}

	// Success
	next();
}

/**
 * Rate limiting for webhook endpoints
 * Simple in-memory implementation
 * For production, use Redis-based rate limiter
 */

interface RateLimitEntry {
	count: number;
	resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup old entries every 5 minutes
setInterval(() => {
	const now = Date.now();
	for (const [key, entry] of rateLimitStore.entries()) {
		if (entry.resetAt < now) {
			rateLimitStore.delete(key);
		}
	}
}, 5 * 60 * 1000);

export function webhookRateLimit(maxRequests: number = 100, windowMinutes: number = 1) {
	return (req: Request, res: Response, next: NextFunction) => {
		const clientKey = req.ip || "unknown";
		const now = Date.now();
		const windowMs = windowMinutes * 60 * 1000;

		let entry = rateLimitStore.get(clientKey);

		if (!entry || entry.resetAt < now) {
			// New window
			entry = {
				count: 1,
				resetAt: now + windowMs,
			};
			rateLimitStore.set(clientKey, entry);
			return next();
		}

		if (entry.count >= maxRequests) {
			// Rate limit exceeded
			void audit({
				actor: "webhook",
				action: "WEBHOOK_RATE_LIMIT",
				entity: "monitoring_webhook",
				entityId: null,
				details: {
					ip: req.ip,
					path: req.path,
					count: entry.count,
					max: maxRequests,
					window_minutes: windowMinutes,
				},
			});

			res.setHeader("X-RateLimit-Limit", maxRequests.toString());
			res.setHeader("X-RateLimit-Remaining", "0");
			res.setHeader("X-RateLimit-Reset", new Date(entry.resetAt).toISOString());

			throw new HttpError(
				429,
				`Rate limit exceeded. Max ${maxRequests} requests per ${windowMinutes} minute(s)`,
				"RATE_LIMIT_EXCEEDED"
			);
		}

		// Increment count
		entry.count += 1;
		rateLimitStore.set(clientKey, entry);

		res.setHeader("X-RateLimit-Limit", maxRequests.toString());
		res.setHeader("X-RateLimit-Remaining", (maxRequests - entry.count).toString());
		res.setHeader("X-RateLimit-Reset", new Date(entry.resetAt).toISOString());

		next();
	};
}
