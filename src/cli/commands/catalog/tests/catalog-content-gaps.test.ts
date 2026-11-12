import assert from "node:assert/strict";
import { copyFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { execute, gam, gomariz, mercaeleva } from "./catalog-content-gaps-fixtures.js";

test("huecos analiza catálogos canónicos explícitos sin exigir referencia global", async () => {
  const before = await readFile(gam, "utf8");
  const single = JSON.parse(await execute(["--catalogo", gam, "--json"])) as {
    provenance: { source: string; catalogs: { providerId: string; contentSha256: string }[] };
    universe: { total: number; providers: { providerId: string }[] };
    editorial: { lengths: { description: { missing: number } }; providers: { providerId: string }[] };
    editorialReuse: { analyzed: number; totals: { capacidad_disponible_sin_aplicar: number } };
    technicalDensity: { totals: { products: number } };
  };
  assert.equal(single.provenance.source, "catalogos_canonicos");
  assert.equal(single.universe.total, 244);
  assert.equal(single.editorial.providers[0]?.providerId, "gam");
  assert.equal(single.technicalDensity.totals.products, single.universe.total);
  assert.equal(single.editorialReuse.analyzed, single.universe.total);
  assert.ok(single.editorialReuse.totals.capacidad_disponible_sin_aplicar >= 0);
  assert.ok(single.editorial.lengths.description.missing >= 0);
  assert.deepEqual(single.universe.providers.map((item) => item.providerId), ["gam"]);
  assert.match(single.provenance.catalogs[0]?.contentSha256 ?? "", /^[a-f0-9]{64}$/);
  const combined = await execute(["--catalogo", gam, "--catalogo", gomariz, "--catalogo", mercaeleva, "--top", "1"]);
  assert.match(combined, /catálogos explícitos \(gam, gomariz, mercaeleva\)/);
  assert.match(combined, /originales 276/);
  assert.match(combined, /CALIDAD EDITORIAL/);
  assert.match(combined, /SEÑALES EDITORIALES/);
  assert.match(combined, /REUTILIZACIÓN EDITORIAL/);
  assert.match(combined, /DENSIDAD TÉCNICA \| PRIORIDAD EDITORIAL/);
  assert.equal(await readFile(gam, "utf8"), before);
});

test("huecos rechaza fuentes parciales y proveedores repetidos", async () => {
  await assert.rejects(execute(["--catalogo", "storage/scraped/manain/scrape-manain-partial-all.csv"]));
  await assert.rejects(execute(["--catalogo", gam, "--catalogo", gam]), /Proveedor duplicado/);
  await assert.rejects(execute(["--catalogo", "--json"]), /requiere la ruta/);
});

test("huecos exige manifiesto y publicación completa coherentes para la fuente explícita", async () => {
  const dir = await mkdtemp(join(tmpdir(), "gaps-catalogo-"));
  try {
    const catalog = join(dir, "scrape-gomariz-catalog.json");
    const sourceDir = resolve(gomariz, "..");
    for (const name of ["scrape-gomariz-catalog.json", "scrape-gomariz-catalog.manifest.json", "scrape-gomariz-summary.json"]) {
      await copyFile(join(sourceDir, name), join(dir, name));
    }
    const valid = await execute(["--catalogo", catalog, "--top", "1"]);
    assert.match(valid, /originales 14/);
    const original = await readFile(catalog, "utf8");
    await writeFile(catalog, `${original} `);
    await assert.rejects(execute(["--catalogo", catalog]), /ejecuciones distintas/);
    await writeFile(catalog, original);
    await rm(join(dir, "scrape-gomariz-summary.json"));
    await assert.rejects(execute(["--catalogo", catalog]));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

