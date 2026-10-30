import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import type { ImportCandidate } from "../../legacy-export/contracts.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { sourceSemanticQualityIssues } from "../source/semantic-quality.js";
import { prepareSourceProduct } from "../prepare-product.js";

const gomariz = (await readCanonicalCatalog("catalogs/providers/gomariz/original/scrape-gomariz-catalog.json")).products;
const gam = (await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-marzo-2026-catalog.json")).products;
const published = JSON.parse(readFileSync(
  "catalogs/providers/mercaeleva/publications/9a8db5bd6929fdc7fce8ceb7e63705b9b168a34161cc52d9536269cff26442e2/mercaeleva-publishable.json", "utf8"
)) as readonly ImportCandidate[];

const source = (candidate: ImportCandidate): ProductRecord => ({
  providerId: candidate.providerId,
  categoryKey: "venta",
  categoryName: candidate.category ?? "",
  url: candidate.sourceUrl,
  title: candidate.title,
  shortDescription: candidate.description,
  longDescription: candidate.description_general,
  price: candidate.price === null ? null : String(candidate.price),
  condition: candidate.condition === "Nuevo" ? "Nuevo" : candidate.condition === "Segunda_Mano" ? "Segunda mano" : null,
  reference: candidate.reference,
  brand: typeof candidate.spec.Marca === "string" ? candidate.spec.Marca : null,
  model: typeof candidate.spec.Modelo === "string" ? candidate.spec.Modelo : null,
  year: null,
  location: null,
  country: null,
  horometer: null,
  serialNumber: null,
  image: candidate.image,
  images: candidate.images,
  specs: candidate.spec
});

const mercaeleva = published.map(source);
const find = (records: readonly ProductRecord[], reference: string): ProductRecord => {
  const record = records.find((item) => item.reference === reference);
  assert.ok(record, reference);
  return record;
};

const conflicts = ["BA1465", "M547-2372", "M838-0666", "M969-4655"] as const;

const recordOf = (reference: string): ProductRecord =>
  find(reference.startsWith("M") ? mercaeleva : gomariz, reference);

test("Las contradicciones reales se documentan por campo y fuerzan revisión sin reescribir la fuente", () => {
  for (const reference of conflicts) {
    const record = recordOf(reference);
    const before = JSON.stringify(record);
    const findings = sourceSemanticQualityIssues(record);
    assert.equal(findings.length, 1, reference);
    const result = prepareSourceProduct(record);
    assert.equal(result.status, "review", reference);
    assert.ok(result.issues.includes(findings[0] ?? ""), reference);
    assert.equal(result.product.reference, record.reference, reference);
    assert.equal(result.product.sourceUrl, record.url, reference);
    assert.deepEqual(result.product.spec, record.specs, reference);
    assert.equal(JSON.stringify(record), before, reference);
  }
});

test("Las alturas SS0507E ya resueltas por evidencia siguen aptas", () => {
  for (const reference of ["TE1858", "TE1621", "TE1622"]) {
    const record = find(gomariz, reference);
    assert.deepEqual(sourceSemanticQualityIssues(record), [], reference);
    assert.equal(prepareSourceProduct(record).status, "ready", reference);
    assert.equal(record.specs?.["Altura plataforma"], "14.30 m");
  }
});

test("La anomalía de alturas no acreditada sí queda bajo revisión", () => {
  const record = find(gomariz, "TE1858");
  const altered = { ...record, specs: { ...record.specs, "Altura plataforma": "18 m" } };
  assert.ok(sourceSemanticQualityIssues(altered).some((issue) => issue.includes("Alturas contradictorias")));
  assert.equal(prepareSourceProduct(altered).status, "review");
});

test("Las familias, variantes, URLs y artículos deben corresponder a la misma referencia", () => {
  const model = find(mercaeleva, "M838-0666");
  const family = find(mercaeleva, "M547-2372");
  const cases: readonly ProductRecord[] = [
    { ...model, providerId: "gam" },
    { ...model, reference: "M969-4655" },
    { ...model, url: model.url.replace("sales.mercaeleva.com", "example.com") },
    { ...model, url: `${model.url}?source=copy` },
    { ...model, model: "450 AJ SII" },
    { ...model, title: "JLG 450 AJ SII" },
    { ...model, specs: { ...model.specs, Modelo: "450 AJ SII" } },
    { ...model, specs: { ...model.specs, "Artículo No.": "453" } },
    { ...model, longDescription: model.longDescription?.replace("SII", "SIII") ?? null },
    { ...family, providerId: "gomariz" },
    { ...family, reference: "M547-2373" },
    { ...family, title: "Toyota 6FBRE14 TRANSPALET ELECTRICO 1350 KG" },
    { ...family, specs: { ...family.specs, "Título adicional": "TRANSPALET ELECTRICO 1350 KG" } },
    { ...family, longDescription: family.longDescription?.replace("TRANSPALET", "CARRETILLA RETRACTIL") ?? null }
  ];
  for (const [index, record] of cases.entries()) {
    assert.deepEqual(sourceSemanticQualityIssues(record), [], String(index));
  }
});

test("Miles expresados como 3000 y 3.000 kg son la misma capacidad", () => {
  for (const reference of ["M644-0759", "M520-1851", "M493-1006"]) {
    assert.deepEqual(sourceSemanticQualityIssues(find(mercaeleva, reference)), [], reference);
  }
  const record = find(mercaeleva, "M644-0759");
  const incompatible = { ...record, longDescription: record.longDescription?.replace("3.000 KG", "2.500 KG") ?? null };
  assert.ok(sourceSemanticQualityIssues(incompatible).some((issue) => issue.includes("Capacidad contradictoria")));
});

test("Corte completo: solo cuatro conflictos no resueltos y sin contaminación de GAM", () => {
  assert.equal(gomariz.length, 143);
  assert.equal(gam.length, 983);
  assert.equal(mercaeleva.length, 220);
  const sources: readonly ProductRecord[] = [...gomariz, ...gam, ...mercaeleva];
  const found = sources.filter((record) => sourceSemanticQualityIssues(record).length).map((record) => record.reference);
  assert.deepEqual(found.sort(), [...conflicts].sort());
  assert.ok(gam.every((record) => sourceSemanticQualityIssues(record).length === 0));
});
