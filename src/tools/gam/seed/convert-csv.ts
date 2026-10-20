import { setImmediate as yieldToTerminal } from "node:timers/promises";
import { runToolTask } from "../../../cli/reporting/tool-task.js";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseCsv } from "./internal/csv.js";
import { loadCategoryIndex } from "./internal/category-index.js";
import { resolveCategorySellIdAuto } from "./internal/category-resolve.js";
import { extractUrlCategorySlug } from "./internal/slug.js";
import { ensureString, safeJsonParse } from "./internal/json.js";
import { buildDefaultMetadata } from "./internal/metadata.js";
import { refWithPrefix } from "./internal/reference.js";
import { normalizeSpace } from "./internal/string.js";
import { normalizeSpecKey, parseSpecByRule } from "./internal/spec.js";
import { renderSeedTs } from "./internal/seed-printer.js";
import type { ConvertOptions, Report, SeedProduct, SpecValue } from "./internal/types.js";

export const convertGamCsvToSeedTs = async (options: ConvertOptions, onProgress?: (done: number, total: number) => void): Promise<void> => {
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

const parseOptionalInteger = (raw: string | undefined, flag: string, fallback: number): number => {
    if (raw === undefined) return fallback;
    const value = Number(raw);
    if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`${flag} debe ser un entero positivo`);
    return value;
};

export const resolveGamConverterOptions = (argv: readonly string[]): ConvertOptions => {
    const values: string[] = [];
    const flags = new Map<string, string>();
    const allowed = new Set(["idStart", "companyID", "defaultImage", "referencePrefix"]);

    for (let i = 0; i < argv.length; i += 1) {
        const argument = argv[i];
        if (!argument) continue;
        if (!argument.startsWith("--")) {
            values.push(argument);
            continue;
        }
        const name = argument.slice(2);
        const value = argv[i + 1];
        if (!allowed.has(name) || !value || value.startsWith("--")) {
            throw new Error(`Argumento inválido: ${argument}`);
        }
        flags.set(name, value);
        i += 1;
    }

    const [inputCsvPath, outputTsPath, categoryFlatPath] = values;
    if (!inputCsvPath || !outputTsPath || !categoryFlatPath || values.length !== 3) {
        throw new Error("Uso: convertGamCsvToSeedTs <input.csv> <output.ts> <categorySell-flat.json> [--idStart <n>] [--companyID <n>] [--defaultImage <url>] [--referencePrefix <texto>]");
    }

    return {
        inputCsvPath: resolve(inputCsvPath),
        outputTsPath: resolve(outputTsPath),
        categorySellFlatJsonPath: resolve(categoryFlatPath),
        idStart: parseOptionalInteger(flags.get("idStart"), "idStart", 681),
        companyID: parseOptionalInteger(flags.get("companyID"), "companyID", 208),
        defaultImage: flags.get("defaultImage") ?? "https://online.gamrentals.com/img/p/es-default.jpg",
        referencePrefix: flags.get("referencePrefix") ?? "GAM-"
    };
};

if (isMain(import.meta.url)) {
    await runToolTask("CONVERSIÓN GAM", async (status) => {
        const options = resolveGamConverterOptions(process.argv.slice(2));
        status.update(`CONVERSIÓN GAM | convirtiendo ${options.inputCsvPath}`);
        await convertGamCsvToSeedTs(options, (done, total) => status.update(`CONVERSIÓN GAM | procesando ${done}/${total} filas`));
        return `Archivo: ${options.outputTsPath} | Informe: ${options.outputTsPath}.report.json`;
    });
}
