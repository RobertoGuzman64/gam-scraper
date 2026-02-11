import { normalizeSpace } from "./string.js";

export const splitCsvLine = (line: string): string[] => {
    const out: string[] = [];
    let cur = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i += 1) {
        const ch = line[i] ?? "";
        if (inQuotes) {
            if (ch === '"') {
                const next = line[i + 1];
                if (next === '"') {
                    cur += '"';
                    i += 1;
                    continue;
                }
                inQuotes = false;
                continue;
            }
            cur += ch;
            continue;
        }

        if (ch === '"') {
            inQuotes = true;
            continue;
        }

        if (ch === ",") {
            out.push(cur);
            cur = "";
            continue;
        }

        cur += ch;
    }

    out.push(cur);
    return out;
};

export const parseCsv = (csv: string): { headers: string[]; rows: string[][] } => {
    const lines = csv
        .replace(/\r\n/g, "\n")
        .replace(/\r/g, "\n")
        .split("\n")
        .filter((l) => l.length > 0);

    if (lines.length === 0) return { headers: [], rows: [] };

    const headers = splitCsvLine(lines[0] ?? "").map((h) => normalizeSpace(h));
    const rows = lines.slice(1).map((l) => splitCsvLine(l));

    return { headers, rows };
};
