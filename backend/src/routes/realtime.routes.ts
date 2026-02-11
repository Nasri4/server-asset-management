/**
 * REAL-TIME SSE ROUTES
 * 
 * Provides SSE (Server-Sent Events) endpoints for real-time updates
 */

import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { realtimeService } from "../services/realtimeService";
import { v4 as uuidv4 } from "uuid";

const router = Router();

/**
 * SSE Connection Endpoint
 * GET /api/realtime/events
 * 
 * Establishes a persistent SSE connection for real-time updates
 */
router.get("/events", requireAuth, (req, res) => {
  const user = req.user;
  const clientId = uuidv4();
  
  // Add client to realtime service
  realtimeService.addClient(
    clientId,
    res,
    user?.userId || null,
    user?.teamId || null
  );
  
  // Keep connection alive with periodic comments
  const keepAlive = setInterval(() => {
    res.write(": keepalive\n\n");
  }, 15000); // Every 15 seconds
  
  // Cleanup on disconnect
  req.on("close", () => {
    clearInterval(keepAlive);
    realtimeService.removeClient(clientId);
  });
});

/**
 * Subscribe to specific server
 * POST /api/realtime/subscribe/:serverId
 */
router.post("/subscribe/:serverId", requireAuth, (req, res) => {
  const serverId = parseInt(req.params.serverId);
  const clientId = req.body.clientId;
  
  if (!clientId) {
    return res.status(400).json({ error: "clientId required" });
  }
  
  realtimeService.subscribeToServer(clientId, serverId);
  res.json({ success: true, serverId, clientId });
});

/**
 * Unsubscribe from specific server
 * POST /api/realtime/unsubscribe/:serverId
 */
router.post("/unsubscribe/:serverId", requireAuth, (req, res) => {
  const serverId = parseInt(req.params.serverId);
  const clientId = req.body.clientId;
  
  if (!clientId) {
    return res.status(400).json({ error: "clientId required" });
  }
  
  realtimeService.unsubscribeFromServer(clientId, serverId);
  res.json({ success: true, serverId, clientId });
});

/**
 * Get realtime service stats
 * GET /api/realtime/stats
 */
router.get("/stats", requireAuth, (req, res) => {
  const stats = realtimeService.getStats();
  res.json({ data: stats });
});

/**
 * Health check
 * GET /api/realtime/health
 */
router.get("/health", (req, res) => {
  res.json({ ok: true, service: "Realtime SSE" });
});

export const realtimeRouter = router;
