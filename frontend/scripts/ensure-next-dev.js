const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

function ps(command) {
  return execFileSync(
    "powershell.exe",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", command],
    { encoding: "utf8" }
  ).trim();
}

function isWindows() {
  return process.platform === "win32";
}

function safeUnlink(filePath) {
  try {
    fs.unlinkSync(filePath);
    // eslint-disable-next-line no-console
    console.warn(`Removed stale Next dev lock: ${filePath}`);
  } catch {
    // ignore
  }
}

function main() {
  const lockPath = path.join(process.cwd(), ".next", "dev", "lock");
  if (fs.existsSync(lockPath)) {
    safeUnlink(lockPath);
  }

  // Optional: if port 3000 is held by a stale `next dev` from THIS repo, stop it.
  // If port 3000 is used by something else, do not kill it.
  if (isWindows()) {
    try {
      const pidOut = ps(
        `$c = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1; ` +
          `if ($null -ne $c) { $c.OwningProcess }`
      );
      const pid = Number(String(pidOut).trim());
      if (Number.isFinite(pid) && pid > 0) {
        const cmd = ps(
          `(Get-CimInstance Win32_Process -Filter \"ProcessId=${pid}\" | Select-Object -ExpandProperty CommandLine)`
        ).toLowerCase();

        const looksLikeNextDev = cmd.includes("next") && cmd.includes("dev");
        const looksLikeThisRepo = cmd.includes("server-asset-management-api") && cmd.includes("frontend");

        if (looksLikeNextDev && looksLikeThisRepo) {
          // eslint-disable-next-line no-console
          console.warn(`Port 3000 is held by a stale Next dev (PID ${pid}). Stopping it...`);
          ps(`Stop-Process -Id ${pid} -Force`);
        }
      }
    } catch {
      // ignore
    }
  }
}

main();
