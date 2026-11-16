import { parseCsvRowsStrict } from "../../../../shared/csv-parse.js";
import { normalizeSpace } from "./string.js";

export const parseCsv = (csv: string): { headers: string[]; rows: string[][] } => {
    const parsed = parseCsvRowsStrict(csv);
    const headers = parsed.headers.map(normalizeSpace);
    if (headers.some((header) => !header) || new Set(headers).size !== headers.length) {
        throw new Error("CSV inválido: cabeceras vacías o duplicadas");
    }
    return {
        headers,
        rows: parsed.rows.map((row) => [...row])
    };
};
