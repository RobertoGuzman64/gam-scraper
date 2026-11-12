import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { resolveReusableEditorial } from "../domain/editorial-composition.js";
import { resolveEditorialFacts } from "../domain/editorial-facts.js";
import { prepareSourceProduct } from "../../../prepare-product.js";

const [gam, gomariz, mercaeleva] = await Promise.all([
  readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-catalog.json"),
  readCanonicalCatalog("catalogs/providers/gomariz/original/scrape-gomariz-catalog.json"),
  readCanonicalCatalog("catalogs/providers/mercaeleva/original/scrape-mercaeleva-catalog.json")
]);

const get = (records: readonly ProductRecord[], reference: string): ProductRecord => {
  const record = records.find((item) => item.reference === reference);
  assert.ok(record, reference);
  return record;
};

test("tijera: composición y hechos independientes de la fuente y la ruta histórica", () => {
  const outside = get(gomariz.products, "TE1589");
  const alternative = get(mercaeleva.products, "M563-8693");
  const before = JSON.stringify([outside, alternative]);
  const gomarizText = resolveReusableEditorial(outside);
  const mercaText = resolveReusableEditorial(alternative);
  assert.equal(resolveEditorialFacts(outside)?.family, "plataforma-tijera");
  assert.equal(resolveEditorialFacts(alternative)?.family, "plataforma-tijera");
  assert.match(gomarizText.short ?? "", /altura de trabajo de 10 m y capacidad de 450 kg/u);
  assert.match(mercaText.short ?? "", /altura de trabajo de 14 m/u);
  assert.doesNotMatch(mercaText.short ?? "", /capacidad de/u);
  assert.equal(prepareSourceProduct(outside).product.description, gomarizText.short);
  assert.equal(JSON.stringify([outside, alternative]), before);
});

test("carretilla: concepto de capacidad compartido, elevación y peso diferenciados", () => {
  const gamRecord = get(gam.products, "6682");
  const gomarizRecord = get(gomariz.products, "CA1325");
  const mercaRecord = get(mercaeleva.products, "M940-4770");
  const a = resolveReusableEditorial(gamRecord);
  const b = resolveReusableEditorial(mercaRecord);
  const c = resolveReusableEditorial(gomarizRecord);
  assert.equal(resolveEditorialFacts(gamRecord)?.family, "carretilla-elevadora");
  assert.equal(resolveEditorialFacts(mercaRecord)?.family, "carretilla-elevadora");
  assert.match(a.short ?? "", /capacidad de carga de 3\.500 kg/u);
  assert.match(b.short ?? "", /capacidad de carga de 2\.000 kg/u);
  assert.doesNotMatch(b.short ?? "", /altura de elevación/u);
  assert.equal(resolveEditorialFacts(gomarizRecord)?.family, "carretilla-elevadora");
  assert.match(c.short ?? "", /capacidad de carga de 2\.500 kg/u);
});

test("negativos: procedencia, variante, magnitud, contradicción y semántica insuficiente", () => {
  const scissor = get(gomariz.products, "TE1589");
  const forklift = get(mercaeleva.products, "M940-4770");
  const invalid: readonly ProductRecord[] = [
    { ...scissor, providerId: "gam" },
    { ...scissor, url: scissor.url.replace("gomarizrent.com", "example.com") },
    { ...scissor, url: `${scissor.url}?source=unknown` },
    { ...scissor, url: scissor.url.replace("as0812", "otra-referencia") },
    { ...scissor, model: "OTRO" },
    { ...scissor, condition: "Nuevo" },
    { ...scissor, specs: { ...scissor.specs, "Altura de trabajo": "10 kg" } },
    { ...scissor, specs: { ...scissor.specs, Motor: "Diésel" } },
    { ...scissor, specs: { ...scissor.specs, Capacidad: "450 litros" } },
    { ...scissor, specs: { ...scissor.specs, "Altura de trabajo": "300 m" } },
    { ...forklift, url: forklift.url.replace("https:", "http:") },
    { ...forklift, specs: { ...forklift.specs, Marca: "OTRO" } },
    { ...forklift, specs: { ...forklift.specs, "Capacidad máxima de elevación": "2000 litros" } },
    { ...forklift, specs: { ...forklift.specs, Peso: "2000 kg", "Capacidad máxima de elevación": "" } },
    { ...forklift, title: forklift.title?.replace("2000 KG", "3000 KG") ?? null },
    get(gomariz.products, "TE1858")
  ];
  for (const [index, record] of invalid.entries()) {
    assert.equal(resolveEditorialFacts(record), null, `rechazo ${index}`);
    assert.deepEqual(resolveReusableEditorial(record), { short: null, general: null }, `texto ${index}`);
  }
});

test("contrato de extensión: todo módulo nuevo de dominio se comprueba sin bifurcaciones por proveedor", async () => {
  const { readFile, readdir } = await import("node:fs/promises");
  const root = "src/preparation/shared/editorial/domain";
  const list = async (directory: string): Promise<readonly string[]> => {
    const entries = await readdir(directory, { withFileTypes: true });
    const files = await Promise.all(entries.map((item) => item.isDirectory() ? list(`${directory}/${item.name}`) :
      Promise.resolve(item.isFile() && item.name.endsWith(".ts") ? [`${directory}/${item.name}`] : [])));
    return files.flat();
  };
  const modules = (await list(root)).filter((path) => path !== `${root}/editorial-source.ts`);
  assert.ok(modules.length >= 5);
  for (const path of modules) {
    const content = await readFile(path, "utf8");
    assert.doesNotMatch(content, /\bproviderId\b|\b(?:gam|gomariz|mercaeleva)\b|\.\.\/\.\.\/(?:gam|gomariz|mercaeleva)\//u, path);
  }
});

test("contrato de extensión: cuatro familias usan su propia fuente sin extenderse a otras unidades", () => {
  const matrix = [
    [get(gomariz.products, "TE1589"), get(mercaeleva.products, "M563-8693"), "plataforma-tijera"],
    [get(gomariz.products, "BA1346"), get(mercaeleva.products, "M921-0545"), "plataforma-articulada"],
    [get(gomariz.products, "BT1102"), get(mercaeleva.products, "M749-9513"), "plataforma-telescopica"],
    [get(gam.products, "6682"), get(gomariz.products, "CA1325"), "carretilla-elevadora"]
  ] as const;
  for (const [first, second, family] of matrix) {
    const firstFacts = resolveEditorialFacts(first);
    const secondFacts = resolveEditorialFacts(second);
    assert.equal(firstFacts?.family, family);
    assert.equal(secondFacts?.family, family);
    const firstText = resolveReusableEditorial(first).short;
    const secondText = resolveReusableEditorial(second).short;
    assert.ok(firstText?.includes(`${firstFacts?.brand} ${firstFacts?.model}`));
    assert.ok(secondText?.includes(`${secondFacts?.brand} ${secondFacts?.model}`));
    assert.notEqual(firstText, secondText);
  }
});
