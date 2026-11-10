import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { verifiedGomarizPriorityGeneral } from "../evidence/verified-priority-general.js";
import { verifiedCanonicalBriefEditorial } from "../../../shared/editorial/evidence/verified-canonical-brief-editorial.js";
import { resolveGomarizUnitSpecificGeneral } from "../mapping/unit-specific-general.js";
import { resolveGomarizVerifiedModelGeneral } from "../mapping/verified-model-general.js";
import { prepareSourceProduct } from "../../../prepare-product.js";

const signedGenerals: Readonly<Record<string, { readonly general: string }>> = verifiedCanonicalBriefEditorial;

const catalog = await readCanonicalCatalog("catalogs/providers/gomariz/original/scrape-gomariz-catalog.json");
const references = new Set(["CC1535", "CC1666", "FR1077", "BA1522", "PV556", "BA1465", "TE1814", "TE1772", "BA1358"]);
const find = (reference: string): ProductRecord => {
  const record = catalog.products.find((item) => item.reference === reference);
  assert.ok(record, reference);
  return record;
};

test("Gomariz personaliza generales genéricas con medidas de su propia ficha", () => {
  const improved = new Set<string>();
  for (const record of catalog.products) {
    const original = JSON.stringify(record);
    const prepared = prepareSourceProduct(record);
    if (references.has(record.reference ?? "")) {
      const general = prepared.product.description_general;
      const replacement = resolveGomarizUnitSpecificGeneral(record);
      assert.ok(record.reference && general && replacement);
      const suffix = record.year ? ` Año de fabricación de esta unidad: ${record.year}.` : "";
      const underlying = suffix && general.endsWith(suffix) ? general.slice(0, -suffix.length) : general;
      const verified = signedGenerals[`gomariz:${record.reference}`];
      const expected = verified?.general ?? verifiedGomarizPriorityGeneral(record) ?? replacement;
      assert.equal(underlying, resolveGomarizVerifiedModelGeneral(record, expected) ?? expected, record.reference);
      if (verified) {
        const modelEvidence = record.reference === "PV556" ? "SLA15" : "20D SPEED";
        assert.ok(general.includes(modelEvidence), record.reference);
        assert.ok((record.brand ?? "").split(/\s+/).every((part) => general.toLowerCase().includes(part.toLowerCase())), record.reference);
      } else {
        assert.ok(general.includes(record.title ?? ""), record.reference);
      }
      assert.ok(general.includes("longitud") && general.includes("anchura") && (general.includes("peso") || general.includes("masa")), record.reference);
      if (record.reference === "BA1465") {
        assert.match(general, /13,8 m de altura de plataforma|altura de plataforma consignada es de 13,8 m/u);
        assert.match(general, /1,98 m de altura de almacenaje|altura de almacenaje declarada es de 1,98 m/u);
        assert.ok(general.split(/\s+/u).length >= 60);
      }
      assert.equal(prepared.status, "ready", record.reference);
      improved.add(record.reference);
    }
    assert.equal(JSON.stringify(record), original);
  }
  assert.deepEqual(improved, references);
});

test("Gomariz preserva fuentes no coherentes o fuera de identidad", () => {
  for (const reference of ["TE1858", "TE1621", "TE1622", "RO1197", "RE454", "CC1665"]) {
    const record = find(reference);
    assert.equal(resolveGomarizUnitSpecificGeneral(record), null, reference);
  }
  const record = find("CC1535");
  const rejected: readonly ProductRecord[] = [
    { ...record, providerId: "gam" },
    { ...record, reference: "CC1666", url: `${record.url}?variant=2` },
    { ...record, model: "FORSTE 18T SPEED" },
    { ...record, brand: "Otra Marca" },
    { ...record, specs: { ...record.specs, "Altura plataforma": "25 m" } },
    { ...record, specs: { ...record.specs, "Altura de trabajo": "0 m" } },
    { ...record, specs: { ...record.specs, Motor: "Híbrido" } },
    { ...record, longDescription: "Descripción específica." }
  ];
  for (const [index, invalid] of rejected.entries()) {
    assert.equal(resolveGomarizUnitSpecificGeneral(invalid), null, String(index));
  }
});


test("Gomariz: dos tijeras sin motor publicado conservan los detalles funcionales de su categoría", () => {
  for (const reference of ["TE1814", "TE1772"]) {
    const record = find(reference);
    const snapshot = JSON.stringify(record);
    const general = resolveGomarizUnitSpecificGeneral(record);
    assert.ok(general?.includes("con ruedas antihuellas y plataforma extensible."), reference);
    assert.equal(prepareSourceProduct(record).product.description_general, verifiedGomarizPriorityGeneral(record) ?? general, reference);
    assert.equal(JSON.stringify(record), snapshot, reference);
    const variants: readonly ProductRecord[] = [
      { ...record, model: "OTRO" },
      { ...record, specs: { ...record.specs, Motor: "Diésel" } },
      { ...record, url: `${record.url}?variation=2` },
      { ...record, longDescription: record.longDescription?.replace("plataforma extensible", "plataforma fija") ?? null }
    ];
    for (const variant of variants) {
      assert.equal(resolveGomarizUnitSpecificGeneral(variant)?.includes("con ruedas antihuellas y plataforma extensible.") ?? false, false, reference);
    }
  }
});
