import type { PanelExplorerProduct, PanelFieldDifference, PanelSpecAddition } from "../explorer/types.js";
import { create, append, text } from "./dom.js";
import { changes, additionLabels, formatNumber } from "./explorer-labels.js";

export const renderSpecifications = (item: PanelExplorerProduct, additionKind: PanelSpecAddition["kind"] | "todos"): HTMLElement => {
  const section = create("section", "detail-section technical-section");
  append(section, create("p", "minor-note", "Especificaciones alineadas por campo. Solo se colorean las incorporaciones del motor. Azul: incorporación editorial exclusiva; naranja: la misma incorporación editorial compartida con otras máquinas; gris: pertenencia aún sin resolver. Compartir información técnica no significa copiar datos entre unidades."));
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
