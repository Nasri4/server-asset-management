import sql from "mssql";
import { env } from "../config/env";

const config: sql.config = {
  server: env.db.server,
  database: env.db.database,
  user: env.db.user,
  password: env.db.password,
  options: {
    encrypt: env.db.encrypt,
    trustServerCertificate: env.db.trustServerCertificate
  }
};

// Create and export the pool directly
export const pool = new sql.ConnectionPool(config);

// Connect on first import
pool.connect().then(() => {
  console.log("✅ Database connection successful");
}).catch((err) => {
  console.error("❌ Database connection failed:", err);
});

// Legacy function for backward compatibility
export async function getPool(): Promise<sql.ConnectionPool> {
  if (!pool.connected && !pool.connecting) {
    await pool.connect();
  }
  return pool;
}
