import { printReportLine } from "../../reporting/terminal.js";
import { createHash } from "node:crypto";
import { readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { analyzeSourceContentGaps, prioritizeCatalogGaps } from "../../../catalog/diagnostics/content-gaps-source.js";
import { analyzeEditorialQuality, analyzePublishedEditorialQuality } from "../../../catalog/diagnostics/editorial-quality.js";
import type { EditorialAnalysis } from "../../../catalog/diagnostics/editorial-quality.js";
import { discoverAccreditedPublications, readAccreditedPublication } from "../../../infrastructure/filesystem/catalog/accredited-publication.js";
import type { GapGroupBy, GapInput } from "../../../catalog/diagnostics/content-gaps-types.js";
import { findCampaignBaseline } from "../../../pipeline/campaign/reference/compare.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { loadPreparationInputs } from "../../../infrastructure/filesystem/preparation/preparation-inputs.js";
import { prepareSourceProduct } from "../../../catalog/preparation/prepare-product.js";
import { printCommandError } from "../../reporting/errors.js";
import { buildProductIdentity } from "../../../catalog/identity.js";
import { analyzeSpecificationCoverage } from "../../../catalog/diagnostics/specification-coverage.js";
import { analyzeDescriptionCoverage } from "../../../catalog/diagnostics/description-coverage.js";
import type { DescriptionCoverageInput } from "../../../catalog/diagnostics/description-coverage.js";
import { reconstructMercaelevaSource } from "../../../catalog/diagnostics/description-source.js";
import { analyzeDescriptionPriorities } from "../../../catalog/diagnostics/description-priorities.js";
import type { DescriptionPriorities } from "../../../catalog/diagnostics/description-priorities.js";
import type { ProductRecord } from "../../../contracts/catalog.js";

const root = fileURLToPath(new URL("../../../../", import.meta.url));

type CommandOptions = { readonly json: boolean; readonly specs: boolean; readonly finales: boolean; readonly comparar: boolean; readonly groupBy: GapGroupBy; readonly minGroup: number;
  readonly minMissing: number; readonly limit: number; readonly catalogs: readonly string[];
  readonly publications: readonly string[] };

const parsePositive = (value: string | undefined, flag: string): number => {
  if (!value || !/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value))) {
    throw new Error(`${flag} requiere un entero positivo`);
  }
  return Number(value);
};

const readOptions = (args: readonly string[]): CommandOptions => {
  let json = false;
  let specs = false;
  let finales = false;
  let comparar = false;
  let groupBy: GapGroupBy = "categoria";
  let minGroup = 8;
  let minMissing = 3;
  let limit = 20;
  const catalogs: string[] = [];
  const publications: string[] = [];
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === "--json") json = true;
    else if (arg === "--specs") specs = true;
    else if (arg === "--finales") finales = true;
    else if (arg === "--comparar") comparar = true;
    else if (arg === "--catalogo") {
      const value = args[++index];
      if (!value?.trim() || value.startsWith("--")) throw new Error("--catalogo requiere la ruta de un -catalog.json");
      catalogs.push(resolve(value));
    } else if (arg === "--publicacion") {
      const value = args[++index];
      if (!value?.trim() || value.startsWith("--")) throw new Error("--publicacion requiere un fichero -publishable.json");
      publications.push(resolve(value));
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
  if (catalogs.length > 0 && publications.length > 0) {
    throw new Error("--catalogo y --publicacion son modos alternativos; no mezclarlos");
  }
  if (finales && (catalogs.length > 0 || publications.length > 0)) {
    throw new Error("--finales no se combina con --catalogo ni --publicacion");
  }
  if (comparar && (finales || catalogs.length > 0 || publications.length > 0)) {
    throw new Error("--comparar no se combina con --finales, --catalogo ni --publicacion");
  }
  if (specs && !comparar) throw new Error("--specs requiere --comparar; las publicaciones solas no acreditan especificaciones de origen");
  return { json, specs, finales, comparar, groupBy, minGroup, minMissing, limit, catalogs, publications };
};

const printEditorial = (editorial: EditorialAnalysis, limit: number): void => {
  printReportLine("CALIDAD EDITORIAL | umbrales orientativos, sin intervenir fichas");
  printReportLine(`CRITERIOS (palabras) | título >= ${editorial.criteria.minTitleWords} | corta ${editorial.criteria.minShortWords}-${editorial.criteria.maxShortWords} | general ${editorial.criteria.minLongWords}-${editorial.criteria.maxLongWords}`);
  for (const provider of editorial.providers) {
    const short = provider.lengths.description;
    const long = provider.lengths.description_general;
    printReportLine(`${provider.providerId} | corta: ${short.present}/${provider.total}, mediana ${short.words.median ?? "-"} palabras, P90 ${short.words.p90 ?? "-"} | general: ${long.present}/${provider.total}, mediana ${long.words.median ?? "-"} palabras, P90 ${long.words.p90 ?? "-"}`);
  }
  printReportLine(`SEÑALES EDITORIALES | ${editorial.patterns.length} patrones | ${editorial.cases.length} fichas con observaciones | TOP ${Math.min(limit, editorial.patterns.length)}`);
  for (const pattern of editorial.patterns.slice(0, limit)) {
    printReportLine(`${pattern.providerId} | ${pattern.category} | ${pattern.code} | ${pattern.affected}/${pattern.total} | ejemplos ${pattern.examples.join(", ")}`);
  }
  printReportLine(`DESCRIPCIONES GENERALES MÁS LARGAS | TOP ${Math.min(limit, editorial.longestGeneral.length)} | palabras y caracteres`);
  for (const item of editorial.longestGeneral.slice(0, limit)) {
    printReportLine(`${item.identity} | ${item.words} palabras | ${item.characters} caracteres | ${item.title} | ${item.url}`);
    printReportLine(`  Extracto: ${item.preview}`);
  }
  printReportLine("Consulta sin escrituras. Los casos, métricas, evidencias y ranking de hasta 50 descripciones se incluyen en --json.");
};

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
  if (options.json) {
    console.log(JSON.stringify({ version: 1, analyzedAt: new Date().toISOString(), provenance, editorial }, null, 2));
  } else {
    printReportLine(`HUECOS | publicaciones acreditadas (${publications.map((item) => item.providerId).join(", ")}) | finales ${products.length} | diagnóstico exclusivamente editorial`);
    printEditorial(editorial, options.limit);
  }
};

const originalSources = async (providerId: string): Promise<Map<string, ProductRecord> | null> => {
  const directory = join(root, "catalogs", "providers", providerId, "original");
  let filenames: string[];
  try {
    filenames = (await readdir(directory)).filter((name) => name.endsWith("-catalog.json"));
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return null;
    throw error;
  }
  if (filenames.length === 0) return null;
  if (filenames.length !== 1) throw new Error(`Original canónico ambiguo para ${providerId}`);
  const original = await readCanonicalCatalog(join(directory, filenames[0]!));
  if (original.providerId !== providerId) throw new Error(`Proveedor incorrecto en original ${providerId}`);
  const sources = new Map<string, ProductRecord>();
  for (const source of original.products) {
    const key = buildProductIdentity(source).key;
    if (sources.has(key)) throw new Error(`Identidad duplicada en original ${key}`);
    sources.set(key, source);
  }
  return sources;
};

const printDescriptionCoverage = (coverage: ReturnType<typeof analyzeDescriptionCoverage>): void => {
  const { totals } = coverage;
  const sum = (counts: Readonly<Record<"description" | "description_general", number>>): number =>
    counts.description + counts.description_general;
  printReportLine(`P0 DESCRIPCIONES | publicadas ${totals.products} | emparejadas ${totals.products} | vacíos publicados ${sum(totals.publishedMissing)} (cortas ${totals.publishedMissing.description}, generales ${totals.publishedMissing.description_general})`);
  printReportLine(`P0 RESULTADO DE PREPARACIÓN | recuperados ${sum(totals.recovered)} (cortas ${totals.recovered.description}, generales ${totals.recovered.description_general}) | pendientes ${sum(totals.pending)} (cortas ${totals.pending.description}, generales ${totals.pending.description_general}) | campos perdidos ${sum(totals.lost)} | fichas incompletas ${totals.incompleteProducts} | ambas vacías ${totals.bothPending}`);
  for (const item of coverage.providers) {
    printReportLine(`P0 PROVEEDOR | ${item.providerId} | publicadas ${item.products} | origen ${item.origin} | vacíos ${sum(item.publishedMissing)} | recuperados ${sum(item.recovered)} | pendientes ${sum(item.pending)} | perdidos ${sum(item.lost)}`);
  }
  printReportLine(`P0 FAMILIAS | ${coverage.families.length} grupos con ausencias, ordenados por campos pendientes y proporción | clasificación provisional cuando se indica`);
  for (const family of coverage.families) {
    printReportLine(`  ${family.providerId} | ${family.family} | ${family.missingFields} campos | ${family.incomplete}/${family.total} fichas | ${family.familyMethod}`);
  }
  printReportLine(`P0 COLA RESIDUAL | ${coverage.pendingCases.length} fichas, sin recorte por --top`);
  for (const item of coverage.pendingCases) {
    printReportLine(`  ${item.providerId} | ${item.reference ?? item.identity} | ${item.family} | faltan ${item.missing.join(", ")} | ${item.evidence} | ${item.origin}`);
    printReportLine(`    ${item.title ?? "Sin título"} | ${item.url}`);
    if (item.issues.some((issue) => /contradic|conflict|incompatible/i.test(issue))) {
      printReportLine(`    Incidencias: ${item.issues.filter((issue) => /contradic|conflict|incompatible/i.test(issue)).join("; ")}`);
    }
  }
  for (const item of coverage.lostCases) printReportLine(`  REGRESIÓN | ${item.identity} | ${item.lost.join(", ")} | ${item.url}`);
};

const printDescriptionPriorities = (report: DescriptionPriorities, limit: number): void => {
  printReportLine(`PRIORIDADES EDITORIALES | pendientes ${report.totals.pending} | resueltos por preparación ${report.totals.resolved} | aparecidos ${report.totals.appeared} | incidencias técnicas ${report.totals.technical}`);
  printReportLine(`ORDEN DE TRABAJO | P0 vacíos ${report.totals.pendingByStage.P0} | P1 insuficiencia/extremos ${report.totals.pendingByStage.P1} | P2 diferencias familiares ${report.totals.pendingByStage.P2}`);
  const visible = report.pending.filter((item) => item.stage !== "P0").slice(0, limit);
  printReportLine(`COLA EDITORIAL | P0 íntegro en la sección de cobertura | P1/P2 TOP ${visible.length} de ${report.pending.filter((item) => item.stage !== "P0").length} | sin mezclar incidencias técnicas`);
  for (const item of visible) {
    printReportLine(`  ${item.stage} | ${item.providerId} | ${item.reference ?? item.identity} | ${item.family} | ${item.signal} | publicada ${item.publishedWords} palabras → preparada ${item.preparedWords} | mediana familiar ${item.familyMedianWords ?? "-"} (${item.familySamples} muestras) | ${item.state}`);
    printReportLine(`    ${item.url} | ${item.evidence}`);
  }
  printReportLine(`RESUELTOS POR PREPARACIÓN | ${report.resolved.length} señales, incluidos vacíos | ejemplos TOP ${Math.min(limit, report.resolved.length)}`);
  for (const item of report.resolved.slice(0, limit)) {
    printReportLine(`  ${item.providerId} | ${item.reference ?? item.identity} | ${item.signal} | ${item.publishedWords} → ${item.preparedWords} palabras`);
  }
  printReportLine(`INCIDENCIAS TÉCNICAS | ${report.technical.length} fichas detectadas por preparación; no confundir con avisos de longitud`);
  for (const item of report.technical) {
    printReportLine(`  ${item.providerId} | ${item.reference ?? item.identity} | ${item.family} | ${item.issues.join("; ")} | ${item.url}`);
  }
  printReportLine("El JSON incluye la cola editorial completa, referencias, evidencias, muestras familiares y casos resueltos.");
};

const reportDescriptionComparison = async (paths: readonly string[], options: CommandOptions): Promise<void> => {
  const publications = await Promise.all(paths.map(readAccreditedPublication));
  const providers = new Set<string>();
  const inputs: DescriptionCoverageInput[] = [];
  const sourceProvenance: { providerId: string; origin: "original_canonico" | "reconstruccion_publicada"; originalProducts: number | null; publishedProducts: number; publicationSha256: string }[] = [];
  for (const publication of publications) {
    if (providers.has(publication.providerId)) throw new Error(`Proveedor duplicado en publicaciones: ${publication.providerId}`);
    providers.add(publication.providerId);
    const sources = await originalSources(publication.providerId);
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
  const coverage = analyzeDescriptionCoverage(inputs);
  const products = publications.flatMap((item) => item.products);
  const editorial = analyzePublishedEditorialQuality(products);
  const editorialPrepared = analyzeEditorialQuality(inputs);
  const priorities = analyzeDescriptionPriorities(inputs, editorial, editorialPrepared);
  const technicalSpecs = options.specs ? analyzeSpecificationCoverage(inputs) : null;
  const { fingerprints } = await loadPreparationInputs();
  const provenance = { source: "comparacion_publicaciones_y_preparacion", publications: sourceProvenance,
    rulesSha256: fingerprints.rulesSha256, preparation: "Recalculada; Mercaeleva reconstruida únicamente desde campos de su publicación, no desde un original canónico" };
  if (options.json) {
    console.log(JSON.stringify({ version: 1, analyzedAt: new Date().toISOString(), provenance, coverage, editorial, editorialPrepared, priorities, ...(technicalSpecs ? { technicalSpecs } : {}) }, null, 2));
  } else {
    printReportLine(`HUECOS | publicaciones finales ${coverage.totals.products} | comparación frente a preparación actual; sin modificar publicaciones`);
    printDescriptionCoverage(coverage);
    printDescriptionPriorities(priorities, options.limit);
    printReportLine("CALIDAD EDITORIAL | vista derivada tras preparación; señales orientativas independientes de P0");
    printEditorial(editorialPrepared, options.limit);
    if (technicalSpecs) {
      const totals = technicalSpecs.totals;
      printReportLine(`SPECS | originales canónicos ${totals.canonicalOriginals} | fuentes reconstruidas ${totals.reconstructedSources} | pendientes de publicar ${totals.pendingPublication} | diferencias origen/preparación ${totals.sourceNotPreserved} | pérdidas respecto al final ${totals.lostAfterPublication} | normalizaciones ambiguas ${totals.ambiguousNormalization} | ausencias observacionales ${totals.observationalMissing}`);
      printReportLine(technicalSpecs.note);
      for (const item of technicalSpecs.cases.slice(0, options.limit)) {
        printReportLine(`  ${item.stage} | ${item.providerId} | ${item.family} | ${item.reference ?? item.identity} | ${item.key} | ${item.origin}`);
      }
      printReportLine(`SPECS | ${technicalSpecs.cases.length} observaciones | ${technicalSpecs.patterns.length} patrones familiares | TOP ${Math.min(options.limit, technicalSpecs.cases.length)}`);
    }
  }
};

export const runCatalogContentGaps = async (args: readonly string[]): Promise<void> => {
  if (args.length === 1 && args[0] === "--help") {
    printReportLine("Uso: npm run huecos -- [--comparar | --finales | --catalogo ruta/-catalog.json ... | --publicacion ruta/-publishable.json ...] [--agrupar categoria|marca|modelo] [--min-grupo N] [--min-ausentes N] [--top N] [--json] [--specs]\nSin fuente explícita: campaña entregada o referencia histórica; si faltan, comparación de publicaciones acreditadas frente a preparación actual. --comparar fuerza esa comparación. --finales analiza solo las publicaciones acreditadas. --catalogo analiza originales canónicos; --publicacion analiza exclusivamente textos finales acreditados. --comparar --specs compara las claves técnicas del origen canónico, preparación y publicación; las ausencias familiares no son atributos obligatorios.");
    return;
  }
  const options = readOptions(args);
  if (options.comparar) {
    const paths = await discoverAccreditedPublications(root);
    if (paths.length === 0) throw new Error("No hay publicaciones acreditadas en catalogs/providers/*/publications");
    await reportDescriptionComparison(paths, options);
    return;
  }
  if (options.publications.length > 0 || options.finales) {
    const paths = options.finales ? await discoverAccreditedPublications(root) : options.publications;
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
  printEditorial(editorial, options.limit);
};

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  runCatalogContentGaps(process.argv.slice(2)).catch((error: unknown) => {
    printCommandError("huecos", error);
    process.exitCode = 1;
  });
}
