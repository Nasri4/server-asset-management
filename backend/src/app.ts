import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env";
import { maintenanceRouter } from "./routes/maintenance.routes";
import { maintenanceOpsRouter } from "./routes/maintenanceOps.routes";
import { applicationsRouter } from "./routes/applications.routes";
import { visitsRouter } from "./routes/visits.routes";
import { errorHandler } from "./middleware/error";
import { authRouter } from "./routes/auth.routes";
import { teamsRouter } from "./routes/teams.routes";
import { locationsRouter } from "./routes/locations.routes";
import { racksRouter } from "./routes/racks.routes";
import { engineersRouter } from "./routes/engineers.routes";
import { serversRouter } from "./routes/servers.routes";
import { hardwareRouter } from "./routes/hardware.routes";
import { networkRouter } from "./routes/network.routes";
import { incidentsRouter } from "./routes/incidents.routes";
import { monitoringRouter } from "./routes/monitoring.routes";
import { auditRouter } from "./routes/audit.routes";
import { securityRouter } from "./routes/security.routes";
import activityRouter from "./routes/activity.routes";
import savedViewsRouter from "./routes/savedViews.routes";
import searchRouter from "./routes/search.routes";
import { realtimeRouter } from "./routes/realtime.routes";
import usersRouter from "./routes/users.routes";


export function createApp() {
  const app = express();

  if (env.server.trustProxy) {
    app.set("trust proxy", 1);
  }

  app.use(helmet());
  app.use(
    morgan("combined", {
      skip: (req) => req.path === "/health" || req.path === "/favicon.ico"
    })
  );

  app.use(
    cors({
      credentials: true,
      origin: (origin, cb) => {
        // Allow non-browser tools (no Origin header).
        if (!origin) return cb(null, true);
        // If no origins are configured (dev), allow all.
        if (env.cors.origins.length === 0) return cb(null, true);
        if (env.cors.origins.includes(origin)) return cb(null, true);
        return cb(new Error("CORS origin not allowed"));
      }
    })
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());

  // Basic favicon to avoid 404s in browsers
  app.get("/favicon.ico", (_req, res) => res.status(204).end());

  app.get("/health", (_req, res) => res.json({ ok: true, service: "SAM API" }));

  app.use("/auth", authRouter);

  app.use("/api/teams", teamsRouter);
  app.use("/api/locations", locationsRouter);
  app.use("/api/racks", racksRouter);
  app.use("/api/engineers", engineersRouter);

  app.use("/api/servers", serversRouter);
  app.use("/api/hardware", hardwareRouter);
  app.use("/api/network", networkRouter);
  app.use("/api/incidents", incidentsRouter);
  app.use("/api/monitoring", monitoringRouter);
  app.use("/api/maintenance", maintenanceRouter);
  app.use("/api/maintenance-ops", maintenanceOpsRouter);
  app.use("/api/applications", applicationsRouter);
  app.use("/api/visits", visitsRouter);
  app.use("/api/audit", auditRouter);
  app.use("/api/security", securityRouter);
  
  // V2 Enterprise Features
  app.use("/api/activity", activityRouter);
  app.use("/api/saved-views", savedViewsRouter);
  app.use("/api/search", searchRouter);
  
  // V2 Real-time (SSE)
  app.use("/api/realtime", realtimeRouter);
  
  // RBAC User Management
  app.use("/api/users", usersRouter);


  app.use(errorHandler);
  return app;
}
