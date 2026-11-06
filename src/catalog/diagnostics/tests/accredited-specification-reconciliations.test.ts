import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { prepareSourceProduct } from "../../../preparation/prepare-product.js";
import type { DescriptionCoverageInput } from "../description-coverage.js";
import { analyzeSpecificationCoverage } from "../specification-coverage.js";

const [gam, mercaeleva] = await Promise.all([
  readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-catalog.json"),
  readCanonicalCatalog("catalogs/providers/mercaeleva/original/scrape-mercaeleva-catalog.json")
]);

const sourceRecord = (reference: string): ProductRecord => {
  const catalog = reference.startsWith("M") ? mercaeleva : gam;
  const record = catalog.products.find((item) => item.reference === reference);
  assert.ok(record, reference);
  return record;
};

const input = (source: ProductRecord): DescriptionCoverageInput => {
  const prepared = prepareSourceProduct(source);
  return { source, prepared, origin: "original_canonico", published: { ...prepared.product } };
};

const references = ["2219", "6807", "M329-6156", "M502-4867"] as const;

const audit = (item: DescriptionCoverageInput) => analyzeSpecificationCoverage([item]);

test("las reconciliaciones técnicas se mantienen visibles con el valor original y su destino", () => {
  const cases = references.map((reference) => {
    const source = sourceRecord(reference);
    const before = JSON.stringify(source);
    const report = audit(input(source));
    assert.equal(report.totals.sourceNotPreserved, 0, reference);
    assert.equal(report.totals.accreditedReconciliations, 1, reference);
    assert.equal(report.totals.lostAfterPublication, 0, reference);
    assert.equal(JSON.stringify(source), before, reference);
    const resolved = report.cases.find((item) => item.stage === "reconciliacion_acreditada");
    assert.ok(resolved, reference);
    return resolved;
  });
  assert.deepEqual(cases.map((item) => [item.reference, item.key, item.reconciliation?.originalValue, item.reconciliation?.destinationKeys]), [
    ["2219", "Ancho promedio (mm)", "24V / 840-1000Ah(V/Ah)", ["Capacidad de la batería (Ah)", "Voltaje batería (V)"]],
    ["6807", "Nº de serie", "NRXL3AALS10000101", []],
    ["M329-6156", "Horas laborales", "73 883 h", ["Kilómetros (km)"]],
    ["M502-4867", "Horas laborales", "42 922 h", ["Kilómetros (km)"]]
  ]);
});

test("la acreditación se invalida si cambia la evidencia canónica, la procedencia o el destino preparado", () => {
  for (const reference of references) {
    const initial = input(sourceRecord(reference));
    const source = initial.source;
    const tamperedSources: ProductRecord[] = [
      { ...source, title: "Máquina de otra marca sin modelo" },
      { ...source, url: `${source.url}?ref=other` },
      { ...source, specs: { ...source.specs, [reference === "2219" ? "Ancho promedio" : reference === "6807" ? "Nº de serie" : "Horas laborales"]: "valor ajeno" } }
    ];
    for (const changed of tamperedSources) {
      const report = audit({ ...initial, source: changed, published: { ...initial.published, sourceUrl: changed.url },
        prepared: { ...initial.prepared, product: { ...initial.prepared.product, sourceUrl: changed.url } } });
      assert.equal(report.totals.accreditedReconciliations, 0, `${reference}: fuente alterada`);
      assert.equal(report.totals.sourceNotPreserved, 1, `${reference}: fuente alterada`);
    }
    const reconstructed = audit({ ...initial, origin: "reconstruccion_publicada" });
    assert.equal(reconstructed.totals.accreditedReconciliations, 0, reference);

    const destination = reference === "2219" ? "Voltaje batería (V)" : "Kilometraje";
    if (reference !== "6807") {
      const report = audit({ ...initial, prepared: { ...initial.prepared, product: {
        ...initial.prepared.product, spec: { ...initial.prepared.product.spec, [destination]: "valor cambiado" }
      } } });
      assert.equal(report.totals.accreditedReconciliations, 0, `${reference}: transformación adulterada`);
      assert.equal(report.totals.sourceNotPreserved, 1, `${reference}: transformación adulterada`);
    }
  }
});

test("las pérdidas y diferencias sin acreditación siguen apareciendo como antes", () => {
  const original = input(sourceRecord("6807"));
  const unverified = { ...original, source: { ...original.source, specs: {
    ...original.source.specs, "Clave no acreditada": "dato original"
  } } };
  const report = audit(unverified);
  assert.equal(report.totals.accreditedReconciliations, 0);
  assert.ok(report.cases.some((item) => item.stage === "diferencia_origen_preparacion" && item.key === "Clave no acreditada"));
  assert.ok(report.cases.some((item) => item.stage === "diferencia_origen_preparacion" && item.key === "Nº de serie"));
});
