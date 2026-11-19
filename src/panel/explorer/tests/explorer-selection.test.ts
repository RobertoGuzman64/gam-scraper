import assert from "node:assert/strict";
import { test } from "node:test";
import { readPanelSnapshot } from "../../evidence/read-panel-snapshot.js";
import { createPanelEvidenceWorkspaceFixture } from "../../../testing/builders/panel-evidence-workspace-fixture.js";
import { readPanelExplorer } from "../read-panel-explorer.js";
import { createExplorerIndex, explorerCategoryCounts, explorerProductMetrics, explorerStageCounts, selectExplorerProducts } from "../explorer-selection.js";
import type { ExplorerSelection } from "../explorer-selection.js";
import type { PanelExplorerProduct, PanelFieldDifference } from "../types.js";

const fixture = createPanelEvidenceWorkspaceFixture();
const baseSelection: ExplorerSelection = {
  providerId: "todos", stage: "todos", category: "todos", query: "",
  sort: "most-differences", missingOriginalDescription: false,
  withoutOriginalSpecs: false, withTechnicalAdditions: false, withEditorialChanges: false
};
const source = async (): Promise<PanelExplorerProduct> => {
  const workspace = await fixture.root();
  const explorer = await readPanelExplorer(workspace, await readPanelSnapshot(workspace));
  const item = explorer.products.find((candidate) => candidate.original && candidate.published && candidate.commercial);
  assert.ok(item?.original && item.published);
  return item;
};
const difference = (field: string, group: PanelFieldDifference["group"], change: PanelFieldDifference["change"]): PanelFieldDifference =>
  ({ field, group, change, before: "original", after: "publicado" });
const product = (base: PanelExplorerProduct, identity: string, specs: number, changes: readonly PanelFieldDifference[],
  shortDescription: string | null = "Texto original"): PanelExplorerProduct => {
  assert.ok(base.original && base.published);
  const originalSpecs = Object.fromEntries(Array.from({ length: specs }, (_, index) => [`Campo ${index}`, "Valor"]));
  return { ...base, identity,
    original: { ...base.original, specs: originalSpecs, shortDescription, generalDescription: "Descripción original" },
    changes
  };
};

test("separa carencias originales, incorporaciones, valores modificados y ambigüedades", async () => {
  const base = await source();
  const item = product(base, "gam:ejemplo:1", 0, [
    difference("Peso", "technical", "added"), difference("Año", "technical", "changed"),
    difference("Medida", "technical", "ambiguous"), difference("Nombre", "content", "removed")
  ], null);
  const metrics = explorerProductMetrics(item);
  assert.deepEqual(metrics, {
    originalSpecs: 0, publishedSpecs: Object.keys(item.published?.specs ?? {}).length,
    technicalAdditions: 1, technicalChanges: 1, observedDifferences: 3,
    missingOriginalDescription: true, missingOriginalShortDescription: true,
    missingOriginalGeneralDescription: false, titleChanges: false, editorialChanges: false
  });
});

test("menos prestaciones originales ordena por escasez observable sin índice global inventado", async () => {
  const base = await source();
  const a = product(base, "a", 9, [difference("Año", "technical", "added")]);
  const b = product(base, "b", 0, [difference("Peso", "technical", "added")]);
  const c = product(base, "c", 2, []);
  const selected = selectExplorerProducts([a, c, b], { ...baseSelection, sort: "fewest-original-specs" });
  assert.deepEqual(selected.map((item) => item.identity), ["b", "c", "a"]);
});

test("incorporaciones y modificaciones técnicas se ordenan por su propia clase", async () => {
  const base = await source();
  const additions = product(base, "additions", 2, [difference("A", "technical", "added"), difference("B", "technical", "added")]);
  const changed = product(base, "changed", 2, [difference("A", "technical", "changed"), difference("B", "technical", "changed"), difference("C", "technical", "changed")]);
  assert.deepEqual(selectExplorerProducts([changed, additions], { ...baseSelection, sort: "most-technical-additions" })
    .map((item) => item.identity), ["additions", "changed"]);
  assert.deepEqual(selectExplorerProducts([additions, changed], { ...baseSelection, sort: "most-technical-changes" })
    .map((item) => item.identity), ["changed", "additions"]);
});

test("las fichas no comparables siguen accesibles con cualquier ordenación", async () => {
  const base = await source();
  const item = product(base, "publicada", 1, [difference("Año", "technical", "added")]);
  const noOriginal = { ...item, identity: "sin-original", original: null };
  const excluded = { ...item, identity: "excluida", published: null, stage: "editorial-excluded" as const };
  assert.deepEqual(selectExplorerProducts([excluded, noOriginal, item], baseSelection).map((entry) => entry.identity),
    ["publicada", "excluida", "sin-original"]);
  assert.equal(selectExplorerProducts([excluded, noOriginal, item], { ...baseSelection, sort: "reference" }).length, 3);
  assert.deepEqual(selectExplorerProducts([excluded], { ...baseSelection, stage: "editorial-excluded" })
    .map((entry) => entry.identity), ["excluida"]);
});

test("filtros de carencias y aportaciones son combinables y no mezclan etapas", async () => {
  const base = await source();
  const useful = product(base, "apta", 0, [difference("Peso", "technical", "added"),
    difference("Descripción corta", "content", "added")], null);
  const noChanges = product(base, "sin-cambios", 0, [], null);
  const hasSpecs = product(base, "con-specs", 3, useful.changes, null);
  const selected = selectExplorerProducts([noChanges, hasSpecs, useful], {
    ...baseSelection, withoutOriginalSpecs: true, missingOriginalDescription: true,
    withTechnicalAdditions: true, withEditorialChanges: true
  });
  assert.deepEqual(selected.map((item) => item.identity), ["apta"]);
});

test("búsqueda sin tildes, proveedor, etapa y categoría respetan el ámbito solicitado", async () => {
  const base = await source();
  const a = { ...product(base, "gam:única", 1, []), providerId: "gam" as const, reference: "Grúa 123", category: "Elevación" };
  const b = { ...a, identity: "gomariz:única", providerId: "gomariz" as const };
  const selected = selectExplorerProducts([b, a], {
    ...baseSelection, providerId: "gam", stage: "commercial", category: "Elevación", query: "grua 123"
  });
  assert.deepEqual(selected.map((item) => item.identity), [a.identity]);
});

test("empates mantienen orden determinista por identidad sin mutar las fichas", async () => {
  const base = await source();
  const a = product(base, "gam:001", 1, [difference("A", "technical", "added")]);
  const b = product(base, "gam:002", 1, [difference("B", "technical", "added")]);
  const original = JSON.stringify([b, a]);
  for (let index = 0; index < 3; index++) {
    assert.deepEqual(selectExplorerProducts([b, a], baseSelection).map((item) => item.identity), ["gam:001", "gam:002"]);
  }
  assert.equal(JSON.stringify([b, a]), original);
});

test("la descripción parcialmente ausente se identifica sin clasificarla como peor calidad", async () => {
  const base = await source();
  const item = product(base, "parcial", 1, [], " ");
  assert.equal(explorerProductMetrics(item).missingOriginalDescription, true);
  assert.deepEqual(selectExplorerProducts([item], { ...baseSelection, missingOriginalDescription: true })
    .map((entry) => entry.identity), ["parcial"]);
  assert.equal(explorerProductMetrics(product(base, "completa", 1, [])).missingOriginalDescription, false);
});

test("F4 separa descripciones ausentes, cambios técnicos y títulos sin inventar causas", async () => {
  const base = await source();
  const useful = product(base, "útil", 1, [difference("Título", "content", "changed"),
    difference("Peso", "technical", "changed")], null);
  const other = product(base, "otra", 0, [difference("Peso", "technical", "added")]);
  assert.ok(other.original);
  const absentGeneral = { ...other, identity: "sin-general", original: {
    ...other.original, generalDescription: "   "
  } };
  assert.deepEqual(selectExplorerProducts([other, useful, absentGeneral], {
    ...baseSelection, missingOriginalShortDescription: true, withTechnicalChanges: true,
    withTitleChanges: true
  }).map((entry) => entry.identity), ["útil"]);
  assert.deepEqual(selectExplorerProducts([other, useful, absentGeneral], {
    ...baseSelection, missingOriginalGeneralDescription: true
  }).map((entry) => entry.identity), ["sin-general"]);
});

test("F4 cuenta estados y categorías según combinaciones sin excluir etapas", async () => {
  const base = await source();
  const commercial = { ...product(base, "A", 1, []), category: "Carretillas" };
  const editorial = { ...product(base, "B", 1, []), stage: "editorial-excluded" as const,
    published: null, category: "Plataformas" };
  const commercialExcluded = { ...product(base, "C", 1, []), stage: "commercial-excluded" as const,
    commercial: null, category: "Carretillas" };
  const index = createExplorerIndex([commercial, editorial, commercialExcluded]);
  assert.deepEqual(explorerStageCounts(index, baseSelection), {
    todos: 3, commercial: 1, "commercial-excluded": 1, "editorial-excluded": 1
  });
  assert.deepEqual(explorerStageCounts(index, { ...baseSelection, category: "Carretillas" }), {
    todos: 2, commercial: 1, "commercial-excluded": 1, "editorial-excluded": 0
  });
  assert.deepEqual([...explorerCategoryCounts(index, { ...baseSelection, stage: "editorial-excluded" }).counts],
    [["Plataformas", 1]]);
  assert.equal(explorerCategoryCounts(index, { ...baseSelection, stage: "editorial-excluded" }).total, 1);
  assert.deepEqual(selectExplorerProducts([], { ...baseSelection, stage: "editorial-excluded" }, index)
    .map((entry) => entry.identity), ["B"]);
});

test("F4 reutiliza el índice de búsqueda sin mutar ni recalcular el catálogo", async () => {
  const base = await source();
  const first = { ...product(base, "X", 1, []), reference: "Máquina única" };
  const index = createExplorerIndex([first]);
  assert.deepEqual(selectExplorerProducts([], { ...baseSelection, query: "maquina UNICA" }, index)
    .map((item) => item.identity), ["X"]);
  assert.equal(index[0]?.item, first);
});
