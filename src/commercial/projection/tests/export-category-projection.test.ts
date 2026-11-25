import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import type { CommercialBaselineInput } from "../../diagnostics/commercial-baseline.js";
import { planCommercialExport } from "../export-projection.js";
import { decideCommercialCategory } from "../category-decision.js";
import { isValidCommercialCategory } from "../category-projection.js";
import { accreditCommercialPlan } from "../../diagnostics/commercial-accreditation.js";
import { selectAccreditedCommercialInputs } from "../../../testing/builders/commercial-publication-selection.js";
import { loadImportCatalog } from "../../../infrastructure/filesystem/legacy-export/import-catalog-loader.js";
import { loadCommercialReference } from "../../../infrastructure/filesystem/legacy-export/commercial-reference-loader.js";
import { fileURLToPath } from "node:url";
import { catalog, logos, source, entry, plan } from "./export-projection-fixture.js";

test("conserva todas las elegibles incluso sin categoría, y registra exclusiones de lotes y herramientas", () => {
  const unresolved = entry("101", null);
  const batch = entry("102");
  const tool = entry("103");
  const output = plan([unresolved, {
    ...batch,
    source: { ...batch.source, url: "https://example.org/lotes/102" },
    published: { ...batch.published, sourceUrl: "https://example.org/lotes/102" },
    mapped: { ...batch.mapped, product: { ...batch.mapped.product, sourceUrl: "https://example.org/lotes/102" } }
  }, {
    ...tool,
    source: { ...tool.source, categoryKey: "herramientas" }
  }]);
  assert.equal(output.total, 3);
  assert.equal(output.summary.exported, 1);
  assert.equal(output.summary.pendingCategory, 1);
  assert.equal(output.summary.excludedLots, 1);
  assert.equal(output.summary.excludedTools, 1);
  assert.equal(output.products[0]?.categorySellID, null);
  assert.deepEqual(output.products[0]?.attributes, []);
  assert.ok(output.exceptions.some((item) => item.reason === "sin-categoria"));
  assert.equal(output.excluded.length, 2);
  assert.equal(output.excluded[0]?.reason, "lote");
  assert.equal(output.excluded[1]?.reason, "herramienta");
});

test("Manain excluye herramientas portátiles solo con identidad y familia documentadas", () => {
  const tool: ProductRecord = {
    ...source("MAN676"), providerId: "manain", categoryKey: "venta", categoryName: "Maquinaria en venta",
    url: "https://manain.com/producto/venta-pequena-maquinaria-martillos-electricos-bosch-gsh-11-e/",
    title: "GSH 11 E", brand: "BOSCH", model: "GSH 11 E",
    specs: { Marca: "BOSCH", Modelo: "GSH 11 E", Motor: "Eléctrico" }
  };
  const radial: ProductRecord = {
    ...tool, reference: "MAN683", title: "GWS 22-230 H", model: "GWS 22-230 H",
    url: "https://manain.com/producto/venta-pequena-maquinaria-radiales-electricas-bosch-gws-22-230-h-3/",
    specs: { Marca: "BOSCH", Modelo: "GWS 22-230 H", Motor: "Eléctrico" }
  };
  for (const record of [tool, radial]) {
    assert.deepEqual(decideCommercialCategory(record, null),
      { status: "excluded", reason: "herramienta", categorySellID: null });
  }
  const unrelated: readonly ProductRecord[] = [
    { ...tool, url: tool.url.replace("manain.com", "other.example") },
    { ...tool, url: tool.url.replace("martillos-electricos", "martillo-miniex") },
    { ...tool, categoryKey: "maquinaria" },
    { ...tool, brand: "Otra marca" },
    { ...tool, specs: { ...tool.specs, Modelo: "OTRO" } },
    { ...tool, specs: { ...tool.specs, Motor: "Diésel" } },
    { ...tool, model: "OTRO" },
    { ...tool, title: "Otra máquina" },
    { ...radial, url: radial.url.replace("radiales-electricas", "martillos-electricos") },
    { ...tool, url: "https://manain.com/producto/venta-pequena-maquinaria-compactacion-husqvarna-lt-6005/" }
  ];
  for (const record of unrelated) {
    assert.equal(decideCommercialCategory(record, null).status, "pending");
  }
});

test("rechaza identidades cambiadas, duplicadas o categorías no hoja", () => {
  const sample = entry("109");
  assert.throws(() => plan([sample, sample]), /duplicada/);
  assert.throws(() => plan([{ ...sample, published: { ...sample.published, reference: "OTRA" } }]), /discordante/);
  const wrong = { ...sample, mapped: { ...sample.mapped, product: { ...sample.mapped.product, categorySellID: 20 } } };
  assert.throws(() => plan([wrong]), /Categoría comercial no válida/);
});

test("exporta solo maquinaria y acredita exclusión de accesorio con evidencia explícita", () => {
  const sample = entry("2373", null);
  const url = "https://online.gamrentals.com/es/plataformas-elevadoras-bravi/2373-kit-sobre-elevacion-small-e-bravi";
  const source = { ...sample.source, url, categoryKey: "marcas-nuevas", title: "KIT DE ELEVACIÓN BRAVI SMALL-E",
    shortDescription: "Accesorio para la plataforma Bravi Leonardo HD" };
  const input: CommercialBaselineInput = {
    source: { ...source, brand: "BRAVI" },
    published: { ...sample.published, sourceUrl: url },
    mapped: { ...sample.mapped, product: { ...sample.mapped.product, sourceUrl: url } }
  };
  const output = plan([input]);
  assert.equal(output.summary.exported, 0);
  assert.equal(output.summary.excludedAccessories, 1);
  assert.equal(output.summary.excludedTools, 0);
  assert.deepEqual(output.excluded.map((item) => item.reason), ["accesorio"]);
  const accreditation = accreditCommercialPlan([input], output, catalog, logos, null);
  assert.equal(accreditation.summary.blocking, 0);
  assert.equal(accreditation.summary.pending, 0);
});

test("Manain clasifica mástiles, compactación y agua en categorías generales acreditadas", async () => {
  const realCatalog = await loadImportCatalog();
  const { brandLogos } = await loadCommercialReference();
  const root = fileURLToPath(new URL("../../../../", import.meta.url));
  const categories = new Map<string, number>([
    ["MA4032", 34], ["MA4031", 34], ["MA3804", 34], ["MA3641", 34],
    ["MA3622", 34], ["MA3806", 34], ["MA3264", 34], ["MA3719", 34],
    ["MA1824", 47], ["MAN1120", 68],
    ["MAN2327", 73], ["MAN2285", 73], ["MA3959", 73], ["MA3803", 73],
    ["MA3306", 73], ["MA4054", 73], ["MA4048", 73],
    ["MAN980", 67], ["MAN743", 67], ["MAN742", 67], ["MAN553", 67],
    ["MAN118", 104], ["MAN685", 104]
  ]);
  const pending = ["MAN1188"];
  const selected = await selectAccreditedCommercialInputs(root, realCatalog,
    { manain: [...categories.keys(), ...pending] });
  const manain = selected.get("manain");
  assert.ok(manain);
  const before = JSON.stringify(manain.entries);
  const output = planCommercialExport(manain.entries, "manain", manain.publicationSha256,
    realCatalog, brandLogos, null, null);
  assert.equal(output.total, 24);
  assert.equal(output.summary.exported, 24);
  assert.equal(output.summary.categorized, 23);
  assert.equal(output.summary.pendingCategory, 1);
  assert.equal(accreditCommercialPlan(manain.entries, output, realCatalog, brandLogos, null).summary.blocking, 0);
  assert.equal(JSON.stringify(manain.entries), before);
  for (const entry of manain.entries) {
    const expected = categories.get(entry.source.reference ?? "") ?? null;
    const product = output.products.find((candidate) => candidate.reference === entry.source.reference);
    assert.ok(product);
    assert.equal(product.categorySellID, expected, entry.source.reference ?? undefined);
    assert.deepEqual(product.spec, entry.published.spec);
    if (expected === null) {
      assert.deepEqual(product.attributes, []);
      continue;
    }
    assert.equal(isValidCommercialCategory(entry.source, expected, "Segunda_Mano", realCatalog), true);
    assert.equal(isValidCommercialCategory(entry.source, expected, "Nuevo", realCatalog), false);
    if (expected === 67 || expected === 73 || expected === 104) assert.deepEqual(product.attributes, []);
    const source = entry.source;
    const modified = [
      { ...source, categoryKey: "maquinaria" },
      { ...source, url: source.url.replace("manain.com", "otro.example") },
      { ...source, brand: "OTRA MARCA" },
      { ...source, model: "OTRO MODELO" },
      { ...source, specs: { ...source.specs, Marca: "OTRA MARCA" } },
      { ...source, specs: { ...source.specs, Modelo: "OTRO MODELO" } },
      { ...source, specs: { ...source.specs, Motor: expected === 67 ? "Eléctrico" : "Gasolina" } },
      { ...source, specs: { ...source.specs, "Nueva o usada": "nueva" } },
      ...(expected === 68 ? [
        { ...source, specs: { ...source.specs, "Diametro del tambor": "800 mm" } },
        { ...source, specs: { ...source.specs, Peso: "3000 kg" } }
      ] : expected === 67 ? [
        { ...source, title: "OTRO MODELO" },
        { ...source, specs: { ...source.specs, Peso: "sin medida" } },
        { ...source, url: source.url.replace("compactacion", "hidrolimpiadora") }
      ] : expected === 73 ? [
        { ...source, title: "OTRO MODELO" },
        { ...source, specs: { ...source.specs, "Capacidad carga": "227 kg" } },
        { ...source, specs: { ...source.specs, "Altura trabajo": "" } },
        { ...source, specs: { ...source.specs, "Longitud plataforma": "" } },
        { ...source, url: source.url.replace("elevacion-mastil", "elevacion-unipersonal") }
      ] : expected === 104 ? [
        { ...source, title: "OTRO MODELO" },
        { ...source, url: source.url.replace("venta-pequena-maquinaria-", "venta-pequena-maquinaria-otra-") },
        { ...source, specs: { ...source.specs, "Caudal max.": "", "Caudal nominal": "" } },
        { ...source, specs: { ...source.specs, "Altura elevacion max": "", "Presion max.": "" } }
      ] : [
        { ...source, specs: { ...source.specs, "Capacidad carga": "200 kg" } }
      ])
    ];
    for (const altered of modified) {
      assert.equal(isValidCommercialCategory(altered, expected, "Segunda_Mano", realCatalog), false,
        `${entry.source.reference}: identidad o evidencia alterada`);
    }
  }
});

test("Gomariz clasifica el rodillo dúplex documentado sin atribuir categoría inexistente a barredoras", async () => {
  const realCatalog = await loadImportCatalog();
  const { brandLogos } = await loadCommercialReference();
  const root = fileURLToPath(new URL("../../../../", import.meta.url));
  const selected = await selectAccreditedCommercialInputs(root, realCatalog,
    { gomariz: ["RO456", "BR901", "BR954"] });
  const gomariz = selected.get("gomariz");
  assert.ok(gomariz);
  const original = JSON.stringify(gomariz.entries);
  const output = planCommercialExport(gomariz.entries, "gomariz", gomariz.publicationSha256,
    realCatalog, brandLogos, null, null);
  assert.equal(output.total, 3);
  assert.equal(output.summary.exported, 3);
  assert.equal(output.summary.categorized, 1);
  assert.equal(output.summary.pendingCategory, 2);
  assert.equal(accreditCommercialPlan(gomariz.entries, output, realCatalog, brandLogos, null).summary.blocking, 0);
  assert.equal(JSON.stringify(gomariz.entries), original);
  for (const entry of gomariz.entries) {
    const reference = entry.source.reference;
    const product = output.products.find((candidate) => candidate.reference === reference);
    assert.ok(product);
    assert.deepEqual(product.spec, entry.published.spec);
    if (reference !== "RO456") {
      assert.equal(product.categorySellID, null);
      assert.deepEqual(product.attributes, []);
      continue;
    }
    assert.equal(product.categorySellID, 68);
    assert.equal(isValidCommercialCategory(entry.source, 68, "Segunda_Mano", realCatalog), true);
    assert.equal(isValidCommercialCategory(entry.source, 68, "Nuevo", realCatalog), false);
    const altered: readonly ProductRecord[] = [
      { ...entry.source, categoryKey: "maquinaria" },
      { ...entry.source, url: entry.source.url.replace("gomarizrent.com", "otro.example") },
      { ...entry.source, url: entry.source.url.replace("/rodillo/", "/retroexcavadora/") },
      { ...entry.source, brand: "OTRA MARCA" },
      { ...entry.source, model: "OTRO MODELO" },
      { ...entry.source, title: "Otra máquina" },
      { ...entry.source, longDescription: "Rodillo sin tipo técnico acreditado" },
      { ...entry.source, specs: { ...entry.source.specs, Motor: "Eléctrico" } },
      { ...entry.source, specs: { ...entry.source.specs, Peso: "500 kg" } }
    ];
    for (const candidate of altered) {
      assert.equal(isValidCommercialCategory(candidate, 68, "Segunda_Mano", realCatalog), false);
    }
  }
});
