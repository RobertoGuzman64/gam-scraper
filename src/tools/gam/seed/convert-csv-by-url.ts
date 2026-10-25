import { setImmediate as yieldToTerminal } from "node:timers/promises";
import { runToolTask } from "../../../cli/reporting/tool-task.js";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseCsv } from "./internal/csv.js";
import { safeJsonParse, ensureString } from "./internal/json.js";
import { buildDefaultMetadata } from "./internal/metadata.js";
import { refWithPrefix } from "./internal/reference.js";
import { extractUrlCategorySlug } from "./internal/slug.js";
import { normalizeSpace } from "./internal/string.js";
import { loadUrlCategoryIndex, resolveUrlCategorySellId } from "./internal/url-category.js";
import { parseUrlSpecScalar } from "./internal/url-spec-scalar.js";
import type { ConvertOptions, Report, SeedProduct } from "./internal/types.js";

type UrlConvertOptions = ConvertOptions & { failOnUnresolved?: boolean };
type UrlReport = Omit<Report, "usedAliasSlugMatch" | "usedFuzzySlugMatch">;

export const convertGamCsvToSeedTsAuto = async (options: UrlConvertOptions, onProgress?: (done: number, total: number) => void): Promise<void> => {
    const idx = await loadUrlCategoryIndex(options.categorySellFlatJsonPath);

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

    const report: UrlReport = {
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
        if (r % 250 === 0) {
            onProgress?.(r, parsed.rows.length);
            await yieldToTerminal();
        }
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
        const categorySellID = resolveUrlCategorySellId({ byId: idx.byId, idsBySlug: idx.idsBySlug }, categoryKey, urlCategorySlug, report);

        if (!categorySellID) {
            const key = urlCategorySlug ? `urlSlug:${urlCategorySlug}` : `categoryKey:${categoryKey}`;
            report.missingCategorySellId[key] = (report.missingCategorySellId[key] ?? 0) + 1;
            continue;
        }

        const specParsed = safeJsonParse(specJsonRaw);
        const specObj = (specParsed && typeof specParsed === "object" && !Array.isArray(specParsed) ? specParsed : {}) as Record<
            string,
            unknown
        >;

        const spec: Record<string, string | number | boolean> = {};
        for (const [k, v] of Object.entries(specObj)) {
            spec[normalizeSpace(k)] = parseUrlSpecScalar(v);
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

    onProgress?.(parsed.rows.length, parsed.rows.length);
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

    await runToolTask("SEMILLAS POR URL", async (status) => {
        status.update(`SEMILLAS POR URL | convirtiendo ${inputCsvPath}`);
        await convertGamCsvToSeedTsAuto({
        inputCsvPath: resolve(inputCsvPath),
        outputTsPath: resolve(outputTsPath),
        categorySellFlatJsonPath: resolve(categoryFlatPath),
        idStart: 200000,
        companyID: 208,
        defaultImage: "https://online.gamrentals.com/img/p/es-default.jpg",
        referencePrefix: "GAM-",
        failOnUnresolved: false
    }, (done, total) => status.update(`SEMILLAS POR URL | procesando ${done}/${total} filas`));
        return `Archivo: ${resolve(outputTsPath)} | Informe: ${resolve(outputTsPath)}.report.json`;
    });
}
