import type { PanelDashboardPayload } from "../application/dashboard-data.js";
import type { PanelExplorerProduct, PanelPresentationCase, PanelProductView, PanelCommercialView, PanelFieldDifference } from "../explorer/types.js";
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
  if (!artifact.path.startsWith("catalogs/") || artifact.path.includes("..") || !/^[a-f0-9]{64}$/.test(artifact.sha256)) {
    throw new Error("Artefacto sin ruta segura");
  }
  const row = create("div", "explorer-source");
  append(row, create("strong", "", title), linkTo(encodeURI(`../${artifact.path}`), artifact.path), create("code", "", `SHA256 ${artifact.sha256}`));
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
const excerpt = (label: string, body: string | null): HTMLElement => {
  const block = create("div", "record-excerpt");
  append(block, create("span", "record-label", label));
  if (!body) {
    append(block, create("p", "muted-copy", "No consta"));
  } else if (body.length > 300) {
    const details = create("details");
    append(details, create("summary", "", body.slice(0, 300).trimEnd() + "… Mostrar completo"), create("p", "record-long-copy", body));
    append(block, details);
  } else append(block, create("p", "", body));
  return block;
};
const recordCard = (label: string, record: PanelProductView | PanelCommercialView | null, extra?: PanelCommercialView): HTMLElement => {
  const card = create("article", "record-card");
  append(card, create("span", "section-kicker", label));
  if (!record) {
    append(card, create("div", "record-missing", "Evidencia no disponible o etapa no alcanzada"));
    return card;
  }
  const preview = imagePreview(record);
  if (preview) append(card, preview);
  append(card, create("h3", "record-title", text(record.title)), excerpt("Descripción corta", record.shortDescription),
    excerpt("Descripción general", record.generalDescription));
  const facts = create("dl", "record-facts");
  for (const [title, value] of [["Categoría", text(record.category)], ["Precio declarado", text(record.price)]] as const) {
    append(facts, create("dt", "", title), create("dd", "", value));
  }
  if (extra) {
    append(facts, create("dt", "", "Categoría comercial (ID)"),
      create("dd", "", extra.categorySellID === null ? "Pendiente" : String(extra.categorySellID)),
      create("dt", "", "Atributos comerciales aceptados"), create("dd", "", String(extra.attributes.length)));
  }
  append(card, facts);
  const specs = Object.entries(record.specs);
  if (specs.length) {
    const section = create("details", "record-specs");
    append(section, create("summary", "", `${formatNumber.format(specs.length)} prestaciones técnicas · Ver todas`));
    const list = create("dl", "record-spec-list");
    for (const [key, value] of specs) {
      append(list, create("dt", "", key), create("dd", "", Array.isArray(value) ? value.join(" · ") : String(value)));
    }
    append(section, list, card);
  }
  if (extra?.attributes.length) {
    const attrs = create("details", "record-specs");
    append(attrs, create("summary", "", `${extra.attributes.length} atributos comerciales · Ver IDs y valores`));
    const list = create("dl", "record-spec-list");
    for (const attr of extra.attributes) {
      append(list, create("dt", "", `ID ${attr.attributeID}`), create("dd", "", String(attr.value)));
    }
    append(attrs, list, card);
  }
  return card;
};

let scope: Scope = "todos";
let stage: Stage = "todos";
let query = "";
let category = "todos";
let page = 0;
let selectedId: string | null = null;
let showUnchanged = false;
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
  append(region, create("h3", "", label), create("p", "minor-note", `${observed.length} diferencias o correspondencias ambiguas observadas · ${items.length} campos comparables`));
  if (!items.length) {
    append(region, create("p", "muted-copy", "Comparación no disponible para este corte o esta etapa."));
    return region;
  }
  const table = create("table", "data-table difference-table");
  const head = create("thead");
  const tr = create("tr");
  for (const label of ["CAMPO", "ESTADO", "ANTES", "DESPUÉS"]) append(tr, create("th", "", label));
  append(head, tr);
  append(table, head);
  const body = create("tbody");
  const visible = showUnchanged ? items : observed;
  for (const item of visible) {
    const tr = create("tr");
    append(tr, create("th", "diff-name", item.field), create("td", `diff-label diff-${item.change}`, changes[item.change]),
      create("td", "diff-content", text(item.before)), create("td", "diff-content", text(item.after)));
    append(body, tr);
  }
  append(table, body);
  if (visible.length) append(region, create("div", "scroll-table", ""));
  if (visible.length) region.lastElementChild?.append(table);
  else append(region, create("p", "muted-copy", "No hay diferencias de valor observadas en estos campos."));
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
    create("div", "detail-reference", `Identidad técnica: ${item.identity}`),
    create("p", "", `Referencia visible: ${item.reference ?? "No consta"} · Corte comercial UTC: ${data.snapshot.packageDateUtc}`));
  if (verifiedUrl(item.sourceUrl)) append(heading, linkTo(item.sourceUrl, "Abrir ficha del proveedor ↗"));
  append(heading, create("p", "minor-note", "La URL externa puede haber cambiado después del corte; su contenido actual no acredita el histórico."));
  append(target, heading);
  if (item.decision) {
    const box = create("section", "decision-alert");
    append(box, create("span", "section-kicker", item.decision.stage === "editorial" ? "DECISIÓN EDITORIAL ACREDITADA" : "EXCLUSIÓN DE PROYECCIÓN COMERCIAL"),
      create("h3", "", item.decision.reason));
    for (const issue of item.decision.issues) append(box, create("p", "", issue));
    for (const url of item.decision.evidenceUrls) if (verifiedUrl(url)) append(box, linkTo(url, "Enlace de evidencia externa ↗"));
    append(target, box);
  }
  const records = create("div", "record-grid");
  append(records, recordCard("01 / ORIGINAL", item.original), recordCard("02 / FINISH", item.published),
    recordCard("03 / COMERCIAL", item.commercial, item.commercial ?? undefined));
  append(target, records);
  const diffHeading = create("div", "diff-heading");
  append(diffHeading, create("div", "", "Diferencias estructuradas"),
    newButton(showUnchanged ? "Ocultar conservados" : "Mostrar campos conservados", () => {
      showUnchanged = !showUnchanged;
      renderDetail();
    }, "text-action"));
  append(target, diffHeading);
  if (!item.original && item.published) append(target, create("p", "evidence-warning", "No existe original verificable para este corte. No se muestran diferencias imaginadas."));
  append(target, renderDifferences("Origen → Publicación técnica", item.changes),
    renderDifferences("Publicación técnica → Comercial", item.commercialChanges));
  const provenance = create("section", "detail-evidence");
  append(provenance, create("h3", "", "Procedencia del expediente"));
  for (const [label, artifact] of [["Original verificado", item.evidence.original],
    ["Publicación acreditada", item.evidence.publication], ["JSON comercial", item.evidence.commercial],
    ["Acreditación editorial", item.evidence.accreditation]] as const) {
    if (artifact) append(provenance, sourceLink(artifact, label));
  }
  if (!item.evidence.original) append(provenance, create("p", "evidence-warning", "No hay original verificado para esta identidad o exclusión sin original conservado."));
  append(provenance, create("p", "minor-note", "La comparación acredita diferencias observadas de campos; no demuestra por sí sola qué regla interna causó cada cambio."));
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

type PresentationStep = { readonly title: string; readonly description: string; readonly view: "resumen" | "flujo" | "explorador" | "calidad"; readonly example?: PanelPresentationCase };
const presentationSteps: readonly PresentationStep[] = [
  { title: "EQUIPZILLA, en cifras", description: "Tres fuentes, un corte seleccionado. Original, FINISH y paquete comercial son poblaciones distintas.", view: "resumen" },
  { title: "El recorrido verificable", description: "Las transformaciones técnicas, acreditaciones editoriales y la proyección comercial se mantienen separadas.", view: "flujo" },
  ...data.explorer.cases.filter((item) => item.focus !== "exclusion").map((item) => ({
    title: `${names[item.providerId]} · ${caseLabels[item.focus]}`,
    description: "Caso seleccionado a partir de campos realmente observados en original, publicación y comercial. No se atribuye automáticamente una regla.",
    view: "explorador" as const, example: item
  })),
  ...data.explorer.cases.filter((item) => item.focus === "exclusion").map((item) => ({
    title: `${names[item.providerId]} · Exclusión acreditada`,
    description: "El motivo de bloqueo se obtiene de accreditation.json; la máquina no se cuenta como publicada.",
    view: "explorador" as const, example: item
  })),
  { title: "Confianza y límites", description: "Exclusiones diferenciadas, categorías pendientes, fuentes trazables e integración de BD no verificada.", view: "calidad" }
];
let presentation = -1;
const renderPresentation = (): void => {
  const strip = find("presentation-strip");
  strip.hidden = presentation < 0;
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
find("presentation-start").addEventListener("click", () => { presentation = 0; renderPresentation(); });
find("presentation-prev").addEventListener("click", () => { if (presentation > 0) { presentation -= 1; renderPresentation(); } });
find("presentation-next").addEventListener("click", () => {
  if (presentation >= 0 && presentation < presentationSteps.length - 1) { presentation += 1; renderPresentation(); }
});
find("presentation-exit").addEventListener("click", () => { presentation = -1; renderPresentation(); });
window.addEventListener("keydown", (event: KeyboardEvent) => {
  if (event.key === "Escape" && presentation >= 0) { presentation = -1; renderPresentation(); }
});
refreshCategories();
renderExplorer();
