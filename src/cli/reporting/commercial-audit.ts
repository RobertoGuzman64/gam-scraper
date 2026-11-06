import type { CommercialAudit } from "../../commercial/export/commercial-audit.js";
import { printReportLine } from "./terminal.js";

export const printCommercialAuditReport = (
  report: CommercialAudit, mode: string | undefined, attributeId: string | undefined, productReference: string | undefined
): void => {
  if (mode === "--acreditacion-json") {
    console.log(JSON.stringify({ version: 1, providers: report.providers.map((item) => item.accreditation) }, null, 2));
    return;
  }
  if (mode === "--acreditacion") {
    let blocking = 0;
    for (const { accreditation: audit } of report.providers) {
      blocking += audit.summary.blocking;
      printReportLine(`${audit.providerId.toUpperCase()} | acreditadas por contrato ${audit.summary.exported} | excluidas ${audit.summary.excluded} | categoría ${audit.summary.categorized} | pendientes ${audit.summary.pendingCategory} | atributos ${audit.summary.attributes} | títulos normalizados ${audit.summary.normalizedTitles} | campos perdidos ${audit.summary.lostFields} | alterados ${audit.summary.changedFields} | infracciones ${audit.summary.blocking}`);
      for (const finding of audit.blocking) printReportLine(`  BLOQUEANTE ${finding.reason}: ${finding.affected}`);
      for (const finding of audit.pending) printReportLine(`  PENDIENTE ${finding.reason}: ${finding.affected}`);
    }
    printReportLine(`ACREDITACIÓN TÉCNICA DEL DERIVADO | ${blocking === 0 ? "SIN INFRACCIONES" : `${blocking} INFRACCIONES`} | validación semántica y BD todavía pendientes`);
    if (blocking > 0) process.exitCode = 1;
    return;
  }
  if (mode === "--json") {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  if (mode === "--exportacion") {
    for (const { baseline, exportAudit } of report.providers) {
      const stats = exportAudit.summary;
      printReportLine(`${baseline.providerId.toUpperCase()} | candidatos ${stats.exported}/${baseline.products} | categoría ${stats.categorized} | pendientes ${stats.pendingCategory} | excluidos ${exportAudit.excluded} | atributos ${stats.attributes} | logo ${stats.withLogo} | precio ${stats.withPrice}`);
      for (const reason of exportAudit.reasons) printReportLine(`  ${reason.reason}: ${reason.affected}`);
    }
    return;
  }
  if (productReference !== undefined) {
    let found = 0;
    for (const { baseline, presentationAudit, attributeAudit } of report.providers) {
      for (const item of presentationAudit.decisions.filter((decision) => decision.reference === productReference)) {
        found += 1;
        printReportLine(`${baseline.providerId.toUpperCase()} | ${item.reference} | ${item.status} | categorySellID ${item.categorySellID ?? "pendiente"} | ${item.sourceUrl}`);
        printReportLine(`  Título: ${item.title ?? "ausente"} | normalizado ${item.titleChanged} | subtítulo normalizado ${item.descriptionTitleChanged}`);
        printReportLine(`  Resumen: ${item.shortPreview ?? "ausente"}`);
        printReportLine(`  Descripción general: ${item.generalPreview ?? "ausente"}`);
        printReportLine(`  Imágenes ${item.images} | specs ${item.specifications} | metadata ${JSON.stringify(item.metadata)}`);
        const attributes = attributeAudit.decisions.find((decision) => decision.sourceUrl === item.sourceUrl);
        if (attributes?.status === "proposed") {
          printReportLine(`  Atributos aceptados ${attributes.attributes.length} | relaciones directas ${attributes.relatedAttributes} | recuperados ${attributes.recovered.length} | valores resueltos no asignados ${attributes.unresolved.length}`);
        }
        for (const signal of item.signals) printReportLine(`  REVISAR ${signal}`);
      }
    }
    if (found === 0) printReportLine(`No existe referencia técnica publicada ${productReference}`);
    return;
  }
  if (mode === "--contenido" || mode === "--contenido-revision") {
    for (const { baseline, presentationAudit: audit } of report.providers) {
      printReportLine(`${baseline.providerId.toUpperCase()} | elegibles ${audit.eligible} | excluidos ${audit.excluded} | títulos ${audit.withTitle} | cortos ${audit.withShort} | generales ${audit.withGeneral} | imágenes ${audit.withImage} | metadata ${audit.withMetadata}`);
      printReportLine(`  Metadatos: categoría ${audit.metadataWithCategory} | marca acreditada ${audit.metadataWithBrand} | modelo acreditado ${audit.metadataWithModel} | títulos depurados ${audit.titlesNormalized} | subtítulos depurados ${audit.descriptionTitlesNormalized}`);
      printReportLine(`  Preservación: resumen modificado ${audit.changedShort} | general modificada ${audit.changedGeneral} | imágenes perdidas ${audit.lostImages} | specs perdidas ${audit.lostSpecifications}`);
      for (const signal of audit.signals) {
        printReportLine(`    CONTENIDO ${signal.reason}: ${signal.affected}`);
        if (mode === "--contenido-revision") for (const url of signal.examples) printReportLine(`      ${url}`);
      }
    }
    return;
  }
  if (attributeId !== undefined) {
    const id = Number(attributeId);
    let known = false;
    for (const { baseline, attributeAudit: audit } of report.providers) {
      const stats = audit.coverage.find((item) => item.attributeID === id);
      if (!stats) continue;
      known = true;
      printReportLine(`${baseline.providerId.toUpperCase()} | ${id} ${stats.name} | relacionadas ${stats.relatedProducts} | aceptadas ${stats.accepted}`);
      for (const decision of audit.decisions) {
        const issue = decision.unresolved.find((item) => item.attributeID === id);
        const recovered = decision.recovered.find((item) => item.attributeID === id);
        if (recovered) printReportLine(`  RECUPERADO ${recovered.value} | ${decision.reference ?? decision.sourceUrl} | ${decision.sourceCategory} | ${decision.sourceUrl}`);
        if (issue) printReportLine(`  INTERVENIR ${issue.status} | ${decision.reference ?? decision.sourceUrl} | ${decision.sourceCategory} | ${decision.sourceUrl}`);
      }
    }
    if (!known) printReportLine(`No hay categorías elegibles relacionadas con el atributo ${id}`);
    return;
  }
  if (mode === "--atributos-vacios") {
    for (const { baseline, attributeAudit: audit } of report.providers) {
      const empty = audit.decisions.filter((item) => item.status === "proposed" && item.attributes.length === 0);
      const withoutRelations = empty.filter((item) => item.relatedAttributes === 0);
      printReportLine(`${baseline.providerId.toUpperCase()} | sin atributos ${empty.length} | sin relaciones directas ${withoutRelations.length} | con relaciones sin valor aceptado ${empty.length - withoutRelations.length}`);
      for (const item of empty) {
        const reason = item.relatedAttributes === 0 ? "SIN RELACIONES DIRECTAS" :
          item.unresolved.length > 0 ? "VALOR RESUELTO NO ASIGNADO" : "SIN ATRIBUTOS VÁLIDOS";
        printReportLine(`  ${reason} | categoría ${item.categorySellID} | ${item.reference ?? item.sourceUrl} | ${item.sourceUrl}`);
      }
    }
    return;
  }
  if (mode === "--atributos" || mode === "--atributos-revision") {
    for (const { baseline, attributeAudit: audit } of report.providers) {
      printReportLine(`${baseline.providerId.toUpperCase()} | elegibles ${audit.eligible} | categorizadas ${audit.categorized} | asignaciones ${audit.acceptedAssignments}/${audit.mappedAssignments + audit.recoveredAssignments} | recuperadas ${audit.recoveredAssignments} | incidencias de validación ${audit.validationIssues.reduce((sum, issue) => sum + issue.affected, 0)} | sin atributos ${audit.decisions.filter((item) => item.status === "proposed" && item.attributes.length === 0).length}`);
      for (const issue of audit.validationIssues) {
        printReportLine(`  VALIDACIÓN ${issue.reason}: ${issue.affected}`);
        if (mode === "--atributos-revision") {
          for (const sample of issue.examples) printReportLine(`    ${sample.reference ?? sample.sourceUrl} | ${sample.sourceUrl}`);
        }
      }
    }
    return;
  }
  if (mode === "--pendientes") {
    for (const { baseline } of report.providers) {
      printReportLine(`${baseline.providerId.toUpperCase()} | ${baseline.categoryAudit.pending} pendientes | ${baseline.categoryAudit.excludedLots} lotes | ${baseline.categoryAudit.excludedTools} herramientas excluidas | ${baseline.categoryAudit.excludedAccessories} accesorios excluidos`);
      for (const item of baseline.categoryAudit.decisions.filter((decision) => decision.status === "pending")) {
        printReportLine(`  ${item.status.toUpperCase()} | ${item.reference ?? item.sourceUrl} | ${item.sourceCategory} | ${item.sourceUrl}`);
      }
    }
    return;
  }
  if (mode === "--muestras") {
    for (const { baseline } of report.providers) {
      printReportLine(`${baseline.providerId.toUpperCase()} | ${baseline.categoryAudit.categories.length} categorías distintas`);
      for (const category of baseline.categoryAudit.categories) {
        printReportLine(`  ${category.categorySellID} | ${category.name} | ${category.proposed} propuestas`);
        for (const sample of category.samples) {
          printReportLine(`    ${sample.reference ?? sample.sourceUrl} | ${sample.title ?? "Sin título"} | ${sample.sourceCategory}`);
        }
      }
    }
    return;
  }
  if (mode === "--revision") {
    for (const { baseline } of report.providers) {
      printReportLine(`${baseline.providerId.toUpperCase()} | ${baseline.categoryAudit.pending} categorías por resolver`);
      for (const group of baseline.pendingCategoryFamilies) {
        printReportLine(`  ${group.sourceCategory}: ${group.affected}`);
        for (const sample of group.examples) printReportLine(`    ${sample.reference ?? sample.sourceUrl} | ${sample.sourceUrl}`);
      }
    }
    return;
  }
  const total = report.providers.reduce((sum, entry) => sum + entry.baseline.products, 0);
  printReportLine(`AUDITORÍA COMERCIAL | ${total} fichas técnicas acreditadas | propuestas, no decisiones aprobadas`);
  for (const { baseline: value, originalProducts, publicationSha256 } of report.providers) {
    printReportLine(`${value.providerId.toUpperCase()} | publicadas ${value.products} | originales ${originalProducts} | SHA ${publicationSha256}`);
    printReportLine(`  Mapeador previo: categorías ${value.mapping.withCategory} | sin categoría ${value.mapping.withoutCategory} (incluye excluidos) | atributos ${value.mapping.attributes}`);
    printReportLine(`  Publicación técnica: títulos ${value.publication.withTitle} | textos breves ${value.publication.withDescription} | generales ${value.publication.withGeneralDescription} | imágenes ${value.publication.withImage} | specs ${value.publication.specifications} | precios ${value.publication.withPrice}`);
    printReportLine(`  Categorización comercial: elegibles ${value.categoryAudit.eligible} | propuestas ${value.categoryAudit.proposed} | pendientes ${value.categoryAudit.pending} | lotes excluidos ${value.categoryAudit.excludedLots} | herramientas excluidas ${value.categoryAudit.excludedTools} | accesorios excluidos ${value.categoryAudit.excludedAccessories}`);
    const attributeAudit = report.providers.find((item) => item.baseline.providerId === value.providerId)?.attributeAudit;
    if (attributeAudit) printReportLine(`  Auditoría atributos: aceptados ${attributeAudit.acceptedAssignments}/${attributeAudit.mappedAssignments + attributeAudit.recoveredAssignments} | recuperados ${attributeAudit.recoveredAssignments} | incidencias de validación ${attributeAudit.validationIssues.reduce((sum, item) => sum + item.affected, 0)}`);
    printReportLine(`  Referencias visibles duplicadas ${value.commercialReferenceCollisions.length} | categorías propuestas distintas ${value.categoryAudit.categories.length}`);
    const presentationAudit = report.providers.find((item) => item.baseline.providerId === value.providerId)?.presentationAudit;
    if (presentationAudit) printReportLine(`  Presentación comercial: títulos ${presentationAudit.withTitle} | resúmenes ${presentationAudit.withShort} | generales ${presentationAudit.withGeneral} | metadata ${presentationAudit.withMetadata} | títulos depurados ${presentationAudit.titlesNormalized} | imágenes/specs perdidas ${presentationAudit.lostImages}/${presentationAudit.lostSpecifications}`);
    for (const group of value.pendingCategoryFamilies.slice(0, 5)) {
      printReportLine(`    PENDIENTE ${group.sourceCategory}: ${group.affected} | ${group.examples.map((item) => item.reference ?? item.sourceUrl).join(", ")}`);
    }
  }
  printReportLine("Las exclusiones solo afectan a la selección comercial. Las propuestas no acreditan precisión ni importabilidad, y los históricos reducidos no permiten comparación completa.");
};
