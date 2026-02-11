import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

type ProductCondition = "Segunda_Mano" | "Nuevo" | "Alquiler";

type SeedProduct = {
    id: number;
    title: string;
    categorySellID: number;
    companyID: number;
    condition: ProductCondition;
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
    idStart: number;
    companyID: number;
    defaultImage: string;
    categorySellFlatJsonPath: string;
    categorySellPathByCategoryKey?: Readonly<Record<string, string>>;
    metadataByCategoryKey?: Readonly<
        Record<
            string,
            {
                keywords: string[];
                tags: string[];
            }
        >
    >;
    referencePrefix?: string;
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

const normalizePath = (path: string): string[] =>
    normalizeSpace(path)
        .replace(/\\/g, "/")
        .split("/")
        .map((p) => normalizeSpace(p))
        .filter((p) => p.length > 0);

const loadCategoryResolver = async (flatJsonPath: string): Promise<(path: string) => number | null> => {
    const raw = await readFile(flatJsonPath, "utf8");
    const parsed = safeJsonParse(raw);

    if (!Array.isArray(parsed)) throw new Error("categorySell-flat.json no es un array.");

    const flat = parsed.filter(isCategoryFlatRow);
    if (flat.length === 0) throw new Error("categorySell-flat.json está vacío o inválido.");

    const byParentAndSlug = new Map<string, number>();
    for (const r of flat) {
        const key = `${r.parentId ?? "root"}|${r.slug}`;
        byParentAndSlug.set(key, r.id);
    }

    return (path: string): number | null => {
        const parts = normalizePath(path);
        if (parts.length === 0) return null;

        let parentId: number | null = null;
        let currentId: number | null = null;

        for (const slug of parts) {
            const key = `${parentId ?? "root"}|${slug}`;
            const id = byParentAndSlug.get(key);
            if (!id) return null;
            currentId = id;
            parentId = id;
        }

        return currentId;
    };
};

export const convertGamCsvToSeedTs = async (options: ConvertOptions): Promise<void> => {
    const csv = await readFile(options.inputCsvPath, "utf8");
    const parsed = parseCsv(csv);

    const idx = (name: string): number => parsed.headers.findIndex((h) => h === name);

    const iCategoryKey = idx("categoryKey");
    const iCategorySellPath = idx("categorySellPath");
    const iTitle = idx("title");
    const iShort = idx("shortDescription");
    const iLong = idx("longDescription");
    const iReference = idx("reference");
    const iUrl = idx("url");
    const iSpecJson = idx("specJson");

    if (iCategoryKey < 0 || iTitle < 0 || iShort < 0 || iLong < 0 || iReference < 0 || iUrl < 0 || iSpecJson < 0) {
        throw new Error("CSV no tiene las columnas mínimas esperadas (categoryKey,title,shortDescription,longDescription,reference,url,specJson).");
    }

    const resolveCategoryId = await loadCategoryResolver(options.categorySellFlatJsonPath);

    const out: SeedProduct[] = [];
    const missingCategories = new Map<string, number>();

    for (let r = 0; r < parsed.rows.length; r += 1) {
        const row = parsed.rows[r] ?? [];
        const categoryKey = normalizeSpace(row[iCategoryKey] ?? "");
        const categorySellPathFromCsv = iCategorySellPath >= 0 ? normalizeSpace(row[iCategorySellPath] ?? "") : "";
        const title = normalizeSpace(row[iTitle] ?? "");
        const shortDescription = normalizeSpace(row[iShort] ?? "");
        const longDescription = ensureString(row[iLong] ?? "").trim();
        const referenceRaw = normalizeSpace(row[iReference] ?? "");
        const url = normalizeSpace(row[iUrl] ?? "");
        const specJsonRaw = ensureString(row[iSpecJson] ?? "");

        if (!categoryKey || !title) continue;

        const fallbackPath = options.categorySellPathByCategoryKey?.[categoryKey] ?? "";
        const categorySellPath = categorySellPathFromCsv || fallbackPath;

        const categorySellID = categorySellPath ? resolveCategoryId(categorySellPath) : null;
        if (!categorySellID) {
            const key = categorySellPath ? `path:${categorySellPath}` : `key:${categoryKey}`;
            missingCategories.set(key, (missingCategories.get(key) ?? 0) + 1);
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

        const metadataFromMap = options.metadataByCategoryKey?.[categoryKey];
        const metadata = metadataFromMap ?? buildDefaultMetadata(categoryKey);

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

    if (missingCategories.size > 0) {
        const lines = [...missingCategories.entries()]
            .sort((a, b) => b[1] - a[1])
            .map(([k, count]) => `${k} -> ${count}`)
            .join("\n");
        throw new Error(`Hay productos sin categoría resoluble:\n${lines}`);
    }

    const ts = `import { ProductCondition } from "@prisma/client";

const products = ${JSON.stringify(out, null, 2)
            .replace(/"Segunda_Mano"/g, "ProductCondition.Segunda_Mano")
            .replace(/"Nuevo"/g, "ProductCondition.Nuevo")
            .replace(/"Alquiler"/g, "ProductCondition.Alquiler")} as const;

export default products;
`;

    await mkdir(dirname(options.outputTsPath), { recursive: true });
    await writeFile(options.outputTsPath, ts, "utf8");
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

    await convertGamCsvToSeedTs({
        inputCsvPath: resolve(inputCsvPath),
        outputTsPath: resolve(outputTsPath),
        categorySellFlatJsonPath: resolve(categoryFlatPath),
        idStart: 200000,
        companyID: 208,
        defaultImage: "https://online.gamrentals.com/img/p/es-default.jpg",
        referencePrefix: "GAM-",
        categorySellPathByCategoryKey: {
            elevacion: "maquinaria/elevacion",
            manutencion: "maquinaria/manutencion",
            manipulacion: "maquinaria/manipulacion",
            energia: "maquinaria/energia",
            otros: "maquinaria/otros",
            movilidad: "maquinaria/movilidad",
            maquinaria: "maquinaria"
        }
    });
}
