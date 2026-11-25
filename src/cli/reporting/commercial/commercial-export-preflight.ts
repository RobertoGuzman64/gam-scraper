import { renderHistoricalReferenceMismatches } from "../catalog/historical-references.js";
import { isReferenceProviderSet } from "../../../contracts/campaign-providers.js";
import type { CommercialExportPreflight } from "../../../commercial/export/commercial-export-preflight.js";
import type { CommercialEnvironment } from "../../../infrastructure/filesystem/legacy-export/commercial-reference-loader.js";

export const renderCommercialExportPreflight = (
  report: CommercialExportPreflight, environment: CommercialEnvironment | null, detailed = false
): readonly string[] => {
  const lines = [
    `PREFLIGHT COMERCIAL | solo lectura · entorno ${environment ?? "sin companyID"} · no se prepara ni publica`
  ];
  if (report.publications.length) lines.push("");
  for (const publication of report.publications) {
    const original = publication.sourceProductCount === null ? "no declarado" : `${publication.sourceProductCount} fichas`;
    if (detailed) {
      if (lines[lines.length - 1] !== "") lines.push("");
      lines.push(`PUBLICACIÓN VIGENTE | ${publication.providerId} | ${publication.products} fichas | SHA256 ${publication.publicationSha256}`);
      lines.push(`  Run: ${publication.runId} | selección: ${publication.selection}`);
      lines.push(`  Original declarado: ${original} | SHA256 ${publication.sourceCatalogSha256 ?? "no declarado"}`);
      lines.push("  Fecha de publicación: no declarada en el contrato acreditado; no se infiere del nombre ni del mtime");
    } else {
      lines.push(`PUBLICACIÓN VIGENTE | ${publication.providerId} | ${publication.products} fichas · original: ${original}`);
    }
  }
  if (!detailed && report.publications.length) {
    lines.push("", "Fecha de publicación: no declarada · huellas, rutas e identificadores: --detalle");
  }
  if (report.failures.length || report.globalFailures.length) lines.push("");
  for (const failure of report.failures) lines.push(`${failure.category} | ${failure.providerId} | ${failure.detail}`);
  for (const failure of report.globalFailures) lines.push(`ERROR | ${failure}`);
  lines.push("");
  if (report.historicalReferenceWarning !== null) lines.push(`WARN | REFERENCIAS HISTÓRICAS | diagnóstico no disponible: ${report.historicalReferenceWarning}`);
  else if (report.historicalReferences === null) lines.push("WARN | REFERENCIAS HISTÓRICAS | sin manifiesto disponible");
  else lines.push(...renderHistoricalReferenceMismatches(report.historicalReferences, detailed));
  lines.push("", report.failures.length || report.globalFailures.length || !isReferenceProviderSet(report.publications.map((item) => item.providerId))
    ? "Etapas: preparación nueva NO EJECUTADA · publicaciones inspeccionadas con bloqueos · paquete comercial NO GENERADO"
    : "Etapas: preparación nueva NO EJECUTADA · publicaciones vigentes REUTILIZADAS · paquete comercial AÚN NO GENERADO");
  return lines;
};
