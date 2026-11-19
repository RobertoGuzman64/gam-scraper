import type { PanelDashboardPayload } from "../application/dashboard-data.js";
import { createExplorerIndex, explorerProductMetrics, selectExplorerProducts } from "../explorer/explorer-selection.js";
import { createExplorerFilterControls } from "./explorer-filter-controls.js";
import type { PanelExplorerProduct, PanelPresentationCase, PanelFieldDifference } from "../explorer/types.js";
import { renderStageCards } from "./explorer-stage-cards.js";

const find = (id: string): HTMLElement => {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Explorador sin control: ${id}`);
  return node;
};
const create = <K extends keyof HTMLElementTagNameMap>(tag: K, className = "", value?: string): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (value !== undefined) node.textContent = value;
  return node;
};
const append = (parent: HTMLElement, ...nodes: (Node | string)[]): void => parent.append(...nodes);
const text = (value: string | number | boolean | null): string => value === null || value === "" ? "No consta" : String(value);
const payloadNode = document.getElementById("panel-data")?.textContent;
if (!payloadNode) throw new Error("Sin datos para explorar fichas");
const parsed: unknown = JSON.parse(payloadNode);
const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const valid = (value: unknown): value is PanelDashboardPayload =>
  isRecord(value) && isRecord(value.explorer) && Array.isArray(value.explorer.products) &&
  Array.isArray(value.explorer.cases) && isRecord(value.names);
if (!valid(parsed)) throw new Error("Contrato de explorador incompleto");
const data = parsed;
const products = data.explorer.products;
const productsById = new Map(products.map((item) => [item.identity, item]));
const names = data.names;
const stages: Readonly<Record<PanelExplorerProduct["stage"], string>> = {
  commercial: "Exportada", "commercial-excluded": "Excluida comercial", "editorial-excluded": "Excluida editorial"
};
const changes: Readonly<Record<PanelFieldDifference["change"], string>> = {
  added: "Incorporado", changed: "Modificado", unchanged: "Conservado", removed: "Retirado", ambiguous: "Sin correspondencia unívoca"
};
const formatNumber = new Intl.NumberFormat("es-ES");
const verifiedUrl = (value: string): boolean => {
  try { return ["https:", "http:"].includes(new URL(value).protocol); }
  catch { return false; }
};
const linkTo = (href: string, label: string): HTMLAnchorElement => {
  const anchor = create("a", "explorer-link", label);
  anchor.href = href;
  anchor.target = "_blank";
  anchor.rel = "noopener noreferrer";
  return anchor;
};
const newButton = (label: string, fn: () => void, className = ""): HTMLButtonElement => {
  const node = create("button", className, label);
  node.type = "button";
  node.addEventListener("click", fn);
  return node;
};
const descriptionPanel = (label: string, description: string | null, unavailable: string): HTMLElement => {
  const panel = create("article", "description-panel");
  append(panel, create("h4", "", label), create("div", "description-body", description === null || description === "" ? unavailable : description));
  return panel;
};
const renderDescriptions = (item: PanelExplorerProduct, field: "shortDescription" | "generalDescription"): HTMLElement => {
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
const renderTitle = (item: PanelExplorerProduct): HTMLElement => {
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
const comparisonState = (
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
const compareSection = (label: string, status: string, content: HTMLElement, initiallyOpen = false): HTMLElement => {
  const section = create("details", "comparison-group");
  section.open = initiallyOpen;
  const heading = create("summary", "comparison-group-title");
  append(heading, create("span", "", label), create("span", "comparison-group-state", status));
  append(section, heading, content);
  return section;
};
const contentDifference = (item: PanelExplorerProduct, field: string): readonly PanelFieldDifference[] =>
  item.changes.filter((entry) => entry.group === "content" && entry.field === field);
const commercialDifference = (item: PanelExplorerProduct, field: string): readonly PanelFieldDifference[] =>
  item.commercialChanges.filter((entry) => entry.field === field);
const renderSpecifications = (item: PanelExplorerProduct): HTMLElement => {
  const section = create("section", "detail-section technical-section");
  append(section, create("p", "minor-note", "Especificaciones alineadas por campo. Claves normalizadas para comparar; los valores originales conservan sus unidades. Las correspondencias ambiguas no se fuerzan."));
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
  const finishToCommercial = new Map(item.commercialTechnicalChanges.map((difference) => [difference.field, difference]));
  const fields = [...new Set([...originalToFinish.keys(), ...finishToCommercial.keys()])].sort((a, b) => a.localeCompare(b, "es"));
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
      const before = item.original ? text(edit?.before ?? null) : "Evidencia no disponible";
      const after = item.published ? text(edit?.after ?? projection?.before ?? null) : "No aplica";
      const commercial = item.commercial ? text(projection?.after ?? null) : "No aplica";
      const classification = !item.original || !item.published ? "Sin comparación editorial" :
        edit ? changes[edit.change] : "No consta en original/FINISH";
      const commercialStatus = projection && projection.change !== "unchanged" ? ` · Comercial: ${changes[projection.change]}` : "";
      append(result, create("th", "technical-field", field), create("td", "technical-value", before),
        create("td", "technical-value", after), create("td", "technical-value", commercial),
        create("td", `technical-status ${edit && item.original && item.published ? `diff-${edit.change}` : ""}`,
          classification + commercialStatus));
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
const renderCommercialData = (item: PanelExplorerProduct): HTMLElement => {
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
const renderTechnicalContribution = (item: PanelExplorerProduct): HTMLElement | null => {
  if (!item.original || !item.published) return null;
  const metrics = explorerProductMetrics(item);
  const changes: string[] = [];
  if (metrics.technicalAdditions) changes.push(`${formatNumber.format(metrics.technicalAdditions)} especificaciones incorporadas`);
  if (metrics.technicalChanges) changes.push(`${formatNumber.format(metrics.technicalChanges)} valores técnicos modificados`);
  if (!changes.length) return null;
  return create("p", "explorer-contribution", `Original → FINISH · ${changes.join(" · ")}`);
};

const index = createExplorerIndex(products);
let page = 0;
let selectedId: string | null = null;
let renderedId: string | null = null;
const pageSize = 30;
const filters = createExplorerFilterControls(index, names, () => {
  page = 0;
  reconcileSelection();
  renderExplorer();
});
const visibleProducts = (): readonly PanelExplorerProduct[] =>
  selectExplorerProducts(products, filters.selection(), index);
const reconcileSelection = (): void => {
  const visible = visibleProducts();
  if (!selectedId || !visible.some((item) => item.identity === selectedId)) {
    selectedId = visible[0]?.identity ?? null;
  }
  if (selectedId) page = Math.max(0, Math.floor(visible.findIndex((item) => item.identity === selectedId) / pageSize));
};
const showSelectionForDesktop = (): void => {
  if (window.matchMedia("(max-width: 1250px)").matches) return;
  const detail = find("explorer-detail");
  const position = detail.getBoundingClientRect();
  if (position.top < 0 || position.top >= window.innerHeight) {
    detail.scrollIntoView({ block: "start", behavior: "instant" });
  }
};
const renderRows = (): void => {
  const filtered = visibleProducts();
  const list = find("explorer-list");
  list.replaceChildren();
  const lastPage = Math.max(0, Math.ceil(filtered.length / pageSize) - 1);
  page = Math.min(page, lastPage);
  const totalInScope = products.filter((item) => filters.selection().providerId === "todos" || item.providerId === filters.selection().providerId).length;
  find("explorer-counter").textContent = filtered.length === totalInScope ?
    `${formatNumber.format(filtered.length)} fichas` :
    `${formatNumber.format(filtered.length)} de ${formatNumber.format(totalInScope)} fichas`;
  find("explorer-pages-label").textContent = `${filtered.length ? page + 1 : 0} / ${filtered.length ? lastPage + 1 : 0}`;
  const prev = find("explorer-page-prev");
  const next = find("explorer-page-next");
  if (prev instanceof HTMLButtonElement) prev.disabled = page === 0;
  if (next instanceof HTMLButtonElement) next.disabled = page === lastPage;
  const showSelected = find("explorer-show-selected");
  if (showSelected instanceof HTMLButtonElement) showSelected.disabled = !selectedId;
  if (!filtered.length) {
    append(list, create("div", "explorer-empty", "No hay máquinas con estos filtros. Prueba otra referencia o categoría."));
    return;
  }
  for (const item of filtered.slice(page * pageSize, (page + 1) * pageSize)) {
    const button = newButton("", () => { selectedId = item.identity; renderRows(); ensureDetail(); closeCatalogOnMobile(); showSelectionOnMobile(); showSelectionForDesktop(); },
      `product-row ${selectedId === item.identity ? "selected" : ""}`);
    button.setAttribute("aria-pressed", String(selectedId === item.identity));
    const top = create("span", "product-row-top");
    append(top, create("span", "product-row-provider", names[item.providerId]),
      create("strong", "product-row-reference", item.reference ?? "Sin referencia"));
    append(button, top, create("span", "product-title", item.published?.title ?? item.original?.title ?? "Sin título"));
    if (item.stage !== "commercial") append(button,
      create("span", `product-status product-${item.stage}`, stages[item.stage]));
    append(list, button);
  }
};
const renderDetail = (): void => {
  const target = find("explorer-detail");
  target.replaceChildren();
  if (!selectedId) {
    append(target, create("div", "explorer-empty", "Selecciona una máquina del listado o uno de los casos reales."));
    return;
  }
  const item = productsById.get(selectedId);
  if (!item) return;
  const heading = create("div", "detail-header");
  const metadata = create("div", "detail-metadata");
  append(metadata, create("p", "", `Referencia: ${item.reference ?? "No consta"}`),
    create("p", "", `Categoría: ${item.category ?? "No consta"}`));
  append(heading, create("span", "section-kicker", `${names[item.providerId]} · ${stages[item.stage]}`),
    create("h2", "", item.published?.title ?? item.original?.title ?? "Máquina sin título"), metadata);
  if (verifiedUrl(item.sourceUrl)) append(heading, linkTo(item.sourceUrl, "Abrir ficha del proveedor"));

  append(target, heading);
  if (item.decision) {
    const excluded = create("section", "explorer-decision-summary");
    append(excluded, create("strong", "", item.decision.stage === "editorial" ?
      "Excluida de FINISH" : "Excluida de la proyección comercial"), create("p", "", item.decision.reason));
    if (item.decision.issues.length) {
      const issues = create("ul");
      for (const issue of item.decision.issues) append(issues, create("li", "", issue));
      append(excluded, issues);
    }
    for (const url of item.decision.evidenceUrls) {
      if (verifiedUrl(url)) append(excluded, linkTo(url, "Consultar evidencia de la exclusión"));
    }
    append(target, excluded);
  }
  append(target, renderStageCards(item));
  const contribution = renderTechnicalContribution(item);
  if (contribution) append(target, contribution);
  const comparison = create("section", "record-comparison");
  append(comparison, create("span", "section-kicker", "CONTENIDO POR ETAPA"),
    create("h3", "", "Comparar contenido de la ficha"));
  if (!item.original && item.published) append(comparison, create("p", "evidence-warning",
    "No existe original verificable para este corte. No se muestran diferencias imaginadas."));
  append(comparison,
    compareSection("Título", comparisonState(item, contentDifference(item, "Título"), commercialDifference(item, "Título")),
      renderTitle(item), true),
    compareSection("Descripción corta", comparisonState(item, contentDifference(item, "Descripción corta"), []),
      renderDescriptions(item, "shortDescription")),
    compareSection("Especificaciones técnicas", comparisonState(item,
      item.changes.filter((entry) => entry.group === "technical"), item.commercialTechnicalChanges),
      renderSpecifications(item)),
    compareSection("Descripción general", comparisonState(item, contentDifference(item, "Descripción general"), []),
      renderDescriptions(item, "generalDescription")),
    compareSection("Categoría y datos comerciales", comparisonState(item,
      [...contentDifference(item, "Categoría de origen / técnica"), ...contentDifference(item, "Precio declarado")],
      [...commercialDifference(item, "Categoría técnica / comercial"), ...commercialDifference(item, "Precio"),
        ...commercialDifference(item, "Identificador de categoría comercial"),
        ...item.commercialChanges.filter((entry) => entry.field.startsWith("Atributo comercial #"))]),
      renderCommercialData(item)));
  append(target, comparison);
};
const ensureDetail = (): void => {
  if (renderedId === selectedId) return;
  renderDetail();
  renderedId = selectedId;
};
const renderExplorer = (): void => {
  reconcileSelection();
  filters.render();
  renderRows();
  ensureDetail();
};
const catalog = find("explorer-catalog");
const catalogToggle = find("explorer-catalog-toggle");
const closeCatalogOnMobile = (): void => {
  if (!window.matchMedia("(max-width: 1250px)").matches) return;
  catalog.classList.remove("is-open");
  catalogToggle.setAttribute("aria-expanded", "false");
  catalogToggle.textContent = "Mostrar listado";
};
catalogToggle.addEventListener("click", () => {
  const opened = catalog.classList.toggle("is-open");
  catalogToggle.setAttribute("aria-expanded", String(opened));
  catalogToggle.textContent = opened ? "Ocultar listado" : "Mostrar listado";
});
catalog.addEventListener("keydown", (event) => {
  if (event.key !== "Escape" || !catalog.classList.contains("is-open")) return;
  closeCatalogOnMobile();
  catalogToggle.focus();
});
const showSelectionOnMobile = (): void => {
  if (!window.matchMedia("(max-width: 1250px)").matches) return;
  const target = find("explorer-detail");
  target.setAttribute("tabindex", "-1");
  target.focus({ preventScroll: true });
  target.scrollIntoView({ block: "start" });
};
const chooseCase = (item: PanelPresentationCase): void => {
  const record = productsById.get(item.identity);
  if (!record) return;
  filters.resetForCase();
  const provider = document.getElementById("provider-filter");
  if (!(provider instanceof HTMLSelectElement)) throw new Error("Proveedor no disponible");
  provider.value = item.providerId;
  provider.dispatchEvent(new Event("change", { bubbles: true }));
  selectedId = item.identity;
  page = Math.max(0, Math.floor(visibleProducts().findIndex((entry) => entry.identity === selectedId) / pageSize));
  renderExplorer();
  window.dispatchEvent(new CustomEvent("panel:request-view", { detail: "explorador" }));
  showSelectionOnMobile();
};
const changePage = (offset: number): void => {
  const visible = visibleProducts();
  const lastPage = Math.max(0, Math.ceil(visible.length / pageSize) - 1);
  page = Math.max(0, Math.min(lastPage, page + offset));
  selectedId = visible[page * pageSize]?.identity ?? null;
  renderRows();
  ensureDetail();
  catalog.scrollIntoView({ block: "start", behavior: "instant" });
};
find("explorer-show-selected").addEventListener("click", () => { closeCatalogOnMobile(); showSelectionOnMobile(); });
find("explorer-page-prev").addEventListener("click", () => changePage(-1));
find("explorer-page-next").addEventListener("click", () => changePage(1));
window.addEventListener("panel:scope", (event: Event) => {
  if (!(event instanceof CustomEvent)) return;
  const next: unknown = event.detail;
  if (next !== "todos" && next !== "gam" && next !== "gomariz" && next !== "mercaeleva") return;
  filters.updateScope(next);
});
window.addEventListener("panel:request-case", (event: Event) => {
  if (!(event instanceof CustomEvent)) return;
  const identity: unknown = event.detail;
  if (typeof identity !== "string") return;
  const selected = data.explorer.cases.find((candidate) => candidate.identity === identity);
  if (selected) chooseCase(selected);
});
renderExplorer();
