import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { analyzeCatalogContentGaps, prioritizeCatalogGaps } from "../tools/catalog-content-gaps.js";
import type { GapGroupBy, GapInput } from "../tools/catalog-content-gaps.js";
import { inspectCampaignReference } from "../infrastructure/filesystem/campaign-reference.js";
import { loadImportCatalogSnapshot } from "../infrastructure/filesystem/import-catalog-loader.js";
import { prepareProduct } from "../catalog/import/preparation/prepare-product.js";
import { printCommandError } from "./reporting/errors.js";

const root = fileURLToPath(new URL("../../", import.meta.url));
const sha256 = (content: string): string => createHash("sha256").update(content).digest("hex");

type CommandOptions = { readonly json: boolean; readonly groupBy: GapGroupBy; readonly minGroup: number;
  readonly minMissing: number; readonly limit: number };

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
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === "--json") json = true;
    else if (arg === "--agrupar") {
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
  return { json, groupBy, minGroup, minMissing, limit };
};

export const runCatalogContentGaps = async (args: readonly string[]): Promise<void> => {
  if (args.length === 1 && args[0] === "--help") {
    console.log("Uso: npm run huecos -- [--agrupar categoria|marca|modelo] [--min-grupo N] [--min-ausentes N] [--top N] [--json]\nConsulta solo lectura de los originales de data/reference; --json emite un informe completo por stdout.");
    return;
  }
  const options = readOptions(args);
  const inspection = await inspectCampaignReference(root);
  if (inspection.status !== "valid") {
    throw new Error(inspection.status === "absent" ? "No existe referencia íntegra; consulta no disponible" :
      `Referencia no válida para auditoría (${inspection.status}): ${inspection.reason}`);
  }
  const { catalog, categoryRaw, attributeRaw } = await loadImportCatalogSnapshot();
  const inputs: GapInput[] = [];
  for (const sourceCatalog of inspection.reference.catalogs) {
    for (const source of sourceCatalog.products) inputs.push({ source, prepared: prepareProduct(source, catalog) });
  }
  const analysis = analyzeCatalogContentGaps(inputs, catalog, { groupBy: options.groupBy });
  const ranked = prioritizeCatalogGaps(analysis, options.minGroup, options.minMissing);
  if (options.json) {
    console.log(JSON.stringify({ version: 1, analyzedAt: new Date().toISOString(), provenance: {
      runId: inspection.reference.manifest.runId,
      catalogs: inspection.reference.manifest.catalogs.map(({ providerId, productCount, sha256 }) => ({ providerId, productCount, sha256 })),
      importCatalogSha256: { categories: sha256(categoryRaw), attributes: sha256(attributeRaw) },
      preparation: "Vista recalculada con los mapeadores actuales, no preparación histórica"
    }, ...analysis, prioritized: ranked.slice(0, options.limit).map(({ group, observation, tier }) => ({
      providerId: group.providerId, categorySellID: group.categorySellID, sourceCategoryKey: group.sourceCategoryKey,
      brand: group.brand, model: group.model, field: observation.field, missing: observation.missing, tier
    })) }, null, 2));
    return;
  }
  console.log(`HUECOS | referencia ${inspection.reference.manifest.runId} | originales ${analysis.universe.total} | ready ${analysis.universe.ready} | review ${analysis.universe.review} | sin categoría ${analysis.universe.withoutCategory}`);
  console.log(analysis.universe.note);
  console.log(`PROVEEDORES | ${analysis.universe.providers.map((item) => `${item.providerId}:${item.originals}`).join(" | ")}`);
  console.log(`PATRONES | ${ranked.length} con grupo >= ${options.minGroup} y ausencias >= ${options.minMissing} | TOP ${Math.min(options.limit, ranked.length)}`);
  for (const { group, observation } of ranked.slice(0, options.limit)) {
    const field = observation.field.kind === "attribute" ? `${observation.field.name} (#${observation.field.attributeID})` : observation.field.name;
    const label = group.category ?? `sin categoría (${group.sourceCategoryKey})`;
    const refinement = [group.brand, group.model].filter((value) => value !== null).join(" / ");
    console.log(`${group.providerId} | ${label}${refinement ? ` | ${refinement}` : ""} | ${field} | ${observation.present}/${observation.applicable} (${observation.coveragePercent}%) | ausentes ${observation.missing} | ${observation.coverage} | evidencias directas ${observation.directEvidence}, texto relacionado ${observation.relatedText}`);
    console.log(`  Casos: ${observation.missingIdentities.join(", ")}`);
  }
  console.log("Consulta sin escrituras. Para evidencias originales y todos los grupos: npm run huecos -- --json");
};

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  runCatalogContentGaps(process.argv.slice(2)).catch((error: unknown) => {
    printCommandError("huecos", error);
    process.exitCode = 1;
  });
}
