import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const assertExplorerFilters = (html: string): void => {
  assert.ok(html.includes('id="explorer-active-filters"'));
  assert.ok(html.includes('class="surface-card explorer-filter-dashboard"'));
  assert.ok(html.includes('id="explorer-category-picker"'));
  assert.ok(html.includes('id="explorer-stage-count-commercial-excluded"'));
  assert.ok(!html.includes('id="explorer-order-note"'));
  assert.ok(!html.includes("Tres etapas de la ficha"));
  assert.ok(html.includes('<option value="reference">Referencia · todas las fichas</option>'));
  assert.ok(html.includes("filters.resetForCase()"));
  assert.ok(html.includes('class="explorer-layout"'));
  assert.ok(!html.includes('id="explorer-cases"'));
  assert.ok(html.includes("const chooseCase ="));
  assert.ok(html.includes('compareSection("Título"'));
  assert.ok(!html.includes("Ver procedencia de los cambios"));
  assert.ok(!html.includes("Ver decisión acreditada y motivos"));
  assert.ok(html.includes("Comparar contenido de la ficha"));
};

export const assertCompactCatalog = (html: string): void => {
  assert.ok(html.includes('if (item.stage !== "commercial")'));
  assert.ok(!html.includes('class="product-impact'));
  assert.ok(html.includes('class="explorer-catalog-content"'));
  assert.ok(!html.includes('Specs ${formatNumber.format(metrics.originalSpecs)}'));
  assert.ok(html.includes('id="explorer-active-filters"'));
  assert.ok(html.includes('id="explorer-sort"'));
};

export const assertCompactStages = async (html: string): Promise<void> => {
  assert.ok(html.includes("renderStageCards(item, normalizedFields)"));

  assert.ok(html.includes("renderTechnicalContribution(item)"));
  assert.ok(html.includes("explorer-contribution"));
  assert.ok(!html.includes("renderImpactComparison(item)"));
  assert.ok(html.includes("Comparar contenido de la ficha"));
  assert.ok(!html.includes("recordCard(\"01 / ORIGINAL\""));
  assert.ok(html.includes("data:text/javascript;base64,"));
  assert.ok(html.includes(".stage-record-grid {display:grid;grid-template-columns:repeat(3,minmax(0,1fr))"));
  const matches = [...html.matchAll(/data:text\/javascript;base64,([A-Za-z0-9+/=]+)/g)];
  assert.ok(matches.length > 0);
  const cards = await readFile(join(process.cwd(), "dist", "panel", "ui", "explorer-stage-cards.js"), "utf8");
  for (const key of ["original", "published", "commercial"]) assert.ok(cards.includes(key));
  assert.ok(cards.includes("dialog.showModal()"));
  assert.ok(cards.includes("stageSpecAddition(stage, key, value, item.specAdditions, normalizedFields)"));
  assert.ok(cards.includes("Añadida · "));
  for (const className of ["spec-kind-own", "spec-kind-reused", "spec-kind-pending"]) {
    assert.ok(html.includes(`.equipzilla-product-view .equipzilla-spec-item.${className}`));
  }
  assert.ok(cards.includes("dialog.remove()"));
  assert.ok(cards.includes("Etapa no disponible en este expediente"));
  assert.ok(cards.includes("Sin fotografía disponible"));
  assert.ok(cards.includes("Imagen externa no disponible"));
  assert.ok(cards.includes("Abrir imagen en otra pestaña"));
  assert.ok(cards.includes("show(index + 1)"));
  assert.ok(cards.includes("unavailablePhoto(\"equipzilla-gallery-empty\", url)"));
  assert.ok(!cards.includes("window.fetch("));
};

export const assertExpandedStagePresentation = async (html: string): Promise<void> => {
  const cards = await readFile(join(process.cwd(), "dist", "panel", "ui", "explorer-stage-cards.js"), "utf8");
  for (const label of ["01 · ORIGINAL", "02 · FINISH", "03 · COMERCIAL"]) assert.ok(cards.includes(label));
  assert.ok(cards.includes("item[stage]"));
  assert.ok(cards.includes("imageUrls(record)"));
  assert.ok(cards.includes("equipzilla-gallery-thumbnails"));
  assert.ok(cards.includes("Fotografía anterior"));
  assert.ok(cards.includes("Fotografía siguiente"));
  assert.ok(cards.includes("ArrowLeft"));
  assert.ok(cards.includes("ArrowRight"));
  assert.ok(cards.includes("aria-pressed"));
  assert.ok(cards.includes("stage-viewer-close"));
  assert.ok(cards.includes("trigger.focus({ preventScroll: true })"));
  assert.ok(cards.includes('stage === "commercial"'));
  assert.ok(cards.includes("item.commercial.attributes"));
  assert.ok(!cards.includes("window.fetch("));
  assert.ok(!cards.includes("innerHTML"));
  for (const rule of [
    ".stage-record-viewer.equipzilla-stage-dialog",
    ".equipzilla-product-view .equipzilla-product-top",
    ".equipzilla-product-view .equipzilla-gallery-frame",
    ".equipzilla-product-view .equipzilla-spec-grid",
    ".equipzilla-product-view .equipzilla-gallery-thumbnail"
  ]) assert.ok(html.includes(rule), rule);
  for (const color of ["#f3533d", "#387e7f", "#fff"]) assert.ok(html.toLowerCase().includes(color));
  assert.ok(!html.includes("https://fonts.googleapis.com"));
};

export const assertStageSectionOrder = (html: string): void => {
  const sections = [
    'compareSection("Título"', 'compareSection("Descripción corta"',
    'compareSection("Especificaciones técnicas"', 'compareSection("Descripción general"',
    'compareSection("Categoría y datos comerciales"'
  ];
  for (const [position, section] of sections.entries()) {
    assert.ok(html.includes(section), section);
    if (position) assert.ok(html.indexOf(sections[position - 1] ?? "") < html.indexOf(section));
  }
  for (const removed of ["E5 / LA HISTORIA DEL DATO", "Ver procedencia de los cambios", "Diferencias en otros campos",
    "Ver decisión acreditada y motivos", "Ver artefactos íntegros y huellas SHA256", "RESOLUCIÓN Y AUDITORÍA",
    "renderFieldStory", "explorer-provenance-disclosure", "explorer-decision-detail", "audit-artifacts", "sourceLink("]) {
    assert.ok(!html.includes(removed), removed);
  }
  assert.ok(html.includes('item.decision.reason'));
  assert.ok(html.includes('item.decision.issues'));
  assert.ok(html.includes('item.decision.evidenceUrls'));
  assert.ok(html.includes('item.commercial.categorySellID'));
  assert.ok(html.includes('renderCommercialAttributes(item)'));
  assert.ok(html.includes('!item.original || !item.published'));
  assert.ok(html.includes('row.original === null && row.finish === null && row.commercial === null'));
  assert.ok(html.includes('String(item.commercial.categorySellID)'));
};

export const assertExpandedStageReading = async (html: string): Promise<void> => {
  const cards = await readFile(join(process.cwd(), "dist", "panel", "ui", "explorer-stage-cards.js"), "utf8");
  assert.ok(cards.includes('element("h3", "", "Descripción corta")'));
  assert.ok(cards.includes('"equipzilla-general-description"'));
  assert.ok(cards.includes('"equipzilla-general-text"'));
  assert.ok(cards.includes('"equipzilla-commercial-attributes"'));
  assert.ok(cards.includes('"equipzilla-spec-grid equipzilla-attributes-grid"'));
  assert.match(cards, /if \(additional\)\s*content\.append\(additional\)/);
  assert.ok(cards.includes('dialog.showModal()'));
  assert.ok(cards.includes('dialog.scrollTop = 0'));
  assert.match(cards, /if \(trigger\.isConnected\)\s*trigger\.focus\(\{ preventScroll: true \}\)/);
  assert.ok(!cards.includes('element("details"'));
  assert.ok(!cards.includes('equipzilla-read-more'));
  assert.ok(!html.includes('equipzilla-disclosure'));
  assert.ok(html.includes('.equipzilla-product-view .equipzilla-general-text'));
  assert.ok(html.includes('.comparison-group-title'));
};

export const assertCatalogPagination = (html: string): void => {
  assert.ok(html.includes("max-width:1900px"));
  assert.ok(html.includes("grid-template-columns:minmax(350px,380px) minmax(0,1fr)"));
  assert.ok(html.includes(".explorer-list {max-height:none;overflow:visible}"));
  assert.ok(html.includes("const pageSize = 30"));
  assert.ok(html.includes("Math.ceil(filtered.length / pageSize) - 1"));
  assert.ok(html.includes("filtered.slice(page * pageSize, (page + 1) * pageSize)"));
  assert.ok(html.includes("Math.floor(visible.findIndex((item) => item.identity === selectedId) / pageSize)"));
  assert.ok(html.includes('catalog.scrollIntoView({ block: "start", behavior: "instant" })'));
  assert.ok(html.includes('id="explorer-page-prev"'));
  assert.ok(html.includes('id="explorer-page-next"'));
};

export const assertCatalogRows = (html: string): void => {
  assert.ok(html.includes('create("span", "product-row-provider", names[item.providerId])'));
  assert.ok(html.includes('create("strong", "product-row-reference", item.reference ?? "Sin referencia")'));
  assert.ok(html.includes('create("span", "product-title", item.published?.title ?? item.original?.title ?? "Sin título")'));
  assert.ok(!html.includes('create("small", "product-context"'));
  assert.ok(html.includes('create("div", "detail-metadata")'));
  assert.ok(html.includes('`Categoría: ${item.category ?? "No consta"}`'));
  assert.ok(html.includes('grid-template-columns:minmax(350px,380px) minmax(0,1fr);grid-template-rows:max-content minmax(0,1fr)'));
  assert.ok(html.includes('.explorer-list {display:grid;gap:5px;max-height:none;overflow:visible;padding-right:0}'));
  assert.ok(html.includes('.explorer-list {max-height:none;overflow:visible}'));
  assert.ok(html.includes('const pageSize = 30'));
  assert.ok(html.includes('catalog.scrollIntoView({ block: "start", behavior: "instant" })'));
  assert.ok(html.includes('showSelectionForDesktop()'));
  assert.ok(html.includes('detail.scrollIntoView({ block: "start", behavior: "instant" })'));
  assert.ok(html.includes('(max-width: 1250px)'));
};
