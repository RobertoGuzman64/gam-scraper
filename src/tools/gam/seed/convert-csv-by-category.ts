import { setImmediate as yieldToTerminal } from "node:timers/promises";
import { runToolTask } from "../../../cli/reporting/tool-task.js";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseCsv } from "./internal/csv.js";
import { ensureString, safeJsonParse } from "./internal/json.js";
import { normalizeSpace } from "./internal/string.js";
import { buildDefaultMetadata } from "./internal/metadata.js";
import { refWithPrefix } from "./internal/reference.js";
import { loadCategoryResolver } from "./internal/category-path.js";
import { parseScalar } from "./internal/category-path-scalar.js";
import type { ConvertOptions, SeedProduct } from "./internal/category-path-types.js";

export const convertGamCsvToSeedTs = async (options: ConvertOptions, onProgress?: (done: number, total: number) => void): Promise<void> => {
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
        if (r % 250 === 0) {
            onProgress?.(r, parsed.rows.length);
            await yieldToTerminal();
        }
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

    onProgress?.(parsed.rows.length, parsed.rows.length);
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

    await runToolTask("SEMILLAS POR CATEGORÍA", async (status) => {
        status.update(`SEMILLAS POR CATEGORÍA | convirtiendo ${inputCsvPath}`);
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
    }, (done, total) => status.update(`SEMILLAS POR CATEGORÍA | procesando ${done}/${total} filas`));
        return `Archivo: ${resolve(outputTsPath)}`;
    });
}
