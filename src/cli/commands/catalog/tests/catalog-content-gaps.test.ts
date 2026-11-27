import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { type TestContext } from "node:test";
import { execute } from "./catalog-content-gaps-fixtures.js";
import { writeCanonicalCatalog } from "../../../../infrastructure/filesystem/catalog/originals/canonical-catalog.js";
import type { ProductRecord } from "../../../../contracts/catalog.js";

const workspace = async (t: TestContext): Promise<string> => {
  const directory = await mkdtemp(join(tmpdir(), "gaps-catalogo-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
};

const original = async (root: string, providerId: string): Promise<string> => {
  const directory = join(root, providerId);
  await mkdir(directory);
  const prefix = `scrape-${providerId}`;
  const startedAt = "2026-01-01T00:00:00Z";
  const endedAt = "2026-01-02T00:00:00Z";
  const products: ProductRecord[] = ["1", "2"].map((reference) => ({
    providerId, reference, url: `https://example.test/${providerId}/${reference}`,
    categoryKey: "plataformas", categoryName: "Plataformas", title: "Plataforma de tijera eléctrica",
    brand: "Marca", model: "Modelo", shortDescription: "Plataforma eléctrica", longDescription: null,
    price: null, year: null, location: null, country: null, horometer: null, serialNumber: null, image: null,
    specs: reference === "1" ? { "Altura de trabajo": "8 m" } : {}
  }));
  const catalogSha256 = await writeCanonicalCatalog(directory, prefix, "a".repeat(16), startedAt, endedAt, products);
  await writeFile(join(directory, `${prefix}-summary.json`), JSON.stringify({ startedAt, endedAt,
    quality: { status: "complete", published: true }, totals: { scrapedProducts: products.length }, artifacts: { catalogSha256 } }));
  return join(directory, `${prefix}-catalog.json`);
};

test("huecos analiza catálogos canónicos explícitos sin exigir referencia global", async (t) => {
  const directory = await workspace(t);
  const gam = await original(directory, "gam");
  const gomariz = await original(directory, "gomariz");
  const mercaeleva = await original(directory, "mercaeleva");
  const paths = [gam, gomariz, mercaeleva].flatMap((path) => [path, path.replace(/-catalog\.json$/u, "-catalog.manifest.json"), path.replace(/-catalog\.json$/u, "-summary.json")]);
  const before = await Promise.all(paths.map((path) => readFile(path)));
  const single = JSON.parse(await execute(["--catalogo", gam, "--json"])) as {
    provenance: { source: string; catalogs: { providerId: string; contentSha256: string }[] };
    universe: { total: number; providers: { providerId: string }[] };
    editorial: { lengths: { description: { missing: number } }; providers: { providerId: string }[] };
    editorialReuse: { analyzed: number; totals: { capacidad_disponible_sin_aplicar: number } };
    technicalDensity: { totals: { products: number } };
  };
  assert.equal(single.provenance.source, "catalogos_canonicos");
  assert.equal(single.universe.total, 2);
  assert.equal(single.editorial.providers[0]?.providerId, "gam");
  assert.equal(single.technicalDensity.totals.products, single.universe.total);
  assert.equal(single.editorialReuse.analyzed, single.universe.total);
  assert.ok(single.editorialReuse.totals.capacidad_disponible_sin_aplicar >= 0);
  assert.ok(single.editorial.lengths.description.missing >= 0);
  assert.deepEqual(single.universe.providers.map((item) => item.providerId), ["gam"]);
  assert.match(single.provenance.catalogs[0]?.contentSha256 ?? "", /^[a-f0-9]{64}$/);
  const combined = await execute(["--catalogo", gam, "--catalogo", gomariz, "--catalogo", mercaeleva, "--top", "1"]);
  assert.match(combined, /catálogos explícitos \(gam, gomariz, mercaeleva\)/);
  const originalCount = /HUECOS \|[^\n]*\| originales (\d+)/u.exec(combined);
  assert.ok(originalCount);
  assert.equal(Number(originalCount[1]), 6);
  assert.match(combined, /CALIDAD EDITORIAL/);
  assert.match(combined, /SEÑALES EDITORIALES/);
  assert.match(combined, /REUTILIZACIÓN EDITORIAL/);
  assert.match(combined, /DENSIDAD TÉCNICA \| PRIORIDAD EDITORIAL/);
  assert.deepEqual(await Promise.all(paths.map((path) => readFile(path))), before);
});

test("huecos rechaza fuentes parciales y proveedores repetidos", async (t) => {
  const directory = await workspace(t);
  const gam = await original(directory, "gam");
  const partial = join(directory, "scrape-manain-partial-all.csv");
  await writeFile(partial, "providerId,reference\nmanain,1\n");
  await assert.rejects(execute(["--catalogo", partial]), /fichero -catalog\.json/);
  await assert.rejects(execute(["--catalogo", gam, "--catalogo", gam]), /Proveedor duplicado/);
  await assert.rejects(execute(["--catalogo", "--json"]), /requiere la ruta/);
});

test("huecos exige manifiesto y publicación completa coherentes para la fuente explícita", async (t) => {
  const directory = await workspace(t);
  const catalog = await original(directory, "gomariz");
  const valid = await execute(["--catalogo", catalog, "--top", "1"]);
  assert.match(valid, /HUECOS \|[^\n]*\| originales [1-9]\d*/u);
  const content = await readFile(catalog, "utf8");
  await writeFile(catalog, `${content} `);
  await assert.rejects(execute(["--catalogo", catalog]), /ejecuciones distintas/);
  await writeFile(catalog, content);
  await rm(join(directory, "gomariz", "scrape-gomariz-summary.json"));
  await assert.rejects(execute(["--catalogo", catalog]));
});
