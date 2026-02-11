export type CsvColumn<Row extends Record<string, any>> = {
  key: keyof Row;
  label: string;
  format?: (value: unknown, row: Row) => string;
};

function escapeCell(value: unknown) {
  const s = String(value ?? "");
  const needsQuotes = /[\n\r,\"]/g.test(s);
  const escaped = s.replace(/\"/g, '""');
  return needsQuotes ? `"${escaped}"` : escaped;
}

export function buildCsv<Row extends Record<string, any>>(
  rows: Row[],
  columns: Array<CsvColumn<Row>>
): string;
export function buildCsv(headers: string[], rows: Array<Record<string, any>>): string;
export function buildCsv(a: any, b: any): string {
  // Back-compat: buildCsv(headers, rows)
  if (Array.isArray(a) && (a.length === 0 || typeof a[0] === "string")) {
    const headers = a as string[];
    const rows = (b ?? []) as Array<Record<string, any>>;
    const columns = headers.map((h) => ({ key: h, label: h })) as Array<CsvColumn<Record<string, any>>>;
    return buildCsv(rows, columns);
  }

  // Modern: buildCsv(rows, columns)
  const rows = (a ?? []) as Array<Record<string, any>>;
  const columns = (b ?? []) as Array<CsvColumn<Record<string, any>>>;

  const header = columns.map((c) => escapeCell(c.label)).join(",");
  const lines = rows.map((row) => {
    return columns
      .map((c) => {
        const raw = row[c.key as string];
        const v = c.format ? c.format(raw, row) : String(raw ?? "");
        return escapeCell(v);
      })
      .join(",");
  });

  return [header, ...lines].join("\n");
}

export function downloadCsv(filename: string, csvText: string) {
  const blob = new Blob(["\ufeff", csvText], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
