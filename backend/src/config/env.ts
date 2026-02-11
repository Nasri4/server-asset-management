import crypto from "crypto";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

function resolveBackendRoot(): string | null {
  // Common cases:
  // - running from backend/: cwd has src/
  // - running from repo root: cwd has backend/src/
  const cwd = process.cwd();
  if (fs.existsSync(path.join(cwd, "src")) && fs.existsSync(path.join(cwd, "package.json"))) {
    return cwd;
  }
  const candidate = path.join(cwd, "backend");
  if (fs.existsSync(path.join(candidate, "src")) && fs.existsSync(path.join(candidate, "package.json"))) {
    return candidate;
  }
  return null;
}

const backendRoot = resolveBackendRoot();
dotenv.config({ path: backendRoot ? path.join(backendRoot, ".env") : undefined });

function must(name: string): string {
  const v =process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function isValidCredentialsKeyBase64(value: string): boolean {
  try {
    return Buffer.from(value, "base64").length === 32;
  } catch {
    return false;
  }
}

function getCredentialsEncryptionKey(): string {
  const fromEnv = process.env.CREDENTIALS_ENCRYPTION_KEY;
  if (fromEnv) return fromEnv;

  const nodeEnv = process.env.NODE_ENV ?? "development";
  if (nodeEnv !== "development") {
    return must("CREDENTIALS_ENCRYPTION_KEY");
  }

  // Dev convenience: persist a stable key so encrypted passwords remain decryptable across restarts.
  // Stored in backend/.sam_credentials_key and gitignored.
  const root = backendRoot ?? process.cwd();
  const keyFile = path.join(root, ".sam_credentials_key");

  try {
    if (fs.existsSync(keyFile)) {
      const existing = fs.readFileSync(keyFile, "utf8").trim();
      if (isValidCredentialsKeyBase64(existing)) return existing;
    }

    const generated = crypto.randomBytes(32).toString("base64");
    fs.writeFileSync(keyFile, `${generated}\n`, { encoding: "utf8" });
    console.warn(
      `DEV NOTE: Generated credentials encryption key at ${keyFile}. ` +
        "Set CREDENTIALS_ENCRYPTION_KEY in backend .env to control it explicitly."
    );
    return generated;
  } catch {
    // If we cannot persist (permissions, read-only FS), keep credentials disabled.
    return "";
  }
}

function getJwtSecret(): string {
  const fromEnv = process.env.JWT_SECRET;
  if (fromEnv) return fromEnv;

  const nodeEnv = process.env.NODE_ENV ?? "development";
  if (nodeEnv !== "development") {
    return must("JWT_SECRET");
  }

  // Dev convenience: persist a stable JWT secret so logins remain valid across restarts.
  // Stored in backend/.sam_jwt_secret and gitignored.
  const root = backendRoot ?? process.cwd();
  const secretFile = path.join(root, ".sam_jwt_secret");

  try {
    if (fs.existsSync(secretFile)) {
      const existing = fs.readFileSync(secretFile, "utf8").trim();
      if (existing.length >= 32) return existing;
    }

    const generated = crypto.randomBytes(64).toString("hex");
    fs.writeFileSync(secretFile, `${generated}\n`, { encoding: "utf8" });
    console.warn(
      `DEV NOTE: Generated JWT secret at ${secretFile}. ` +
        "Set JWT_SECRET in backend .env to control it explicitly."
    );
    return generated;
  } catch {
    // If we cannot persist, fail loudly so the developer sets JWT_SECRET explicitly.
    return must("JWT_SECRET");
  }
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 5000),

  server: {
    // If behind a reverse proxy (Nginx/IIS/Ingress), set TRUST_PROXY=true so
    // secure cookies + rate limiting use the correct client IP.
    trustProxy: (process.env.TRUST_PROXY ?? "false") === "true"
  },

  cors: {
    // Comma-separated list of allowed origins. Example:
    // CORS_ORIGINS=http://localhost:3000,https://sam.internal.company
    origins: (process.env.CORS_ORIGINS ?? "")
      .split(",")
      .map((s: string) => s.trim())
      .filter(Boolean)
  },

  credentials: {
    // Base64-encoded 32-byte key used to encrypt stored server passwords.
    // In production this must be set; in development, the credentials feature will be disabled unless provided.
    encryptionKey: getCredentialsEncryptionKey()
  },

  notifications: {
    // Optional: if set, outbound SMS will be sent via this provider.
    // If empty, code runs in placeholder mode (still writes audit entries).
    smsApiUrl: (process.env.SMS_API_URL ?? "").trim()
  },

  db: {
    server: must("DB_SERVER"),
    database: must("DB_DATABASE"),
    user: must("DB_USER"),
    password: must("DB_PASSWORD"),
    encrypt: (process.env.DB_ENCRYPT ?? "false") === "true",
    trustServerCertificate: (process.env.DB_TRUST_SERVER_CERT ?? "true") === "true"
  },

  auth: {
    jwtSecret: getJwtSecret(),
    cookieName: process.env.COOKIE_NAME ?? "sam_session",
    cookieSecure:
      (process.env.COOKIE_SECURE ?? "") === ""
        ? (process.env.NODE_ENV ?? "development") === "production"
        : (process.env.COOKIE_SECURE ?? "false") === "true",
    jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "8h"
    ,
    // Dev-only bootstrap token used to create the first Admin user via Postman.
    // Disabled in production.
    devBootstrapToken: (process.env.DEV_BOOTSTRAP_TOKEN ?? "").trim()
  }
};

if (env.nodeEnv === "production" && env.cors.origins.length === 0) {
  throw new Error("Missing env var: CORS_ORIGINS (required in production)");
}
