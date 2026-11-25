import assert from "node:assert/strict";

export const assertInformationalMetricLabels = (html: string): void => {
  assert.ok(html.includes('"kpi-metric-label"'));
  assert.ok(html.includes('cell.textContent = column.label'));
  assert.ok(html.includes('cell.scope = "col"'));
  for (const removed of ["definition-dialog", "definition-title", "definition-source", "metric-button", "metric-info",
    "close-definition", "dialog-files-toggle", "sourceArtifacts", "local-proof-link", "openDefinition",
    "Activar enlaces locales", "DEFINICIÓN Y PROCEDENCIA"]) assert.ok(!html.includes(removed), removed);
  assert.ok(html.includes('id="rule-dialog"'));
  assert.ok(html.includes('id="rule-dialog-code"'));
  for (const rule of ["source", "normalization", "exclusion"]) assert.ok(html.includes(`data-rule="${rule}"`));
  assert.ok(html.includes('data-rule="source"'));
};

export const assertDemonstrationOrder = (html: string): void => {
  assert.equal((html.match(/<section class="page-view" data-view=/g) ?? []).length, 4);
  const labels = ["ETAPA 1 / MAPA DE PROCEDENCIA", "ETAPA 2 / NORMALIZACIÓN", "ETAPA 3 / CORROBORACIÓN DOCUMENTADA", "ETAPA 4 / CONTROL Y EXCLUSIÓN"];
  for (const step of labels) assert.equal(html.split(step).length - 1, 1, step);
  for (let i = 1; i < labels.length; i++) {
    assert.ok(html.indexOf(labels[i - 1]!) < html.indexOf(labels[i]!), labels[i]);
  }
  const views = ["resumen", "flujo", "calidad", "explorador"];
  for (let i = 1; i < views.length; i++) {
    assert.ok(html.indexOf(`data-nav="${views[i - 1]}"`) < html.indexOf(`data-nav="${views[i]}"`));
    assert.ok(html.indexOf(`data-view="${views[i - 1]}"`) < html.indexOf(`data-view="${views[i]}"`));
  }
  assert.ok(html.includes("03 / VALIDACIÓN Y CONTROL"));
  for (const id of ["source-map-title", "source-example", "checks-title"]) assert.ok(html.includes(`id="${id}"`));
  assert.ok(html.includes('id="source-example"'));
  assert.ok(html.includes('id="normalization-examples"'));
  assert.ok(html.includes('id="excluded-example"'));
  assert.ok(html.includes('id="control-exclusion-editorial"'));
  assert.ok(html.includes('id="control-exclusion-commercial"'));
  assert.ok(html.includes('<details class="audit-disclosure"><summary>Consultar matrices de recorrido y transformación (A y B)'));
  assert.ok(!html.includes('id="quality-cut-title"'));
  assert.ok(html.includes("EJEMPLOS DE REGLA VIGENTE"));
  assert.ok(html.includes("Cuatro comprobaciones para decidir"));
  assert.ok(!html.includes("Ver comprobaciones y código de referencia"));
  assert.ok(!html.includes('class="mechanism-detail"'));
  assert.ok(html.includes("No todo rechazo significa lo mismo"));
  assert.ok(html.includes("source-map-grid"));
  assert.ok(html.includes("CORROBORACIÓN DOCUMENTADA"));
  assert.ok(html.includes("panel:request-case"));
  assert.ok(html.includes('"normalizationExamples":['));
  assert.ok(!html.includes("regla aplicada históricamente a esta ficha"));
};

export const assertDiagramPresentation = (html: string): void => {
  assert.ok(html.indexOf('id="normalization-title"') < html.indexOf('id="pipeline-matrix"'));
  assert.ok(html.indexOf('id="quality-title"') < html.indexOf('id="checks-title"'));
  assert.ok(html.indexOf('id="checks-title"') < html.indexOf('id="controls-title"'));
  assert.ok(html.indexOf('id="quality-title"') < html.indexOf('id="controls-title"'));
  assert.ok(html.indexOf('id="controls-title"') < html.indexOf('id="excluded-example"'));
  assert.ok(!html.includes('id="stage-strip"'));
  assert.ok(!html.includes('id="quality-highlights"'));
  assert.ok(html.includes('class="normalization-diagram"'));
  assert.ok(html.includes('class="validation-diagram"'));
  assert.ok(html.includes('class="check-result-pass"'));
  assert.ok(html.includes('class="check-result-stop"'));
  assert.ok(html.includes('class="control-group control-fields"'));
  assert.ok(html.includes('class="control-group control-records"'));
  assert.ok(html.includes('id="control-exclusion-editorial"'));
  assert.ok(html.includes('id="control-exclusion-commercial"'));
  assert.ok(html.includes("No se atribuye o incorpora por esa ruta"));
  assert.ok(html.includes("No entra en el paquete comercial"));
  assert.ok(html.includes("Comparar contenido de la ficha"));
  assert.ok(html.includes('id="normalization-example"'));
  assert.ok(html.includes('id="excluded-example"'));
  assert.ok(html.includes('class="audit-disclosure"'));
  assert.ok(!html.includes("presentacion-start"));
};

export const assertPortableNavigation = (html: string): void => {
  assert.ok(!html.includes('id="local-evidence-toggle"'));
  for (const marker of ["presentation-start", "presentation-prev", "presentation-next", "presentation-exit",
    "presentation-strip", "presentationSteps", "RECORRIDO GUIADO", "presentation-focus"]) {
    assert.ok(!html.includes(marker), marker);
  }
  for (const anchor of ["overview-kpis-title", "normalization-title", "controls-title", "explorer-detail"]) {
    assert.ok(html.includes(`id="${anchor}"`), anchor);
  }
  assert.equal((html.match(/data-nav="(?:resumen|flujo|explorador|calidad)"/g) ?? []).length, 4);
  assert.equal((html.match(/<svg class="nav-icon" aria-hidden="true"/g) ?? []).length, 4);
  assert.ok(!html.includes('<span class="nav-icon" aria-hidden="true">'));
  assert.ok(html.includes('class="nav-button active" type="button" data-nav="resumen" aria-current="page"'));
  assert.ok(html.includes("panel:request-case"));
  assert.ok(html.includes("panel:request-view"));
  assert.ok(html.includes("const chooseCase ="));
  assert.ok(!html.includes("renderCases()"));
  assert.ok(!html.includes('id="explorer-cases"'));
  assert.ok(html.includes("filters.render()"));
  assert.ok(html.includes("renderedId === key"));
  assert.ok(!html.includes("explorer-sort-current"));
  assert.ok(!html.includes('id="quality-cut-files-list"'));
  assert.ok(!html.includes('class="stage-strip"'));
  assert.ok(!html.includes('"stage-value"'));
  assert.ok(!html.includes('<script type="module" src='));
};

export const assertMatrixPlacement = (html: string): void => {
  const flow = html.split('data-view="flujo"')[1]?.split('data-view="calidad"')[0];
  const quality = html.split('data-view="calidad"')[1]?.split('data-view="explorador"')[0];
  assert.ok(flow);
  assert.ok(quality);
  for (const id of ["pipeline-matrix", "transform-matrix"]) assert.ok(flow.includes(`id="${id}"`));
  for (const id of ["controls-title", "control-exclusion-editorial", "control-exclusion-commercial"])
    assert.ok(quality.includes(`id="${id}"`));
  assert.ok(!quality.includes('id="quality-highlights"'));
  assert.ok(!html.includes('id="stage-strip"'));
  assert.ok(!html.includes('renderStages()'));
  assert.ok(!html.includes('renderQualityHighlights('));
  assert.ok(html.includes('renderSpecifications(item, additionKind)'));
  assert.ok(html.includes('renderDescriptions(item, "shortDescription")'));
  assert.ok(html.includes('renderDescriptions(item, "generalDescription")'));
  assert.ok(!html.includes('renderFieldStory(item)'));
  assert.ok(html.includes('renderTechnicalContribution(item)'));
  assert.ok(!html.includes('renderImpactComparison(item)'));
  assert.ok(!html.includes('const technicalKeys = new Set('));
  assert.ok(!html.includes('const editorialDifferences = item.changes.filter('));
};

export const assertNoRetiredDocumentControls = (html: string): void => {
  const pending = [html];
  const scripts: string[] = [];
  const processed = new Set<string>();
  while (pending.length) {
    const source = pending.pop();
    if (!source) continue;
    for (const match of source.matchAll(/data:text\/javascript;base64,([A-Za-z0-9+/=]+)/g)) {
      const encoded = match[1];
      if (!encoded || processed.has(encoded)) continue;
      processed.add(encoded);
      const decoded = Buffer.from(encoded, "base64").toString("utf8");
      scripts.push(decoded);
      pending.push(decoded);
    }
  }
  assert.ok(scripts.length > 0);
  const all = `${html}\n${scripts.join("\n")}`;
  for (const forbidden of ["Ver trazabilidad", "spec-provenance-details", "spec-provenance-artifact",
    "spec-provenance-caution", "renderAdditionProvenance"]) {
    assert.ok(!all.includes(forbidden), forbidden);
  }
  for (const preserved of ['id="explorer-spec-kind"', 'value="own"', 'value="reused"',
    "spec-kind-own", "spec-kind-reused", "renderStageCards(item, normalizedFields)",
    "stageSpecAddition(stage, key, value, item.specAdditions, normalizedFields)",
    '"source":{', '"normalization":{', '"exclusion":{']) {
    assert.ok(all.includes(preserved), preserved);
  }
};
