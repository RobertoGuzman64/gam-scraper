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
  const diagnostics = report.diagnostics;
  lines.push(`COMPROBACIONES TRANSVERSALES | ${diagnostics.checks.length ? `${diagnostics.checks.length} activas` : "ninguna activa"} | cobertura por ficha`);
  for (const check of diagnostics.checks) {
    lines.push(`  ${check.check} | población ${check.population} | elegibles ${check.eligible} | evaluadas ${check.evaluated} | excluidas ${check.excluded} | no evaluables ${check.notEvaluable} | errores ${check.errors} | proveedores sin evaluar ${check.missingProviders.join(", ") || "ninguno"}`);
    if (options.detailed) for (const item of check.byProvider) {
      lines.push(`    ${item.providerId} | población ${item.population} | elegibles ${item.eligible} | evaluadas ${item.evaluated} | excluidas ${item.excluded} | no evaluables ${item.notEvaluable} | errores ${item.errors}`);
      for (const reason of item.reasons) lines.push(`      ${reason.status} | ${reason.count} fichas | ${reason.reason}`);
    }
  }
  if (diagnostics.checks.length > 0) {
    lines.push(`IMPACTO TRANSVERSAL | ${diagnostics.potential.uniqueProducts} fichas | ${diagnostics.potential.uniqueSpecifications} prestaciones únicas acreditadas | ${diagnostics.potential.occurrences} ocurrencias de defecto o hipótesis`,
      `  Defectos reproducibles ${diagnostics.byAssessment.defecto_reproducible.occurrences} | hipótesis ${diagnostics.byAssessment.hipotesis.occurrences} | diferencias legítimas ${diagnostics.byAssessment.diferencia_legitima.occurrences} | no evaluables ${diagnostics.byAssessment.no_evaluable.occurrences} | no aplicables ${diagnostics.byAssessment.no_aplicable.occurrences}`);
    const priority = (assessment: string): number => assessment === "defecto_reproducible" ? 0 : assessment === "hipotesis" ? 1 : 2;
    const groups = [...diagnostics.groups].sort((a, b) => priority(a.assessment) - priority(b.assessment) ||
      b.impact.uniqueProducts - a.impact.uniqueProducts || b.impact.occurrences - a.impact.occurrences);
    lines.push(`GRUPOS TRANSVERSALES | ${Math.min(groups.length, options.limit)}/${groups.length}; --json devuelve todos`);
    for (const group of groups.slice(0, options.limit)) {
      lines.push(`  ${group.check} | ${group.cause} | ${group.assessment} | ${group.specificationKey ?? "prestación no acreditada"} | ${group.scope.family ?? `${group.scope.providerId}/${group.scope.sourceCategoryKey}`} | ${group.stage}/${group.circuit} | ${group.impact.uniqueProducts} fichas | ${group.impact.occurrences} ocurrencias`);
      if (options.detailed) for (const index of group.occurrenceIndices.slice(0, 3)) {
        const occurrence = diagnostics.occurrences[index];
        if (occurrence) lines.push(`    ${occurrence.identity} | ${occurrence.applicability} | ${occurrence.reason} | ${JSON.stringify(occurrence.evidence)}`);
      }
    }
  }
  return lines;
};

export const printNormalizationAudit = (report: Report, options: Options): void => {
  for (const line of formatNormalizationAudit(report, options)) printReportLine(line);
};

const jsonFragments = function* (fields: Readonly<Record<string, unknown>>, nestedDiagnostics = false): Generator<string> {
  yield "{";
  let first = true;
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    if (!first) yield ",";
    first = false;
    yield `${JSON.stringify(key)}:`;
    if (Array.isArray(value)) {
      yield "[";
      for (const [index, item] of value.entries()) {
        if (index > 0) yield ",";
        yield JSON.stringify(item) ?? "null";
      }
      yield "]";
    } else if (nestedDiagnostics && key === "diagnostics" && typeof value === "object" && value !== null) {
      yield* jsonFragments(Object.fromEntries(Object.entries(value)));
    } else yield JSON.stringify(value);
  }
  yield "}";
};

type JsonWriter = (chunk: string) => Promise<void>;
const writeStdout: JsonWriter = (chunk) => new Promise((resolve, reject) => {
  process.stdout.write(chunk, (error) => error ? reject(error) : resolve());
});

export const writeNormalizationAuditJson = async (report: Report, write: JsonWriter = writeStdout): Promise<void> => {
  const limit = 256 * 1024;
  let chunk = "";
  for (const fragment of jsonFragments(report, true)) {
    if (chunk && chunk.length + fragment.length > limit) {
      await write(chunk);
      chunk = "";
    }
    if (fragment.length >= limit) await write(fragment);
    else chunk += fragment;
  }
  await write(`${chunk}\n`);
};
