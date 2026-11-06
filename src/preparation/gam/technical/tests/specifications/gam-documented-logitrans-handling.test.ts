import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord, SpecsMap } from "../../../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { recoverGamDocumentedLogitransHandlingSpecs } from "../../evidence/verified-models/documented-logitrans-handling-specs.js";
import { prepareSourceProduct } from "../../../../prepare-product.js";
import { analyzeTechnicalDensity } from "../../../../../catalog/diagnostics/technical-density.js";

const originals = (await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-catalog.json")).products;
const expectedByReference: Readonly<Record<string, SpecsMap>> = {
  "220": {
    "Propulsión": "Manual",
    "Dirección": "Asistida en ambas ruedas"
  },
  "221": {
    "Propulsión": "Manual",
    "Dirección": "Asistida en ambas ruedas"
  },
  "222": {
    "Controlador de tracción": "Curtis (CA)",
    "Conducción con timón vertical": "Permitida"
  },
  "223": {
    "Controlador de tracción": "Curtis (CA)",
    "Conducción con timón vertical": "Permitida"
  },
  "224": {
    "Controlador de tracción": "Curtis (CA)",
    "Conducción con timón vertical": "Permitida"
  },
  "225": {
    "Controlador de tracción": "Curtis (CA)",
    "Conducción con timón vertical": "Permitida"
  },
  "226": {
    "Material del chasis de horquillas": "Acero inoxidable AISI 316L",
    "Configuración de horquillas": "Cerradas",
    "Accionamiento de elevación": "Manual"
  },
  "227": {
    "Material del chasis de horquillas": "Acero inoxidable AISI 316L",
    "Configuración de horquillas": "Cerradas",
    "Accionamiento de elevación": "Eléctrico"
  },
  "228": {
    "Material del chasis de horquillas": "Acero inoxidable AISI 316L",
    "Configuración de horquillas": "Cerradas",
    "Accionamiento de elevación": "Eléctrico"
  },
  "229": {
    "Altura máxima de elevación": "800 mm",
    "Capacidad de carga a más de 470 mm": "1000 kg",
    "Configuración de ruedas de carga": "Tándem"
  },
  "230": {
    "Altura máxima de elevación": "800 mm",
    "Capacidad de carga a más de 470 mm": "1000 kg"
  },
  "231": {
    "Recorrido de elevación": "275 mm",
    "Altura de trabajo con caja inclinada": "750–950 mm"
  },
  "232": {
    "Recorrido de elevación": "275 mm",
    "Altura de trabajo con caja inclinada": "750–950 mm"
  },
  "233": {
    "Controlador de tracción": "Curtis ACF2C",
    "Conducción con timón vertical": "Permitida"
  },
  "234": {
    "Acceso del operador": "Mediante código PIN",
    "Panel de control": "Pantalla LCD con estado de batería"
  },
  "236": {
    "Nivel sonoro de desplazamiento": "Inferior a 60 dB(A)",
    "Material de ruedas": "Caucho blando",
    "Sistema de elevación": "Elevación rápida permanente"
  },
  "238": {
    "Precisión del sistema de pesaje": "99,95 %",
    "Células de pesaje": "4",
    "Protección de las células de carga": "IP68"
  },
  "240": {
    "Recorrido de elevación": "275 mm",
    "Altura de trabajo con caja inclinada": "750–950 mm"
  },
  "245": {
    "Altura máxima de elevación": "800 mm",
    "Capacidad de carga a más de 470 mm": "1000 kg"
  },
  "246": {
    "Altura máxima de elevación": "800 mm",
    "Capacidad de carga a más de 470 mm": "1000 kg"
  }
};
const references = new Set(Object.keys(expectedByReference));

test("GAM: 20 referencias Logitrans incorporan 46 prestaciones contrastadas sin modificar los originales", () => {
  const improved = new Set<string>();
  let additions = 0;
  for (const record of originals) {
    const originalSpecs = record.specs ?? {};
    const snapshot = JSON.stringify(record);
    const documented = recoverGamDocumentedLogitransHandlingSpecs(record, originalSpecs);
    const expected = record.reference ? expectedByReference[record.reference] : undefined;
    if (!expected) {
      assert.equal(documented, originalSpecs, record.reference ?? record.url);
      continue;
    }
    assert.deepEqual(documented, { ...originalSpecs, ...expected }, record.reference ?? record.url);
    const prepared = prepareSourceProduct(record);
    assert.equal(prepared.status, "ready", record.reference ?? record.url);
    for (const [key, value] of Object.entries(expected)) {
      assert.equal(prepared.product.spec[key], value, `${record.reference}:${key}`);
      assert.ok(!(key in originalSpecs), `${record.reference}:${key}`);
    }
    assert.equal(JSON.stringify(record), snapshot);
    if (record.reference) improved.add(record.reference);
    additions += Object.keys(expected).length;
  }
  assert.deepEqual(improved, references);
  assert.equal(additions, 46);
});

test("GAM: la recuperación Logitrans protege proveedor, identidad y especificaciones anteriores", () => {
  for (const record of originals) {
    if (!record.reference || !references.has(record.reference)) continue;
    const specs = record.specs ?? {};
    const firstKey = Object.keys(expectedByReference[record.reference] ?? {})[0];
    assert.ok(firstKey, record.reference);
    const variants: readonly ProductRecord[] = [
      { ...record, providerId: "mercaeleva" },
      { ...record, categoryKey: "otra-categoria" },
      { ...record, reference: `${record.reference}-otro` },
      { ...record, url: `${record.url}?variante=1` },
      { ...record, title: `${record.title} diferente` },
      { ...record, brand: "Otra marca" },
      { ...record, model: "Otro modelo" },
      { ...record, condition: "Segunda mano" },
      { ...record, year: "2099" },
      { ...record, shortDescription: "Texto distinto" },
      { ...record, longDescription: `${record.longDescription} variante` },
      { ...record, specs: { ...specs, "Año de fabricación": "2000" } },
      { ...record, specs: { ...specs, [firstKey]: "Otro valor" } }
    ];
    for (const [index, variant] of variants.entries()) {
      const input = variant.specs ?? {};
      assert.equal(recoverGamDocumentedLogitransHandlingSpecs(variant, input), input, `${record.reference}:${index}`);
    }
    const preexisting = { ...specs, [firstKey]: "Acreditado previamente" };
    assert.equal(recoverGamDocumentedLogitransHandlingSpecs(record, preexisting), preexisting);
  }
});

test("GAM: 20 avisos altos se eliminan al superar la densidad técnica mínima", () => {
  const originalSelected = originals.filter((record) => record.reference && references.has(record.reference));
  assert.equal(originalSelected.length, 20);
  const before = originalSelected.map((record) => {
    const prepared = prepareSourceProduct(record).product;
    const newKeys = expectedByReference[record.reference ?? ""];
    assert.ok(newKeys, record.reference ?? record.url);
    return { ...prepared, spec: Object.fromEntries(Object.entries(prepared.spec).filter(([key]) => !(key in newKeys))) };
  });
  const after = originalSelected.map((record) => prepareSourceProduct(record).product);
  const previousDensity = analyzeTechnicalDensity(before);
  const nextDensity = analyzeTechnicalDensity(after);
  assert.deepEqual([previousDensity.totals.sparse, previousDensity.totals.medium], [20, 0]);
  assert.deepEqual([nextDensity.totals.sparse, nextDensity.totals.medium], [0, 0]);
});
