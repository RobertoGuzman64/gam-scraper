import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

type SeedProduct = {
    id: number;
    title: string;
    categorySellID: number;
    companyID: number;
    condition: "Segunda_Mano";
    description_title: string;
    description: string;
    image: string;
    reference: string;
    description_general: string;
    spec: Record<string, string | number | boolean>;
    metadata: {
        featured: boolean;
        keywords: string[];
        tags: string[];
    };
};

type CategoryFlatRow = {
    id: number;
    parentId: number | null;
    name: string;
    slug: string;
};

type ConvertOptions = {
    inputCsvPath: string;
    outputTsPath: string;
    categorySellFlatJsonPath: string;
    idStart: number;
    companyID: number;
    defaultImage: string;
    referencePrefix?: string;
    failOnUnresolved?: boolean;
};

type Report = {
    totalRows: number;
    totalProductsWritten: number;
    missingCategorySellId: Record<string, number>;
    ambiguousUrlSlug: Record<string, number>;
    usedFallbackToCategoryKey: Record<string, number>;
    usedDirectSlugMatch: Record<string, number>;
    usedNormalizedSlugMatch: Record<string, number>;
    unknownUrlSlug: Record<string, number>;
};

const normalizeSpace = (s: string): string => s.replace(/\s+/g, " ").trim();

const splitCsvLine = (line: string): string[] => {
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

const parseCsv = (csv: string): { headers: string[]; rows: string[][] } => {
    const lines = csv.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").filter((l) => l.length > 0);
    if (lines.length === 0) return { headers: [], rows: [] };

    const headers = splitCsvLine(lines[0] ?? "").map((h) => normalizeSpace(h));
    const rows = lines.slice(1).map((l) => splitCsvLine(l));

    return { headers, rows };
};

const parseNumberLike = (s: string): number | null => {
    const t = normalizeSpace(s);
    if (!t) return null;

    const pure = t.replace(/\./g, "").replace(",", ".");
    if (/^\d+(\.\d+)?$/.test(pure)) return Number(pure);

    const m = pure.match(/^(\d+(?:\.\d+)?)(?:\s*(?:mm|cm|m|kg|kW|w|%|h|horas))$/i);
    if (m?.[1]) return Number(m[1]);

    const m2 = pure.match(/^(\d+(?:\.\d+)?)/);
    if (m2?.[1] && /(?:mm|cm|m|kg|%|h|horas)\b/i.test(pure)) return Number(m2[1]);

    return null;
};

const parseScalar = (v: unknown): string | number | boolean => {
    if (typeof v === "boolean") return v;
    if (typeof v === "number") return v;
    if (typeof v !== "string") return String(v);

    const t = normalizeSpace(v);
    if (!t) return "";

    const lower = t.toLowerCase();
    if (lower === "true") return true;
    if (lower === "false") return false;

    const n = parseNumberLike(t);
    if (n !== null && Number.isFinite(n)) return n;

    return t;
};

const safeJsonParse = (s: string): unknown => {
    const t = normalizeSpace(s);
    if (!t) return {};
    try {
        return JSON.parse(t);
    } catch {
        return {};
    }
};

const ensureString = (v: unknown): string => {
    if (typeof v === "string") return v;
    if (v === null || v === undefined) return "";
    return String(v);
};

const refWithPrefix = (raw: string, prefix: string): string => {
    const t = normalizeSpace(raw);
    if (!t) return "";
    const upper = t.toUpperCase();
    if (upper.startsWith(prefix.toUpperCase())) return t;
    if (/^[A-Z]{1,5}-/.test(t)) return t;
    return `${prefix}${t}`;
};

const buildDefaultMetadata = (categoryKey: string): { keywords: string[]; tags: string[] } => {
    const base = ["maquinaria", "maquinaria-de-ocasion"];
    const perKey: Record<string, string[]> = {
        elevacion: ["elevacion-de-segunda-mano"],
        manutencion: ["manutencion-de-segunda-mano"],
        manipulacion: ["manipulacion-de-segunda-mano"],
        energia: ["energia-de-segunda-mano"],
        otros: ["otros-equipos-de-segunda-mano"],
        movilidad: ["movilidad-sostenible-de-segunda-mano"],
        maquinaria: ["maquinaria-de-ocasion"]
    };

    const extra = perKey[categoryKey] ?? [];
    const all = [...base, ...extra];
    return { keywords: all, tags: all };
};

const isCategoryFlatRow = (v: unknown): v is CategoryFlatRow => {
    if (!v || typeof v !== "object") return false;
    const o = v as Record<string, unknown>;
    return (
        typeof o["id"] === "number" &&
        (typeof o["parentId"] === "number" || o["parentId"] === null) &&
        typeof o["name"] === "string" &&
        typeof o["slug"] === "string"
    );
};

const extractUrlCategorySlug = (url: string): string => {
    try {
        const u = new URL(url);
        const parts = u.pathname.split("/").filter(Boolean);
        const i = parts.indexOf("es");
        if (i < 0) return "";
        return normalizeSpace(parts[i + 1] ?? "");
    } catch {
        return "";
    }
};

const normalizeGamSlug = (slug: string): string => {
    const s = normalizeSpace(slug).toLowerCase();
    if (!s) return "";
    const withoutSaleSuffix = s
        .replace(/-segunda-mano\b/g, "")
        .replace(/-de-segunda-mano\b/g, "")
        .replace(/-de-ocasion\b/g, "")
        .replace(/-ocasion\b/g, "")
        .replace(/-usado\b/g, "")
        .replace(/-usada\b/g, "")
        .replace(/-venta\b/g, "")
        .replace(/-alquiler\b/g, "");
    return normalizeSpace(withoutSaleSuffix).replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
};

const inc = (obj: Record<string, number>, key: string): void => {
    if (!key) return;
    obj[key] = (obj[key] ?? 0) + 1;
};

const loadCategoryIndex = async (flatJsonPath: string): Promise<{
    byId: ReadonlyMap<number, CategoryFlatRow>;
    idsBySlug: ReadonlyMap<string, readonly number[]>;
}> => {
    const raw = await readFile(flatJsonPath, "utf8");
    const parsed = safeJsonParse(raw);
    if (!Array.isArray(parsed)) throw new Error("categorySell-flat.json no es un array.");

    const flat = parsed.filter(isCategoryFlatRow);
    if (flat.length === 0) throw new Error("categorySell-flat.json está vacío o inválido.");

    const byId = new Map<number, CategoryFlatRow>();
    const idsBySlug = new Map<string, number[]>();

    for (const r of flat) {
        byId.set(r.id, r);

        const slug = normalizeSpace(r.slug).toLowerCase();
        const prev = idsBySlug.get(slug) ?? [];
        idsBySlug.set(slug, [...prev, r.id]);
    }

    return { byId, idsBySlug };
};

const buildPath = (byId: ReadonlyMap<number, CategoryFlatRow>, id: number): string => {
    const slugs: string[] = [];
    let cur: CategoryFlatRow | undefined = byId.get(id);
    while (cur) {
        slugs.push(cur.slug);
        if (cur.parentId === null) break;
        cur = byId.get(cur.parentId);
    }
    return slugs.reverse().join("/");
};

const pickBestCandidate = (paths: readonly string[], categoryKey: string): string | null => {
    if (paths.length === 0) return null;
    if (paths.length === 1) return paths[0] ?? null;

    const key = normalizeSpace(categoryKey).toLowerCase();
    const target = key ? `/maquinaria/${key}` : "/maquinaria";
    const prioritized = paths.find((p) => p.toLowerCase().includes(target));
    return prioritized ?? (paths[0] ?? null);
};

const categoryKeyFallbackSlug = (categoryKey: string): string => {
    const k = normalizeSpace(categoryKey).toLowerCase();
    if (!k) return "maquinaria";
    if (k === "maquinaria") return "maquinaria";
    return k;
};

const resolveCategorySellIdAuto = (
    idx: { byId: ReadonlyMap<number, CategoryFlatRow>; idsBySlug: ReadonlyMap<string, readonly number[]> },
    categoryKey: string,
    urlCategorySlug: string,
    report: Report
): number | null => {
    const slug = normalizeSpace(urlCategorySlug).toLowerCase();

    if (slug) {
        const directIds = idx.idsBySlug.get(slug) ?? [];
        if (directIds.length === 1) {
            inc(report.usedDirectSlugMatch, slug);
            return directIds[0] ?? null;
        }
        if (directIds.length > 1) {
            const paths = directIds.map((id) => buildPath(idx.byId, id));
            const best = pickBestCandidate(paths, categoryKey);
            if (best) {
                inc(report.ambiguousUrlSlug, slug);
                const bestId = directIds[paths.indexOf(best)] ?? null;
                return bestId;
            }
        }

        const normalized = normalizeGamSlug(slug);
        if (normalized) {
            const normIds = idx.idsBySlug.get(normalized) ?? [];
            if (normIds.length === 1) {
                inc(report.usedNormalizedSlugMatch, slug);
                return normIds[0] ?? null;
            }
            if (normIds.length > 1) {
                const paths = normIds.map((id) => buildPath(idx.byId, id));
                const best = pickBestCandidate(paths, categoryKey);
                if (best) {
                    inc(report.ambiguousUrlSlug, `${slug}=>${normalized}`);
                    const bestId = normIds[paths.indexOf(best)] ?? null;
                    return bestId;
                }
            }
        }

        inc(report.unknownUrlSlug, slug);
    }

    const fallbackSlug = categoryKeyFallbackSlug(categoryKey);
    const fallbackIds = fallbackSlug ? (idx.idsBySlug.get(fallbackSlug) ?? []) : [];
    if (fallbackIds.length === 1) {
        inc(report.usedFallbackToCategoryKey, categoryKey);
        return fallbackIds[0] ?? null;
    }

    return null;
};

export const convertGamCsvToSeedTsAuto = async (options: ConvertOptions): Promise<void> => {
    const idx = await loadCategoryIndex(options.categorySellFlatJsonPath);

    const csv = await readFile(options.inputCsvPath, "utf8");
    const parsed = parseCsv(csv);

    const col = (name: string): number => parsed.headers.findIndex((h) => h === name);

    const iCategoryKey = col("categoryKey");
    const iTitle = col("title");
    const iShort = col("shortDescription");
    const iLong = col("longDescription");
    const iReference = col("reference");
    const iUrl = col("url");
    const iSpecJson = col("specJson");

    if (iCategoryKey < 0 || iTitle < 0 || iShort < 0 || iLong < 0 || iReference < 0 || iUrl < 0 || iSpecJson < 0) {
        throw new Error("CSV no tiene las columnas mínimas esperadas (categoryKey,title,shortDescription,longDescription,reference,url,specJson).");
    }

    const report: Report = {
        totalRows: parsed.rows.length,
        totalProductsWritten: 0,
        missingCategorySellId: {},
        ambiguousUrlSlug: {},
        usedFallbackToCategoryKey: {},
        usedDirectSlugMatch: {},
        usedNormalizedSlugMatch: {},
        unknownUrlSlug: {}
    };

    const out: SeedProduct[] = [];

    for (let r = 0; r < parsed.rows.length; r += 1) {
        const row = parsed.rows[r] ?? [];
        const categoryKey = normalizeSpace(row[iCategoryKey] ?? "");
        const title = normalizeSpace(row[iTitle] ?? "");
        const shortDescription = normalizeSpace(row[iShort] ?? "");
        const longDescription = ensureString(row[iLong] ?? "").trim();
        const referenceRaw = normalizeSpace(row[iReference] ?? "");
        const url = normalizeSpace(row[iUrl] ?? "");
        const specJsonRaw = ensureString(row[iSpecJson] ?? "");

        if (!categoryKey || !title) continue;

        const urlCategorySlug = extractUrlCategorySlug(url);
        const categorySellID = resolveCategorySellIdAuto({ byId: idx.byId, idsBySlug: idx.idsBySlug }, categoryKey, urlCategorySlug, report);

        if (!categorySellID) {
            const key = urlCategorySlug ? `urlSlug:${urlCategorySlug}` : `categoryKey:${categoryKey}`;
            inc(report.missingCategorySellId, key);
            continue;
        }

        const specParsed = safeJsonParse(specJsonRaw);
        const specObj = (specParsed && typeof specParsed === "object" && !Array.isArray(specParsed) ? specParsed : {}) as Record<
            string,
            unknown
        >;

        const spec: Record<string, string | number | boolean> = {};
        for (const [k, v] of Object.entries(specObj)) {
            spec[normalizeSpace(k)] = parseScalar(v);
        }

        const metadata = buildDefaultMetadata(categoryKey);
        const reference = refWithPrefix(referenceRaw, options.referencePrefix ?? "GAM-");

        out.push({
            id: options.idStart + out.length,
            title,
            categorySellID,
            companyID: options.companyID,
            condition: "Segunda_Mano",
            description_title: title,
            description: shortDescription,
            image: options.defaultImage,
            reference,
            description_general: longDescription,
            spec,
            metadata: {
                featured: false,
                keywords: metadata.keywords,
                tags: metadata.tags
            }
        });
    }

    report.totalProductsWritten = out.length;

    if (options.failOnUnresolved && Object.keys(report.missingCategorySellId).length > 0) {
        const lines = Object.entries(report.missingCategorySellId)
            .sort((a, b) => b[1] - a[1])
            .map(([k, v]) => `${k} -> ${v}`)
            .join("\n");
        throw new Error(`Hay productos sin categorySellID:\n${lines}`);
    }

    const ts = `import { ProductCondition } from "@prisma/client";

const products = ${JSON.stringify(out, null, 2).replace(/"Segunda_Mano"/g, "ProductCondition.Segunda_Mano")} as const;

export default products;
`;

    await mkdir(dirname(options.outputTsPath), { recursive: true });
    await writeFile(options.outputTsPath, ts, "utf8");
    await writeFile(`${options.outputTsPath}.report.json`, JSON.stringify(report, null, 2), "utf8");
};

const isMain = (metaUrl: string): boolean => {
    const argv1 = process.argv[1];
    if (!argv1) return false;
    return metaUrl === pathToFileURL(argv1).href;
};

if (isMain(import.meta.url)) {
    const inputCsvPath = process.argv[2];
    const outputTsPath = process.argv[3];
    const categoryFlatPath = process.argv[4];

    if (!inputCsvPath || !outputTsPath || !categoryFlatPath) {
        throw new Error("Uso: node dist/conversor/convertidorTS.js <input.csv> <output.ts> <categorySell-flat.json>");
    }

    await convertGamCsvToSeedTsAuto({
        inputCsvPath: resolve(inputCsvPath),
        outputTsPath: resolve(outputTsPath),
        categorySellFlatJsonPath: resolve(categoryFlatPath),
        idStart: 200000,
        companyID: 208,
        defaultImage: "https://online.gamrentals.com/img/p/es-default.jpg",
        referencePrefix: "GAM-",
        failOnUnresolved: false
    });
}
