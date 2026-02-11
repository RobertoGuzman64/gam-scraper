const escapeCsv = (value: string): string => {
  if (!/[",\n\r]/.test(value)) return value;
  return `"${value.replace(/"/g, '""')}"`;
};

export const toCsv = (rows: readonly Record<string, string>[], headers: readonly string[]): string => {
  const head = headers.map(escapeCsv).join(",");
  const body = rows
    .map((r) => headers.map((h) => escapeCsv(r[h] ?? "")).join(","))
    .join("\n");
  return `${head}\n${body}\n`;
};
