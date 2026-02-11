export type ParsedCsv = {
  readonly headers: readonly string[];
  readonly rows: readonly Record<string, string>[];
};

const parseRow = (line: string): string[] => {
  const out: string[] = [];
  let cur = "";
  let i = 0;
  let inQuotes = false;

  while (i < line.length) {
    const ch = line[i] ?? "";
    if (inQuotes) {
      if (ch === '"') {
        const next = line[i + 1];
        if (next === '"') {
          cur += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      cur += ch;
      i += 1;
      continue;
    }

    if (ch === ',') {
      out.push(cur);
      cur = "";
      i += 1;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }

    cur += ch;
    i += 1;
  }

  out.push(cur);
  return out;
};

const splitLines = (csv: string): string[] => {
  const lines: string[] = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < csv.length; i += 1) {
    const ch = csv[i] ?? "";
    if (ch === '"') {
      const next = csv[i + 1];
      if (inQuotes && next === '"') {
        cur += '""';
        i += 1;
        continue;
      }
      inQuotes = !inQuotes;
      cur += ch;
      continue;
    }
    if (!inQuotes && (ch === "\n" || ch === "\r")) {
      if (ch === "\r" && csv[i + 1] === "\n") i += 1;
      lines.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }

  if (cur.length > 0) lines.push(cur);
  return lines.filter((l) => l.length > 0);
};

export const parseCsv = (csv: string): ParsedCsv => {
  const lines = splitLines(csv);
  const headerLine = lines[0];
  if (!headerLine) return { headers: [], rows: [] };

  const headers = parseRow(headerLine);
  const rows: Record<string, string>[] = [];

  for (let li = 1; li < lines.length; li += 1) {
    const line = lines[li];
    if (!line) continue;
    const cells = parseRow(line);
    const r: Record<string, string> = {};
    for (let hi = 0; hi < headers.length; hi += 1) {
      const h = headers[hi] ?? "";
      r[h] = cells[hi] ?? "";
    }
    rows.push(r);
  }

  return { headers, rows };
};
