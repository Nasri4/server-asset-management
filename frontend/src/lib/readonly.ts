export function isReadOnlyMode() {
  // Default to read-only unless explicitly disabled.
  // Set NEXT_PUBLIC_READ_ONLY_MODE=false to re-enable write actions.
  return String(process.env.NEXT_PUBLIC_READ_ONLY_MODE ?? "true").toLowerCase() !== "false";
}
