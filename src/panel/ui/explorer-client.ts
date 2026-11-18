import type { PanelDashboardPayload } from "../application/dashboard-data.js";
import type { PanelExplorerProduct, PanelPresentationCase, PanelProductView, PanelCommercialView, PanelFieldDifference, PanelFieldProvenance } from "../explorer/types.js";
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
const caseLabels: Readonly<Record<PanelPresentationCase["focus"], string>> = {
  content: "Texto editorial", technical: "Transformación técnica", commercial: "Proyección comercial", exclusion: "Exclusión acreditada"
};
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
const imagePreview = (record: PanelProductView): HTMLElement | null => {
  const cover = record.image ?? record.images[0];
  if (!cover || !verifiedUrl(cover)) return null;
  const figure = create("div", "record-figure");
  const image = create("img");
  image.src = cover;
  image.loading = "lazy";
  image.referrerPolicy = "no-referrer";
  image.alt = `Imagen de origen o publicación: ${record.title ?? "máquina"}`;
  image.addEventListener("error", () => {
    figure.replaceChildren(create("div", "image-unavailable", "Imagen externa no disponible"));
  });
  append(figure, image, create("span", "", `${formatNumber.format(record.images.length)} imágenes declaradas`));
  return figure;
};
const recordCard = (label: string, record: PanelProductView | PanelCommercialView | null, extra?: PanelCommercialView): HTMLElement => {
  const card = create("article", "record-card");
  append(card, create("span", "section-kicker", label));
  if (!record) {
    append(card, create("div", "record-missing", label.includes("ORIGINAL") ?
      "Evidencia original no disponible" : "Etapa no alcanzada"));
    return card;
  }
  const preview = imagePreview(record);
  if (preview) append(card, preview);
  append(card, create("h3", "record-title", text(record.title)));
  const facts = create("dl", "record-facts");
  for (const [title, value] of [["Categoría", text(record.category)], ["Precio declarado", text(record.price)],
    ["Prestaciones", formatNumber.format(Object.keys(record.specs).length)]] as const) {
    append(facts, create("dt", "", title), create("dd", "", value));
  }
  if (extra) {
    append(facts, create("dt", "", "Categoría comercial (ID)"),
      create("dd", "", extra.categorySellID === null ? "Pendiente" : String(extra.categorySellID)),
      create("dt", "", "Atributos comerciales aceptados"), create("dd", "", String(extra.attributes.length)));
  }
  append(card, facts);
  return card;
};

const descriptionPanel = (label: string, description: string | null, unavailable: string): HTMLElement => {
  const panel = create("article", "description-panel");
  append(panel, create("h4", "", label), create("div", "description-body", description === null || description === "" ? unavailable : description));
  return panel;
};
const renderDescriptions = (item: PanelExplorerProduct): HTMLElement => {
  const section = create("section", "detail-section description-section");
  append(section, create("span", "section-kicker", "CONTENIDO COMPLETO"), create("h3", "", "Descripciones, sin recortes"),
    create("p", "minor-note", "Se muestran los textos íntegros tal como constan en cada etapa; las diferencias no demuestran por sí solas una regla aplicada."));
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
  append(section, create("p", "minor-note", `${formatNumber.format(fields.length)} campos técnicos presentados; los atributos comerciales son una población diferente.`));
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
      create("p", "minor-note", "No consta en los artefactos una motivación individual de cada transformación. El panel muestra cambios observados, no una decisión editorial inferida ni integración en base de datos."));
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
    create("h3", "", "¿De dónde sale este dato?"),
    create("p", "minor-note", "Selecciona una incorporación o modificación. La fuente compatible no equivale a una ejecución histórica acreditada."));
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
      append(detail, create("p", "minor-note", "El HTML autónomo conserva la ruta y el SHA de esta prueba, pero no adjunta el documento. El enlace solo se habilita desde el repositorio; una URL externa puede cambiar."));
      append(detail, create("p", "field-story-limit", "Qué permite afirmar: hay una correspondencia verificable con la fuente indicada. Qué no: la ejecución histórica de la regla ni la causa única de este cambio."));
    } else {
      append(detail, create("p", "field-story-limit", "La diferencia está contrastada entre original y FINISH, pero no existe una fuente individual aplicable que permita atribuir su causa."));
      if (item.evidence.original) append(detail, sourceLink(item.evidence.original, "Consultar original verificable"));
    }
  };
  fields.forEach((difference, index) => {
    const button = newButton(`${changes[difference.change]} · ${difference.field}`, () => selectField(difference), "field-choice");
    button.dataset.field = `${difference.group}:${difference.field}`;
    button.setAttribute("aria-pressed", "false");
    buttons.push(button);
    if (index < 6) append(selection, button);
  });
  if (fields.length > 6) {
    const more = create("details", "field-story-more");
    const moreOptions = create("div", "field-story-more-list");
    for (const button of buttons.slice(6)) append(moreOptions, button);
    append(more, create("summary", "", `Ver otros ${formatNumber.format(fields.length - 6)} cambios`), moreOptions);
    append(selection, more);
  }
  append(controls, selection, detail);
  append(section, controls);
  const initial = fields[0];
  if (initial) selectField(initial);
  return section;
};
const renderChangeSummary = (item: PanelExplorerProduct): HTMLElement => {
  const section = create("section", "change-overview");
  append(section, create("span", "section-kicker", "APORTACIONES Y ESTADO"), create("h3", "", "Qué cambió respecto al origen"));
  const list = create("div", "change-summary-grid");
  const entries = [
    ["Incorporados", item.changes.filter((entry) => entry.change === "added").length],
    ["Modificados", item.changes.filter((entry) => entry.change === "changed").length],
    ["Retirados o ambiguos", item.changes.filter((entry) => entry.change === "removed" || entry.change === "ambiguous").length],
    ["Conservados", item.changes.filter((entry) => entry.change === "unchanged").length]
  ] as const;
  for (const [label, count] of entries) {
    const cell = create("div", "change-summary-cell");
    append(cell, create("strong", "", item.original && item.published ? formatNumber.format(count) : "—"), create("span", "", label));
    append(list, cell);
  }
  append(section, list, create("p", "minor-note", item.original && item.published ?
    "Recuento de campos comparados por el Explorador; no es el total de incorporaciones del informe FINISH." :
    "Sin comparación original → FINISH disponible para esta ficha."));
  if (item.decision) append(section, create("p", "change-decision", `Estado del expediente: ${stages[item.stage]}. Motivo declarado: ${item.decision.reason}`));
  else append(section, create("p", "change-decision", "Publicada en FINISH y exportada comercialmente en el paquete seleccionado; no equivale a importación en BD."));
  return section;
};
const renderCommercialSummary = (item: PanelExplorerProduct): HTMLElement | null => {
  if (!item.commercial) return null;
  const section = create("section", "commercial-summary");
  append(section, create("span", "section-kicker", "SALIDA COMERCIAL · MISMO CORTE"),
    create("h3", "", "Proyección comercial"),
    create("p", "", `Categoría: ${text(item.commercial.category)} · ID: ${text(item.commercial.categorySellID)} · Precio: ${text(item.commercial.price)} · ${formatNumber.format(item.commercial.attributes.length)} atributos aceptados.`),
    create("p", "minor-note", "La proyección no acredita prestaciones técnicas adicionales ni confirma importación en el backend."));
  return section;
};

let scope: Scope = "todos";
let stage: Stage = "todos";
let query = "";
let category = "todos";
let page = 0;
let selectedId: string | null = null;
const pageSize = 18;
const normalized = (value: string): string => value.toLocaleLowerCase("es").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const visibleProducts = (): readonly PanelExplorerProduct[] => products.filter((item) =>
  (scope === "todos" || item.providerId === scope) && (stage === "todos" || item.stage === stage) &&
  (category === "todos" || item.category === category) &&
  (!query || normalized([item.reference, item.identity, item.sourceUrl, item.original?.title,
    item.published?.title, item.commercial?.title].filter((value) => value !== null && value !== undefined).join(" ")).includes(query)));
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
const renderCases = (): void => {
  const target = find("explorer-cases");
  target.replaceChildren(create("span", "case-caption", "CASOS REALES"));
  for (const item of data.explorer.cases) {
    const product = productsById.get(item.identity);
    if (!product || scope !== "todos" && item.providerId !== scope) continue;
    append(target, newButton(`${names[item.providerId]} · ${caseLabels[item.focus]}`, () => {
      stage = "todos";
      category = "todos";
      query = "";
      input("explorer-search").value = "";
      select("explorer-stage").value = "todos";
      refreshCategories();
      selectedId = item.identity;
      page = Math.max(0, Math.floor(visibleProducts().findIndex((entry) => entry.identity === item.identity) / pageSize));
      renderExplorer();
    }, "case-button"));
  }
};
const renderRows = (): void => {
  const filtered = visibleProducts();
  const list = find("explorer-list");
  list.replaceChildren();
  const lastPage = Math.max(0, Math.ceil(filtered.length / pageSize) - 1);
  page = Math.min(page, lastPage);
  find("explorer-counter").textContent = `${formatNumber.format(filtered.length)} fichas · ${scope === "todos" ? "Todos" : names[scope]}`;
  find("explorer-pages-label").textContent = `${filtered.length ? page + 1 : 0} / ${filtered.length ? lastPage + 1 : 0}`;
  const prev = find("explorer-page-prev");
  const next = find("explorer-page-next");
  if (prev instanceof HTMLButtonElement) prev.disabled = page === 0;
  if (next instanceof HTMLButtonElement) next.disabled = page === lastPage;
  if (!filtered.length) {
    append(list, create("div", "explorer-empty", "No hay máquinas con estos filtros. Prueba otra referencia o categoría."));
    return;
  }
  for (const item of filtered.slice(page * pageSize, (page + 1) * pageSize)) {
    const button = newButton("", () => { selectedId = item.identity; renderRows(); renderDetail(); },
      `product-row ${selectedId === item.identity ? "selected" : ""}`);
    button.setAttribute("aria-pressed", String(selectedId === item.identity));
    const top = create("span", "product-row-top");
    append(top, create("strong", "", item.reference ?? "Sin referencia"),
      create("span", `product-status product-${item.stage}`, stages[item.stage]));
    append(button, top, create("span", "product-title", item.published?.title ?? item.original?.title ?? "Sin título"),
      create("small", "", `${names[item.providerId]} · ${item.category ?? "Categoría no disponible"}`));
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
    create("p", "detail-reference", `Identidad técnica: ${item.identity}`),
    create("p", "", `Referencia: ${item.reference ?? "No consta"} · Paquete comercial UTC: ${data.snapshot.packageDateUtc}`));
  if (verifiedUrl(item.sourceUrl)) append(heading, linkTo(item.sourceUrl, "Abrir ficha del proveedor"));
  append(heading, create("p", "minor-note", "La página externa puede haber cambiado después del corte y no acredita por sí sola su contenido histórico."));
  append(target, heading, renderChangeSummary(item), renderFieldStory(item));
  const commercial = renderCommercialSummary(item);
  if (commercial) append(target, commercial);
  const full = create("details", "full-record");
  append(full, create("summary", "", "Abrir ficha completa · textos, especificaciones y diferencias"));
  const records = create("div", "record-grid");
  append(records, recordCard("01 / ORIGINAL", item.original), recordCard("02 / FINISH", item.published),
    recordCard("03 / COMERCIAL", item.commercial, item.commercial ?? undefined));
  append(full, records, renderDescriptions(item), renderSpecifications(item), renderCommercialAttributes(item),
    create("h3", "diff-heading", "Diferencias estructuradas"));
  if (!item.original && item.published) append(full, create("p", "evidence-warning", "No existe original verificable para este corte. No se muestran diferencias imaginadas."));
  append(full, renderDifferences("Origen → Publicación técnica", item.changes),
    renderDifferences("Publicación técnica → Comercial", item.commercialChanges));
  append(target, full);
  const provenance = create("section", "detail-evidence");
  append(provenance, create("span", "section-kicker", "RESOLUCIÓN Y AUDITORÍA"), create("h3", "", "Decisión y evidencias del expediente"), renderDecision(item));
  const artifacts = create("details", "audit-artifacts");
  append(artifacts, create("summary", "", "Ver artefactos íntegros y huellas SHA256"));
  for (const [label, artifact] of [["Original verificado", item.evidence.original],
    ["Publicación acreditada", item.evidence.publication], ["JSON comercial", item.evidence.commercial],
    ["Acreditación editorial", item.evidence.accreditation]] as const) {
    if (artifact) append(artifacts, sourceLink(artifact, label));
  }
  if (!item.evidence.original) append(artifacts, create("p", "evidence-warning", "No hay original verificado para esta identidad o exclusión sin original conservado."));
  append(artifacts, create("p", "minor-note", "Este HTML no transporta los JSON ni informes. Para abrir las rutas desde panel/, activa los enlaces del repositorio en el encabezado."));
  append(provenance, artifacts);
  append(target, provenance);
};
const renderExplorer = (): void => { renderCases(); renderRows(); renderDetail(); };
const chooseCase = (item: PanelPresentationCase): void => {
  const record = productsById.get(item.identity);
  if (!record) return;
  const selectProvider = select("provider-filter");
  selectProvider.value = item.providerId;
  selectProvider.dispatchEvent(new Event("change", { bubbles: true }));
  stage = "todos";
  category = "todos";
  query = "";
  input("explorer-search").value = "";
  select("explorer-stage").value = "todos";
  refreshCategories();
  selectedId = item.identity;
  page = Math.max(0, Math.floor(visibleProducts().findIndex((entry) => entry.identity === selectedId) / pageSize));
  renderExplorer();
  window.dispatchEvent(new CustomEvent("panel:request-view", { detail: "explorador" }));
};

type PresentationStep = {
  readonly title: string;
  readonly description: string;
  readonly view: "resumen" | "flujo" | "explorador" | "calidad";
  readonly focusId: string;
  readonly example?: PanelPresentationCase;
};
const presentationCases = data.explorer.cases.filter((item) => item.focus !== "exclusion");
const exclusionCase = data.explorer.cases.find((item) => item.focus === "exclusion");
const presentationSteps: readonly PresentationStep[] = [
  { title: "01 · De dónde pueden venir los datos", description: "E1 · Las fuentes son posibilidades sujetas a identidad y aplicabilidad; conocer una referencia no prueba su uso en una ficha.", view: "resumen", focusId: "source-map-title" },
  { title: "02 · El resultado del corte", description: "Los indicadores corresponden al mismo corte técnico-comercial, pero a poblaciones y etapas distintas. No acreditan importación en backend.", view: "resumen", focusId: "overview-kpis-title" },
  { title: "03 · Uniformidad técnica", description: "E2 · Correspondencias de claves del diccionario vigente, no pruebas de que una regla actuara históricamente sobre una unidad concreta.", view: "flujo", focusId: "normalization-title" },
  { title: "04 · Evidencia que permite incorporar", description: "E3 · Comprobaciones documentadas de una ruta técnica, con condiciones opcionales y rechazo de una clave si no cumple el contrato.", view: "calidad", focusId: "checks-title" },
  { title: "05 · Controles y exclusiones", description: "E4 · No incorporar una especificación, excluir de FINISH y excluir del comercial son decisiones diferentes.", view: "calidad", focusId: "controls-title" },
  ...presentationCases.map((item): PresentationStep => ({
    title: `${names[item.providerId]} · ${caseLabels[item.focus]}`,
    description: "E5 · Ficha real del paquete identificado. Observa el antes y después y consulta la fuente compatible cuando exista; no presupone una ejecución histórica demostrada.",
    view: "explorador", focusId: "explorer-detail", example: item
  })),
  ...(exclusionCase ? [{
    title: `${names[exclusionCase.providerId]} · Caso adverso`,
    description: "Exclusión real documentada en la acreditación del corte. No se confunde con un rechazo aislado de un campo ni con una exclusión comercial.",
    view: "explorador" as const, focusId: "explorer-detail", example: exclusionCase
  }] : []),
  { title: "Cierre · Qué podemos demostrar", description: "Resultado agregado, limitaciones, SHA y evidencias. Un cambio observado o una fuente compatible no demuestran por sí solos su causalidad histórica.", view: "resumen", focusId: "overview-kpis-title" }
];
let presentation = -1;
const renderPresentation = (): void => {
  const strip = find("presentation-strip");
  strip.hidden = presentation < 0;
  document.querySelectorAll(".presentation-focus").forEach((node) => node.classList.remove("presentation-focus"));
  if (presentation < 0) return;
  const step = presentationSteps[presentation];
  if (!step) return;
  find("presentation-progress").textContent = `RECORRIDO GUIADO · ${presentation + 1} / ${presentationSteps.length}`;
  find("presentation-heading").textContent = step.title;
  find("presentation-description").textContent = step.description;
  for (const [id, disabled] of [["presentation-prev", presentation === 0],
    ["presentation-next", presentation === presentationSteps.length - 1]] as const) {
    const node = find(id);
    if (node instanceof HTMLButtonElement) node.disabled = disabled;
  }
  if (step.example) chooseCase(step.example);
  else {
    select("provider-filter").value = "todos";
    select("provider-filter").dispatchEvent(new Event("change", { bubbles: true }));
    window.dispatchEvent(new CustomEvent("panel:request-view", { detail: step.view }));
  }
  const focus = find(step.focusId);
  focus.classList.add("presentation-focus");
  focus.setAttribute("tabindex", "-1");
  focus.focus({ preventScroll: true });
  focus.scrollIntoView({ block: "start", behavior: "auto" });
};

input("explorer-search").addEventListener("input", () => {
  query = normalized(input("explorer-search").value.trim());
  page = 0;
  renderExplorer();
});
select("explorer-stage").addEventListener("change", () => {
  const selected = select("explorer-stage").value;
  stage = selected === "commercial" || selected === "commercial-excluded" || selected === "editorial-excluded" ? selected : "todos";
  page = 0;
  renderExplorer();
});
select("explorer-category").addEventListener("change", () => {
  category = select("explorer-category").value;
  page = 0;
  renderExplorer();
});
find("explorer-page-prev").addEventListener("click", () => { page = Math.max(0, page - 1); renderRows(); });
find("explorer-page-next").addEventListener("click", () => { page += 1; renderRows(); });
window.addEventListener("panel:scope", (event: Event) => {
  if (!(event instanceof CustomEvent)) return;
  const next: unknown = event.detail;
  if (next !== "todos" && next !== "gam" && next !== "gomariz" && next !== "mercaeleva") return;
  scope = next;
  page = 0;
  if (selectedId && !visibleProducts().some((item) => item.identity === selectedId)) selectedId = null;
  refreshCategories();
  renderExplorer();
});
window.addEventListener("panel:request-case", (event: Event) => {
  if (!(event instanceof CustomEvent)) return;
  const identity: unknown = event.detail;
  if (typeof identity !== "string") return;
  const selected = data.explorer.cases.find((candidate) => candidate.identity === identity);
  if (selected) chooseCase(selected);
});
find("presentation-start").addEventListener("click", () => { presentation = 0; renderPresentation(); });
find("presentation-prev").addEventListener("click", () => { if (presentation > 0) { presentation -= 1; renderPresentation(); } });
find("presentation-next").addEventListener("click", () => {
  if (presentation >= 0 && presentation < presentationSteps.length - 1) { presentation += 1; renderPresentation(); }
});
const exitPresentation = (): void => {
  presentation = -1;
  renderPresentation();
  find("presentation-start").focus();
};
find("presentation-exit").addEventListener("click", exitPresentation);
window.addEventListener("keydown", (event: KeyboardEvent) => {
  if (presentation < 0) return;
  if (event.key === "Escape") exitPresentation();
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement ||
    event.target instanceof HTMLTextAreaElement) return;
  if (event.key === "ArrowRight" && presentation < presentationSteps.length - 1) {
    presentation += 1;
    renderPresentation();
  } else if (event.key === "ArrowLeft" && presentation > 0) {
    presentation -= 1;
    renderPresentation();
  }
});
refreshCategories();
renderExplorer();
