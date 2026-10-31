import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import type { ProductRecord } from "../../../contracts/catalog.js";
import type { ImportCandidate } from "../../legacy-export/contracts.js";
import { reconstructMercaelevaSource } from "../../diagnostics/description-source.js";
import { verifiedMercaelevaCriticalGeneral } from "../evidence/providers/mercaeleva/critical-general-descriptions.js";
import { prepareSourceProduct } from "../prepare-product.js";

const published: readonly ImportCandidate[] = JSON.parse(readFileSync(
  "catalogs/providers/mercaeleva/publications/9a8db5bd6929fdc7fce8ceb7e63705b9b168a34161cc52d9536269cff26442e2/mercaeleva-publishable.json", "utf8"
));
const sources = published.map(reconstructMercaelevaSource);
const targets = ["M432-1479", "M913-0641", "M736-5615", "M095-5362", "M144-5512", "M171-6370", "M200-9533"] as const;
const find = (reference: string): ProductRecord => {
  const found = sources.find((record) => record.reference === reference);
  assert.ok(found, reference);
  return found;
};
const words = (text: string | null): number => text?.split(/\s+/u).filter(Boolean).length ?? 0;

test("Mercaeleva: resuelve siete generales prioritarias breves con evidencia del modelo", () => {
  assert.equal(sources.length, 220);
  const matched = sources.filter((record) => verifiedMercaelevaCriticalGeneral(record) !== null);
  assert.deepEqual(new Set(matched.map((record) => record.reference)), new Set(targets));
  for (const record of matched) {
    const original = JSON.stringify(record);
    const improved = verifiedMercaelevaCriticalGeneral(record);
    assert.ok(improved);
    assert.ok(words(record.longDescription) < 20, record.reference ?? "sin referencia");
    assert.ok(words(improved) >= 60, record.reference ?? "sin referencia");
    assert.ok(improved.toLocaleLowerCase("es").includes((record.brand ?? "identidad ausente").toLocaleLowerCase("es")));
    assert.ok(improved.includes(record.model ?? "identidad ausente"));
    const prepared = prepareSourceProduct(record);
    assert.equal(prepared.product.description_general, improved);
    assert.equal(prepared.product.sourceUrl, record.url);
    assert.equal(prepared.product.reference, record.reference);
    assert.deepEqual(prepared.product.spec, record.specs);
    assert.equal(JSON.stringify(record), original);
  }
});

test("Mercaeleva: diferencia tres unidades STAR-10 sin intercambiar sus horas", () => {
  const prepared = ["M095-5362", "M144-5512", "M171-6370"].map((ref) => verifiedMercaelevaCriticalGeneral(find(ref)));
  assert.equal(new Set(prepared).size, 3);
  assert.ok(prepared[0]?.includes("617 horas"));
  assert.ok(prepared[1]?.includes("377 horas"));
  assert.ok(prepared[2]?.includes("1.126 horas"));
  assert.ok(verifiedMercaelevaCriticalGeneral(find("M736-5615"))?.includes("180°"));
  assert.ok(verifiedMercaelevaCriticalGeneral(find("M200-9533"))?.includes("4.000 kg"));
});

test("Mercaeleva: no aplica evidencia a referencias o datos de unidad inconsistentes", () => {
  for (const reference of targets) {
    const record = find(reference);
    const variants: readonly ProductRecord[] = [
      { ...record, providerId: "gam" },
      { ...record, reference: `${reference}-otro` },
      { ...record, url: `${record.url}?tracking=1` },
      { ...record, title: `${record.title} OTRO` },
      { ...record, model: "OTRO" },
      { ...record, year: "2026" },
      { ...record, longDescription: `${record.longDescription} más contenido no verificado` },
      { ...record, horometer: "9999 h" },
      { ...record, specs: { ...record.specs, Modelo: "OTRO" } },
      { ...record, specs: { ...record.specs, "Artículo No.": "OTRO" } },
      { ...record, specs: { ...record.specs, "Horas laborales": "9999 h" } },
      { ...record, specs: { ...record.specs, "Título adicional": "OTRO" } }
    ];
    for (const [index, variant] of variants.entries()) {
      assert.equal(verifiedMercaelevaCriticalGeneral(variant), null, `${reference}:${index}`);
    }
  }
  assert.equal(verifiedMercaelevaCriticalGeneral({ ...find("M736-5615"), specs: { ...find("M736-5615").specs, "Certificación CE": "No" } }), null);
  assert.equal(verifiedMercaelevaCriticalGeneral({ ...find("M095-5362"), specs: { ...find("M095-5362").specs, "Altura de trabajo": "11 m" } }), null);
  assert.equal(verifiedMercaelevaCriticalGeneral({ ...find("M200-9533"), specs: { ...find("M200-9533").specs, "Capacidad máxima de elevación": "4500 kg" } }), null);
  for (const reference of ["M011-3720", "M582-1882", "M028-8481", "M887-9469", "M486-0114", "M547-2372"]) {
    assert.equal(verifiedMercaelevaCriticalGeneral(find(reference)), null, reference);
  }
});
