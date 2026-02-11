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
};

type Report = {
    totalRows: number;
    totalProductsWritten: number;
    missingCategorySellId: Record<string, number>;
    ambiguousUrlSlug: Record<string, number>;
    usedFallbackToCategoryKey: Record<string, number>;
    usedDirectSlugMatch: Record<string, number>;
    usedNormalizedSlugMatch: Record<string, number>;
    usedAliasSlugMatch: Record<string, number>;
    usedFuzzySlugMatch: Record<string, number>;
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

const isNullLike = (v: unknown): boolean => {
    if (v === null || v === undefined) return true;
    if (typeof v === "string") {
        const t = normalizeSpace(v).toLowerCase();
        if (!t) return true;
        if (t === "null" || t === "undefined") return true;
        if (t === "n/a" || t === "na" || t === "no aplica") return true;
        if (t === "-" || t === "—") return true;
    }
    return false;
};

const parseScalar = (key: string, v: unknown): string | number | boolean | null => {
    if (isNullLike(v)) return null;
    if (typeof v === "boolean") return v;
    if (typeof v === "number") return v;
    if (typeof v !== "string") return String(v);

    const t = normalizeSpace(v);
    if (!t) return null;

    if (key === "Nº de serie") return t;

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

const normalizeGamSlugBase = (slug: string): string => {
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

const slugCandidatesFromUrlSlug = (urlSlug: string): readonly string[] => {
    const raw = normalizeSpace(urlSlug).toLowerCase();
    if (!raw) return [];

    const candidates: string[] = [];
    const base = normalizeGamSlugBase(raw);

    const withSuffix = (s: string): string => {
        const t = normalizeSpace(s).toLowerCase().replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
        if (!t) return "";
        if (t.endsWith("-segunda-mano")) return t;
        return `${t}-segunda-mano`;
    };

    const push = (s: string): void => {
        const t = normalizeSpace(s).toLowerCase().replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
        if (!t) return;
        if (!candidates.includes(t)) candidates.push(t);
    };

    push(raw);
    push(base);
    push(withSuffix(base));

    const noElevadoras = base.replace(/\bplataformas-elevadoras-/, "plataformas-").replace(/-elevadoras-/g, "-");
    push(noElevadoras);
    push(withSuffix(noElevadoras));

    const elevadoresToPlataformas = base.replace(/^elevadores-/, "plataformas-");
    push(elevadoresToPlataformas);
    push(withSuffix(elevadoresToPlataformas));

    const telescopicas = base
        .replace(/^elevadores-/, "plataformas-")
        .replace(/-telescopicos\b/, "-telescopicas")
        .replace(/-telescopico\b/, "-telescopica");
    push(telescopicas);
    push(withSuffix(telescopicas));

    const plataformasElevadorasTelescopicas = telescopicas.replace(/^plataformas-/, "plataformas-elevadoras-");
    push(plataformasElevadorasTelescopicas);
    push(withSuffix(plataformasElevadorasTelescopicas));

    const transpaletas = base.replace(/^transpaletas-elevadoras-/, "transpaletas-");
    push(transpaletas);
    push(withSuffix(transpaletas));

    const apiladoras = base.replace(/^apiladoras-elevadoras-/, "apiladores-").replace(/^apiladoras-/, "apiladores-");
    push(apiladoras);
    push(withSuffix(apiladoras));

    const apiladoresElectricos = base
        .replace(/^apiladoras-elevadoras-/, "apiladores-")
        .replace(/^apiladoras-/, "apiladores-")
        .replace(/-electricas\b/, "-electricos")
        .replace(/-electrica\b/, "-electrico");
    push(apiladoresElectricos);
    push(withSuffix(apiladoresElectricos));

    const preparapedidos = base.replace(/^preparapedidos\b/, "preparapedido");
    push(preparapedidos);
    push(withSuffix(preparapedidos));

    const carretillas4x4 = base.replace(/^carretillas-todoterreno-4x4\b/, "carretillas-todoterreno");
    push(carretillas4x4);
    push(withSuffix(carretillas4x4));

    const minicargadoras = base.replace(/^mini-cargadoras\b/, "minicargadoras").replace(/^mini-cargadora\b/, "minicargadora");
    push(minicargadoras);
    push(withSuffix(minicargadoras));

    const miniexcavadoras = base.replace(/^mini-excavadoras\b/, "miniexcavadoras").replace(/^mini-excavadora\b/, "miniexcavadora");
    push(miniexcavadoras);
    push(withSuffix(miniexcavadoras));

    if (base.startsWith("camiones-cesta")) {
        push("plataformas-elevadoras-sobre-camion-segunda-mano");
        push("plataformas-elevadoras-sobre-camion");
    }

    if (base.startsWith("manipuladores-frontales")) {
        push("manipulacion-elevacion-cargas-segunda-mano");
        push("manipulacion-elevacion-cargas");
    }

    if (base.startsWith("resto-maquinaria")) {
        push("maquinaria");
    }

    return candidates;
};

const toTokens = (slug: string): readonly string[] => {
    const stop = new Set([
        "segunda",
        "mano",
        "de",
        "la",
        "el",
        "y",
        "a",
        "en",
        "por",
        "para",
        "venta",
        "ocasion",
        "usado",
        "usada",
        "alquiler",
        "diesel",
        "diésel",
        "electricas",
        "eléctricas",
        "electricos",
        "eléctricos",
        "manuales",
        "manual"
    ]);

    const parts = normalizeSpace(slug)
        .toLowerCase()
        .replace(/[^a-z0-9áéíóúüñ-]/g, " ")
        .replace(/-+/g, "-")
        .split(/[-\s]+/g)
        .map((p) => normalizeSpace(p))
        .filter((p) => p.length > 0);

    const filtered: string[] = [];
    for (const p of parts) {
        if (!stop.has(p)) filtered.push(p);
    }
    return filtered;
};

const inc = (obj: Record<string, number>, key: string): void => {
    if (!key) return;
    obj[key] = (obj[key] ?? 0) + 1;
};

const loadCategoryIndex = async (
    flatJsonPath: string
): Promise<{
    idsBySlug: ReadonlyMap<string, readonly number[]>;
    pathById: ReadonlyMap<number, string>;
    tokensById: ReadonlyMap<number, readonly string[]>;
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

    const buildPath = (id: number): string => {
        const slugs: string[] = [];
        let cur: CategoryFlatRow | undefined = byId.get(id);
        while (cur) {
            slugs.push(cur.slug);
            if (cur.parentId === null) break;
            cur = cur.parentId === null ? undefined : byId.get(cur.parentId);
        }
        return slugs.reverse().join("/");
    };

    const pathById = new Map<number, string>();
    const tokensById = new Map<number, readonly string[]>();

    for (const id of byId.keys()) {
        const p = buildPath(id).toLowerCase();
        pathById.set(id, p);
        tokensById.set(id, toTokens(p));
    }

    return { idsBySlug, pathById, tokensById };
};

const pickBestCandidate = (candidateIds: readonly number[], idx: { pathById: ReadonlyMap<number, string> }, categoryKey: string): number | null => {
    if (candidateIds.length === 0) return null;
    if (candidateIds.length === 1) return candidateIds[0] ?? null;

    const key = normalizeSpace(categoryKey).toLowerCase();
    const target = key ? `/maquinaria/${key}/` : "/maquinaria/";
    for (const id of candidateIds) {
        const path = idx.pathById.get(id) ?? "";
        if (path.includes(target)) return id;
    }
    return candidateIds[0] ?? null;
};

const fuzzyFindBestId = (
    urlSlug: string,
    categoryKey: string,
    idx: {
        pathById: ReadonlyMap<number, string>;
        tokensById: ReadonlyMap<number, readonly string[]>;
    }
): number | null => {
    const base = normalizeGamSlugBase(urlSlug);
    const wanted = toTokens(base);
    if (wanted.length === 0) return null;

    const key = normalizeSpace(categoryKey).toLowerCase();
    const target = key ? `/maquinaria/${key}/` : "/maquinaria/";

    let bestId: number | null = null;
    let bestScore = 0;

    for (const [id, tokens] of idx.tokensById.entries()) {
        const path = idx.pathById.get(id) ?? "";
        if (!path.includes(target)) continue;

        let inter = 0;
        const tokenSet = new Set(tokens);
        for (const w of wanted) if (tokenSet.has(w)) inter += 1;

        if (inter === 0) continue;

        const score = inter / wanted.length;
        if (score > bestScore) {
            bestScore = score;
            bestId = id;
        }
    }

    if (bestId !== null && bestScore >= 0.5) return bestId;

    return null;
};

const categoryKeyFallbackSlug = (categoryKey: string): string => {
    const k = normalizeSpace(categoryKey).toLowerCase();
    if (!k) return "maquinaria";
    if (k === "maquinaria") return "maquinaria";
    return k;
};

const resolveCategorySellIdAuto = (
    idx: {
        idsBySlug: ReadonlyMap<string, readonly number[]>;
        pathById: ReadonlyMap<number, string>;
        tokensById: ReadonlyMap<number, readonly string[]>;
    },
    categoryKey: string,
    urlCategorySlug: string,
    report: Report
): number | null => {
    const slug = normalizeSpace(urlCategorySlug).toLowerCase();

    if (slug) {
        const directIds = idx.idsBySlug.get(slug) ?? [];
        if (directIds.length > 0) {
            const chosen = pickBestCandidate(directIds, { pathById: idx.pathById }, categoryKey);
            if (chosen !== null) {
                inc(report.usedDirectSlugMatch, slug);
                return chosen;
            }
        }

        const candidates = slugCandidatesFromUrlSlug(slug);
        for (const c of candidates) {
            const ids = idx.idsBySlug.get(c) ?? [];
            if (ids.length > 0) {
                const chosen = pickBestCandidate(ids, { pathById: idx.pathById }, categoryKey);
                if (chosen !== null) {
                    inc(report.usedAliasSlugMatch, slug);
                    return chosen;
                }
            }
        }

        const fuzzy = fuzzyFindBestId(slug, categoryKey, { pathById: idx.pathById, tokensById: idx.tokensById });
        if (fuzzy !== null) {
            inc(report.usedFuzzySlugMatch, slug);
            return fuzzy;
        }

        inc(report.unknownUrlSlug, slug);
    }

    const fallbackSlug = categoryKeyFallbackSlug(categoryKey);
    const fallbackIds = fallbackSlug ? (idx.idsBySlug.get(fallbackSlug) ?? []) : [];
    if (fallbackIds.length > 0) {
        const chosen = pickBestCandidate(fallbackIds, { pathById: idx.pathById }, categoryKey);
        if (chosen !== null) {
            inc(report.usedFallbackToCategoryKey, categoryKey);
            return chosen;
        }
    }

    return null;
};

export const convertGamCsvToSeedTs = async (options: ConvertOptions): Promise<void> => {
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
    const iImage = col("image");
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
        usedAliasSlugMatch: {},
        usedFuzzySlugMatch: {},
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
        const imageRaw = iImage >= 0 ? normalizeSpace(row[iImage] ?? "") : "";
        const specJsonRaw = ensureString(row[iSpecJson] ?? "");

        if (!categoryKey || !title) continue;

        const urlCategorySlug = extractUrlCategorySlug(url);
        const categorySellID = resolveCategorySellIdAuto(
            { idsBySlug: idx.idsBySlug, pathById: idx.pathById, tokensById: idx.tokensById },
            categoryKey,
            urlCategorySlug,
            report
        );

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
        for (const [kRaw, v] of Object.entries(specObj)) {
            const k = normalizeSpace(kRaw);
            if (!k) continue;
            const parsed = parseScalar(k, v);
            if (parsed === null) continue;
            spec[k] = parsed;
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
            image: imageRaw || options.defaultImage,
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
        throw new Error("Uso: node dist/converter/convertGamCsvToSeedTs.js <input.csv> <output.ts> <categorySell-flat.json>");
    }

    await convertGamCsvToSeedTs({
        inputCsvPath: resolve(inputCsvPath),
        outputTsPath: resolve(outputTsPath),
        categorySellFlatJsonPath: resolve(categoryFlatPath),
        idStart: 681,
        companyID: 208,
        defaultImage: "https://online.gamrentals.com/img/p/es-default.jpg",
        referencePrefix: "GAM-"
    });
}
