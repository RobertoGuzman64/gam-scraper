import { createExplorerIndex, selectExplorerProducts } from "../explorer/explorer-selection.js";
import type { PanelExplorerProduct, PanelPresentationCase } from "../explorer/types.js";
import { createExplorerFilterControls } from "./explorer-filter-controls.js";
import { readPanelPayload } from "./panel-payload.js";
import { find, create, append, newButton } from "./dom.js";
import { stages, formatNumber } from "./explorer-labels.js";
import { renderExplorerDetail } from "./explorer-detail.js";
import { renderSpecBreakdown } from "./explorer-spec-summary.js";

const data = readPanelPayload();
const products = data.explorer.products;
const productsById = new Map(products.map((item) => [item.identity, item]));
const names = data.names;
const normalizedFields = new Map(data.normalizationDictionary.map((entry) => [entry.input, entry.canonical] as const));
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
const ensureDetail = (): void => {
  const key = `${selectedId ?? ""}:${filters.selection().additionKind ?? "todos"}`;
  if (renderedId === key) return;
  renderExplorerDetail(selectedId ? productsById.get(selectedId) ?? null : null, names, filters.selection().additionKind ?? "todos", normalizedFields);
  renderedId = key;
};
const renderExplorer = (): void => {
  reconcileSelection();
  filters.render();
  renderSpecBreakdown(products, names, filters.selection().providerId);
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
