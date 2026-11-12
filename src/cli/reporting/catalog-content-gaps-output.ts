import { printReportLine } from "./terminal.js";
import type { EditorialAnalysis } from "../../catalog/diagnostics/editorial-quality.js";
import type { ReuseReport } from "../../catalog/diagnostics/editorial-reuse.js";
import { analyzeDescriptionCoverage } from "../../catalog/diagnostics/description-coverage.js";
import type { DescriptionPriorities } from "../../catalog/diagnostics/description-priorities.js";

export const printEditorial = (editorial: EditorialAnalysis, limit: number, detailed = false): void => {
  printReportLine("CALIDAD EDITORIAL | umbrales orientativos, sin intervenir fichas");
  if (detailed) printReportLine(`CRITERIOS (palabras) | título >= ${editorial.criteria.minTitleWords} | corta ${editorial.criteria.minShortWords}-${editorial.criteria.maxShortWords} | general ${editorial.criteria.minLongWords}-${editorial.criteria.maxLongWords}`);
  if (detailed) for (const provider of editorial.providers) {
    const short = provider.lengths.description;
    const long = provider.lengths.description_general;
    printReportLine(`${provider.providerId} | corta: ${short.present}/${provider.total}, mediana ${short.words.median ?? "-"} palabras, P90 ${short.words.p90 ?? "-"} | general: ${long.present}/${provider.total}, mediana ${long.words.median ?? "-"} palabras, P90 ${long.words.p90 ?? "-"}`);
  }
  printReportLine(`SEÑALES EDITORIALES | ${editorial.patterns.length} patrones · ${editorial.cases.length} fichas observadas; orientativas, no defectos confirmados`);
  if (detailed) for (const pattern of editorial.patterns.slice(0, limit)) {
    printReportLine(`${pattern.providerId} | ${pattern.category} | ${pattern.code} | ${pattern.affected}/${pattern.total} | ejemplos ${pattern.examples.join(", ")}`);
  }
  if (detailed) printReportLine(`DESCRIPCIONES GENERALES MÁS LARGAS | TOP ${Math.min(limit, editorial.longestGeneral.length)} | palabras y caracteres`);
  if (detailed) for (const item of editorial.longestGeneral.slice(0, limit)) {
    printReportLine(`${item.identity} | ${item.words} palabras | ${item.characters} caracteres | ${item.title} | ${item.url}`);
    printReportLine(`  Extracto: ${item.preview}`);
  }
  if (detailed) printReportLine("Consulta sin escrituras. Casos, métricas, evidencias y ranking también disponibles en --json.");
};

export const printDescriptionCoverage = (coverage: ReturnType<typeof analyzeDescriptionCoverage>, detailed = false): void => {
  const { totals } = coverage;
  const sum = (counts: Readonly<Record<"description" | "description_general", number>>): number =>
    counts.description + counts.description_general;
  printReportLine(`P0 DESCRIPCIONES | publicadas ${totals.products} | emparejadas ${totals.products} | vacíos publicados ${sum(totals.publishedMissing)} (cortas ${totals.publishedMissing.description}, generales ${totals.publishedMissing.description_general})`);
  printReportLine(`P0 RESULTADO DE PREPARACIÓN | recuperados ${sum(totals.recovered)} (cortas ${totals.recovered.description}, generales ${totals.recovered.description_general}) | pendientes ${sum(totals.pending)} (cortas ${totals.pending.description}, generales ${totals.pending.description_general}) | campos perdidos ${sum(totals.lost)} | fichas incompletas ${totals.incompleteProducts} | ambas vacías ${totals.bothPending}`);
  if (detailed) for (const item of coverage.providers) {
    printReportLine(`P0 PROVEEDOR | ${item.providerId} | publicadas ${item.products} | origen ${item.origin} | vacíos ${sum(item.publishedMissing)} | recuperados ${sum(item.recovered)} | pendientes ${sum(item.pending)} | perdidos ${sum(item.lost)}`);
  }
  if (detailed) printReportLine(`P0 FAMILIAS | ${coverage.families.length} grupos con ausencias, ordenados por campos pendientes y proporción | clasificación provisional cuando se indica`);
  if (detailed) for (const family of coverage.families) {
    printReportLine(`  ${family.providerId} | ${family.family} | ${family.missingFields} campos | ${family.incomplete}/${family.total} fichas | ${family.familyMethod}`);
  }
  printReportLine(`P0 COLA RESIDUAL | ${coverage.pendingCases.length} fichas, sin recorte por --top`);
  if (detailed) for (const item of coverage.pendingCases) {
    printReportLine(`  ${item.providerId} | ${item.reference ?? item.identity} | ${item.family} | faltan ${item.missing.join(", ")} | ${item.evidence} | ${item.origin}`);
    printReportLine(`    ${item.title ?? "Sin título"} | ${item.url}`);
    if (item.issues.some((issue) => /contradic|conflict|incompatible/i.test(issue))) {
      printReportLine(`    Incidencias: ${item.issues.filter((issue) => /contradic|conflict|incompatible/i.test(issue)).join("; ")}`);
    }
  }
  if (detailed) for (const item of coverage.lostCases) printReportLine(`  REGRESIÓN | ${item.identity} | ${item.lost.join(", ")} | ${item.url}`);
  else if (coverage.lostCases.length) printReportLine(`P0 ALERTA | ${coverage.lostCases.length} fichas con pérdidas de descripción; consultar --detalle o --json`);
};

export const printDescriptionPriorities = (report: DescriptionPriorities, limit: number, detailed = false): void => {
  printReportLine(`PRIORIDADES EDITORIALES | pendientes ${report.totals.pending} | resueltos por preparación ${report.totals.resolved} | aparecidos ${report.totals.appeared} | incidencias técnicas ${report.totals.technical}`);
  printReportLine(`ORDEN DE TRABAJO | P0 vacíos ${report.totals.pendingByStage.P0} | P1 insuficiencia/extremos ${report.totals.pendingByStage.P1} | P2 diferencias familiares ${report.totals.pendingByStage.P2}`);
  if (!detailed) {
    printReportLine(`INCIDENCIAS TÉCNICAS | ${report.technical.length} fichas con problemas de preparación; usar --detalle o --json`);
    return;
  }
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


export const printEditorialReuse = (report: ReuseReport, limit: number, detailed = false): void => {
  const counts = report.totals;
  printReportLine(`REUTILIZACIÓN EDITORIAL | originales ${report.analyzed} | campos aplicados ${counts.aplicada} | candidatas desplazadas por precedencia ${counts.precedencia_de_texto_existente} | textos existentes sin candidata ${counts.texto_existente_sin_candidata} | candidatas sin aplicar ${counts.capacidad_disponible_sin_aplicar}`);
  if (!detailed) return;
  printReportLine(`CAUSAS DE VACÍO | origen no validado ${counts.origen_no_validado} | familia/evidencia incompatible ${counts.familia_o_evidencia_no_compatible} | preparación en revisión ${counts.preparacion_en_revision} | sin composición ${counts.sin_composicion_de_familia}`);
  for (const item of report.cases.filter((entry) => entry.cause === "capacidad_disponible_sin_aplicar").slice(0, limit)) {
    printReportLine(`  REVISAR FALLBACK | ${item.providerId} | ${item.reference ?? item.identity} | ${item.field} | ${item.family ?? "sin familia"} | ${item.url}`);
  }
  printReportLine(report.note);
};
