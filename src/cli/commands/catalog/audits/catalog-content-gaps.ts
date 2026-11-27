import { printCommandHeader, printCommandSection, printReportLine } from "../../../reporting/terminal.js";
import { resolve } from "node:path";
import type { GapInput } from "../../../../catalog/diagnostics/coverage/content-gaps-types.js";
import { readContentGapOptions, type CommandOptions } from "./catalog-content-gaps-options.js";
import { printEditorial, printDescriptionCoverage, printDescriptionPriorities, printEditorialReuse, printEditorialKnowledgeUsage, printDocumentaryNarrative } from "../../../reporting/audits/catalog-content-gaps-output.js";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { analyzeSourceContentGaps, prioritizeCatalogGaps } from "../../../../catalog/diagnostics/coverage/content-gaps-source.js";
import { analyzeEditorialQuality, analyzePublishedEditorialQuality } from "../../../../catalog/diagnostics/editorial/editorial-quality.js";
import { analyzeEditorialReuse, analyzeEditorialKnowledgeUsage, analyzeEditorialKnowledgeComparison } from "../../../../catalog/diagnostics/editorial/editorial-reuse.js";
import { readAccreditedPublication } from "../../../../infrastructure/filesystem/catalog/publications/accredited-publication.js";
import { findCampaignBaseline } from "../../../../campaign/reference/compare.js";
import { readCanonicalCatalog } from "../../../../infrastructure/filesystem/catalog/originals/canonical-catalog.js";
import { readActiveTechnicalPublication } from "../../../../infrastructure/filesystem/catalog/publications/technical-publication.js";
import { CAMPAIGN_PROVIDERS } from "../../../../contracts/campaign-providers.js";
import { loadPreparationInputs } from "../../../../infrastructure/filesystem/preparation/preparation-inputs.js";
import { loadGapPublications, loadGapComparison, loadGapCurrentPopulation } from "../../../../infrastructure/filesystem/preparation/content-gap-population.js";
import { gapPopulation, gapPopulationFailure, gapCheckCoverage, reconcileGapCurrentEntries, type GapPopulationEntry } from "../../../../catalog/diagnostics/coverage/content-gap-population.js";
import { analyzeContentGapCampaigns } from "../../../../catalog/diagnostics/coverage/content-gap-campaigns.js";
import { printContentGapCampaigns } from "../../../reporting/audits/technical-preparation-output.js";
import { analyzePreparedSpecificationStage, compareSpecificationStages } from "../../../../catalog/diagnostics/coverage/specification-stages.js";
import { printTechnicalPreparation, printGapPopulation } from "../../../reporting/audits/technical-preparation-output.js";
import { prepareSourceProduct } from "../../../../preparation/prepare-product.js";
import { printCommandError, errorDetail } from "../../../reporting/errors.js";
import { collectAuditProviderResults, auditProviderCoverage, markAuditProviderFailures } from "../../../../shared/audit-provider-results.js";
import { analyzeSpecificationCoverage } from "../../../../catalog/diagnostics/coverage/specification-coverage.js";
import { analyzeSpecificationOpportunities } from "../../../../catalog/diagnostics/coverage/specification-opportunities.js";
import { analyzeSpecificationImprovement, parseSpecificationImprovementExceptions } from "../../../../catalog/diagnostics/coverage/specification-improvement.js";
import { formatSpecificationImprovementReport } from "./specification-improvement-report.js";
import { formatSpecificationOpportunitiesReport } from "./specification-opportunities-report.js";
import { formatSpecificationCoverageReport } from "./specification-coverage-report.js";
import { assessCatalogAuditClosure } from "../../../../catalog/diagnostics/findings/audit-closure.js";
import { formatCatalogAuditClosureReport } from "./catalog-audit-closure-report.js";
import { analyzeDescriptionCoverage } from "../../../../catalog/diagnostics/coverage/description-coverage.js";
import { hasIndependentDescriptionSource } from "../../../../catalog/diagnostics/coverage/description-coverage.js";
import { analyzeDescriptionPriorities } from "../../../../catalog/diagnostics/coverage/description-priorities.js";
import { analyzeTechnicalDensity } from "../../../../catalog/diagnostics/technical/technical-density.js";
import { formatTechnicalDensityReport } from "./technical-density-report.js";
import { analyzeTitleQuality } from "../../../../catalog/diagnostics/editorial/title-quality.js";
import { formatTitleQualityReport } from "./title-quality-report.js";
import { analyzePublishedTechnicalQuality } from "../../../../catalog/diagnostics/technical/published-technical-quality.js";
import { formatPublishedTechnicalQualityReport } from "./published-technical-quality-report.js";

const root = fileURLToPath(new URL("../../../../../", import.meta.url));

const reportPublications = async (paths: readonly string[] | null, options: CommandOptions): Promise<void> => {
  const global = paths === null ? await loadGapPublications(root) : null;
  const selected = global?.publications ?? await Promise.all((paths ?? []).map(async (path) => ({ path, publication: await readAccreditedPublication(path) })));
  if (global) markAuditProviderFailures(global.failures);
  const publications = selected.map(({ publication }) => publication);
  const providers = new Set<string>();
  for (const publication of publications) {
    if (providers.has(publication.providerId)) throw new Error(`Proveedor duplicado en publicaciones: ${publication.providerId}`);
    providers.add(publication.providerId);
  }
  const population = global?.population ?? gapPopulation(publications.map((publication) => ({ providerId: publication.providerId,
    state: "evaluado", eligible: publication.products.length, evaluated: publication.products.length })), [...providers]);
  if (!publications.length) {
    process.exitCode = 1;
    if (options.json) console.log(JSON.stringify({ version: 1, population, status: "ERROR", error: "No hay publicaciones acreditadas evaluables" }));
    else printGapPopulation("PUBLICACIONES COMERCIALES", population);
    return;
  }
  const products = publications.flatMap((publication) => publication.products);
  const provenance = { source: "publicaciones_acreditadas", publications: publications.map((publication, index) => ({
    path: selected[index]?.path, providerId: publication.providerId, runId: publication.runId,
    productCount: publication.products.length, contentSha256: publication.sha256
  })) };
  const editorial = analyzePublishedEditorialQuality(products);
  const technicalDensity = analyzeTechnicalDensity(products);
  const technicalSemantics = analyzePublishedTechnicalQuality(products);
  if (options.json) {
    console.log(JSON.stringify({ version: 1, analyzedAt: new Date().toISOString(), provenance, population, checkCoverage: { editorial: gapCheckCoverage(population, products.length), technicalDensity: gapCheckCoverage(population, products.length), technicalSemantics: gapCheckCoverage(population, products.length) }, editorial, technicalDensity, technicalSemantics }));
  } else {
    printReportLine(`HUECOS | publicaciones acreditadas (${publications.map((item) => item.providerId).join(", ")}) | finales ${products.length} | diagnóstico editorial y semántico técnico`);
    printGapPopulation("PUBLICACIONES COMERCIALES", population);
    printEditorial(editorial, options.limit, options.detailed);
    for (const line of formatTechnicalDensityReport(technicalDensity, options.limit, options.detailed)) printReportLine(line);
    for (const line of formatPublishedTechnicalQualityReport(technicalSemantics, options.limit, options.detailed)) printReportLine(line);
  }
};

const reportTechnicalPublications = async (options: CommandOptions): Promise<void> => {
  const candidates = await collectAuditProviderResults(CAMPAIGN_PROVIDERS, async (providerId) => ({
    providerId, value: await readActiveTechnicalPublication(root, providerId)
  }), (providerId) => providerId);
  markAuditProviderFailures(candidates.failures);
  const publications = candidates.evaluated.filter((item) => item !== null);
  const population = gapPopulation([...publications.map(({ snapshot }): GapPopulationEntry => ({
    providerId: snapshot.providerId, state: snapshot.quality === "partial" ? "parcial" : "evaluado",
    eligible: snapshot.source.kind === "manain-record" ? snapshot.source.discoveredProductUrls : snapshot.products.length, evaluated: snapshot.products.length,
    ready: snapshot.totals.ready, review: snapshot.totals.review
  })), ...candidates.failures.map((failure) => gapPopulationFailure(failure.source, failure))]);
  if (!publications.length) {
    process.exitCode = 1;
    if (options.json) console.log(JSON.stringify({ version: 1, population, status: "ERROR", error: "No hay publicaciones técnicas vigentes; consulta publicacion:tecnica" }));
    else printGapPopulation("PUBLICACIONES TÉCNICAS", population);
    return;
  }
  const products = publications.flatMap((item) => item.snapshot.products.map((entry) => entry.product));
  const review = publications.flatMap(({ snapshot }) => snapshot.products.flatMap((entry, index) =>
    entry.status === "review" ? [{ providerId: snapshot.providerId, identity: snapshot.identities[index],
      issues: entry.issues }] : []));
  const provenance = { source: "publicaciones_tecnicas", publications: publications.map(({ sha256, snapshot }) => ({
    providerId: snapshot.providerId, sha256, quality: snapshot.quality, source: snapshot.source,
    totals: snapshot.totals
  })) };
  const editorial = analyzePublishedEditorialQuality(products);
  const technicalDensity = analyzeTechnicalDensity(products);
  const technicalSemantics = analyzePublishedTechnicalQuality(products);
  if (options.json) {
    console.log(JSON.stringify({ version: 1, analyzedAt: new Date().toISOString(), provenance,
      population, checkCoverage: { editorial: gapCheckCoverage(population, products.length), technicalDensity: gapCheckCoverage(population, products.length), technicalSemantics: gapCheckCoverage(population, products.length) }, review, editorial, technicalDensity, technicalSemantics }));
    return;
  }
  printReportLine(`HUECOS | publicaciones técnicas ${publications.length} proveedores · ${products.length} fichas · ${review.length} review · solo lectura`);
  printGapPopulation("PUBLICACIONES TÉCNICAS", population);
  for (const { snapshot, sha256 } of publications) {
    printReportLine(`  ${snapshot.providerId.toUpperCase()} | ${snapshot.quality} | ${snapshot.totals.ready} ready · ${snapshot.totals.review} review | ${sha256}`);
  }
  if (options.detailed) for (const item of review.slice(0, options.limit)) {
    printReportLine(`  REVIEW | ${item.identity} | ${item.issues.join(" | ")}`);
  }
  printEditorial(editorial, options.limit, options.detailed);
  for (const line of formatTechnicalDensityReport(technicalDensity, options.limit, options.detailed)) printReportLine(line);
  for (const line of formatPublishedTechnicalQualityReport(technicalSemantics, options.limit, options.detailed)) printReportLine(line);
};

const reportDescriptionComparison = async (options: CommandOptions): Promise<void> => {
  const discovered = await loadGapPublications(root);
  const inspected = await loadGapComparison(root, discovered.publications);
  const publications = inspected.evaluated.map((item) => item.publication);
  const inputs = inspected.evaluated.flatMap((item) => item.inputs);
  const sourceProvenance = inspected.evaluated.map((item) => item.provenance);
  const sourceCoverage = auditProviderCoverage({ evaluated: inspected.evaluated, failures: [...discovered.failures, ...inspected.failures],
    requested: discovered.publications.length + discovered.failures.length });
  markAuditProviderFailures([...discovered.failures, ...inspected.failures]);
  const { fingerprints } = await loadPreparationInputs();
  const provenance = { source: "comparacion_publicaciones_y_preparacion", publications: sourceProvenance,
    discoveredPublications: discovered.publications.map(({ path, publication }) => ({ path, providerId: publication.providerId,
      runId: publication.runId, publicationSha256: publication.sha256, publishedProducts: publication.products.length })),
    rulesSha256: fingerprints.rulesSha256, preparation: "Recalculada; Manain limitado al registro parcial verificado; Mercaeleva, si no dispone de original, reconstruida desde su publicación" };
  const matchedScope = gapPopulation(discovered.population.providers.flatMap((provider): GapPopulationEntry[] => {
    if (provider.state === "ausente" || provider.state === "no_seleccionado") return [];
    const failure = inspected.failures.find((item) => item.source === provider.providerId) ?? discovered.failures.find((item) => item.source === provider.providerId);
    if (failure) return [gapPopulationFailure(provider.providerId, failure, provider.eligible)];
    const item = inspected.evaluated.find((entry) => entry.publication.providerId === provider.providerId);
    if (!item) throw new Error(`Comparación sin resultado: ${provider.providerId}`);
    return [{ providerId: provider.providerId, state: item.provenance.origin === "registro_parcial_verificado" ? "parcial" :
      item.provenance.origin === "reconstruccion_publicada" ? "reconstruido" : "evaluado", eligible: provider.eligible, evaluated: item.inputs.length }];
  }));
  const currentPopulation = await loadGapCurrentPopulation(root, fingerprints);
  const currentCoverage = auditProviderCoverage(currentPopulation);
  markAuditProviderFailures(currentPopulation.failures.filter((failure) => failure.category === "ERROR"));
  const currentScope = gapPopulation([...currentPopulation.evaluated.map(({ provenance, entries }): GapPopulationEntry => ({
    providerId: provenance.source.providerId, state: provenance.source.record ? "parcial" : "evaluado",
    eligible: provenance.source.record?.discoveredProductUrls ?? provenance.source.productCount, evaluated: entries.length,
    ready: entries.filter(({ prepared }) => prepared.status === "ready").length, review: entries.filter(({ prepared }) => prepared.status === "review").length,
    ...(provenance.source.record ? { detail: "Registro parcial: URLs descartadas no evaluables" } : {})
  })), ...currentPopulation.failures.map((failure) => gapPopulationFailure(failure.source, failure))]);
  const currentEntries = currentPopulation.evaluated.flatMap((item) => item.entries);
  const reconciliation = reconcileGapCurrentEntries(currentEntries, inputs, discovered.publications.flatMap(({ publication }) => publication.products),
    discovered.failures.map((failure) => failure.source), new Map(currentPopulation.evaluated.map(({ provenance }) => [provenance.source.providerId, provenance.source.catalogSha256])),
    new Map(sourceProvenance.map((item) => [item.providerId, item.originalSha256])));
  const population = { published: discovered.population, matched: matchedScope, current: currentScope, reconciliation };
  const current = { coverage: currentCoverage, provenance: currentPopulation.evaluated.map((item) => item.provenance),
    report: currentEntries.length && !options.titles ? analyzePreparedSpecificationStage(currentEntries, options.specs) : null };
  const matchedCheck = gapCheckCoverage(matchedScope, inputs.length);
  const currentCheck = gapCheckCoverage(currentScope, currentEntries.length);
  if (!options.json) {
    printGapPopulation("PUBLICACIONES COMERCIALES", population.published);
    printGapPopulation("COMPARACIÓN CON ORIGEN ACREDITADO", matchedScope);
    printGapPopulation("PREPARACIÓN VIGENTE", currentScope);
    printReportLine(`CONCILIACIÓN VIGENTE | publicadas conciliadas ${reconciliation.totals.matched} | no conciliadas ${reconciliation.totals.unmatched} | sin publicación ${reconciliation.totals.withoutPublication} | no evaluables ${reconciliation.totals.notEvaluable} | diferencias batch/individual ${reconciliation.totals.batchDifferences}`);
  }
  const knowledgeFields = options.titles ? ["title"] as const : undefined;
  const editorialKnowledge = analyzeEditorialKnowledgeComparison(inputs, currentEntries, knowledgeFields);
  if (publications.length === 0) {
    const campaignOpportunities = analyzeContentGapCampaigns(currentEntries, editorialKnowledge.current, current.report);
    process.exitCode = 1;
    if (options.json) console.log(JSON.stringify({ version: 1, analyzedAt: new Date().toISOString(), provenance, population, auditCoverage: sourceCoverage,
      checkCoverage: { matched: matchedCheck, current: currentCheck, editorialKnowledge: { matched: matchedCheck, current: currentCheck } }, editorialKnowledge, campaignOpportunities, technicalPreparation: { matched: null, current } }));
    else {
      printReportLine(`HUECOS | comparación no evaluable · ${sourceCoverage.incompleteSource} fuentes ausentes · ${sourceCoverage.errors} errores`);
      printEditorialKnowledgeUsage(editorialKnowledge.current, "preparación vigente", options.limit, options.detailed);
      printContentGapCampaigns(campaignOpportunities, options.limit, options.detailed);
    }
    return;
  }
  if (options.titles) {
    const titles = analyzeTitleQuality(inputs);
    const campaignOpportunities = analyzeContentGapCampaigns(currentEntries, editorialKnowledge.current, null);
    if (options.json) {
      console.log(JSON.stringify({ version: 1, analyzedAt: new Date().toISOString(), provenance, population, auditCoverage: sourceCoverage, checkCoverage: { titles: matchedCheck, editorialKnowledge: { matched: matchedCheck, current: currentCheck } }, currentProvenance: current.provenance, titles, editorialKnowledge, campaignOpportunities }));
    } else {
      printReportLine(`HUECOS | auditoría de títulos técnicos | publicaciones ${titles.totals.products} | comparación frente a preparación, solo lectura`);
      for (const line of formatTitleQualityReport(titles, options.limit)) printReportLine(line);
      printEditorialKnowledgeUsage(editorialKnowledge.current, "preparación vigente", options.limit, options.detailed);
      printContentGapCampaigns(campaignOpportunities, options.limit, options.detailed);
    }
    return;
  }
  const coverage = analyzeDescriptionCoverage(inputs);
  const products = publications.flatMap((item) => item.products);
  const editorial = analyzePublishedEditorialQuality(products);
  const editorialPrepared = analyzeEditorialQuality(inputs);
  const reusable = inputs.filter((item) => hasIndependentDescriptionSource(item.origin));
  const editorialReuse = analyzeEditorialReuse(reusable);
  const technicalDensity = analyzeTechnicalDensity(products);
  const priorities = analyzeDescriptionPriorities(inputs, editorial, editorialPrepared);
  const technicalSpecs = options.specs ? analyzeSpecificationCoverage(inputs) : null;
  const technicalSemantics = options.specs ? analyzePublishedTechnicalQuality(products) : null;
  const specificationImprovements = options.specs ? analyzeSpecificationImprovement(inputs,
    parseSpecificationImprovementExceptions(JSON.parse(await readFile(resolve(root, "data/specification-improvement-exceptions.json"), "utf8"))), technicalDensity) : null;
  const technicalOpportunities = technicalSpecs && specificationImprovements ? analyzeSpecificationOpportunities(inputs, technicalDensity, technicalSpecs, specificationImprovements) : null;
  const matched = analyzePreparedSpecificationStage(inputs, options.specs);
  const technicalPreparation = {
    matched,
    current,
    ...(specificationImprovements && matched.specificationImprovements ? { comparison: compareSpecificationStages(
      inputs, specificationImprovements, matched.specificationImprovements) } : {})
  };
  const campaignOpportunities = analyzeContentGapCampaigns(currentEntries, editorialKnowledge.current, current.report, {
    reconciliation, matched: inputs, coverage: technicalSpecs, semantics: technicalSemantics, priorities, publishedDensity: technicalDensity, matchedDensity: matched.technicalDensity,
    ...(technicalOpportunities ? { publishedValue: technicalOpportunities.value.cases } : {}) });
  const checkCoverage = { descriptions: matchedCheck, editorial: matchedCheck, editorialPrepared: matchedCheck,
    editorialReuse: gapCheckCoverage(matchedScope, reusable.length, inputs.length - reusable.length, "reconstruccion_sin_original_independiente"),
    priorities: matchedCheck, technicalDensity: matchedCheck, editorialKnowledge: { matched: matchedCheck, current: currentCheck },
    technicalPreparation: { matched: matchedCheck, current: currentCheck,
      ...(options.specs ? { matchedValueOpportunities: matchedCheck, currentValueOpportunities: currentCheck, matchedOpportunities: gapCheckCoverage(matchedScope, matched.technicalDensity.target.below, inputs.length - matched.technicalDensity.target.below, "fuera_del_objetivo_minimo"),
        currentOpportunities: gapCheckCoverage(currentScope, current.report?.technicalDensity.target.below ?? 0, currentEntries.length - (current.report?.technicalDensity.target.below ?? 0), "fuera_del_objetivo_minimo") } : {}) },
    ...(technicalSpecs ? { technicalSpecs: matchedCheck, technicalSemantics: matchedCheck, specificationImprovements: matchedCheck,
      technicalValueOpportunities: matchedCheck, technicalOpportunities: gapCheckCoverage(matchedScope, technicalDensity.target.below, inputs.length - technicalDensity.target.below, "fuera_del_objetivo_minimo") } : {}) };
  if (options.json) {
    console.log(JSON.stringify({ version: 1, analyzedAt: new Date().toISOString(), provenance, population, auditCoverage: sourceCoverage, checkCoverage, coverage, editorial, editorialPrepared, editorialReuse, editorialKnowledge, priorities, technicalDensity, technicalPreparation, campaignOpportunities, ...(technicalSpecs ? { technicalSpecs, technicalSemantics, technicalOpportunities, specificationImprovements, auditClosure: assessCatalogAuditClosure(coverage, priorities, technicalSpecs, matchedScope.complete && currentScope.complete) } : {}) }));
  } else {
    printReportLine(`HUECOS | publicaciones finales ${coverage.totals.products} · comparación con preparación actual · solo lectura`);
    printCommandSection("DESCRIPCIONES · P0");
    printDescriptionCoverage(coverage, options.detailed);
    printDescriptionPriorities(priorities, options.limit, options.detailed);
    printDocumentaryNarrative(editorial, "publicaciones finales", options.limit, options.detailed);
    if (!options.detailed) printDocumentaryNarrative(editorialPrepared, "preparación actual", options.limit, false);
    if (options.detailed) printReportLine("CALIDAD EDITORIAL | vista derivada tras preparación; señales orientativas independientes de P0");
    if (options.detailed) printEditorial(editorialPrepared, options.limit, true);
    printEditorialReuse(editorialReuse, options.limit, options.detailed);
    printEditorialKnowledgeUsage(editorialKnowledge.current, "preparación vigente", options.limit, options.detailed);
    for (const line of formatTechnicalDensityReport(technicalDensity, options.limit, options.detailed)) printReportLine(line);
    printTechnicalPreparation(technicalPreparation);
    printContentGapCampaigns(campaignOpportunities, options.limit, options.detailed);
    if (technicalSpecs) {
      printCommandSection("ESPECIFICACIONES Y CIERRE AUDITOR");
      for (const line of formatSpecificationCoverageReport(technicalSpecs, options.limit, options.detailed)) printReportLine(line);
      if (technicalOpportunities) for (const line of formatSpecificationOpportunitiesReport(technicalOpportunities, options.limit, options.detailed)) printReportLine(line);
      if (technicalSemantics) for (const line of formatPublishedTechnicalQualityReport(technicalSemantics, options.limit, options.detailed)) printReportLine(line);
      for (const line of formatCatalogAuditClosureReport(coverage, priorities, technicalSpecs, matchedScope.complete && currentScope.complete)) printReportLine(line);
      if (specificationImprovements) for (const line of formatSpecificationImprovementReport(specificationImprovements, options.limit, options.detailed)) printReportLine(line);
    }
  }
};

export const runCatalogContentGaps = async (args: readonly string[]): Promise<void> => {
  if (args.length === 1 && args[0] === "--help") {
    printReportLine("Uso: npm run huecos -- [--comparar | --finales | --tecnicas | --catalogo ruta/-catalog.json ... | --publicacion ruta/-publishable.json ...] [--agrupar categoria|marca|modelo] [--min-grupo N] [--min-ausentes N] [--top N] [--detalle] [--json] [--specs] [--titulos]\nSin fuente explícita: campaña entregada o referencia histórica; si faltan, comparación de publicaciones acreditadas frente a preparación actual. --comparar fuerza esa comparación. --finales analiza solo las publicaciones acreditadas. --catalogo analiza originales canónicos; --publicacion analiza exclusivamente textos finales acreditados. --finales incluye la auditoría semántica de valores técnicos publicados; --comparar separa publicación, preparación conciliada y preparación completa de fuentes vigentes. --comparar --specs contrasta claves, valores y oportunidades de cada etapa; las ausencias familiares no son atributos obligatorios. --comparar --titulos analiza señales de títulos técnicos, sin modificar fichas. --json entrega el diagnóstico íntegro en formato compacto; --top y --detalle solo controlan la presentación.");
    return;
  }
  const options = readContentGapOptions(args);
  if (!options.json) printCommandHeader("HUECOS · AUDITORÍA TÉCNICA");
  if (options.technicalPublications) {
    await reportTechnicalPublications(options);
    return;
  }
  if (options.compareSources) {
    await reportDescriptionComparison(options);
    return;
  }
  if (options.publications.length > 0 || options.finalPublications) {
    await reportPublications(options.finalPublications ? null : options.publications, options);
    return;
  }
  const baseline = options.catalogs.length === 0 ? await findCampaignBaseline(root) : null;
  if (options.catalogs.length === 0 && !baseline) {
      await reportDescriptionComparison(options);
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
  const selectedProviders = analysis.universe.providers.map((item) => item.providerId);
  const population = gapPopulation(analysis.universe.providers.map((item) => ({ providerId: item.providerId,
    state: "evaluado", eligible: item.originals, evaluated: item.originals })), selectedProviders);
  const ranked = prioritizeCatalogGaps(analysis, options.minGroup, options.minMissing);
  const editorial = analyzeEditorialQuality(inputs);
  const editorialReuse = analyzeEditorialReuse(inputs);
  const editorialKnowledge = analyzeEditorialKnowledgeUsage(inputs);
  const technicalDensity = analyzeTechnicalDensity(inputs.map((item) => item.prepared.product));
  if (options.json) {
    console.log(JSON.stringify({ version: 1, analyzedAt: new Date().toISOString(), provenance,
      population, checkCoverage: { sourceGaps: gapCheckCoverage(population, inputs.length), editorial: gapCheckCoverage(population, inputs.length), editorialReuse: gapCheckCoverage(population, inputs.length), editorialKnowledge: gapCheckCoverage(population, inputs.length), technicalDensity: gapCheckCoverage(population, inputs.length) },
      ...analysis, editorial, editorialReuse, editorialKnowledge, technicalDensity, prioritized: ranked.map(({ group, observation, tier }) => ({
        providerId: group.providerId, categorySellID: group.categorySellID, sourceCategoryKey: group.sourceCategoryKey,
        brand: group.brand, model: group.model, field: observation.field, missing: observation.missing, tier
      })) }));
    return;
  }
  printReportLine(`HUECOS | ${sourceLabel} | originales ${analysis.universe.total} | ready ${analysis.universe.ready} | review ${analysis.universe.review} | sin categoría ${analysis.universe.withoutCategory}`);
  printGapPopulation("ORÍGENES SELECCIONADOS", population);
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
  printEditorialReuse(editorialReuse, options.limit, options.detailed);
  printEditorialKnowledgeUsage(editorialKnowledge, "orígenes seleccionados", options.limit, options.detailed);
  for (const line of formatTechnicalDensityReport(technicalDensity, options.limit, options.detailed)) printReportLine(line);
};

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  runCatalogContentGaps(process.argv.slice(2)).catch((error: unknown) => {
    if (process.argv.includes("--json")) console.log(JSON.stringify({ error: errorDetail(error), status: "ERROR" }));
    printCommandError("huecos", error);
    process.exitCode = 1;
  });
}
