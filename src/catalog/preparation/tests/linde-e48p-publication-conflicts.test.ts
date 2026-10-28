import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { loadImportCatalog } from "../../../infrastructure/filesystem/legacy-export/import-catalog-loader.js";
import { resolveAttribute } from "../mapping/attribute-mapping.js";
import { describeMercaelevaE48pPublicationConflict } from "../evidence/providers/mercaeleva/linde-e48p-publication-evidence.js";
import { prepareProduct } from "../../legacy-export/prepare-product.js";

const catalog = await loadImportCatalog();
const mercaeleva = await readCanonicalCatalog("src/testing/fixtures/mercaeleva/scrape-mercaeleva-catalog.json");
const original = mercaeleva.products.find((product) => product.reference === "M827-8304");
assert.ok(original);
const load = catalog.attributes.find((attribute) => attribute.name === "Capacidad de carga");
const mast = catalog.attributes.find((attribute) => attribute.name === "Tipo de mástil");
assert.ok(load);
assert.ok(mast);

test("el conflicto MER0798 del vendedor queda identificado sin aprobar capacidad o mástil", () => {
  const snapshot = structuredClone(original);
  const issue = describeMercaelevaE48pPublicationConflict(original);
  assert.match(issue ?? "", /MER0798.*4\.800 kg.*dúplex.*3\.000 kg.*tríplex.*Machineryline/);
  assert.deepEqual(resolveAttribute(original, load), { status: "contradiction", value: null });
  assert.deepEqual(resolveAttribute(original, mast), { status: "contradiction", value: null });
  const result = prepareProduct(original, catalog);
  assert.equal(result.status, "review");
  assert.ok(result.issues.includes(issue ?? ""));
  assert.ok(result.issues.includes("Atributo contradictorio: Capacidad de carga"));
  assert.ok(result.issues.includes("Atributo contradictorio: Tipo de mástil"));
  assert.deepEqual(result.product.spec, snapshot.specs);
  assert.deepEqual(original, snapshot);
});

test("cambios en el anuncio no heredan la evidencia específica", () => {
  const variations: readonly ProductRecord[] = [
    { ...original, providerId: "gam" },
    { ...original, reference: "M827-8305" },
    { ...original, url: `${original.url}?v=2` },
    { ...original, year: "2008" },
    { ...original, condition: "Nuevo" },
    { ...original, title: "Linde E48P ELECTRICA 3000 KG" },
    { ...original, model: "E48" },
    { ...original, longDescription: original.longDescription?.replace("DUPLEX", "TRIPLEX") ?? null },
    { ...original, horometer: "2650" },
    { ...original, image: "https://example.test/changed.jpg" },
    { ...original, images: original.images?.slice(1) ?? [] },
    { ...original, specs: { ...original.specs, "Artículo No.": "MER0000" } },
    { ...original, specs: { ...original.specs, "Tipo de mástil": "Dúplex/estándar" } },
    { ...original, specs: { ...original.specs, "Capacidad máxima de elevación": "4800 kg" } }
  ];
  for (const [index, item] of variations.entries()) {
    assert.equal(describeMercaelevaE48pPublicationConflict(item), null, String(index));
    assert.ok(prepareProduct(item, catalog).issues.every((issue) => !issue.startsWith("MER0798:")), String(index));
  }
});

test("otras máquinas Mercaeleva no reciben el diagnóstico de MER0798", () => {
  for (const product of mercaeleva.products) {
    if (product === original) continue;
    assert.equal(describeMercaelevaE48pPublicationConflict(product), null, product.reference ?? "");
  }
  const changedScrapeDate: ProductRecord = { ...original, scrapedAt: "2026-10-25T00:00:00.000Z" };
  assert.equal(describeMercaelevaE48pPublicationConflict(changedScrapeDate), describeMercaelevaE48pPublicationConflict(original));
});
