import type { PanelDashboardPayload } from "../application/dashboard-data.js";
import type { PanelMetricKey } from "../evidence/metric-definitions.js";
import type { PanelArtifact, PanelProviderEvidence, PanelProviderId, PanelProviderMetrics } from "../evidence/types.js";

type PanelView = "resumen" | "flujo" | "explorador" | "calidad";
type PanelScope = PanelProviderId | "todos";
type MetricColumn = { readonly key: PanelMetricKey; readonly label: string };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const isPayload = (value: unknown): value is PanelDashboardPayload => {
  if (!isRecord(value) || !isRecord(value.snapshot) || !isRecord(value.names)) return false;
  return Array.isArray(value.snapshot.providers) && isRecord(value.snapshot.totals) &&
    typeof value.snapshot.packageDateUtc === "string" &&
    Array.isArray(value.definitions) && Array.isArray(value.decisions) &&
    isRecord(value.explorer) && Array.isArray(value.explorer.products) && Array.isArray(value.explorer.cases);
};
const raw = document.getElementById("panel-data")?.textContent;
if (!raw) throw new Error("Datos del panel no disponibles");
const decoded: unknown = JSON.parse(raw);
if (!isPayload(decoded)) throw new Error("Contrato de visualización incompatible");
const payload = decoded;
const number = new Intl.NumberFormat("es-ES");
const format = (value: number): string => number.format(value).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
const metric = (metrics: PanelProviderMetrics, key: PanelMetricKey): number => {
  const values = { ...metrics, ...metrics.transformations };
  return values[key];
};
const element = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = "", content?: string): HTMLElementTagNameMap[K] => {
  const result = document.createElement(tag);
  if (cls) result.className = cls;
  if (content !== undefined) result.textContent = content;
  return result;
};
const append = (target: HTMLElement, ...children: (Node | string)[]): void => target.append(...children);
const byId = (id: string): HTMLElement => {
  const target = document.getElementById(id);
  if (!target) throw new Error(`Falta estructura UI: ${id}`);
  return target;
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
const artifactLink = (artifact: PanelArtifact): HTMLAnchorElement => {
  const link = element("a", "file-link", artifact.path);
  if (!artifact.path.startsWith("catalogs/") || artifact.path.includes("..") || !/^[a-f0-9]{64}$/.test(artifact.sha256)) {
    throw new Error("Ruta de evidencia inválida");
  }
  link.classList.add("local-proof-link");
  link.dataset.localHref = encodeURI(`../${artifact.path}`);
  link.title = "Archivo acreditado disponible junto al repositorio";
  if (document.documentElement.dataset.localEvidence === "enabled") link.href = link.dataset.localHref;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  return link;
};
type NamedArtifact = { readonly label: string; readonly artifact: PanelArtifact };
const sourceArtifacts = (key: PanelMetricKey, scope: PanelScope): readonly NamedArtifact[] => {
  const definition = metricDefinition(key);
  if (!definition) return [];
  if (definition.source === "technical-report") return [{ label: "Informe técnico", artifact: payload.snapshot.technicalReport }];
  if (definition.source === "commercial-manifest") return [{ label: "Manifiesto comercial", artifact: payload.snapshot.commercialManifest }];
  if (definition.source === "commercial-json") return selectedProviders(scope).map((item) =>
    ({ label: `Comercial · ${knownName(item.providerId)}`, artifact: item.commercial }));
  return selectedProviders(scope).map((item) =>
    ({ label: `FINISH · ${knownName(item.providerId)}`, artifact: item.publicationManifest }));
};
const namedArtifactLink = ({ label, artifact }: NamedArtifact): HTMLAnchorElement => {
  const link = artifactLink(artifact);
  link.textContent = label;
  link.setAttribute("aria-label", `${label} · archivo del repositorio`);
  return link;
};
let currentScope: PanelScope = "todos";
let currentView: PanelView = "resumen";

const dialog = byId("definition-dialog");
const openDefinition = (key: PanelMetricKey): void => {
  const definition = metricDefinition(key);
  if (!definition) return;
  byId("definition-title").textContent = definition.label;
  byId("definition-copy").textContent = definition.interpretation;
  const container = byId("definition-source");
  container.replaceChildren();
  const heading = element("div", "dialog-sources-title", `FUENTE · ${scopeLabel(currentScope)}`);
  append(container, heading);
  for (const entry of sourceArtifacts(key, currentScope)) {
    const row = element("div", "dialog-source-item");
    append(row, namedArtifactLink(entry));
    append(container, row);
  }
  if (dialog instanceof HTMLDialogElement) dialog.showModal();
};
const metricButton = (key: PanelMetricKey, label: string): HTMLButtonElement => {
  const button = element("button", "metric-button", label);
  button.type = "button";
  button.title = `Consultar definición y procedencia: ${label}`;
  button.addEventListener("click", () => openDefinition(key));
  append(button, element("span", "metric-info", "ⓘ"));
  return button;
};
const createMatrix = (target: string, columns: readonly MetricColumn[], scope: PanelScope): void => {
  const table = element("table", "data-table");
  const caption = element("caption", "sr-only", `Matriz del corte · ${scopeLabel(scope)}`);
  const head = element("thead");
  const trh = element("tr");
  append(trh, element("th", "first-col", "PROVEEDOR"));
  for (const column of columns) {
    const cell = element("th");
    append(cell, metricButton(column.key, column.label));
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
const qualityColumns: readonly MetricColumn[] = [
  { key: "excludedEditorial", label: "Exclusiones editoriales" },
  { key: "excludedCommercial", label: "Exclusiones comerciales" },
  { key: "pendingCategory", label: "Categorías pendientes" },
  { key: "exceptions", label: "Excepciones comerciales" },
  { key: "repeatedReferences", label: "Grupos de referencias coincidentes" }
];
const renderDecisions = (): void => {
  const table = element("table", "data-table decision-table");
  const head = element("thead");
  const tr = element("tr");
  for (const title of ["ETAPA", "ENTRADA", "TRANSFORMACIÓN / CONTROL", "SALIDA", "MECANISMO", "EVIDENCIA", "AUTORIZACIÓN"]) {
    append(tr, element("th", "", title));
  }
  append(head, tr);
  const body = element("tbody");
  for (const decision of payload.decisions) {
    const row = element("tr");
    for (const [index, value] of [decision.stage, decision.input, decision.control, decision.output, decision.decision, decision.evidence, decision.authorization].entries()) {
      append(row, element(index === 0 ? "th" : "td", index === 0 ? "decision-title" : "decision-value", value));
    }
    append(body, row);
  }
  append(table, head, body);
  byId("decisions-matrix").replaceChildren(table);
};
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
const renderExplanations = (scope: PanelScope): void => {
  const examples = byId("normalization-examples");
  examples.replaceChildren();
  for (const rule of payload.normalizationExamples) {
    const row = element("div", "normalization-pair");
    const received = element("div");
    append(received, element("span", "pair-label", "CLAVE RECIBIDA"), element("code", "", rule.input));
    const canonical = element("div");
    append(canonical, element("span", "pair-label", "CLAVE CANÓNICA"), element("strong", "", rule.canonical), element("small", "", `Tipo esperado: ${rule.ruleType}`));
    append(row, received, element("span", "pair-arrow", "→"), canonical);
    append(examples, row);
  }
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
    append(tile, metricButton(card.key, metricDefinition(card.key)?.label ?? card.key));
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
  createMatrix("quality-matrix", qualityColumns, scope);
};
const renderQualityCut = (scope: PanelScope): void => {
  const providers = selectedProviders(scope);
  const summary = byId("quality-cut-summary");
  const date = payload.snapshot.packageDateUtc;
  const dateLabel = /^\d{4}-\d{2}-\d{2}$/.test(date) ?
    new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
      .format(new Date(`${date}T00:00:00Z`)) : date;
  const dateItem = element("div", "quality-cut-fact");
  append(dateItem, element("span", "", "Fecha del paquete comercial"), element("strong", "", dateLabel));
  const providersItem = element("div", "quality-cut-fact");
  append(providersItem, element("span", "", "Proveedores del corte"),
    element("strong", "", providers.map((provider) => knownName(provider.providerId)).join(" · ")));
  summary.replaceChildren(dateItem, providersItem);
  const files = byId("quality-cut-files-list");
  const reports = element("div", "quality-cut-file-group");
  append(reports, element("strong", "", "Informes del corte"));
  const reportLinks = element("div", "quality-cut-links");
  for (const entry of [
    { label: "Informe técnico", artifact: payload.snapshot.technicalReport },
    { label: "Informe comercial", artifact: payload.snapshot.commercialReport },
    { label: "Manifiesto comercial", artifact: payload.snapshot.commercialManifest }
  ]) append(reportLinks, namedArtifactLink(entry));
  append(reports, reportLinks);
  files.replaceChildren(reports);
  for (const provider of providers) {
    const group = element("div", "quality-cut-file-group");
    append(group, element("strong", "", knownName(provider.providerId)));
    const links = element("div", "quality-cut-links");
    if (provider.original.status === "verified") {
      append(links, namedArtifactLink({ label: "Original", artifact: provider.original.artifact }));
    } else {
      const unavailable = element("span", "quality-cut-unavailable", `Original no disponible: ${provider.original.reason}`);
      append(links, unavailable);
    }
    append(links,
      namedArtifactLink({ label: "FINISH", artifact: provider.publication }),
      namedArtifactLink({ label: "Comercial", artifact: provider.commercial }));
    append(group, links);
    append(files, group);
  }
};
const render = (): void => {
  byId("scope-summary").textContent = scopeLabel(currentScope);
  renderKpis(currentScope);
  renderExplanations(currentScope);
  renderProviderChart(currentScope);
  renderMatrices(currentScope);
  renderQualityCut(currentScope);
};
const updateScope = (scope: PanelScope): void => {
  currentScope = scope;
  const select = byId("provider-filter");
  if (select instanceof HTMLSelectElement) select.value = scope;
  render();
  window.dispatchEvent(new CustomEvent("panel:scope", { detail: scope }));
};
const navigate = (view: PanelView): void => {
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
for (const id of ["close-definition", "close-definition-secondary"]) byId(id).addEventListener("click", () => {
  if (dialog instanceof HTMLDialogElement) dialog.close();
});
const localEvidenceToggle = byId("local-evidence-toggle");
localEvidenceToggle.addEventListener("click", () => {
  const enabled = document.documentElement.dataset.localEvidence !== "enabled";
  document.documentElement.dataset.localEvidence = enabled ? "enabled" : "disabled";
  for (const link of document.querySelectorAll<HTMLAnchorElement>("a.local-proof-link")) {
    if (enabled && link.dataset.localHref) link.href = link.dataset.localHref;
    else link.removeAttribute("href");
  }
  localEvidenceToggle.setAttribute("aria-pressed", String(enabled));
  localEvidenceToggle.textContent = enabled ? "Desactivar enlaces locales" : "Activar enlaces del repositorio";
  byId("evidence-access-status").textContent = enabled ?
    "Enlaces locales activados; requieren los archivos originales del repositorio." :
    "Enlaces locales desactivados.";
  window.dispatchEvent(new Event("panel:local-evidence-updated"));
});
window.addEventListener("panel:enable-local-evidence", () => {
  if (document.documentElement.dataset.localEvidence !== "enabled") localEvidenceToggle.click();
});
byId("header-package").textContent = `PAQUETE UTC ${payload.snapshot.packageDateUtc}`;
renderDecisions();
render();
const initialHash = location.hash.slice(1);
if (initialHash === "flujo" || initialHash === "explorador" || initialHash === "calidad") navigate(initialHash);
window.addEventListener("panel:request-view", (event: Event) => {
  if (!(event instanceof CustomEvent)) return;
  const target: unknown = event.detail;
  if (target === "resumen" || target === "flujo" || target === "explorador" || target === "calidad") navigate(target);
});
