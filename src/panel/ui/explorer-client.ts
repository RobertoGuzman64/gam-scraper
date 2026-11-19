import type { PanelDashboardPayload } from "../application/dashboard-data.js";
import { explorerProductMetrics, selectExplorerProducts } from "../explorer/explorer-selection.js";
import type { ExplorerSelection, ExplorerSort } from "../explorer/explorer-selection.js";
import type { PanelExplorerProduct, PanelPresentationCase, PanelFieldDifference, PanelFieldProvenance } from "../explorer/types.js";
import { renderStageCards } from "./explorer-stage-cards.js";
import type { PanelArtifact, PanelProviderId } from "../evidence/types.js";

type Scope = PanelProviderId | "todos";
type Stage = PanelExplorerProduct["stage"] | "todos";

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
const select = (id: string): HTMLSelectElement => {
  const node = find(id);
  if (!(node instanceof HTMLSelectElement)) throw new Error(`Selector inválido: ${id}`);
  return node;
};
const input = (id: string): HTMLInputElement => {
  const node = find(id);
  if (!(node instanceof HTMLInputElement)) throw new Error(`Campo inválido: ${id}`);
  return node;
};
const checkbox = (id: string): HTMLInputElement => {
  const node = input(id);
  if (node.type !== "checkbox") throw new Error(`Filtro inválido: ${id}`);
  return node;
};
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
const sourceLink = (artifact: PanelArtifact, title: string): HTMLElement => {
  if (!/^(?:catalogs|data\/editorial\/knowledge)\/[a-zA-Z0-9_./-]+$/.test(artifact.path) ||
    artifact.path.split("/").some((part) => part === "." || part === "..") || !/^[a-f0-9]{64}$/.test(artifact.sha256)) {
    throw new Error("Artefacto sin ruta segura");
  }
  const row = create("div", "explorer-source");
  const link = create("a", "explorer-link local-proof-link", artifact.path);
  link.dataset.localHref = encodeURI(`../${artifact.path}`);
  link.title = "Evidencia local: activar enlaces del repositorio para abrir";
  if (document.documentElement.dataset.localEvidence === "enabled") link.href = link.dataset.localHref;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  append(row, create("strong", "", title), link, create("code", "", `SHA256 ${artifact.sha256}`));
  return row;
};
const newButton = (label: string, fn: () => void, className = ""): HTMLButtonElement => {
  const node = create("button", className, label);
  node.type = "button";
  node.addEventListener("click", fn);
  return node;
};
const proofAccess = (): HTMLElement => {
  const row = create("div", "explorer-proof-access");
  row.dataset.localEvidenceHint = "true";
  append(row, create("span", "", "Los archivos del corte se abren desde el repositorio."),
    newButton("Activar enlaces locales", () => window.dispatchEvent(new Event("panel:enable-local-evidence"))));
  row.hidden = document.documentElement.dataset.localEvidence === "enabled";
  return row;
};
const descriptionPanel = (label: string, description: string | null, unavailable: string): HTMLElement => {
  const panel = create("article", "description-panel");
  append(panel, create("h4", "", label), create("div", "description-body", description === null || description === "" ? unavailable : description));
  return panel;
};
const renderDescriptions = (item: PanelExplorerProduct): HTMLElement => {
  const section = create("section", "detail-section description-section");
  append(section, create("span", "section-kicker", "CONTENIDO COMPLETO"), create("h3", "", "Descripciones, sin recortes"));
  for (const [title, field] of [["Descripción corta", "shortDescription"], ["Descripción general", "generalDescription"]] as const) {
    const group = create("details", "description-group");
    append(group, create("summary", "description-group-title", title));
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
    append(group, columns);
    append(section, group);
  }
  return section;
};
const renderSpecifications = (item: PanelExplorerProduct): HTMLElement => {
  const section = create("section", "detail-section technical-section");
  append(section, create("span", "section-kicker", "PRESTACIONES TÉCNICAS"), create("h3", "", "Especificaciones alineadas por campo"),
    create("p", "minor-note", "Claves normalizadas para comparar; los valores originales conservan sus unidades. Las correspondencias ambiguas no se fuerzan."));
  const technical = item.changes.filter((difference) => difference.group === "technical");
  const source = item.published ? technical : Object.entries(item.original?.specs ?? {}).map(([field, value]): PanelFieldDifference => ({
    field, group: "technical", change: "unchanged", before: Array.isArray(value) ? value.join(" · ") : String(value), after: null
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
  const relevant = fields.filter((field) => !item.published || originalToFinish.get(field)?.change !== "unchanged" ||
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
const renderCommercialAttributes = (item: PanelExplorerProduct): HTMLElement => {
  const section = create("section", "detail-section attributes-section");
  append(section, create("span", "section-kicker", "PROYECCIÓN COMERCIAL"), create("h3", "", "Atributos comerciales aceptados"));
  if (!item.commercial) {
    append(section, create("p", "muted-copy", "No aplica: no se generó producto comercial para esta ficha."));
    return section;
  }
  if (!item.commercial.attributes.length) {
    append(section, create("p", "muted-copy", "Este producto no presenta atributos comerciales aceptados."));
    return section;
  }
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
const renderDecision = (item: PanelExplorerProduct): HTMLElement => {
  const section = create("section", "detail-decision");
  append(section, create("span", "section-kicker", "RESULTADO Y TOMA DE DECISIÓN"),
    create("h3", "", "Resultado acreditado del expediente"));
  if (item.decision?.stage === "editorial") {
    append(section, create("strong", "decision-result", "Excluida de la publicación técnica"),
      create("p", "", item.decision.reason));
    for (const issue of item.decision.issues) append(section, create("p", "decision-issue", issue));
    for (const url of item.decision.evidenceUrls) if (verifiedUrl(url)) append(section, linkTo(url, "Consultar evidencia de la exclusión ↗"));
    append(section, create("p", "minor-note", "Motivo obtenido de la acreditación editorial vigente de este corte."));
  } else if (item.decision?.stage === "commercial") {
    append(section, create("strong", "decision-result", "Publicada técnicamente; excluida de la proyección comercial"),
      create("p", "", item.decision.reason),
      create("p", "minor-note", "Motivo declarado por la exportación comercial; no es una exclusión editorial."));
  } else {
    append(section, create("strong", "decision-result", "Publicada en FINISH y presente en la exportación comercial"),
      create("p", "", "La presencia en las salidas queda acreditada por los artefactos de este corte."),
      create("p", "minor-note", "La causa individual de una transformación solo se atribuye cuando existe evidencia suficiente."));
  }
  return section;
};

const provenanceFor = (item: PanelExplorerProduct, difference: PanelFieldDifference): PanelFieldProvenance | null =>
  item.provenance.find((entry) => entry.group === difference.group && entry.field === difference.field &&
    entry.publicationSha256 === item.evidence.publication?.sha256) ?? null;
const fieldPriority = (item: PanelExplorerProduct, difference: PanelFieldDifference): number => {
  const change = difference.change === "added" ? 0 : difference.change === "changed" ? 1 :
    difference.change === "ambiguous" ? 2 : 3;
  const status = provenanceFor(item, difference)?.status;
  const proof = status === "source-compatible" ? 0 : status === "mechanism-compatible" ? 1 : 2;
  return change * 10 + proof * 3 + (difference.group === "technical" ? 0 : 1);
};
const meaningfulChanges = (item: PanelExplorerProduct): readonly PanelFieldDifference[] =>
  item.changes.filter((difference) => difference.change !== "unchanged")
    .sort((a, b) => fieldPriority(item, a) - fieldPriority(item, b) || a.field.localeCompare(b.field, "es"));
const fieldText = (value: string | null, missing: string): HTMLElement => {
  if (value === null || value === "") return create("p", "field-value-empty", missing);
  if (value.length < 220) return create("p", "field-value", value);
  const details = create("details", "field-value-expand");
  append(details, create("summary", "", `Ver valor íntegro (${formatNumber.format(value.length)} caracteres)`),
    create("p", "field-value", value));
  return details;
};
const renderFieldStory = (item: PanelExplorerProduct): HTMLElement => {
  const section = create("section", "field-story");
  append(section, create("span", "section-kicker", "E5 / LA HISTORIA DEL DATO"),
    create("h3", "", "Un cambio y su procedencia"));
  if (!item.original || !item.published) {
    append(section, create("p", "muted-copy", item.published ?
      "No hay un original verificable para comparar esta publicación." :
      "La ficha no llegó a FINISH: no hay incorporaciones publicadas que atribuir."));
    return section;
  }
  const fields = meaningfulChanges(item);
  if (!fields.length) {
    append(section, create("p", "muted-copy", "Sin diferencias de contenido o especificaciones entre original y FINISH."));
    return section;
  }
  const controls = create("div", "field-story-controls");
  const selection = create("div", "field-story-selection");
  selection.setAttribute("aria-label", "Datos observados de la ficha");
  const detail = create("article", "field-story-proof");
  detail.setAttribute("aria-live", "polite");
  const buttons: HTMLButtonElement[] = [];
  const selectField = (difference: PanelFieldDifference): void => {
    for (const button of buttons) button.setAttribute("aria-pressed", String(button.dataset.field === `${difference.group}:${difference.field}`));
    detail.replaceChildren();
    const provenance = provenanceFor(item, difference);
    const status = provenance?.status ?? "observed-only";
    const statusLabel = status === "source-compatible" ? "Fuente del expediente compatible" :
      status === "mechanism-compatible" ? "Normalización compatible con regla vigente" :
      "Cambio observado; origen individual no acreditado";
    append(detail, create("span", `field-story-status field-status-${status}`, statusLabel),
      create("h4", "", difference.field), create("p", "field-story-change", `${changes[difference.change]} · Original → FINISH`));
    const values = create("div", "field-story-values");
    const before = create("div", "field-story-value");
    append(before, create("strong", "", "Recibido del proveedor"), fieldText(difference.before, "No consta en el campo comparable"));
    const after = create("div", "field-story-value");
    append(after, create("strong", "", "Resultado FINISH"), fieldText(difference.after, "No consta en FINISH"));
    append(values, before, after);
    append(detail, values);
    if (provenance && provenance.status !== "observed-only" && provenance.proof) {
      append(detail, create("p", "field-story-scope", `Alcance acreditable: ${provenance.scope === "unit" ?
        "registro vinculado a esta unidad/original" : "no determinado"}. Campo de la fuente: ${provenance.sourceField ?? "No consta"}.`));
      if (provenance.sourceField && provenance.sourceValue !== null) {
        const sourceValue = create("div", "field-story-source-value");
        append(sourceValue, create("strong", "", `Valor vinculado a la fuente · ${provenance.sourceField}`),
          fieldText(provenance.sourceValue, "No consta"));
        append(detail, sourceValue);
      }
      if (provenance.mechanism) append(detail, create("p", "minor-note", `Mecanismo compatible definido en ${provenance.mechanism}. No consta su ejecución histórica individual.`));
      if (provenance.sourceDigest) append(detail, create("code", "field-story-digest", `Huella editorial del origen: ${provenance.sourceDigest}`));
      append(detail, sourceLink(provenance.proof, "Ver prueba del expediente"));
      if (item.evidence.original && item.evidence.original.path !== provenance.proof.path) {
        append(detail, sourceLink(item.evidence.original, "Consultar original del proveedor"));
      }
      append(detail, create("p", "field-story-limit", "Fuente compatible con este dato. No consta qué regla se ejecutó históricamente ni se acredita una causa única."));
    } else {
      append(detail, create("p", "field-story-limit", "Cambio contrastado entre original y FINISH; su causa individual no está acreditada."));
      if (item.evidence.original) append(detail, sourceLink(item.evidence.original, "Consultar original verificable"));
    }
    if (detail.querySelector(".local-proof-link")) append(detail, proofAccess());
  };
  fields.forEach((difference, index) => {
    const button = newButton(`${changes[difference.change]} · ${difference.field}`, () => selectField(difference), "field-choice");
    button.dataset.field = `${difference.group}:${difference.field}`;
    button.setAttribute("aria-pressed", "false");
    buttons.push(button);
    if (index === 0) append(selection, button);
  });
  if (fields.length > 1) {
    const more = create("details", "field-story-more");
    const moreOptions = create("div", "field-story-more-list");
    for (const button of buttons.slice(1)) append(moreOptions, button);
    append(more, create("summary", "", `Otros cambios (${formatNumber.format(fields.length - 1)})`), moreOptions);
    append(selection, more);
  }
  append(controls, selection, detail);
  append(section, controls);
  const initial = fields[0];
  if (initial) selectField(initial);
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

let scope: Scope = "todos";
let stage: Stage = "todos";
let query = "";
let category = "todos";
let sort: ExplorerSort = "most-differences";
let missingOriginalDescription = false;
let withoutOriginalSpecs = false;
let withTechnicalAdditions = false;
let withEditorialChanges = false;
let page = 0;
let selectedId: string | null = null;
const pageSize = 18;
const visibleProducts = (): readonly PanelExplorerProduct[] => {
  const selection: ExplorerSelection = {
    providerId: scope, stage, category, query, sort,
    missingOriginalDescription, withoutOriginalSpecs, withTechnicalAdditions, withEditorialChanges
  };
  return selectExplorerProducts(products, selection);
};
const reconcileSelection = (preferFirst = false): void => {
  const visible = visibleProducts();
  if (preferFirst || !selectedId || !visible.some((item) => item.identity === selectedId)) {
    selectedId = visible[0]?.identity ?? null;
  }
  if (selectedId) page = Math.max(0, Math.floor(visible.findIndex((item) => item.identity === selectedId) / pageSize));
};
const resetRefinements = (): void => {
  missingOriginalDescription = false;
  withoutOriginalSpecs = false;
  withTechnicalAdditions = false;
  withEditorialChanges = false;
  for (const id of ["explorer-missing-description", "explorer-without-specs", "explorer-with-additions", "explorer-editorial-changes"]) {
    checkbox(id).checked = false;
  }
};
const refreshCategories = (): void => {
  const menu = select("explorer-category");
  const options = [...new Set(products.filter((item) => scope === "todos" || item.providerId === scope)
    .map((item) => item.category).filter((value): value is string => value !== null))]
    .sort((a, b) => a.localeCompare(b, "es"));
  if (category !== "todos" && !options.includes(category)) category = "todos";
  menu.replaceChildren();
  const all = create("option", "", "Todas las categorías");
  all.value = "todos";
  append(menu, all);
  for (const name of options) {
    const option = create("option", "", name);
    option.value = name;
    append(menu, option);
  }
  menu.value = category;
};
const renderActiveFilters = (): void => {
  const target = find("explorer-active-filters");
  target.replaceChildren();
  const active: { label: string; clear: () => void }[] = [];
  if (scope !== "todos") active.push({ label: `Proveedor: ${names[scope]}`, clear: () => {
    const provider = select("provider-filter");
    provider.value = "todos";
    provider.dispatchEvent(new Event("change", { bubbles: true }));
  } });
  if (query) active.push({ label: `Búsqueda: ${query}`, clear: () => {
    query = "";
    input("explorer-search").value = "";
  } });
  if (category !== "todos") active.push({ label: `Categoría: ${category}`, clear: () => {
    category = "todos";
    select("explorer-category").value = "todos";
  } });
  if (stage !== "todos") active.push({ label: `Etapa: ${stages[stage]}`, clear: () => {
    stage = "todos";
    select("explorer-stage").value = "todos";
  } });
  for (const [enabled, label, control] of [
    [missingOriginalDescription, "Descripción ausente", "explorer-missing-description"],
    [withoutOriginalSpecs, "Sin especificaciones", "explorer-without-specs"],
    [withTechnicalAdditions, "Con incorporaciones", "explorer-with-additions"],
    [withEditorialChanges, "Descripciones cambiadas", "explorer-editorial-changes"]
  ] as const) {
    if (!enabled) continue;
    active.push({ label, clear: () => {
      checkbox(control).checked = false;
      if (control === "explorer-missing-description") missingOriginalDescription = false;
      else if (control === "explorer-without-specs") withoutOriginalSpecs = false;
      else if (control === "explorer-with-additions") withTechnicalAdditions = false;
      else withEditorialChanges = false;
    } });
  }
  const heading = create("div", "explorer-filter-heading");
  append(heading, create("strong", "", "Filtros activos"));
  if (active.length) append(heading, newButton("Limpiar", () => {
    query = "";
    category = "todos";
    stage = "todos";
    input("explorer-search").value = "";
    select("explorer-stage").value = "todos";
    select("explorer-category").value = "todos";
    resetRefinements();
    page = 0;
    if (scope !== "todos") {
      const provider = select("provider-filter");
      provider.value = "todos";
      provider.dispatchEvent(new Event("change", { bubbles: true }));
    } else {
      reconcileSelection(true);
      renderExplorer();
    }
  }, "explorer-clear-filters"));
  target.hidden = active.length === 0;
  if (active.length) {
    append(target, heading);
    const chips = create("div", "explorer-filter-chips");
    for (const filter of active) {
      const chip = newButton(`${filter.label} ×`, () => {
        filter.clear();
        page = 0;
        reconcileSelection();
        renderExplorer();
      }, "explorer-filter-chip");
      chip.setAttribute("aria-label", `Quitar filtro ${filter.label}`);
      append(chips, chip);
    }
    append(target, chips);
  }
  const more = find("explorer-extra-count");
  const advanced = [stage !== "todos", missingOriginalDescription, withoutOriginalSpecs,
    withTechnicalAdditions, withEditorialChanges].filter(Boolean).length;
  more.textContent = advanced ? ` · ${advanced} activos` : "";
  for (const option of select("explorer-sort").options) {
    option.disabled = (stage === "commercial-excluded" || stage === "editorial-excluded") && option.value !== "reference";
  }
};
const renderRows = (): void => {
  const filtered = visibleProducts();
  const list = find("explorer-list");
  list.replaceChildren();
  const lastPage = Math.max(0, Math.ceil(filtered.length / pageSize) - 1);
  page = Math.min(page, lastPage);
  const totalInScope = products.filter((item) => scope === "todos" || item.providerId === scope).length;
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
    const button = newButton("", () => { selectedId = item.identity; renderRows(); renderDetail(); showSelectionOnMobile(); },
      `product-row ${selectedId === item.identity ? "selected" : ""}`);
    button.setAttribute("aria-pressed", String(selectedId === item.identity));
    const top = create("span", "product-row-top");
    append(top, create("strong", "", item.reference ?? "Sin referencia"));
    if (item.stage !== "commercial") append(top,
      create("span", `product-status product-${item.stage}`, stages[item.stage]));
    append(button, top, create("span", "product-title", item.published?.title ?? item.original?.title ?? "Sin título"),
      create("small", "product-context", `${names[item.providerId]} · ${item.category ?? "Categoría no disponible"}`));
    if (item.original && item.published) {
      const metrics = explorerProductMetrics(item);
      const summary = create("span", "product-impact");
      if (metrics.technicalAdditions > 0) append(summary,
        create("strong", "product-impact-additions", `+${formatNumber.format(metrics.technicalAdditions)} incorporadas`));
      if (metrics.technicalChanges > 0) append(summary,
        create("span", "product-impact-changes", `${formatNumber.format(metrics.technicalChanges)} valores modificados`));
      append(summary, create("span", "product-impact-differences", metrics.observedDifferences > 0 ?
        `${formatNumber.format(metrics.observedDifferences)} diferencias` : "Sin diferencias observadas"));
      append(button, summary);
    }
    append(list, button);
  }
};
const renderDifferences = (label: string, items: readonly PanelFieldDifference[]): HTMLElement => {
  const region = create("div", "compare-region");
  const observed = items.filter((item) => item.change !== "unchanged");
  const preserved = items.filter((item) => item.change === "unchanged");
  append(region, create("h3", "", label), create("p", "minor-note", `${observed.length} diferencias o correspondencias ambiguas · ${preserved.length} campos conservados`));
  if (!items.length) {
    append(region, create("p", "muted-copy", "Comparación no disponible para este corte o esta etapa."));
    return region;
  }
  const tableOf = (entries: readonly PanelFieldDifference[]): HTMLElement => {
    const wrapper = create("div", "scroll-table");
    const table = create("table", "data-table difference-table");
    const header = create("thead");
    const tr = create("tr");
    for (const title of ["CAMPO", "ESTADO", "ANTES", "DESPUÉS"]) append(tr, create("th", "", title));
    append(header, tr);
    append(table, header);
    const body = create("tbody");
    for (const item of entries) {
      const row = create("tr");
      append(row, create("th", "diff-name", item.field), create("td", `diff-label diff-${item.change}`, changes[item.change]),
        create("td", "diff-content", text(item.before)), create("td", "diff-content", text(item.after)));
      append(body, row);
    }
    append(table, body);
    append(wrapper, table);
    return wrapper;
  };
  if (observed.length) append(region, tableOf(observed));
  else append(region, create("p", "muted-copy", "No hay diferencias de valor observadas en estos campos."));
  if (preserved.length) {
    const details = create("details", "preserved-fields");
    append(details, create("summary", "", `Ver ${formatNumber.format(preserved.length)} campos conservados`), tableOf(preserved));
    append(region, details);
  }
  return region;
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
  append(heading, create("span", "section-kicker", `${names[item.providerId]} · ${stages[item.stage]}`),
    create("h2", "", item.published?.title ?? item.original?.title ?? "Máquina sin título"),
    create("p", "", `Referencia: ${item.reference ?? "No consta"}`));
  if (verifiedUrl(item.sourceUrl)) append(heading, linkTo(item.sourceUrl, "Abrir ficha del proveedor"));

  append(target, heading);
  if (item.decision) append(target, create("p", "explorer-decision-summary", item.decision.reason));
  append(target, renderStageCards(item));
  const contribution = renderTechnicalContribution(item);
  if (contribution) append(target, contribution);
  const story = create("details", "explorer-provenance-disclosure");
  append(story, create("summary", "", "Ver procedencia de los cambios"), renderFieldStory(item));
  append(target, story);
  const full = create("details", "full-record");
  append(full, create("summary", "", "Abrir ficha completa · textos, especificaciones y diferencias"));
  append(full, renderDescriptions(item), renderSpecifications(item), renderCommercialAttributes(item),
    create("h3", "diff-heading", "Diferencias en otros campos"));
  if (!item.original && item.published) append(full, create("p", "evidence-warning", "No existe original verificable para este corte. No se muestran diferencias imaginadas."));
  const technicalKeys = new Set(item.commercialTechnicalChanges.map((difference) => difference.field));
  const editorialDifferences = item.changes.filter((difference) => difference.group === "content" &&
    difference.field !== "Descripción corta" && difference.field !== "Descripción general");
  const commercialDifferences = item.commercialChanges.filter((difference) =>
    !technicalKeys.has(difference.field) && !difference.field.startsWith("Atributo comercial #"));
  append(full, renderDifferences("Original → FINISH · título, categoría y precio", editorialDifferences),
    renderDifferences("FINISH → Comercial · identificación y datos generales", commercialDifferences));
  append(target, full);
  const provenance = create("section", "detail-evidence");
  append(provenance, create("span", "section-kicker", "RESOLUCIÓN Y AUDITORÍA"));
  const decision = create("details", "explorer-decision-detail");
  append(decision, create("summary", "", "Ver decisión acreditada y motivos"), renderDecision(item));
  append(provenance, decision);
  const artifacts = create("details", "audit-artifacts");
  append(artifacts, create("summary", "", "Ver artefactos íntegros y huellas SHA256"));
  for (const [label, artifact] of [["Original verificado", item.evidence.original],
    ["Publicación acreditada", item.evidence.publication], ["JSON comercial", item.evidence.commercial],
    ["Acreditación editorial", item.evidence.accreditation]] as const) {
    if (artifact) append(artifacts, sourceLink(artifact, label));
  }
  if (!item.evidence.original) append(artifacts, create("p", "evidence-warning", "No hay original verificado para esta identidad o exclusión sin original conservado."));
  append(provenance, artifacts);
  append(target, provenance);
};
const renderExplorer = (): void => { reconcileSelection(); renderActiveFilters(); renderRows(); renderDetail(); };
const showSelectionOnMobile = (): void => {
  if (!window.matchMedia("(max-width: 750px)").matches) return;
  const target = find("explorer-detail");
  target.setAttribute("tabindex", "-1");
  target.focus({ preventScroll: true });
  target.scrollIntoView({ block: "start" });
};
const chooseCase = (item: PanelPresentationCase): void => {
  const record = productsById.get(item.identity);
  if (!record) return;
  const selectProvider = select("provider-filter");
  selectProvider.value = item.providerId;
  selectProvider.dispatchEvent(new Event("change", { bubbles: true }));
  stage = "todos";
  category = "todos";
  query = "";
  sort = "reference";
  input("explorer-search").value = "";
  select("explorer-stage").value = "todos";
  select("explorer-sort").value = sort;
  resetRefinements();
  refreshCategories();
  selectedId = item.identity;
  page = Math.max(0, Math.floor(visibleProducts().findIndex((entry) => entry.identity === selectedId) / pageSize));
  renderExplorer();
  window.dispatchEvent(new CustomEvent("panel:request-view", { detail: "explorador" }));
  showSelectionOnMobile();
};

input("explorer-search").addEventListener("input", () => {
  query = input("explorer-search").value.trim();
  page = 0;
  reconcileSelection();
  renderExplorer();
});
select("explorer-stage").addEventListener("change", () => {
  const selected = select("explorer-stage").value;
  stage = selected === "commercial" || selected === "commercial-excluded" || selected === "editorial-excluded" ? selected : "todos";
  if (stage === "commercial-excluded" || stage === "editorial-excluded") {
    sort = "reference";
    select("explorer-sort").value = sort;
  }
  page = 0;
  reconcileSelection();
  renderExplorer();
});
select("explorer-category").addEventListener("change", () => {
  category = select("explorer-category").value;
  page = 0;
  reconcileSelection();
  renderExplorer();
});
select("explorer-sort").addEventListener("change", () => {
  const chosen = select("explorer-sort").value;
  if (chosen !== "most-differences" && chosen !== "fewest-original-specs" &&
    chosen !== "most-technical-additions" && chosen !== "most-technical-changes" && chosen !== "reference") return;
  sort = chosen;
  page = 0;
  reconcileSelection(true);
  renderExplorer();
});
for (const [id, set] of [
  ["explorer-missing-description", (value: boolean): void => { missingOriginalDescription = value; }],
  ["explorer-without-specs", (value: boolean): void => { withoutOriginalSpecs = value; }],
  ["explorer-with-additions", (value: boolean): void => { withTechnicalAdditions = value; }],
  ["explorer-editorial-changes", (value: boolean): void => { withEditorialChanges = value; }]
] as const) {
  checkbox(id).addEventListener("change", () => {
    set(checkbox(id).checked);
    page = 0;
    reconcileSelection(true);
    renderExplorer();
  });
}
const changePage = (offset: number): void => {
  const visible = visibleProducts();
  const lastPage = Math.max(0, Math.ceil(visible.length / pageSize) - 1);
  page = Math.max(0, Math.min(lastPage, page + offset));
  selectedId = visible[page * pageSize]?.identity ?? null;
  renderRows();
  renderDetail();
};
find("explorer-show-selected").addEventListener("click", showSelectionOnMobile);
window.addEventListener("panel:local-evidence-updated", () => {
  const enabled = document.documentElement.dataset.localEvidence === "enabled";
  for (const hint of document.querySelectorAll<HTMLElement>("[data-local-evidence-hint]")) hint.hidden = enabled;
});
find("explorer-page-prev").addEventListener("click", () => changePage(-1));
find("explorer-page-next").addEventListener("click", () => changePage(1));
window.addEventListener("panel:scope", (event: Event) => {
  if (!(event instanceof CustomEvent)) return;
  const next: unknown = event.detail;
  if (next !== "todos" && next !== "gam" && next !== "gomariz" && next !== "mercaeleva") return;
  scope = next;
  page = 0;
  refreshCategories();
  reconcileSelection();
  renderExplorer();
});
window.addEventListener("panel:request-case", (event: Event) => {
  if (!(event instanceof CustomEvent)) return;
  const identity: unknown = event.detail;
  if (typeof identity !== "string") return;
  const selected = data.explorer.cases.find((candidate) => candidate.identity === identity);
  if (selected) chooseCase(selected);
});
refreshCategories();
renderExplorer();
