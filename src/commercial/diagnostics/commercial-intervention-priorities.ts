import type { CommercialAccreditation } from "./commercial-accreditation.js";
import type { CommercialAttributeAudit } from "./commercial-attributes.js";
import type { CommercialCrossCoverageAudit } from "./commercial-cross-coverage.js";
import type { CommercialOutputConsistencyAudit, CommercialOutputConsistencyReason } from "./commercial-output-consistency.js";
import type { CommercialPresentationAudit } from "./commercial-presentation.js";

export type CommercialIntervention = {
  readonly priority: "alta" | "media" | "baja" | "controlada";
  readonly source: "salida" | "transversal" | "editorial" | "acreditacion" | "atributos";
  readonly reason: string;
  readonly affected: number;
  readonly responsible: string;
  readonly action: string;
  readonly examples: readonly string[];
  readonly evidence: readonly string[];
};

export type CommercialInterventionPriorities = {
  readonly pending: readonly CommercialIntervention[];
  readonly controlled: readonly CommercialIntervention[];
};

type Inputs = {
  readonly accreditation: Pick<CommercialAccreditation, "blocking" | "pending">;
  readonly attributeAudit: Pick<CommercialAttributeAudit, "validationIssues">;
  readonly presentationAudit: Pick<CommercialPresentationAudit, "signals">;
  readonly outputConsistencyAudit: Pick<CommercialOutputConsistencyAudit, "signals" | "findings">;
  readonly crossCoverageAudit: Pick<CommercialCrossCoverageAudit, "signals"> & Partial<Pick<CommercialCrossCoverageAudit, "findings">>;
  readonly controlledCoherence?: ReadonlySet<string>;
};

const outputAction = (reason: CommercialOutputConsistencyReason): string => {
  switch (reason) {
    case "referencia-titulo-contradictoria":
      return "Contrastar referencia publicada y sufijo visible; revisar la composición del título solo con identidad acreditada.";
    case "modelo-variante-titulo-contradictorio":
    case "modelo-variante-subtitulo-contradictorio":
      return "Contrastar variante de título, subtítulo y modelo técnico; decidir la fuente correcta antes de ajustar la presentación.";
    case "motorizacion-titulo-resumen-contradictoria":
      return "Contrastar el tipo de motor en la fuente y resolver la discrepancia entre título y resumen, sin inferir variantes mixtas.";
    case "ano-titulo-atributo-contradictorio":
      return "Acreditar el año de fabricación de la unidad antes de corregir título o atributo.";
    case "medida-submetro-atributo-escala-multiplicada":
      return "Comprobar la conversión de metros a milímetros y el valor publicado; corregir el parser sin alterar medidas de otras variantes.";
  }
};

const crossAction = (signal: CommercialCrossCoverageAudit["signals"][number]): string => {
  if (signal.reason === "portada-prefijo-distinto") {
    return "Nomenclatura de archivo con prefijo distinto y misma numeración; conservar la galería salvo evidencia adicional.";
  }
  if (signal.reason === "portada-referencia-ajena") {
    return "Contrastar la portada compartida y la referencia de archivo con la unidad propietaria; no sustituir fotografías sin evidencia.";
  }
  if (signal.reason === "modelo-portada-variante-discordante") {
    return "Contrastar la variante del nombre de la imagen con el modelo técnico y la unidad; no inferir identidad por el archivo.";
  }
  if (signal.reason === "modelo-titulo-spec-discordante") {
    return "Contrastar modelo técnico, título y portada de la unidad origen; corregir únicamente tras acreditar la variante.";
  }
  if (signal.area === "imagenes") {
    return "Contrastar la propiedad de la imagen con la unidad y el modelo originales; no eliminar galerías por coincidencias de URL.";
  }
  if (signal.area === "identidad") {
    return "Revisar referencias visibles y su contexto de proveedor; no fusionar máquinas por espacios o guiones equivalentes.";
  }
  return signal.origin === "introducida"
    ? "Comparar publicación y salida comercial; revisar la regla editorial solo si introduce esta señal."
    : "Comprobar la descripción publicada y la evidencia del proveedor antes de intervenir la fuente técnica.";
};

const editorialAction = (reason: string): string => {
  if (reason === "descripcion-general-posiblemente-truncada" || reason === "listado-origen-incompleto") {
    return "Contrastar el texto completo en el proveedor; no completar automáticamente contenido ausente.";
  }
  if (reason === "unidad-potencia-no-estandar") {
    return "Comprobar la magnitud y unidad originales antes de normalizar su representación.";
  }
  if (reason === "descripcion-origen-en-mayusculas" || reason === "marcadores-origen-residuales") {
    return "Revisar el texto original y decidir si la limpieza editorial es segura y generalizable.";
  }
  return "Contrastar la señal con la publicación y revisar la regla de presentación si existe un defecto demostrado.";
};

const accreditationAction = (reason: string): string => {
  if (reason === "medida-submetro-atributo-escala-multiplicada") {
    return outputAction(reason);
  }
  if (reason === "especificaciones-incompatibles-filtradas") {
    return "Protección aplicada: conservar la traza y verificar que los valores incompatibles sigan fuera de la exportación.";
  }
  if (reason.includes("capacidad")) return "Contrastar capacidad nominal y configuración de la unidad en el proveedor; no inventar el valor correcto.";
  if (reason.includes("altura")) return "Distinguir altura de trabajo y plataforma; contrastar la evidencia de la unidad antes de corregir.";
  if (reason.includes("ano") || reason.includes("año")) {
    return "Verificar el año de fabricación de la unidad con fuente acreditada; no utilizar la URL como única prueba.";
  }
  if (reason.includes("categoria")) return "Revisar la clasificación comercial existente y la categoría de origen, sin crear IDs nuevos.";
  return "Localizar la decisión y contrastarla con la publicación técnica y el contrato comercial existente.";
};

const accreditationResponsible = (reason: string): string => reason === "especificaciones-incompatibles-filtradas"
  ? "validación comercial existente" : reason.includes("categoria")
    ? "categorización comercial" : "evidencia del proveedor / calidad técnica";

const rank: Readonly<Record<CommercialIntervention["priority"], number>> = {
  alta: 0, media: 1, baja: 2, controlada: 3
};

export const prioritizeCommercialInterventions = (input: Inputs): CommercialInterventionPriorities => {
  const interventions: CommercialIntervention[] = [];
  for (const signal of input.outputConsistencyAudit.signals) {
    if (input.accreditation.blocking.some((finding) => finding.reason === signal.reason)) continue;
    const evidence = input.outputConsistencyAudit.findings
      .filter((finding) => finding.reason === signal.reason)
      .slice(0, 3).map((finding) => `${finding.reference ?? finding.sourceUrl} | ${finding.field} | ${finding.evidence.join(" <> ")}`);
    interventions.push({ priority: "alta", source: "salida", reason: signal.reason, affected: signal.affected,
      responsible: "fuente técnica o proyección comercial (por determinar)", action: outputAction(signal.reason),
      examples: signal.examples, evidence });
  }
  for (const signal of input.crossCoverageAudit.signals) {
    const introduced = signal.origin === "introducida";
    const controlledByType = !introduced && signal.reason === "portada-prefijo-distinto";
    const findings = input.crossCoverageAudit.findings?.filter((finding) =>
      finding.area === signal.area && finding.reason === signal.reason && finding.origin === signal.origin);
    const recognized = !introduced && !controlledByType && findings?.length === signal.affected
      ? findings.filter((finding) => input.controlledCoherence?.has(JSON.stringify([finding.sourceUrl, finding.reason])) === true)
      : [];
    const remaining = signal.affected - recognized.length;
    const common = {
      source: "transversal" as const, reason: `${signal.area}:${signal.reason}:${signal.origin}`,
      responsible: introduced ? "proyección comercial (contrastar con publicación)" : "fuente técnica / proveedor",
      action: crossAction(signal), evidence: [] as string[]
    };
    if (remaining > 0) interventions.push({ ...common,
      priority: introduced ? "alta" : controlledByType ? "controlada" : signal.area === "editorial" ? "baja" : "media",
      affected: remaining, examples: recognized.length === 0 ? signal.examples : findings?.filter((finding) =>
        !input.controlledCoherence?.has(JSON.stringify([finding.sourceUrl, finding.reason]))).slice(0, 5)
        .map((finding) => finding.sourceUrl) ?? []
    });
    if (recognized.length > 0) interventions.push({ ...common, priority: "controlada",
      affected: recognized.length, examples: recognized.slice(0, 5).map((finding) => finding.sourceUrl) });
  }
  for (const signal of input.presentationAudit.signals) {
    const strong = signal.reason === "titulo-vacio" || signal.reason === "imagen-principal-fuera-de-galeria" ||
      signal.reason === "unidad-mm-sin-espacio" || signal.reason === "descriptor-mastil-duplicado" ||
      signal.reason === "promocion-proveedor-en-resumen";
    interventions.push({ priority: strong ? "alta" : "media", source: "editorial", reason: signal.reason,
      affected: signal.affected, responsible: strong ? "proyección / validación comercial" : "fuente original / revisión editorial",
      action: editorialAction(signal.reason), examples: signal.examples, evidence: [] });
  }
  for (const finding of input.accreditation.blocking) {
    const evidence = input.outputConsistencyAudit.findings
      .filter((item) => item.reason === finding.reason).slice(0, 3)
      .map((item) => `${item.reference ?? item.sourceUrl} | ${item.field} | ${item.evidence.join(" <> ")}`);
    interventions.push({ priority: "alta", source: "acreditacion", reason: finding.reason, affected: finding.affected,
      responsible: "contrato y validación comercial", action: accreditationAction(finding.reason),
      examples: finding.examples, evidence });
  }
  for (const finding of input.accreditation.pending) {
    const controlled = finding.reason === "especificaciones-incompatibles-filtradas";
    interventions.push({ priority: controlled ? "controlada" : finding.reason.includes("categoria") ? "alta" : "media",
      source: "acreditacion", reason: finding.reason, affected: finding.affected,
      responsible: accreditationResponsible(finding.reason), action: accreditationAction(finding.reason),
      examples: finding.examples, evidence: [] });
  }
  for (const finding of input.attributeAudit.validationIssues) {
    interventions.push({ priority: finding.reason === "resuelto-no-asignado" ? "media" : "alta",
      source: "atributos", reason: finding.reason, affected: finding.affected,
      responsible: "mapeo y validación de atributos comerciales",
      action: "Revisar la asignación y el motivo de rechazo en el contrato actual antes de cambiar relaciones o valores.",
      examples: finding.examples.map((item) => item.sourceUrl), evidence: [] });
  }
  interventions.sort((a, b) => rank[a.priority] - rank[b.priority] || b.affected - a.affected ||
    a.source.localeCompare(b.source, "es") || a.reason.localeCompare(b.reason, "es"));
  return { pending: interventions.filter((item) => item.priority !== "controlada"),
    controlled: interventions.filter((item) => item.priority === "controlada") };
};
