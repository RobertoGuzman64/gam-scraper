import type { buildNormalizationAudit } from "../../../infrastructure/filesystem/preparation/normalization-audit.js";
import { printReportLine } from "../terminal.js";

type Report = Awaited<ReturnType<typeof buildNormalizationAudit>>;
type Options = { readonly limit: number; readonly detailed: boolean };

export const formatNormalizationAudit = (report: Report, options: Options): readonly string[] => {
  const { population } = report.provenance;
  const lines = [`NORMALIZACIÓN TÉCNICA | ${report.complete ? "COBERTURA COMPLETA" : "COBERTURA PARCIAL"} | ${population.processed.length}/${population.expected.length} proveedores`,
    `POBLACIÓN | esperados ${population.expected.join(", ")} | seleccionados ${population.selected.join(", ")} | procesados ${population.processed.join(", ") || "ninguno"}`,
    `FUENTES | no disponibles ${population.unavailable.join(", ") || "ninguna"} | incompletas ${population.incomplete.join(", ") || "ninguna"}`,
    `PREPARACIÓN | ${report.provenance.preparation} | reglas ${report.provenance.fingerprints.rulesSha256}`];
  for (const provider of report.providers) {
    const potential = report.potentialByProvider.find((item) => item.providerId === provider.providerId);
    lines.push(`${provider.providerId} | originales ${provider.originalProducts} | preparados ${provider.preparedProducts} | publicados ${provider.publishedProducts} | sin publicar ${provider.withoutPublication.length} (${provider.readyWithoutPublication} ready, ${provider.reviewWithoutPublication} review) | candidatas ${potential?.uniqueProducts ?? 0}`);
    const source = report.provenance.sources.find((item) => item.providerId === provider.providerId);
    if (source && options.detailed) lines.push(`  Origen ${source.source.catalogSha256} | ${source.source.record ? "registro parcial" : "canónico"} | publicación ${source.publication.sha256} | ${source.publication.path}`);
  }
  lines.push(`PATRONES | ${report.groups.length} grupos | ${report.groups.reduce((count, group) => count + group.patterns.length, 0)} patrones | ${report.impact.uniqueProducts} fichas con señales`,
    `IMPACTO POTENCIAL | ${report.potential.uniqueProducts} fichas únicas | ${report.potential.occurrences} ocurrencias por etapa | ${report.potential.patternMemberships} pertenencias a patrones`,
    "Las señales no son defectos confirmados; los subtotales pueden solaparse.");
  for (const [assessment, impact] of Object.entries(report.potentialByAssessment)) {
    lines.push(`  ${assessment} | ${impact.uniqueProducts} fichas | ${impact.occurrences} ocurrencias`);
  }
  for (const stage of ["original", "preparacion", "publicacion"] as const) {
    const impact = report.byStage[stage];
    lines.push(`  ${stage} | ${impact.uniqueProducts} fichas con señales | ${impact.occurrences} ocurrencias | ${report.potentialByStage[stage].uniqueProducts} candidatas`);
  }
  lines.push(`CONTRASTES | ${report.contrasts.length} observaciones`);
  for (const contrast of report.contrastSummary) lines.push(`  ${contrast.from} → ${contrast.to} | ${contrast.kind} | ${contrast.assessment} | ${contrast.uniqueProducts} fichas | ${contrast.occurrences} ocurrencias`);
  const groups = [...report.groups].sort((a, b) => b.potential.uniqueProducts - a.potential.uniqueProducts ||
    b.potential.occurrences - a.potential.occurrences || b.impact.uniqueProducts - a.impact.uniqueProducts);
  lines.push(`GRUPOS | ${Math.min(groups.length, options.limit)}/${groups.length} por impacto potencial; --json devuelve todos`);
  for (const group of groups.slice(0, options.limit)) {
    const scope = group.scope.family ?? `${group.scope.providerId}/${group.scope.sourceCategoryKey}`;
    lines.push(`${group.kind} | ${scope} | ${group.key} | ${group.potential.uniqueProducts} candidatas | ${group.potential.occurrences} ocurrencias | ${group.impact.uniqueProducts} fichas con señales | ${group.byProvider.map((item) => item.providerId).join(", ")}`);
    if (!options.detailed) continue;
    for (const pattern of group.patterns) {
      lines.push(`  ${pattern.stage} | ${pattern.assessment} | regla ${pattern.rule ?? "no reconocida"} | ${pattern.variants.length} variantes`);
      for (const variant of pattern.variants.slice(0, 3)) {
        const examples = variant.occurrences.slice(0, 3).map((item) => `${item.identity}: ${JSON.stringify(item.specification.rawKey)} = ${JSON.stringify(item.specification.rawValue)}`);
        lines.push(`    ${variant.signature} | ${variant.occurrences.length} ocurrencias | ${examples.join("; ")}`);
      }
    }
  }
  if (options.detailed) lines.push("Detalle limitado a tres variantes y tres ejemplos por patrón; --json conserva todas las referencias y contrastes.");
  return lines;
};

export const printNormalizationAudit = (report: Report, options: Options): void => {
  for (const line of formatNormalizationAudit(report, options)) printReportLine(line);
};
