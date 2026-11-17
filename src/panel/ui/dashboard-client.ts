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
  link.href = encodeURI(`../${artifact.path}`);
  link.title = `Abrir evidencia local · SHA256 ${artifact.sha256}`;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  return link;
};
const sourceArtifacts = (key: PanelMetricKey, scope: PanelScope): readonly PanelArtifact[] => {
  const definition = metricDefinition(key);
  if (!definition) return [];
  if (definition.source === "technical-report") return [payload.snapshot.technicalReport];
  if (definition.source === "commercial-manifest") return [payload.snapshot.commercialManifest];
  if (definition.source === "commercial-json") return selectedProviders(scope).map((item) => item.commercial);
  return selectedProviders(scope).map((item) => item.publicationManifest);
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
  for (const artifact of sourceArtifacts(key, currentScope)) {
    const row = element("div", "dialog-source-item");
    append(row, artifactLink(artifact), element("code", "mono", artifact.sha256));
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
const renderKpis = (scope: PanelScope): void => {
  const container = byId("overview-kpis");
  container.replaceChildren();
  const metrics = metricsFor(scope);
  const cards: readonly { readonly key: PanelMetricKey; readonly overline: string; readonly accent: string; readonly note: string }[] = [
    { key: "originals", overline: "01 / ENTRADA", accent: "neutral", note: "Catálogo original acreditado" },
    { key: "published", overline: "02 / FINISH", accent: "mint", note: "Publicación individual vigente" },
    { key: "exported", overline: "03 / COMERCIAL", accent: "cyan", note: "Productos en el paquete develop" },
    { key: "changedProducts", overline: "04 / TRANSFORMACIÓN", accent: "purple", note: "Fichas con cambios observados" },
    { key: "addedTechnicalKeys", overline: "05 / ESPECIFICACIONES", accent: "blue", note: "Nuevas claves tras normalización" },
    { key: "pendingCategory", overline: "06 / PENDIENTES", accent: "amber", note: "Sin categoría comercial" }
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
const renderVolume = (scope: PanelScope): void => {
  const data = metricsFor(scope);
  const container = byId("volume-flow");
  container.replaceChildren();
  const maximum = Math.max(1, data.originals);
  for (const [index, stage] of [
    { key: "originals", name: "Origen", sub: "Fichas originales", color: "origin" },
    { key: "published", name: "FINISH", sub: "Publicadas técnicas", color: "finish" },
    { key: "exported", name: "Comercial", sub: "Exportadas elegibles", color: "commercial" }
  ].entries()) {
    const row = element("div", "volume-stage");
    const top = element("div", "volume-top");
    append(top, element("span", "volume-stage-name", `${String(index + 1).padStart(2, "0")}  ${stage.name}`), element("strong", "volume-value", format(metric(data, stage.key === "originals" ? "originals" : stage.key === "published" ? "published" : "exported"))));
    const track = element("div", "volume-track");
    const bar = element("span", `volume-fill ${stage.color}`);
    bar.style.width = `${(metric(data, stage.key === "originals" ? "originals" : stage.key === "published" ? "published" : "exported") / maximum) * 100}%`;
    append(track, bar);
    append(row, top, track, element("div", "volume-sub", stage.sub));
    append(container, row);
  }
  const note = element("div", "volume-losses");
  append(note, element("div", "loss-item", `${format(data.excludedEditorial)} excluidas en revisión editorial`), element("div", "loss-item", `${format(data.excludedCommercial)} excluidas en proyección comercial`));
  append(container, note);
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
const renderInsights = (scope: PanelScope): void => {
  const data = metricsFor(scope);
  const container = byId("overview-insights");
  container.replaceChildren();
  const insights = [
    { code: "CONTROL 01", value: format(data.excludedEditorial), label: "Exclusiones editoriales", detail: "No forman parte de las publicaciones individuales." },
    { code: "CONTROL 02", value: format(data.excludedCommercial), label: "Exclusiones comerciales", detail: "Se aplican a fichas ya publicadas técnicamente." },
    { code: "CONTROL 03", value: format(data.withPrice), label: "Fichas con precio", detail: "Precio informado; un valor ausente no equivale a cero." }
  ];
  for (const insight of insights) {
    const card = element("article", "insight-card");
    append(card, element("div", "insight-code", insight.code), element("strong", "insight-value", insight.value), element("div", "insight-label", insight.label), element("p", "insight-detail", insight.detail));
    append(container, card);
  }
};
const renderStages = (scope: PanelScope): void => {
  const data = metricsFor(scope);
  const steps = [
    { index: "01", title: "ORIGEN", value: format(data.originals), detail: "Captura y manifiesto canónico", type: "source" },
    { index: "02", title: "PREPARACIÓN", value: format(data.transformations.changedProducts), detail: "Fichas con cambios observados", type: "prep" },
    { index: "03", title: "FINISH", value: format(data.published), detail: "Publicación individual acreditada", type: "finish" },
    { index: "04", title: "COMERCIAL", value: format(data.exported), detail: "Proyección develop verificada", type: "commercial" },
    { index: "05", title: "BACKEND", value: "—", detail: "Integración en BD no verificada", type: "unknown" }
  ];
  const container = byId("stage-strip");
  container.replaceChildren();
  for (const stage of steps) {
    const card = element("article", `stage-card stage-${stage.type}`);
    append(card, element("span", "stage-index", stage.index), element("div", "stage-title", stage.title), element("div", "stage-value", stage.value), element("p", "stage-detail", stage.detail));
    append(container, card);
  }
};
const renderMatrices = (scope: PanelScope): void => {
  createMatrix("pipeline-matrix", pipelineColumns, scope);
  createMatrix("transform-matrix", transformationColumns, scope);
  createMatrix("quality-matrix", qualityColumns, scope);
};
const renderQualityHighlights = (scope: PanelScope): void => {
  const metrics = metricsFor(scope);
  const container = byId("quality-highlights");
  container.replaceChildren();
  const cards: readonly { key: PanelMetricKey; heading: string; note: string; style: string }[] = [
    { key: "excludedEditorial", heading: "Exclusiones editoriales", note: "Antes de FINISH, acreditadas por proveedor.", style: "blue" },
    { key: "excludedCommercial", heading: "Exclusiones comerciales", note: "Después de FINISH, durante la proyección.", style: "purple" },
    { key: "pendingCategory", heading: "Sin categoría comercial", note: "Exportadas pero pendientes de categorización.", style: "amber" },
    { key: "exceptions", heading: "Excepciones registradas", note: "Incidencias comerciales del corte, no fallos de BD.", style: "neutral" }
  ];
  for (const item of cards) {
    const card = element("article", `quality-card quality-${item.style}`);
    append(card, element("div", "quality-number", format(metric(metrics, item.key))), metricButton(item.key, item.heading), element("p", "quality-note", item.note));
    append(container, card);
  }
};
const evidenceEntry = (title: string, artifact: PanelArtifact, status?: string): HTMLElement => {
  const row = element("div", "evidence-item");
  const top = element("div", "evidence-item-head");
  append(top, element("strong", "", title), element("span", "evidence-verified", status ?? "SHA ACREDITADO"));
  append(row, top, artifactLink(artifact), element("div", "evidence-hash", `SHA256 ${artifact.sha256}`));
  return row;
};
const renderEvidence = (scope: PanelScope): void => {
  const container = byId("evidence-list");
  container.replaceChildren();
  for (const provider of selectedProviders(scope)) {
    const group = element("div", "evidence-group");
    append(group, element("div", "evidence-provider-title", knownName(provider.providerId)));
    if (provider.original.status === "verified") {
      append(group, evidenceEntry("Original canónico", provider.original.artifact, "VERIFICADO"));
    } else {
      const absent = element("div", "evidence-item evidence-unavailable");
      append(absent, element("strong", "", "Original canónico · no disponible"), element("p", "", provider.original.reason), element("code", "mono", provider.original.expectedSha256));
      append(group, absent);
    }
    append(group, evidenceEntry("Publicación individual", provider.publication), evidenceEntry("Proyección comercial", provider.commercial));
    append(container, group);
  }
};
const limitEntry = (title: string, detail: string, type = "warning"): HTMLElement => {
  const row = element("div", `limit-item limit-${type}`);
  append(row, element("span", "limit-symbol", type === "warning" ? "!" : "·"));
  const copy = element("div", "limit-copy");
  append(copy, element("strong", "", title), element("p", "", detail));
  append(row, copy);
  return row;
};
const renderLimits = (scope: PanelScope): void => {
  const data = metricsFor(scope);
  const container = byId("limit-list");
  container.replaceChildren(
    limitEntry("Integración en BD no verificada", "La exportación comercial local no prueba inserción ni aceptación en el backend."),
    limitEntry(`${format(data.pendingCategory)} categorías pendientes`, "Productos exportados sin categoría comercial. No se presentan como preparados para importar."),
    limitEntry("Cambio observado ≠ regla aplicada", "Las transformaciones agregadas del informe no atribuyen automáticamente una decisión editorial a cada ficha.", "info"),
    limitEntry("Sin fechas de activación inferidas", "La fecha mostrada pertenece al paquete comercial, no a cada publicación individual.", "info"),
    limitEntry(`${format(data.repeatedReferences)} grupos de referencia coincidentes`, "Coincidir en la referencia visible no prueba que dos identidades técnicas estén duplicadas.", "info")
  );
};
const sourceListRow = (label: string, artifact: PanelArtifact): HTMLElement => {
  const row = element("div", "source-list-row");
  append(row, element("strong", "", label), artifactLink(artifact), element("code", "mono", artifact.sha256));
  return row;
};
const renderSources = (scope: PanelScope): void => {
  const container = byId("source-list");
  container.replaceChildren(
    sourceListRow("Manifiesto comercial develop", payload.snapshot.commercialManifest),
    sourceListRow("Informe técnico versionado", payload.snapshot.technicalReport),
    sourceListRow("Informe comercial versionado", payload.snapshot.commercialReport)
  );
  for (const item of selectedProviders(scope)) append(container, sourceListRow(`${knownName(item.providerId)} · manifiesto FINISH`, item.publicationManifest));
  const history = element("div", "history-summary");
  append(history, element("strong", "", "RETENCIÓN Y ALCANCE HISTÓRICO"));
  for (const provider of selectedProviders(scope)) {
    append(history, element("p", "", `${knownName(provider.providerId)} · aprobación anterior: ${provider.previousApprovalSha256 ?? "No consta versión anterior conservada"}`));
  }
  append(history, element("p", "", `Paquete comercial anterior: ${payload.snapshot.retainedPreviousSha256.commercial ?? "No conservado"}`));
  append(history, element("p", "", "El explorador compara exclusivamente las fuentes del corte técnico y comercial enlazado. No se generan diferencias temporales sin paquetes compatibles."));
  append(container, history);
};
const render = (): void => {
  byId("provider-summary").textContent = `${selectedProviders(currentScope).length} ${selectedProviders(currentScope).length === 1 ? "PROVEEDOR" : "PROVEEDORES"}`;
  byId("scope-summary").textContent = scopeLabel(currentScope);
  renderKpis(currentScope);
  renderVolume(currentScope);
  renderProviderChart(currentScope);
  renderInsights(currentScope);
  renderStages(currentScope);
  renderMatrices(currentScope);
  renderQualityHighlights(currentScope);
  renderEvidence(currentScope);
  renderLimits(currentScope);
  renderSources(currentScope);
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
  const labels: Record<PanelView, string> = { resumen: "RESUMEN GENERAL", flujo: "FLUJO Y MATRICES", explorador: "EXPLORADOR DE FICHAS", calidad: "CALIDAD Y EVIDENCIAS" };
  byId("current-view-label").textContent = labels[view];
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
byId("header-package").textContent = `PAQUETE UTC ${payload.snapshot.packageDateUtc}`;
byId("package-summary").textContent = `PAQUETE UTC ${payload.snapshot.packageDateUtc}`;
renderDecisions();
render();
const initialHash = location.hash.slice(1);
if (initialHash === "flujo" || initialHash === "explorador" || initialHash === "calidad") navigate(initialHash);
window.addEventListener("panel:request-view", (event: Event) => {
  if (!(event instanceof CustomEvent)) return;
  const target: unknown = event.detail;
  if (target === "resumen" || target === "flujo" || target === "explorador" || target === "calidad") navigate(target);
});
