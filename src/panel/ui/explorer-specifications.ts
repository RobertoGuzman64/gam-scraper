import type { PanelExplorerProduct, PanelFieldDifference, PanelSpecAddition } from "../explorer/types.js";
import { create, append, text } from "./dom.js";
import { changes, additionLabels, formatNumber } from "./explorer-labels.js";

const renderAdditionProvenance = (item: PanelExplorerProduct, addition: PanelSpecAddition): HTMLElement => {
  const details = create("details", "spec-provenance-details");
  append(details, create("summary", "", "Ver trazabilidad"));
  const origin = item.provenance.find((entry) => entry.group === "technical" && entry.field === addition.field);
  const kindDescription = addition.kind === "pending" ? "Pertenencia editorial pendiente de resolver."
    : addition.kind === "own" ? "Incorporación editorial exclusiva de esta máquina dentro del corte verificado."
      : "Incorporación editorial reutilizada entre máquinas vinculadas por su regla técnica.";
  append(details, create("p", "", kindDescription));
  if (addition.kind === "reused" && addition.linkedMachines?.length) {
    append(details, create("p", "", `Misma incorporación editorial compartida con: ${addition.linkedMachines.join(", ")}`));
  }
  if (origin?.status === "source-compatible" && origin.proof && origin.sourceField && origin.sourceValue) {
    append(details,
      create("p", "", `Dato original compatible: ${origin.sourceField} = ${origin.sourceValue}`),
      create("p", "spec-provenance-artifact", `Original verificado: ${origin.proof.path} · SHA-256 ${origin.proof.sha256}`));
  } else if (origin?.status === "mechanism-compatible" && origin.document && origin.mechanism) {
    append(details, create("p", "", `${origin.scope === "model-document" ? "Documento asociado al modelo" :
      origin.scope === "unit-document" ? "Documento externo asociado a la unidad" :
        "Referencia documental registrada; identidad de marca o modelo incompleta"}: ${origin.document.url}`),
      create("p", "", `Identidad original: ${origin.document.brand ?? "sin marca"} / ${origin.document.model ?? "sin modelo"} · Regla: ${origin.mechanism}`),
      create("p", "", "La traza acredita qué referencia utilizó el recuperador; no verifica la vigencia del documento externo ni sustituye la auditoría de clasificación."));
  } else if (origin?.status === "mechanism-compatible" && origin.mechanism) {
    append(details, create("p", "", `Regla compatible: ${origin.mechanism}`));
  } else {
    append(details, create("p", "", "El resolver no aporta prueba individual del mecanismo. Una coincidencia documental no acredita por sí sola el tipo de fuente."));
  }
  append(details, create("p", "spec-provenance-caution", origin?.historicalApplication === "demonstrated"
    ? "Regla ejecutada en la preparación registrada; la clasificación histórica se conserva."
    : "La aplicación histórica de la regla no está demostrada por esta consulta."));
  return details;
};

export const renderSpecifications = (item: PanelExplorerProduct, additionKind: PanelSpecAddition["kind"] | "todos"): HTMLElement => {
  const section = create("section", "detail-section technical-section");
  append(section, create("p", "minor-note", "Especificaciones alineadas por campo. Solo se colorean las incorporaciones del motor. Azul: incorporación editorial exclusiva; naranja: la misma incorporación editorial compartida con otras máquinas; gris: pertenencia aún sin resolver. La procedencia documental se muestra por separado y no decide los colores. Compartir información técnica no significa copiar datos entre unidades."));
  const technical = item.changes.filter((difference) => difference.group === "technical");
  const source = item.original && item.published ? technical :
    item.published && item.commercialTechnicalChanges.length ? item.commercialTechnicalChanges.map((difference): PanelFieldDifference => ({
      field: difference.field, group: "technical", change: "unchanged", before: null, after: difference.before
    })) : Object.entries((item.published ?? item.original)?.specs ?? {}).map(([field, value]): PanelFieldDifference => ({
      field, group: "technical", change: "unchanged",
      before: item.original && !item.published ? Array.isArray(value) ? value.join(" · ") : String(value) : null,
      after: item.published ? Array.isArray(value) ? value.join(" · ") : String(value) : null
    }));
  const originalToFinish = new Map(source.map((difference) => [difference.field, difference]));
  const additions = new Map(item.specAdditions.map((addition) => [addition.field, addition]));
  const finishToCommercial = new Map(item.commercialTechnicalChanges.map((difference) => [difference.field, difference]));
  const fields = [...new Set([...originalToFinish.keys(), ...finishToCommercial.keys()])]
    .filter((field) => additionKind === "todos" || additions.get(field)?.kind === additionKind)
    .sort((a, b) => a.localeCompare(b, "es"));
  if (!fields.length) {
    append(section, create("p", "muted-copy", "No constan prestaciones técnicas en este expediente."));
    return section;
  }
  const createTable = (selected: readonly string[]): HTMLElement => {
    const region = create("div", "scroll-table technical-table-wrap");
    const table = create("table", "data-table technical-table");
    const headingRow = create("tr");
    for (const name of ["PRESTACIÓN", "ORIGINAL", "FINISH", "COMERCIAL", "ESTADO OBSERVADO"]) append(headingRow, create("th", "", name));
    const header = create("thead");
    append(header, headingRow);
    append(table, header);
    const body = create("tbody");
    for (const field of selected) {
      const edit = originalToFinish.get(field);
      const projection = finishToCommercial.get(field);
      const result = create("tr");
      const addition = edit?.change === "added" ? additions.get(field) : undefined;
      if (addition) result.classList.add(`spec-kind-${addition.kind}`);
      const before = item.original ? text(edit?.before ?? null) : "Evidencia no disponible";
      const after = item.published ? text(edit?.after ?? projection?.before ?? null) : "No aplica";
      const commercial = item.commercial ? text(projection?.after ?? null) : "No aplica";
      const classification = !item.original || !item.published ? "Sin comparación editorial" :
        edit ? changes[edit.change] : "No consta en original/FINISH";
      const commercialStatus = projection && projection.change !== "unchanged" ? ` · Comercial: ${changes[projection.change]}` : "";
      const status = addition ? `Añadida · ${additionLabels[addition.kind]}` : classification + commercialStatus;
      const statusCell = create("td", `technical-status${addition ? ` spec-kind-label-${addition.kind}` : ""}`, status);
      if (addition) append(statusCell, renderAdditionProvenance(item, addition));
      append(result, create("th", "technical-field", field), create("td", "technical-value", before),
        create("td", "technical-value", after), create("td", "technical-value", commercial), statusCell);
      append(body, result);
    }
    append(table, body);
    append(region, table);
    return region;
  };
  const relevant = fields.filter((field) => !item.original || !item.published || originalToFinish.get(field)?.change !== "unchanged" ||
    finishToCommercial.get(field)?.change !== "unchanged" && finishToCommercial.has(field));
  const preserved = fields.filter((field) => !relevant.includes(field));
  if (relevant.length) append(section, createTable(relevant));
  else append(section, create("p", "muted-copy", "No se observaron cambios técnicos entre las etapas comparables."));
  if (preserved.length) {
    const details = create("details", "preserved-fields");
    append(details, create("summary", "", `${formatNumber.format(preserved.length)} prestaciones conservadas · Ver todas`), createTable(preserved));
    append(section, details);
  }
  return section;
};
