import type { PanelNormalizationEntry } from "../application/dashboard-data.js";
import type { PanelRuleExamples, PanelRuleId } from "../application/panel-rule-examples.js";
import type { SpecRuleType } from "../../catalog/normalization/spec-rules.js";
import type { PanelMetricKey } from "../evidence/metric-definitions.js";
import type { PanelProviderEvidence, PanelProviderId, PanelProviderMetrics } from "../evidence/types.js";
import { create as element, append, find as byId } from "./dom.js";
import { readPanelPayload } from "./panel-payload.js";

type PanelView = "resumen" | "flujo" | "explorador" | "calidad";
type PanelScope = PanelProviderId | "todos";
type MetricColumn = { readonly key: PanelMetricKey; readonly label: string };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const payload = readPanelPayload();
const ruleRaw = document.getElementById("panel-rule-examples")?.textContent;
if (!ruleRaw) throw new Error("Reglas técnicas del panel no disponibles");
const decodedRules: unknown = JSON.parse(ruleRaw);
const ruleIds = ["source", "normalization", "exclusion"] as const;
const isRuleExample = (value: unknown): value is PanelRuleExamples[PanelRuleId] => isRecord(value) &&
  typeof value.title === "string" && typeof value.summary === "string" &&
  typeof value.path === "string" && typeof value.code === "string";
if (!isRecord(decodedRules) || Object.keys(decodedRules).length !== ruleIds.length ||
  !ruleIds.every((id) => isRuleExample(decodedRules[id]))) {
  throw new Error("Contrato de reglas técnicas incompatible");
}
const sourceRule = decodedRules.source;
const normalizationRule = decodedRules.normalization;
const exclusionRule = decodedRules.exclusion;
if (!isRuleExample(sourceRule) || !isRuleExample(normalizationRule) || !isRuleExample(exclusionRule)) {
  throw new Error("Reglas técnicas no disponibles");
}
const ruleExamples: PanelRuleExamples = {
  source: sourceRule,
  normalization: normalizationRule,
  exclusion: exclusionRule
};
const number = new Intl.NumberFormat("es-ES");
const format = (value: number): string => number.format(value).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
const metric = (metrics: PanelProviderMetrics, key: PanelMetricKey): number => {
  const values = { ...metrics, ...metrics.transformations };
  return values[key];
};
const selectedProviders = (scope: PanelScope): readonly PanelProviderEvidence[] =>
  scope === "todos" ? payload.snapshot.providers : payload.snapshot.providers.filter((item) => item.providerId === scope);
const metricsFor = (scope: PanelScope): PanelProviderMetrics => {
  if (scope === "todos") return payload.snapshot.totals;
  const item = payload.snapshot.providers.find((provider) => provider.providerId === scope);
  if (!item) throw new Error(`Proveedor no incluido en el corte: ${scope}`);
  return item.metrics;
};
const knownName = (id: PanelProviderId): string => payload.names[id];
const scopeLabel = (scope: PanelScope): string => scope === "todos" ? "Todos los proveedores" : knownName(scope);
const metricDefinition = (key: PanelMetricKey) => payload.definitions.find((item) => item.key === key);
let currentScope: PanelScope = "todos";
let currentView: PanelView = "resumen";

const ruleDialog = byId("rule-dialog");
for (const button of document.querySelectorAll<HTMLButtonElement>("[data-rule]")) {
  button.addEventListener("click", () => {
    const id = button.dataset.rule;
    if (id !== "source" && id !== "normalization" && id !== "exclusion") return;
    const example = ruleExamples[id];
    byId("rule-dialog-title").textContent = example.title;
    byId("rule-dialog-summary").textContent = example.summary;
    byId("rule-dialog-code").textContent = example.code;
    byId("rule-dialog-path").textContent = example.path;
    if (ruleDialog instanceof HTMLDialogElement) ruleDialog.showModal();
  });
}
byId("close-rule").addEventListener("click", () => {
  if (ruleDialog instanceof HTMLDialogElement) ruleDialog.close();
});

const createMatrix = (target: string, columns: readonly MetricColumn[], scope: PanelScope): void => {
  const table = element("table", "data-table");
  const caption = element("caption", "sr-only", `Matriz del corte · ${scopeLabel(scope)}`);
  const head = element("thead");
  const trh = element("tr");
  append(trh, element("th", "first-col", "PROVEEDOR"));
  for (const column of columns) {
    const cell = element("th");
    cell.scope = "col";
    cell.textContent = column.label;
    append(trh, cell);
  }
  append(head, trh);
  const body = element("tbody");
  const rows = selectedProviders(scope).map((provider) => ({
    label: knownName(provider.providerId), metrics: provider.metrics, providerId: provider.providerId
  }));
  for (const row of rows) {
    const tr = element("tr");
    const cell = element("th", "row-name");
    cell.scope = "row";
    const filter = element("button", "row-filter", row.label);
    filter.type = "button";
    filter.title = `Filtrar por ${row.label}`;
    filter.addEventListener("click", () => updateScope(row.providerId));
    append(cell, filter);
    append(tr, cell);
    for (const column of columns) append(tr, element("td", "num-cell", format(metric(row.metrics, column.key))));
    append(body, tr);
  }
  if (scope === "todos") {
    const tr = element("tr", "total-row");
    const name = element("th", "row-name", "TOTAL");
    name.scope = "row";
    append(tr, name);
    for (const column of columns) append(tr, element("td", "num-cell", format(metric(payload.snapshot.totals, column.key))));
    append(body, tr);
  }
  append(table, caption, head, body);
  byId(target).replaceChildren(table);
};
const pipelineColumns: readonly MetricColumn[] = [
  { key: "originals", label: "Originales" },
  { key: "published", label: "Publicadas" },
  { key: "excludedEditorial", label: "Excluidas editoriales" },
  { key: "exported", label: "Exportadas" },
  { key: "excludedCommercial", label: "Excluidas comerciales" },
  { key: "categorized", label: "Categorizadas" },
  { key: "pendingCategory", label: "Sin categoría" },
  { key: "attributes", label: "Atributos aceptados" }
];
const transformationColumns: readonly MetricColumn[] = [
  { key: "changedProducts", label: "Fichas transformadas" },
  { key: "changedTitles", label: "Títulos modificados" },
  { key: "createdDescriptions", label: "Descripciones creadas" },
  { key: "modifiedDescriptions", label: "Descripciones modificadas" },
  { key: "addedTechnicalKeys", label: "Claves técnicas incorporadas" },
  { key: "renamedTechnicalKeys", label: "Claves renombradas" },
  { key: "formattedTechnicalValues", label: "Valores formateados" },
  { key: "changedTechnicalValues", label: "Valores cambiados" }
];
const caseFor = (scope: PanelScope, focus?: "technical" | "exclusion") => payload.explorer.cases.find((candidate) =>
  (scope === "todos" || candidate.providerId === scope) &&
  (focus === "exclusion" ? candidate.focus === "exclusion" :
    focus === "technical" ? candidate.focus === "technical" : candidate.focus === "technical" || candidate.focus === "content"));
const renderExampleAction = (id: string, scope: PanelScope, focus?: "technical" | "exclusion"): void => {
  const node = byId(id);
  if (!(node instanceof HTMLButtonElement)) return;
  const example = caseFor(scope, focus);
  node.disabled = example === undefined;
  node.title = example ? `${knownName(example.providerId)} · Caso real del corte; la causa histórica individual puede no estar demostrada` :
    "No hay caso de esta clase seleccionado para el proveedor filtrado";
  node.onclick = example ? () => window.dispatchEvent(new CustomEvent("panel:request-case", { detail: example.identity })) : null;
};
const normalizationTypeLabels: Readonly<Record<SpecRuleType, string>> = {
  string: "Texto",
  number: "Número",
  number_array: "Serie de números",
  dimension: "Dimensiones",
  dimension_rect: "Dimensiones rectangulares",
  battery: "Batería",
  bool: "Sí / no",
  enum: "Opción",
  location: "Ubicación"
};
const renderNormalizationRows = (id: string, rules: readonly PanelNormalizationEntry[]): void => {
  const target = byId(id);
  const rows = document.createDocumentFragment();
  for (const rule of rules) {
    const row = element("tr");
    const received = element("td");
    const normalized = element("td");
    const type = element("td");
    append(received, element("code", "", rule.input));
    append(normalized, element("strong", "", rule.canonical));
    type.textContent = rule.ruleType === null ? "No especificado" : normalizationTypeLabels[rule.ruleType];
    if (rule.ruleType !== null) type.title = rule.ruleType;
    append(row, received, normalized, type);
    rows.append(row);
  }
  target.replaceChildren(rows);
};
const renderNormalization = (): void => {
  renderNormalizationRows("normalization-examples", payload.normalizationExamples);
  renderNormalizationRows("normalization-dictionary-rows", payload.normalizationDictionary);
  byId("normalization-dictionary-count").textContent = `(${format(payload.normalizationDictionary.length)} correspondencias)`;
};
const renderExplanations = (scope: PanelScope): void => {
  const metrics = metricsFor(scope);
  byId("control-exclusion-editorial").textContent = format(metrics.excludedEditorial);
  byId("control-exclusion-commercial").textContent = format(metrics.excludedCommercial);
  renderExampleAction("source-example", scope);
  renderExampleAction("normalization-example", scope, "technical");
  renderExampleAction("excluded-example", scope, "exclusion");
};
const renderKpis = (scope: PanelScope): void => {
  const container = byId("overview-kpis");
  container.replaceChildren();
  const metrics = metricsFor(scope);
  const cards: readonly { readonly key: PanelMetricKey; readonly overline: string; readonly accent: string; readonly note: string }[] = [
    { key: "originals", overline: "01 / ENTRADA", accent: "neutral", note: "Catálogo original acreditado" },
    { key: "published", overline: "02 / FINISH", accent: "mint", note: "Publicación individual del corte" },
    { key: "exported", overline: "03 / COMERCIAL", accent: "cyan", note: "Productos en el paquete develop" },
    { key: "addedTechnicalKeys", overline: "04 / APORTACIÓN", accent: "blue", note: "Claves incorporadas según el informe técnico" }
  ];
  for (const card of cards) {
    const tile = element("article", `kpi-card accent-${card.accent}`);
    append(tile, element("div", "kpi-overline", card.overline));
    append(tile, element("div", "kpi-value", format(metric(metrics, card.key))));
    append(tile, element("span", "kpi-metric-label", metricDefinition(card.key)?.label ?? card.key));
    append(tile, element("p", "kpi-note", card.note));
    append(container, tile);
  }
};
const renderProviderChart = (scope: PanelScope): void => {
  const container = byId("provider-chart");
  container.replaceChildren();
  const providers = selectedProviders(scope);
  const maximum = Math.max(1, ...providers.map((item) => item.metrics.originals));
  byId("chart-scale").textContent = `Escala compartida: 0–${format(maximum)} fichas`;
  for (const provider of providers) {
    const item = element("div", "provider-chart-row");
    const heading = element("div", "provider-chart-heading");
    const button = element("button", "chart-provider-link", knownName(provider.providerId));
    button.type = "button";
    button.addEventListener("click", () => updateScope(provider.providerId));
    append(heading, button, element("span", "chart-provider-total", `${format(provider.metrics.originals)} originales`));
    append(item, heading);
    for (const band of [
      { name: "ORIG", key: "originals", color: "origin" },
      { name: "FINISH", key: "published", color: "finish" },
      { name: "COM", key: "exported", color: "commercial" }
    ] as const) {
      const row = element("div", "mini-bar-row");
      const track = element("div", "mini-bar-track");
      const fill = element("span", `mini-bar-fill ${band.color}`);
      fill.style.width = `${(provider.metrics[band.key] / maximum) * 100}%`;
      append(track, fill);
      append(row, element("span", "mini-bar-label", band.name), track, element("span", "mini-bar-value", format(provider.metrics[band.key])));
      append(item, row);
    }
    append(container, item);
  }
};
const renderMatrices = (scope: PanelScope): void => {
  createMatrix("pipeline-matrix", pipelineColumns, scope);
  createMatrix("transform-matrix", transformationColumns, scope);
};
const render = (): void => {
  byId("scope-summary").textContent = scopeLabel(currentScope);
  renderKpis(currentScope);
  renderExplanations(currentScope);
  renderProviderChart(currentScope);
  renderMatrices(currentScope);
};
const updateScope = (scope: PanelScope): void => {
  currentScope = scope;
  const select = byId("provider-filter");
  if (select instanceof HTMLSelectElement) select.value = scope;
  render();
  window.dispatchEvent(new CustomEvent("panel:scope", { detail: scope }));
};
const providerControl = document.querySelector<HTMLElement>(".page-tools > .filter-control");
const providerTools = document.querySelector<HTMLElement>(".page-tools");
const explorerProviderSlot = byId("explorer-provider-slot");
const placeProvider = (view: PanelView): void => {
  if (!providerControl || !providerTools) return;
  if (view === "explorador") {
    explorerProviderSlot.append(providerControl);
    providerTools.hidden = true;
  } else {
    providerTools.append(providerControl);
    providerTools.hidden = false;
  }
};
const navigate = (view: PanelView): void => {
  placeProvider(view);
  currentView = view;
  for (const target of document.querySelectorAll<HTMLElement>("[data-view]")) target.hidden = target.dataset.view !== currentView;
  for (const button of document.querySelectorAll<HTMLButtonElement>("[data-nav]")) {
    const active = button.dataset.nav === currentView;
    button.classList.toggle("active", active);
    if (active) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  }
  window.scrollTo({ top: 0, behavior: "instant" });
  window.dispatchEvent(new CustomEvent("panel:view", { detail: view }));
};
const filter = byId("provider-filter");
if (filter instanceof HTMLSelectElement) {
  for (const item of payload.snapshot.providers) {
    const option = element("option", "", knownName(item.providerId));
    option.value = item.providerId;
    append(filter, option);
  }
  filter.addEventListener("change", () => {
    const match = payload.snapshot.providers.find((item) => item.providerId === filter.value);
    updateScope(match ? match.providerId : "todos");
  });
}
for (const button of document.querySelectorAll<HTMLButtonElement>("[data-nav]")) {
  button.addEventListener("click", () => {
    const target = button.dataset.nav;
    if (target === "resumen" || target === "flujo" || target === "explorador" || target === "calidad") navigate(target);
  });
}
const brand = document.querySelector<HTMLAnchorElement>(".brand");
brand?.addEventListener("click", () => navigate("resumen"));
for (const button of document.querySelectorAll<HTMLButtonElement>("[data-go]")) {
  button.addEventListener("click", () => {
    const target = button.dataset.go;
    if (target === "resumen" || target === "flujo" || target === "explorador" || target === "calidad") navigate(target);
  });
}
byId("header-package").textContent = `PAQUETE UTC ${payload.snapshot.packageDateUtc}`;
renderNormalization();
render();
const initialHash = location.hash.slice(1);
if (initialHash === "flujo" || initialHash === "explorador" || initialHash === "calidad") navigate(initialHash);
window.addEventListener("panel:request-view", (event: Event) => {
  if (!(event instanceof CustomEvent)) return;
  const target: unknown = event.detail;
  if (target === "resumen" || target === "flujo" || target === "explorador" || target === "calidad") navigate(target);
});
