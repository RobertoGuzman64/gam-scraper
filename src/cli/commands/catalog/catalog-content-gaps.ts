import { printCommandHeader, printCommandSection, printReportLine } from "../../reporting/terminal.js";
import { resolve } from "node:path";
import type { GapInput } from "../../../catalog/diagnostics/content-gaps-types.js";
import { readContentGapOptions, type CommandOptions } from "./catalog-content-gaps-options.js";
import { printEditorial, printDescriptionCoverage, printDescriptionPriorities } from "../../reporting/catalog-content-gaps-output.js";
import { originalSources } from "../../../infrastructure/filesystem/catalog/original-catalog-sources.js";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { analyzeSourceContentGaps, prioritizeCatalogGaps } from "../../../catalog/diagnostics/content-gaps-source.js";
import { analyzeEditorialQuality, analyzePublishedEditorialQuality } from "../../../catalog/diagnostics/editorial-quality.js";
import { discoverAccreditedPublications, readAccreditedPublication } from "../../../infrastructure/filesystem/catalog/accredited-publication.js";
import { findCampaignBaseline } from "../../../campaign/reference/compare.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { loadPreparationInputs } from "../../../infrastructure/filesystem/preparation/preparation-inputs.js";
import { prepareSourceProduct } from "../../../preparation/prepare-product.js";
import { printCommandError } from "../../reporting/errors.js";
import { buildProductIdentity } from "../../../catalog/identity.js";
import { analyzeSpecificationCoverage } from "../../../catalog/diagnostics/specification-coverage.js";
import { formatSpecificationCoverageReport } from "./specification-coverage-report.js";
import { formatCatalogAuditClosureReport } from "./catalog-audit-closure-report.js";
import { analyzeDescriptionCoverage } from "../../../catalog/diagnostics/description-coverage.js";
import type { DescriptionCoverageInput } from "../../../catalog/diagnostics/description-coverage.js";
import { reconstructMercaelevaSource } from "../../../catalog/diagnostics/description-source.js";
import { analyzeDescriptionPriorities } from "../../../catalog/diagnostics/description-priorities.js";
import { analyzeTechnicalDensity } from "../../../catalog/diagnostics/technical-density.js";
import { formatTechnicalDensityReport } from "./technical-density-report.js";
import { analyzeTitleQuality } from "../../../catalog/diagnostics/title-quality.js";
import { formatTitleQualityReport } from "./title-quality-report.js";

const root = fileURLToPath(new URL("../../../../", import.meta.url));

const reportPublications = async (paths: readonly string[], options: CommandOptions): Promise<void> => {
  const publications = await Promise.all(paths.map(readAccreditedPublication));
  const providers = new Set<string>();
  for (const publication of publications) {
    if (providers.has(publication.providerId)) throw new Error(`Proveedor duplicado en publicaciones: ${publication.providerId}`);
    providers.add(publication.providerId);
  }
  const products = publications.flatMap((publication) => publication.products);
  const provenance = { source: "publicaciones_acreditadas", publications: publications.map((publication, index) => ({
    path: paths[index], providerId: publication.providerId, runId: publication.runId,
    productCount: publication.products.length, contentSha256: publication.sha256
  })) };
  const editorial = analyzePublishedEditorialQuality(products);
  const technicalDensity = analyzeTechnicalDensity(products);
  if (options.json) {
    console.log(JSON.stringify({ version: 1, analyzedAt: new Date().toISOString(), provenance, editorial, technicalDensity }, null, 2));
  } else {
    printReportLine(`HUECOS | publicaciones acreditadas (${publications.map((item) => item.providerId).join(", ")}) | finales ${products.length} | diagnóstico exclusivamente editorial`);
    printEditorial(editorial, options.limit, options.detailed);
    for (const line of formatTechnicalDensityReport(technicalDensity, options.limit, options.detailed)) printReportLine(line);
  }
};

const reportDescriptionComparison = async (paths: readonly string[], options: CommandOptions): Promise<void> => {
  const publications = await Promise.all(paths.map(readAccreditedPublication));
  const providers = new Set<string>();
  const inputs: DescriptionCoverageInput[] = [];
  const sourceProvenance: { providerId: string; origin: "original_canonico" | "reconstruccion_publicada"; originalProducts: number | null; publishedProducts: number; publicationSha256: string }[] = [];
  for (const publication of publications) {
    if (providers.has(publication.providerId)) throw new Error(`Proveedor duplicado en publicaciones: ${publication.providerId}`);
    providers.add(publication.providerId);
    const sources = await originalSources(root, publication.providerId);
    if (sources === null && publication.providerId !== "mercaeleva") {
      throw new Error(`No existe original canónico para comparar ${publication.providerId}; no se atribuye fuente inexistente`);
    }
    const origin = sources === null ? "reconstruccion_publicada" : "original_canonico";
    sourceProvenance.push({ providerId: publication.providerId, origin, originalProducts: sources?.size ?? null,
      publishedProducts: publication.products.length, publicationSha256: publication.sha256 });
    for (const published of publication.products) {
      const identity = buildProductIdentity({ providerId: published.providerId, reference: published.reference,
        serialNumber: null, url: published.sourceUrl }).key;
      const source = sources === null ? reconstructMercaelevaSource(published) : sources.get(identity);
      if (!source) throw new Error(`Publicación sin origen canónico emparejado: ${identity}`);
      inputs.push({ published, source, prepared: prepareSourceProduct(source), origin });
    }
  }
  const { fingerprints } = await loadPreparationInputs();
  const provenance = { source: "comparacion_publicaciones_y_preparacion", publications: sourceProvenance,
    rulesSha256: fingerprints.rulesSha256, preparation: "Recalculada; Mercaeleva reconstruida únicamente desde campos de su publicación, no desde un original canónico" };
  if (options.titles) {
    const titles = analyzeTitleQuality(inputs);
    if (options.json) {
      console.log(JSON.stringify({ version: 1, analyzedAt: new Date().toISOString(), provenance, titles }, null, 2));
    } else {
      printReportLine(`HUECOS | auditoría de títulos técnicos | publicaciones ${titles.totals.products} | comparación frente a preparación, solo lectura`);
      for (const line of formatTitleQualityReport(titles, options.limit)) printReportLine(line);
    }
    return;
  }
  const coverage = analyzeDescriptionCoverage(inputs);
  const products = publications.flatMap((item) => item.products);
  const editorial = analyzePublishedEditorialQuality(products);
  const editorialPrepared = analyzeEditorialQuality(inputs);
  const technicalDensity = analyzeTechnicalDensity(products);
  const priorities = analyzeDescriptionPriorities(inputs, editorial, editorialPrepared);
  const technicalSpecs = options.specs ? analyzeSpecificationCoverage(inputs) : null;
  if (options.json) {
    console.log(JSON.stringify({ version: 1, analyzedAt: new Date().toISOString(), provenance, coverage, editorial, editorialPrepared, priorities, technicalDensity, ...(technicalSpecs ? { technicalSpecs } : {}) }, null, 2));
  } else {
    printReportLine(`HUECOS | publicaciones finales ${coverage.totals.products} · comparación con preparación actual · solo lectura`);
    printCommandSection("DESCRIPCIONES · P0");
    printDescriptionCoverage(coverage, options.detailed);
    printDescriptionPriorities(priorities, options.limit, options.detailed);
    if (options.detailed) printReportLine("CALIDAD EDITORIAL | vista derivada tras preparación; señales orientativas independientes de P0");
    if (options.detailed) printEditorial(editorialPrepared, options.limit, true);
    for (const line of formatTechnicalDensityReport(technicalDensity, options.limit, options.detailed)) printReportLine(line);
    if (technicalSpecs) {
      printCommandSection("ESPECIFICACIONES Y CIERRE AUDITOR");
      for (const line of formatSpecificationCoverageReport(technicalSpecs, options.limit, options.detailed)) printReportLine(line);
      for (const line of formatCatalogAuditClosureReport(coverage, priorities, technicalSpecs)) printReportLine(line);
    }
  }
};

export const runCatalogContentGaps = async (args: readonly string[]): Promise<void> => {
  if (args.length === 1 && args[0] === "--help") {
    printReportLine("Uso: npm run huecos -- [--comparar | --finales | --catalogo ruta/-catalog.json ... | --publicacion ruta/-publishable.json ...] [--agrupar categoria|marca|modelo] [--min-grupo N] [--min-ausentes N] [--top N] [--detalle] [--json] [--specs] [--titulos]\nSin fuente explícita: campaña entregada o referencia histórica; si faltan, comparación de publicaciones acreditadas frente a preparación actual. --comparar fuerza esa comparación. --finales analiza solo las publicaciones acreditadas. --catalogo analiza originales canónicos; --publicacion analiza exclusivamente textos finales acreditados. --comparar --specs compara las claves técnicas del origen canónico, preparación y publicación; las ausencias familiares no son atributos obligatorios. --comparar --titulos analiza señales de títulos técnicos en publicaciones y preparación actual, sin modificar fichas.");
    return;
  }
  const options = readContentGapOptions(args);
  if (!options.json) printCommandHeader("HUECOS · AUDITORÍA TÉCNICA");
  if (options.compareSources) {
    const paths = await discoverAccreditedPublications(root);
    if (paths.length === 0) throw new Error("No hay publicaciones acreditadas en catalogs/providers/*/publications");
    await reportDescriptionComparison(paths, options);
    return;
  }
  if (options.publications.length > 0 || options.finalPublications) {
    const paths = options.finalPublications ? await discoverAccreditedPublications(root) : options.publications;
    if (paths.length === 0) throw new Error("No hay publicaciones acreditadas en catalogs/providers/*/publications");
    await reportPublications(paths, options);
    return;
  }
  const baseline = options.catalogs.length === 0 ? await findCampaignBaseline(root) : null;
  if (options.catalogs.length === 0 && !baseline) {
      const paths = await discoverAccreditedPublications(root);
      if (paths.length === 0) {
        throw new Error("No existe campaña entregada ni publicaciones acreditadas; utiliza --catalogo con un canónico completo");
      }
      await reportDescriptionComparison(paths, options);
      return;
  }
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
    if (!baseline) throw new Error("No existe campaña entregada verificable");
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
  const technicalDensity = analyzeTechnicalDensity(inputs.map((item) => item.prepared.product));
  if (options.json) {
    console.log(JSON.stringify({ version: 1, analyzedAt: new Date().toISOString(), provenance,
      ...analysis, editorial, technicalDensity, prioritized: ranked.slice(0, options.limit).map(({ group, observation, tier }) => ({
        providerId: group.providerId, categorySellID: group.categorySellID, sourceCategoryKey: group.sourceCategoryKey,
        brand: group.brand, model: group.model, field: observation.field, missing: observation.missing, tier
      })) }, null, 2));
    return;
  }
  printReportLine(`HUECOS | ${sourceLabel} | originales ${analysis.universe.total} | ready ${analysis.universe.ready} | review ${analysis.universe.review} | sin categoría ${analysis.universe.withoutCategory}`);
  if (options.detailed) printReportLine(analysis.universe.note);
  printReportLine(`PROVEEDORES | ${analysis.universe.providers.map((item) => `${item.providerId}:${item.originals}`).join(" · ")}`);
  printReportLine(`PATRONES | ${ranked.length} grupos con cobertura incompleta; observaciones, no contratos obligatorios`);
  if (options.detailed) for (const { group, observation } of ranked.slice(0, options.limit)) {
    const field = observation.field.name;
    const label = group.category ?? `sin categoría (${group.sourceCategoryKey})`;
    const refinement = [group.brand, group.model].filter((value) => value !== null).join(" / ");
    printReportLine(`${group.providerId} | ${label}${refinement ? ` | ${refinement}` : ""} | ${field} | ${observation.present}/${observation.applicable} (${observation.coveragePercent}%) | ausentes ${observation.missing} | ${observation.coverage} | evidencias directas ${observation.directEvidence}, texto relacionado ${observation.relatedText}`);
    printReportLine(`  Casos: ${observation.missingIdentities.join(", ")}`);
  }
  printEditorial(editorial, options.limit, options.detailed);
  for (const line of formatTechnicalDensityReport(technicalDensity, options.limit, options.detailed)) printReportLine(line);
};

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  runCatalogContentGaps(process.argv.slice(2)).catch((error: unknown) => {
    printCommandError("huecos", error);
    process.exitCode = 1;
  });
}
