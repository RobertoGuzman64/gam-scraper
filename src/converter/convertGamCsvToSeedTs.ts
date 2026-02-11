import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseCsv } from "./internal/csv.js";
import { loadCategoryIndex } from "./internal/categoryIndex.js";
import { resolveCategorySellIdAuto } from "./internal/categoryResolve.js";
import { extractUrlCategorySlug } from "./internal/slug.js";
import { ensureString, safeJsonParse } from "./internal/json.js";
import { buildDefaultMetadata } from "./internal/metadata.js";
import { refWithPrefix } from "./internal/reference.js";
import { normalizeSpace } from "./internal/string.js";
import { normalizeSpecKey, parseSpecByRule } from "./internal/spec.js";
import { renderSeedTs } from "./internal/seedPrinter.js";
import type { ConvertOptions, Report, SeedProduct, SpecValue } from "./internal/types.js";

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
            report.missingCategorySellId[key] = (report.missingCategorySellId[key] ?? 0) + 1;
            continue;
        }

        const specParsed = safeJsonParse(specJsonRaw);
        const specObj = (specParsed && typeof specParsed === "object" && !Array.isArray(specParsed) ? specParsed : {}) as Record<string, unknown>;

        const spec: Record<string, SpecValue> = {};
        for (const [kRaw, v] of Object.entries(specObj)) {
            const k0 = normalizeSpace(kRaw);
            if (!k0) continue;

            const normKey = normalizeSpecKey(k0);
            const parsedSpec = parseSpecByRule(normKey, v);
            if (parsedSpec === null) continue;

            spec[normKey] = parsedSpec;
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

    const ts = renderSeedTs(out);

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
