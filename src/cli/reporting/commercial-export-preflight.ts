import type { CommercialExportPreflight } from "../../commercial/export/commercial-export-preflight.js";
import type { CommercialEnvironment } from "../../infrastructure/filesystem/legacy-export/commercial-reference-loader.js";

export const renderCommercialExportPreflight = (
  report: CommercialExportPreflight, environment: CommercialEnvironment | null
): readonly string[] => {
  const lines = [
    "PREFLIGHT COMERCIAL | solo lectura · publicaciones vigentes acreditadas; no se prepara ni publica",
    `Entorno solicitado: ${environment ?? "sin companyID"}`
  ];
  for (const publication of report.publications) {
    lines.push(`PUBLICACIÓN VIGENTE | ${publication.providerId} | ${publication.products} fichas | SHA256 ${publication.publicationSha256}`);
    lines.push(`  Run: ${publication.runId} | selección: ${publication.selection}`);
    lines.push(`  Original declarado: ${publication.sourceProductCount ?? "no declarado"} fichas | SHA256 ${publication.sourceCatalogSha256 ?? "no declarado"}`);
    lines.push("  Fecha de publicación: no declarada en el contrato acreditado; no se infiere del nombre ni del mtime");
  }
  for (const failure of report.failures) lines.push(`${failure.category} | ${failure.providerId} | ${failure.detail}`);
  for (const failure of report.globalFailures) lines.push(`ERROR | ${failure}`);
  if (report.historicalReferenceWarning !== null) lines.push(`REFERENCIAS HISTÓRICAS | diagnóstico no disponible: ${report.historicalReferenceWarning}`);
  else if (report.historicalReferences === null) lines.push("REFERENCIAS HISTÓRICAS | sin manifiesto disponible");
  else {
    lines.push(`REFERENCIAS HISTÓRICAS | ${report.historicalReferences.length} discrepancias de huella (diagnóstico; no se actualizan)`);
    for (const mismatch of report.historicalReferences) lines.push(
      `  ${mismatch.path} | esperada ${mismatch.expectedSha256} | actual ${mismatch.actualSha256 ?? "archivo ausente"}`);
  }
  lines.push(report.failures.length || report.globalFailures.length || report.publications.length !== 3
    ? "Etapas: preparación nueva NO EJECUTADA · publicaciones inspeccionadas con bloqueos · paquete comercial NO GENERADO"
    : "Etapas: preparación nueva NO EJECUTADA · publicaciones vigentes REUTILIZADAS · paquete comercial AÚN NO GENERADO");
  return lines;
};
