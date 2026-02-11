/**
 * REAL-TIME SERVICE (SSE - Server-Sent Events)
 * 
 * Provides real-time updates to connected clients without polling.
 * Uses Server-Sent Events (SSE) which is lighter than WebSocket
 * and perfect for server-to-client push notifications.
 * 
 * EVENTS:
 * - server.created
 * - server.updated
 * - server.deleted
 * - server.status.changed
 * - incident.created
 * - incident.updated
 * - incident.resolved
 * - maintenance.created
 * - maintenance.updated
 * - maintenance.completed
 * - visit.created
 * - visit.updated
 * - visit.completed
 * - security.updated
 * - monitoring.updated
 * - activity.created
 */

import type { Response } from "express";

export interface SSEClient {
  id: string;
  res: Response;
  userId: number | null;
  teamId: number | null;
  subscribedToServers: Set<number>;
  subscribedToAll: boolean;
  connectedAt: Date;
}

export interface SSEEvent {
  type: string;
  data: any;
  serverId?: number;
  teamId?: number;
}

class RealtimeService {
  private clients: Map<string, SSEClient> = new Map();
  private eventHistory: SSEEvent[] = []; // Keep last 100 events for reconnection
  private maxHistorySize = 100;
  
  /**
   * Add a new SSE client connection
   */
  addClient(
    clientId: string, 
    res: Response, 
    userId: number | null = null, 
    teamId: number | null = null
  ): void {
    // Set SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no"); // Disable Nginx buffering
    
    const client: SSEClient = {
      id: clientId,
      res,
      userId,
      teamId,
      subscribedToServers: new Set(),
      subscribedToAll: true, // By default, subscribe to all events
      connectedAt: new Date()
    };
    
    this.clients.set(clientId, client);
    
    // Send connection confirmation
    this.sendToClient(clientId, {
      type: "connection.established",
      data: {
        clientId,
        connectedAt: client.connectedAt.toISOString(),
        message: "Real-time connection established"
      }
    });
    
    console.log(`[SSE] Client connected: ${clientId} (User: ${userId}, Team: ${teamId})`);
    
    // Send current client count
    this.broadcast({
      type: "system.stats",
      data: {
        connectedClients: this.clients.size
      }
    });
    
    // Handle client disconnect
    res.on("close", () => {
      this.removeClient(clientId);
    });
  }
  
  /**
   * Remove a client connection
   */
  removeClient(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      this.clients.delete(clientId);
      console.log(`[SSE] Client disconnected: ${clientId}`);
      
      // Notify remaining clients
      this.broadcast({
        type: "system.stats",
        data: {
          connectedClients: this.clients.size
        }
      });
    }
  }
  
  /**
   * Subscribe a client to specific server updates
   */
  subscribeToServer(clientId: string, serverId: number): void {
    const client = this.clients.get(clientId);
    if (client) {
      client.subscribedToServers.add(serverId);
    }
  }
  
  /**
   * Unsubscribe a client from specific server updates
   */
  unsubscribeFromServer(clientId: string, serverId: number): void {
    const client = this.clients.get(clientId);
    if (client) {
      client.subscribedToServers.delete(serverId);
    }
  }
  
  /**
   * Send an event to a specific client
   */
  private sendToClient(clientId: string, event: SSEEvent): void {
    const client = this.clients.get(clientId);
    if (!client) return;
    
    try {
      const data = JSON.stringify(event.data);
      client.res.write(`event: ${event.type}\n`);
      client.res.write(`data: ${data}\n\n`);
    } catch (error) {
      console.error(`[SSE] Error sending to client ${clientId}:`, error);
      this.removeClient(clientId);
    }
  }
  
  /**
   * Broadcast an event to all connected clients (with team/server filtering)
   */
  broadcast(event: SSEEvent): void {
    // Add to history
    this.eventHistory.push(event);
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }
    
    // Send to all matching clients
    for (const [clientId, client] of this.clients.entries()) {
      // Check team scoping
      if (event.teamId && client.teamId && event.teamId !== client.teamId) {
        continue; // Skip if event is for a different team
      }
      
      // Check server subscription
      if (event.serverId && !client.subscribedToAll) {
        if (!client.subscribedToServers.has(event.serverId)) {
          continue; // Skip if client not subscribed to this server
        }
      }
      
      this.sendToClient(clientId, event);
    }
    
    console.log(`[SSE] Broadcast: ${event.type} (to ${this.clients.size} clients)`);
  }
  
  /**
   * Emit a server event
   */
  emitServerEvent(
    action: "created" | "updated" | "deleted" | "status.changed",
    serverId: number,
    data: any,
    teamId?: number
  ): void {
    this.broadcast({
      type: `server.${action}`,
      data: {
        serverId,
        ...data,
        timestamp: new Date().toISOString()
      },
      serverId,
      teamId
    });
  }
  
  /**
   * Emit an incident event
   */
  emitIncidentEvent(
    action: "created" | "updated" | "resolved",
    incidentId: number,
    serverId: number,
    data: any,
    teamId?: number
  ): void {
    this.broadcast({
      type: `incident.${action}`,
      data: {
        incidentId,
        serverId,
        ...data,
        timestamp: new Date().toISOString()
      },
      serverId,
      teamId
    });
  }
  
  /**
   * Emit a maintenance event
   */
  emitMaintenanceEvent(
    action: "created" | "updated" | "completed",
    maintenanceId: number,
    serverId: number,
    data: any,
    teamId?: number
  ): void {
    this.broadcast({
      type: `maintenance.${action}`,
      data: {
        maintenanceId,
        serverId,
        ...data,
        timestamp: new Date().toISOString()
      },
      serverId,
      teamId
    });
  }
  
  /**
   * Emit a visit event
   */
  emitVisitEvent(
    action: "created" | "updated" | "completed",
    visitId: number,
    serverId: number,
    data: any,
    teamId?: number
  ): void {
    this.broadcast({
      type: `visit.${action}`,
      data: {
        visitId,
        serverId,
        ...data,
        timestamp: new Date().toISOString()
      },
      serverId,
      teamId
    });
  }
  
  /**
   * Emit a security event
   */
  emitSecurityEvent(
    serverId: number,
    data: any,
    teamId?: number
  ): void {
    this.broadcast({
      type: "security.updated",
      data: {
        serverId,
        ...data,
        timestamp: new Date().toISOString()
      },
      serverId,
      teamId
    });
  }
  
  /**
   * Emit a monitoring event
   */
  emitMonitoringEvent(
    serverId: number,
    data: any,
    teamId?: number
  ): void {
    this.broadcast({
      type: "monitoring.updated",
      data: {
        serverId,
        ...data,
        timestamp: new Date().toISOString()
      },
      serverId,
      teamId
    });
  }
  
  /**
   * Emit an activity event
   */
  emitActivityEvent(
    activityId: number,
    serverId: number | null,
    data: any,
    teamId?: number
  ): void {
    this.broadcast({
      type: "activity.created",
      data: {
        activityId,
        serverId,
        ...data,
        timestamp: new Date().toISOString()
      },
      serverId: serverId || undefined,
      teamId
    });
  }
  
  /**
   * Get current stats
   */
  getStats(): { connectedClients: number; eventHistorySize: number } {
    return {
      connectedClients: this.clients.size,
      eventHistorySize: this.eventHistory.length
    };
  }
  
  /**
   * Get recent events (for reconnection)
   */
  getRecentEvents(since?: Date): SSEEvent[] {
    if (!since) {
      return this.eventHistory.slice(-20); // Return last 20 events
    }
    
    // Filter events after the specified time
    return this.eventHistory.filter(event => {
      const eventTime = new Date(event.data.timestamp);
      return eventTime > since;
    });
  }
  
  /**
   * Health check
   */
  healthCheck(): void {
    const healthEvent: SSEEvent = {
      type: "system.ping",
      data: {
        timestamp: new Date().toISOString(),
        connectedClients: this.clients.size
      }
    };
    
    // Send ping to all clients
    for (const clientId of this.clients.keys()) {
      this.sendToClient(clientId, healthEvent);
    }
  }
}

// Singleton instance
export const realtimeService = new RealtimeService();

// Periodic health check (every 30 seconds)
setInterval(() => {
  realtimeService.healthCheck();
}, 30000);
