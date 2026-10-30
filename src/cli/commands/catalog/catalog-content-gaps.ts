import { printReportLine } from "../../reporting/terminal.js";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { analyzeSourceContentGaps, prioritizeCatalogGaps } from "../../../catalog/diagnostics/content-gaps-source.js";
import { analyzeEditorialQuality } from "../../../catalog/diagnostics/editorial-quality.js";
import type { GapGroupBy, GapInput } from "../../../catalog/diagnostics/content-gaps-types.js";
import { findCampaignBaseline } from "../../../pipeline/campaign/reference/compare.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { loadPreparationInputs } from "../../../infrastructure/filesystem/preparation/preparation-inputs.js";
import { prepareSourceProduct } from "../../../catalog/preparation/prepare-product.js";
import { printCommandError } from "../../reporting/errors.js";

const root = fileURLToPath(new URL("../../../../", import.meta.url));

type CommandOptions = { readonly json: boolean; readonly groupBy: GapGroupBy; readonly minGroup: number;
  readonly minMissing: number; readonly limit: number; readonly catalogs: readonly string[] };

const parsePositive = (value: string | undefined, flag: string): number => {
  if (!value || !/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value))) {
    throw new Error(`${flag} requiere un entero positivo`);
  }
  return Number(value);
};

const readOptions = (args: readonly string[]): CommandOptions => {
  let json = false;
  let groupBy: GapGroupBy = "categoria";
  let minGroup = 8;
  let minMissing = 3;
  let limit = 20;
  const catalogs: string[] = [];
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === "--json") json = true;
    else if (arg === "--catalogo") {
      const value = args[++index];
      if (!value?.trim() || value.startsWith("--")) throw new Error("--catalogo requiere la ruta de un -catalog.json");
      catalogs.push(resolve(value));
    } else if (arg === "--agrupar") {
      const value = args[++index];
      if (value !== "categoria" && value !== "marca" && value !== "modelo") {
        throw new Error("--agrupar admite categoria, marca o modelo");
      }
      groupBy = value;
    } else if (arg === "--min-grupo") minGroup = parsePositive(args[++index], arg);
    else if (arg === "--min-ausentes") minMissing = parsePositive(args[++index], arg);
    else if (arg === "--top") limit = parsePositive(args[++index], arg);
    else throw new Error(`Opción desconocida: ${arg ?? ""}`);
  }
  return { json, groupBy, minGroup, minMissing, limit, catalogs };
};

export const runCatalogContentGaps = async (args: readonly string[]): Promise<void> => {
  if (args.length === 1 && args[0] === "--help") {
    printReportLine("Uso: npm run huecos -- [--catalogo ruta/-catalog.json ...] [--agrupar categoria|marca|modelo] [--min-grupo N] [--min-ausentes N] [--top N] [--json]\nSin --catalogo: última campaña entregada íntegra (o referencia histórica). Con --catalogo: uno o varios catálogos canónicos completos verificados por su manifest y resumen; consulta de solo lectura. Además de ausencias, mide longitudes y señales editoriales de título, descripción corta y general.");
    return;
  }
  const options = readOptions(args);
  const { fingerprints } = await loadPreparationInputs();
  const inputs: GapInput[] = [];
  let provenance: Record<string, unknown>;
  let sourceLabel: string;
  if (options.catalogs.length > 0) {
    const catalogs = await Promise.all(options.catalogs.map(readCanonicalCatalog));
    const providers = new Set<string>();
    for (const catalog of catalogs) {
      if (providers.has(catalog.providerId)) throw new Error(`Proveedor duplicado en los catálogos de entrada: ${catalog.providerId}`);
      providers.add(catalog.providerId);
      for (const source of catalog.products) inputs.push({ source, prepared: prepareSourceProduct(source) });
    }
    provenance = {
      source: "catalogos_canonicos",
      catalogs: catalogs.map((catalog, index) => ({
        path: options.catalogs[index], providerId: catalog.providerId, prefix: catalog.prefix,
        scope: catalog.scope, productCount: catalog.productCount,
        contentSha256: createHash("sha256").update(JSON.stringify(catalog)).digest("hex")
      })),
      rulesSha256: fingerprints.rulesSha256,
      preparation: "Vista recalculada con reglas técnicas actuales, no preparación histórica"
    };
    sourceLabel = `catálogos explícitos (${catalogs.map((catalog) => catalog.providerId).join(", ")})`;
  } else {
    const baseline = await findCampaignBaseline(root);
    if (!baseline) throw new Error("No existe campaña entregada ni referencia íntegra; utiliza --catalogo con un canónico completo");
    for (const catalog of baseline.catalogs) {
      for (const source of catalog.products) inputs.push({ source, prepared: prepareSourceProduct(source) });
    }
    provenance = {
      source: "campaña_entregada",
      runId: baseline.runId,
      catalogs: baseline.catalogs.map(({ providerId, productCount }) => ({ providerId, productCount })),
      rulesSha256: fingerprints.rulesSha256,
      preparation: "Vista recalculada con reglas técnicas actuales, no preparación histórica"
    };
    sourceLabel = `referencia ${baseline.runId}`;
  }
  const analysis = analyzeSourceContentGaps(inputs, { groupBy: options.groupBy });
  const ranked = prioritizeCatalogGaps(analysis, options.minGroup, options.minMissing);
  const editorial = analyzeEditorialQuality(inputs);
  if (options.json) {
    console.log(JSON.stringify({ version: 1, analyzedAt: new Date().toISOString(), provenance,
      ...analysis, editorial, prioritized: ranked.slice(0, options.limit).map(({ group, observation, tier }) => ({
        providerId: group.providerId, categorySellID: group.categorySellID, sourceCategoryKey: group.sourceCategoryKey,
        brand: group.brand, model: group.model, field: observation.field, missing: observation.missing, tier
      })) }, null, 2));
    return;
  }
  printReportLine(`HUECOS | ${sourceLabel} | originales ${analysis.universe.total} | ready ${analysis.universe.ready} | review ${analysis.universe.review} | sin categoría ${analysis.universe.withoutCategory}`);
  printReportLine(analysis.universe.note);
  printReportLine(`PROVEEDORES | ${analysis.universe.providers.map((item) => `${item.providerId}:${item.originals}`).join(" | ")}`);
  printReportLine(`PATRONES | ${ranked.length} con grupo >= ${options.minGroup} y ausencias >= ${options.minMissing} | TOP ${Math.min(options.limit, ranked.length)}`);
  for (const { group, observation } of ranked.slice(0, options.limit)) {
    const field = observation.field.name;
    const label = group.category ?? `sin categoría (${group.sourceCategoryKey})`;
    const refinement = [group.brand, group.model].filter((value) => value !== null).join(" / ");
    printReportLine(`${group.providerId} | ${label}${refinement ? ` | ${refinement}` : ""} | ${field} | ${observation.present}/${observation.applicable} (${observation.coveragePercent}%) | ausentes ${observation.missing} | ${observation.coverage} | evidencias directas ${observation.directEvidence}, texto relacionado ${observation.relatedText}`);
    printReportLine(`  Casos: ${observation.missingIdentities.join(", ")}`);
  }
  printReportLine("CALIDAD EDITORIAL | texto preparado, umbrales orientativos, sin intervenir fichas");
  printReportLine(`CRITERIOS (palabras) | título >= ${editorial.criteria.minTitleWords} | corta ${editorial.criteria.minShortWords}-${editorial.criteria.maxShortWords} | general ${editorial.criteria.minLongWords}-${editorial.criteria.maxLongWords}`);
  for (const provider of editorial.providers) {
    const short = provider.lengths.description;
    const long = provider.lengths.description_general;
    printReportLine(`${provider.providerId} | corta: ${short.present}/${provider.total}, mediana ${short.words.median ?? "-"} palabras, P90 ${short.words.p90 ?? "-"} | general: ${long.present}/${provider.total}, mediana ${long.words.median ?? "-"} palabras, P90 ${long.words.p90 ?? "-"}`);
  }
  printReportLine(`SEÑALES EDITORIALES | ${editorial.patterns.length} patrones | ${editorial.cases.length} fichas con observaciones | TOP ${Math.min(options.limit, editorial.patterns.length)}`);
  for (const pattern of editorial.patterns.slice(0, options.limit)) {
    printReportLine(`${pattern.providerId} | ${pattern.category} | ${pattern.code} | ${pattern.affected}/${pattern.total} | ejemplos ${pattern.examples.join(", ")}`);
  }
  printReportLine("Consulta sin escrituras. El JSON incluye métricas de palabras/caracteres, criterios, patrones y casos editoriales, además de los huecos existentes.");
};

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  runCatalogContentGaps(process.argv.slice(2)).catch((error: unknown) => {
    printCommandError("huecos", error);
    process.exitCode = 1;
  });
}
