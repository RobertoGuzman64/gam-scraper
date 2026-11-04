import { printReportLine } from "./terminal.js";
import type { EditorialAnalysis } from "../../catalog/diagnostics/editorial-quality.js";
import { analyzeDescriptionCoverage } from "../../catalog/diagnostics/description-coverage.js";
import type { DescriptionPriorities } from "../../catalog/diagnostics/description-priorities.js";

export const printEditorial = (editorial: EditorialAnalysis, limit: number): void => {
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

export const printDescriptionCoverage = (coverage: ReturnType<typeof analyzeDescriptionCoverage>): void => {
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

export const printDescriptionPriorities = (report: DescriptionPriorities, limit: number): void => {
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

