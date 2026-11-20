import type { PanelExplorerProduct, PanelFieldDifference } from "../explorer/types.js";
import { explorerProductMetrics } from "../explorer/explorer-selection.js";
import { create, append, text } from "./dom.js";
import { changes, formatNumber } from "./explorer-labels.js";

const descriptionPanel = (label: string, description: string | null, unavailable: string): HTMLElement => {
  const panel = create("article", "description-panel");
  append(panel, create("h4", "", label), create("div", "description-body", description === null || description === "" ? unavailable : description));
  return panel;
};
export const renderDescriptions = (item: PanelExplorerProduct, field: "shortDescription" | "generalDescription"): HTMLElement => {
  const columns = create("div", "description-columns");
  append(columns, descriptionPanel("01 · Original", item.original?.[field] ?? null,
    item.original ? "No consta" : "Evidencia original no disponible"),
    descriptionPanel("02 · FINISH", item.published?.[field] ?? null,
      item.published ? "No consta" : "Etapa no alcanzada"));
  if (item.commercial) {
    const commercial = descriptionPanel("03 · Comercial", item.commercial[field], "No consta");
    commercial.classList.add("description-commercial");
    append(columns, commercial);
  }
  return columns;
};
export const renderTitle = (item: PanelExplorerProduct): HTMLElement => {
  const columns = create("div", "description-columns title-columns");
  append(columns, descriptionPanel("01 · Original", item.original?.title ?? null,
    item.original ? "No consta" : "Evidencia original no disponible"),
    descriptionPanel("02 · FINISH", item.published?.title ?? null,
      item.published ? "No consta" : "Etapa no alcanzada"));
  if (item.published && item.commercial && item.commercial.title !== item.published.title) {
    const commercial = descriptionPanel("03 · Comercial", item.commercial.title, "No consta");
    commercial.classList.add("description-commercial");
    append(columns, commercial);
  }
  return columns;
};
export const comparisonState = (
  item: PanelExplorerProduct,
  editorial: readonly PanelFieldDifference[],
  commercial: readonly PanelFieldDifference[]
): string => {
  const differences = [
    ...(item.original && item.published ? editorial : []),
    ...(item.published && item.commercial ? commercial : [])
  ];
  if (!differences.length) return "Sin comparación disponible";
  if (differences.some((difference) => difference.change === "ambiguous")) return "Incluye correspondencias ambiguas";
  return differences.some((difference) => difference.change !== "unchanged") ?
    "Con cambios observados" : "Sin cambios observados";
};
export const compareSection = (label: string, status: string, content: HTMLElement, initiallyOpen = false): HTMLElement => {
  const section = create("details", "comparison-group");
  section.open = initiallyOpen;
  const heading = create("summary", "comparison-group-title");
  append(heading, create("span", "", label), create("span", "comparison-group-state", status));
  append(section, heading, content);
  return section;
};
export const contentDifference = (item: PanelExplorerProduct, field: string): readonly PanelFieldDifference[] =>
  item.changes.filter((entry) => entry.group === "content" && entry.field === field);
export const commercialDifference = (item: PanelExplorerProduct, field: string): readonly PanelFieldDifference[] =>
  item.commercialChanges.filter((entry) => entry.field === field);

const renderCommercialAttributes = (item: PanelExplorerProduct): HTMLElement | null => {
  if (!item.commercial || !item.commercial.attributes.length) return null;
  const section = create("section", "attributes-section");
  append(section, create("h4", "", "Atributos comerciales aceptados"));
  const region = create("div", "scroll-table");
  const table = create("table", "data-table attributes-table");
  const head = create("thead");
  const row = create("tr");
  append(row, create("th", "", "IDENTIFICADOR DE ATRIBUTO"), create("th", "", "VALOR COMERCIAL"));
  append(head, row);
  append(table, head);
  const body = create("tbody");
  for (const attribute of item.commercial.attributes) {
    const entry = create("tr");
    append(entry, create("th", "", String(attribute.attributeID)), create("td", "", String(attribute.value)));
    append(body, entry);
  }
  append(table, body);
  append(region, table);
  append(section, region);
  return section;
};
export const renderCommercialData = (item: PanelExplorerProduct): HTMLElement => {
  const section = create("section", "detail-section commercial-section");
  const rows = [
    { name: "Categoría", original: item.original?.category ?? null, finish: item.published?.category ?? null,
      commercial: item.commercial?.category ?? null,
      editorial: contentDifference(item, "Categoría de origen / técnica"),
      projection: commercialDifference(item, "Categoría técnica / comercial") },
    { name: "Precio", original: item.original?.price ?? null, finish: item.published?.price ?? null,
      commercial: item.commercial?.price ?? null,
      editorial: contentDifference(item, "Precio declarado"), projection: commercialDifference(item, "Precio") }
  ];
  const region = create("div", "scroll-table");
  const table = create("table", "data-table technical-table commercial-comparison-table");
  const head = create("thead");
  const heading = create("tr");
  for (const name of ["DATO", "ORIGINAL", "FINISH", "COMERCIAL", "ESTADO OBSERVADO"]) append(heading, create("th", "", name));
  append(head, heading);
  append(table, head);
  const body = create("tbody");
  for (const row of rows) {
    if (row.original === null && row.finish === null && row.commercial === null) continue;
    const edit = row.editorial[0];
    const projection = row.projection[0];
    const status = [
      item.original && item.published && edit ? `Editorial: ${changes[edit.change]}` : null,
      item.published && item.commercial && projection ? `Comercial: ${changes[projection.change]}` : null
    ].filter((value): value is string => value !== null).join(" · ");
    const tr = create("tr");
    append(tr, create("th", "technical-field", row.name),
      create("td", "technical-value", item.original ? text(row.original) : "No disponible"),
      create("td", "technical-value", item.published ? text(row.finish) : "No aplica"),
      create("td", "technical-value", item.commercial ? text(row.commercial) : "No aplica"),
      create("td", "technical-status", status || "Sin comparación"));
    append(body, tr);
  }
  if (item.commercial?.categorySellID !== null && item.commercial?.categorySellID !== undefined) {
    const tr = create("tr");
    append(tr, create("th", "technical-field", "Identificador de categoría comercial"),
      create("td", "technical-value", "No aplica"), create("td", "technical-value", "No aplica"),
      create("td", "technical-value", String(item.commercial.categorySellID)),
      create("td", "technical-status", "Solo en salida comercial"));
    append(body, tr);
  }
  if (body.childElementCount) {
    append(table, body);
    append(region, table);
    append(section, region);
  } else append(section, create("p", "muted-copy", "No constan datos de categoría ni precio en las etapas disponibles."));
  const attributes = renderCommercialAttributes(item);
  if (attributes) append(section, attributes);
  else if (!item.commercial) append(section, create("p", "muted-copy", "No se generó salida comercial para esta ficha."));
  return section;
};
export const renderTechnicalContribution = (item: PanelExplorerProduct): HTMLElement | null => {
  if (!item.original || !item.published) return null;
  const metrics = explorerProductMetrics(item);
  const changes: string[] = [];
  if (metrics.technicalAdditions) changes.push(`${formatNumber.format(metrics.technicalAdditions)} especificaciones incorporadas`);
  if (metrics.technicalChanges) changes.push(`${formatNumber.format(metrics.technicalChanges)} valores técnicos modificados`);
  if (!changes.length) return null;
  return create("p", "explorer-contribution", `Original → FINISH · ${changes.join(" · ")}`);
};
