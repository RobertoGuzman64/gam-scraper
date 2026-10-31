import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import type { ProductRecord } from "../../../contracts/catalog.js";
import type { ImportCandidate } from "../../legacy-export/contracts.js";
import { reconstructMercaelevaSource } from "../../diagnostics/description-source.js";
import { verifiedPriorityPlatformGeneral, priorityPlatformManufacturerSources } from "../evidence/providers/mercaeleva/priority-platform-generals.js";
import { prepareSourceProduct } from "../prepare-product.js";

const published: readonly ImportCandidate[] = JSON.parse(readFileSync(
  "catalogs/providers/mercaeleva/publications/9a8db5bd6929fdc7fce8ceb7e63705b9b168a34161cc52d9536269cff26442e2/mercaeleva-publishable.json", "utf8"
));
const sources = published.map(reconstructMercaelevaSource);
const targets = ["M178-6194", "M205-2951", "M572-8190", "M030-7485", "M005-4474"] as const;
const find = (reference: string): ProductRecord => {
  const record = sources.find((item) => item.reference === reference);
  assert.ok(record, reference);
  return record;
};
const words = (value: string | null | undefined): number => value?.split(/\s+/u).filter(Boolean).length ?? 0;

test("Mercaeleva: las generales de plataformas prioritarias se enriquecen solo con identidad acreditada", () => {
  assert.equal(sources.length, 220);
  const matched = sources.filter((record) => verifiedPriorityPlatformGeneral(record) !== null);
  assert.deepEqual(new Set(matched.map((item) => item.reference)), new Set(targets));
  assert.equal(priorityPlatformManufacturerSources.length, 3);
  for (const source of priorityPlatformManufacturerSources) assert.match(source, /^https:\/\/(?:www\.)?(?:manitou\.com|jlg\.com|lgmglifts\.com)\//);
  for (const record of matched) {
    const before = JSON.stringify(record);
    const general = verifiedPriorityPlatformGeneral(record);
    assert.ok(general);
    assert.ok(words(prepareSourceProduct(record).product.description_general) >= 60);
    assert.ok(words(record.longDescription) < 20);
    assert.ok(general.includes(record.model ?? "modelo ausente"));
    const output = prepareSourceProduct(record);
    assert.equal(output.product.description_general, general);
    assert.equal(output.product.reference, record.reference);
    assert.deepEqual(output.product.spec, record.specs);
    assert.equal(JSON.stringify(record), before);
  }
  assert.equal(new Set(targets.slice(0, 3).map((ref) => verifiedPriorityPlatformGeneral(find(ref)))).size, 3);
});

test("Mercaeleva: la preparación no reutiliza evidencia con cambios de unidad, versión o prestaciones", () => {
  for (const reference of targets) {
    const record = find(reference);
    const variants: readonly ProductRecord[] = [
      { ...record, reference: `${reference}-otro` },
      { ...record, providerId: "gam" },
      { ...record, model: "OTRO" },
      { ...record, url: `${record.url}?origen=otro` },
      { ...record, longDescription: `${record.longDescription} valor añadido` },
      { ...record, year: "2025" },
      { ...record, specs: { ...record.specs, "Altura de trabajo": "20 m" } },
      { ...record, specs: { ...record.specs, "Tipo de motor": "Gasolina" } },
      { ...record, specs: { ...record.specs, "Estado": "Otro" } }
    ];
    for (const [index, variant] of variants.entries()) {
      assert.equal(verifiedPriorityPlatformGeneral(variant), null, `${reference}:${index}`);
    }
  }
  for (const reference of ["M028-8481", "M840-8278", "M315-5925", "M582-1882"]) {
    assert.equal(verifiedPriorityPlatformGeneral(find(reference)), null, reference);
  }
});
