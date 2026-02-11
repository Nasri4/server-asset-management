/**
 * USE REALTIME HOOK
 * 
 * React hook for SSE (Server-Sent Events) real-time connection
 * Provides subscription to server events
 */

"use client";

import { useEffect, useState, useCallback, useRef } from "react";

export type RealtimeEvent = {
  type: string;
  data: any;
};

export type EventCallback = (data: any) => void;

export function useRealtime() {
  const [connected, setConnected] = useState(false);
  const [clientId, setClientId] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const listenersRef = useRef<Map<string, Set<EventCallback>>>(new Map());
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);

  // Connect to SSE
  const connect = useCallback(() => {
    // Clear any existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    console.log("[SSE] Connecting to real-time service...");

    const es = new EventSource("/api/realtime/events", {
      withCredentials: true
    });

    es.onopen = () => {
      console.log("[SSE] Connected successfully");
      setConnected(true);
      reconnectAttempts.current = 0;
    };

    es.onerror = (error) => {
      console.error("[SSE] Connection error:", error);
      setConnected(false);
      es.close();

      // Attempt reconnection with exponential backoff
      const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
      reconnectAttempts.current++;
      
      console.log(`[SSE] Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current})`);
      
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, delay);
    };

    // Listen to connection.established event
    es.addEventListener("connection.established", (event: MessageEvent) => {
      const data = JSON.parse(event.data);
      console.log("[SSE] Connection established:", data);
      setClientId(data.clientId);
    });

    // Listen to system.ping events (health check)
    es.addEventListener("system.ping", (event: MessageEvent) => {
      const data = JSON.parse(event.data);
      // Silent health check - no log needed
    });

    // Listen to all real-time event types
    const eventTypes = [
      "server.created",
      "server.updated",
      "server.deleted",
      "server.status.changed",
      "incident.created",
      "incident.updated",
      "incident.resolved",
      "maintenance.created",
      "maintenance.updated",
      "maintenance.completed",
      "visit.created",
      "visit.updated",
      "visit.completed",
      "security.updated",
      "monitoring.updated",
      "activity.created",
      "system.stats"
    ];

    eventTypes.forEach(eventType => {
      es.addEventListener(eventType, (event: MessageEvent) => {
        const data = JSON.parse(event.data);
        console.log(`[SSE] ${eventType}:`, data);
        
        // Notify all listeners for this event type
        const eventListeners = listenersRef.current.get(eventType);
        if (eventListeners && eventListeners.size > 0) {
          eventListeners.forEach(callback => {
            try {
              callback(data);
            } catch (error) {
              console.error(`[SSE] Error in event listener for ${eventType}:`, error);
            }
          });
        }
      });
    });

    eventSourceRef.current = es;
  }, []);

  // Initial connection
  useEffect(() => {
    connect();

    // Cleanup on unmount
    return () => {
      console.log("[SSE] Cleaning up connection");
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      setConnected(false);
    };
  }, [connect]);

  // Subscribe to event
  const subscribe = useCallback((eventType: string, callback: EventCallback) => {
    console.log(`[SSE] Subscribing to: ${eventType}`);
    
    const listeners = listenersRef.current;
    if (!listeners.has(eventType)) {
      listeners.set(eventType, new Set());
    }
    listeners.get(eventType)!.add(callback);

    // Return unsubscribe function
    return () => {
      console.log(`[SSE] Unsubscribing from: ${eventType}`);
      const eventListeners = listeners.get(eventType);
      if (eventListeners) {
        eventListeners.delete(callback);
        if (eventListeners.size === 0) {
          listeners.delete(eventType);
        }
      }
    };
  }, []);

  // Subscribe to multiple events at once
  const subscribeMultiple = useCallback((
    subscriptions: Array<{ eventType: string; callback: EventCallback }>
  ) => {
    const unsubscribers = subscriptions.map(({ eventType, callback }) => 
      subscribe(eventType, callback)
    );

    // Return combined unsubscribe function
    return () => {
      unsubscribers.forEach(unsubscribe => unsubscribe());
    };
  }, [subscribe]);

  // Manual reconnect
  const reconnect = useCallback(() => {
    console.log("[SSE] Manual reconnect triggered");
    reconnectAttempts.current = 0;
    connect();
  }, [connect]);

  return {
    connected,
    clientId,
    subscribe,
    subscribeMultiple,
    reconnect
  };
}
