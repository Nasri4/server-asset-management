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

function getPort() {
  const fromEnv = Number(process.env.PORT);
  if (Number.isFinite(fromEnv) && fromEnv > 0) return fromEnv;
  return 5000;
}

function tryGetListeningPid(port) {
  if (!isWindows()) return null;
  try {
    const out = ps(
      `$c = Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1; ` +
        `if ($null -ne $c) { $c.OwningProcess }`
    );
    const pid = Number(String(out).trim());
    if (!Number.isFinite(pid) || pid <= 0) return null;
    return pid;
  } catch {
    return null;
  }
}

function tryGetProcessInfo(pid) {
  if (!isWindows()) return { name: "", commandLine: "" };
  try {
    const name = ps(`(Get-Process -Id ${pid} | Select-Object -ExpandProperty ProcessName)`);
    // CommandLine requires CIM (works without admin in most dev setups)
    const commandLine = ps(`(Get-CimInstance Win32_Process -Filter \"ProcessId=${pid}\" | Select-Object -ExpandProperty CommandLine)`);
    return { name: String(name || ""), commandLine: String(commandLine || "") };
  } catch {
    return { name: "", commandLine: "" };
  }
}

function shouldKillProcess(info) {
  const name = String(info.name || "").toLowerCase();

  // Dev ergonomics: if the port is held by Node, it's almost always a stale dev server.
  // Refuse to kill non-node processes.
  return name === "node";
}

function stopProcess(pid) {
  try {
    ps(`Stop-Process -Id ${pid} -Force`);
  } catch {
    // Fallback for environments where Stop-Process is restricted.
    execFileSync("cmd.exe", ["/c", `taskkill /PID ${pid} /F`], { stdio: "ignore" });
  }
}

function sleep(ms) {
  const msInt = Number(ms);
  if (!Number.isFinite(msInt) || msInt <= 0) return;
  // Synchronous sleep without extra dependencies.
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, msInt);
}

function main() {
  const port = getPort();
  const pid = tryGetListeningPid(port);
  if (!pid) return;

  const info = tryGetProcessInfo(pid);

  if (!shouldKillProcess(info)) {
    // eslint-disable-next-line no-console
    console.error(
      `Port ${port} is already in use by PID ${pid}.\n` +
        `Refusing to auto-kill because it is not a Node process.\n` +
        `Close the app using port ${port}, or change PORT in backend/.env.`
    );
    process.exit(1);
  }

  // eslint-disable-next-line no-console
  console.warn(`Port ${port} is in use by PID ${pid} (${info.name || "node"}). Stopping it...`);
  stopProcess(pid);

  // Wait briefly for the OS to release the listening socket.
  for (let i = 0; i < 20; i++) {
    sleep(150);
    const pid2 = tryGetListeningPid(port);
    if (!pid2) return;
  }

  const pid2 = tryGetListeningPid(port);
  // eslint-disable-next-line no-console
  console.error(`Port ${port} is still busy${pid2 ? ` (PID ${pid2})` : ""}. Please stop it manually.`);
  process.exit(1);
}

main();
