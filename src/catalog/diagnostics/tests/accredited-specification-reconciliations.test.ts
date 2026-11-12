import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { reconcileGamHorometer } from "../../../preparation/gam/technical/reconciliation/gam-horometer.js";
import { reconcileGamSourceTechnicalUnits } from "../../../preparation/gam/technical/reconciliation/gam-source-technical-units.js";
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


test("los 32 horómetros sin lectura útil se acreditan sin atribuirles otros destinos", () => {
  const sources = gam.products.filter((source) => source.specs?.["Horómetro"] !== undefined &&
    reconcileGamHorometer(source).specs?.["Horómetro"] === undefined);
  assert.equal(sources.length, 32);
  for (const source of sources) {
    const before = JSON.stringify(source);
    const report = audit(input(source));
    const resolved = report.cases.find((item) => item.key === "Horas (h)" &&
      item.stage === "reconciliacion_acreditada");
    assert.ok(resolved, source.reference ?? "");
    assert.deepEqual(resolved.reconciliation, {
      originalValue: source.specs?.["Horómetro"], destinationKeys: [], classification: "origen_no_utilizable"
    });
    assert.equal(report.totals.sourceNotPreserved, 0, source.reference ?? "");
    assert.equal(JSON.stringify(source), before);
  }
  const original = sourceRecord("6652");
  const altered = { ...original, horometer: "450 horas" };
  const invalidated = audit({ ...input(original), source: altered });
  assert.equal(invalidated.totals.accreditedReconciliations, 0);
  assert.equal(invalidated.totals.sourceNotPreserved, 1);
});

test("el arrastre y las claves de marcas se acreditan solo con la transformación verificada", () => {
  const verified = [
    ["2134", "Capacidad de carga (kg)", "5000 KG", ["Capacidad de arrastre (kg)"]],
    ["2135", "Capacidad de carga (kg)", "7000 KG", ["Capacidad de arrastre (kg)"]],
    ["6688", "ALFA ROMEO", "ALFA ROMEO", ["Marca", "Modelo"]],
    ["6689", "AUDI", "AUDI", ["Marca", "Modelo"]],
    ["6690", "PEUGEOUT", "PEUGEOUT", ["Marca"]]
  ] as const;
  for (const [reference, key, originalValue, destinationKeys] of verified) {
    const source = sourceRecord(reference);
    const before = JSON.stringify(source);
    const report = audit(input(source));
    const item = report.cases.find((candidate) => candidate.key === key &&
      candidate.stage === "reconciliacion_acreditada");
    assert.ok(item, reference);
    assert.deepEqual(item.reconciliation, {
      originalValue, destinationKeys, classification: "transformacion_acreditada"
    }, reference);
    assert.equal(JSON.stringify(source), before, reference);
  }
  const tractor = sourceRecord("2134");
  const alteredTractor = { ...tractor, brand: "OTRA" };
  assert.equal(audit({ ...input(tractor), source: alteredTractor }).cases.find((item) => item.key === "Capacidad de carga (kg)")?.stage,
    "diferencia_origen_preparacion");
  const vehicle = sourceRecord("6688");
  const alteredVehicle = { ...vehicle, model: "IDENTIDAD DESCONOCIDA" };
  assert.equal(audit({ ...input(vehicle), source: alteredVehicle }).cases.find((item) => item.key === "ALFA ROMEO")?.stage,
    "diferencia_origen_preparacion");
});

test("las siete diferencias GAM se acreditan con causa, valor original y destino real", () => {
  const resolved = [
    ["2108", "Capacidad de la batería (Ah)", "24V / 240h(V/Ah)", ["Voltaje batería (V)"]],
    ["2109", "Capacidad de la batería (Ah)", "24V / 240h(V/Ah)", ["Voltaje batería (V)"]],
    ["1714", "Altura plataforma (mm)", "4.8mm metros", []],
    ["920", "Capacidad de la batería (Ah)", "24V / 240h(V/Ah)", ["Voltaje batería (V)"]],
    ["2737", "Potencia (kW)", "36", []],
    ["2573", "Potencia Motor (CV)", "48", []],
    ["2218", "Ancho promedio (mm)", "24V / 735-875Ah(V/Ah)", ["Capacidad de la batería (Ah)", "Voltaje batería (V)"]]
  ] as const;
  for (const [reference, key, value, destinations] of resolved) {
    const source = sourceRecord(reference);
    const snapshot = structuredClone(source);
    const result = audit(input(source));
    const item = result.cases.find((candidate) => candidate.key === key);
    assert.equal(item?.stage, "reconciliacion_acreditada", reference);
    assert.deepEqual(item.reconciliation, {
      originalValue: value, destinationKeys: [...destinations],
      classification: destinations.length === 0 ? "origen_no_utilizable" : "transformacion_acreditada"
    }, reference);
    assert.equal(result.totals.sourceNotPreserved, 0, reference);
    assert.equal(result.totals.lostAfterPublication, 0, reference);
    assert.deepEqual(source, snapshot, reference);
  }
});

test("las siete acreditaciones no disimulan cambios del origen ni diferencias de publicación", () => {
  const cases = [
    ["2108", "Capacidad de la batería", "Capacidad de la batería (Ah)"],
    ["2109", "Capacidad de la batería", "Capacidad de la batería (Ah)"],
    ["1714", "Altura Plataforma", "Altura plataforma (mm)"],
    ["920", "Capacidad de la batería", "Capacidad de la batería (Ah)"],
    ["2737", "Potencia Motor (KW)", "Potencia (kW)"],
    ["2573", "Potencia Motor (CV)", "Potencia Motor (CV)"],
    ["2218", "Ancho promedio", "Ancho promedio (mm)"]
  ] as const;
  for (const [reference, sourceKey, auditedKey] of cases) {
    const original = input(sourceRecord(reference));
    const modifiedSource = { ...original.source, specs: { ...original.source.specs, [sourceKey]: "valor no acreditado" } };
    const changed = audit({ ...original, source: modifiedSource });
    assert.equal(changed.cases.find((item) => item.key === auditedKey)?.stage,
      "diferencia_origen_preparacion", reference);
    assert.equal(changed.totals.accreditedReconciliations, 0, reference);
    assert.equal(audit({ ...original, origin: "reconstruccion_publicada" }).totals.accreditedReconciliations, 0, reference);
  }
  for (const reference of ["2108", "2109", "920", "2218"]) {
    const original = input(sourceRecord(reference));
    const changed = audit({ ...original, prepared: { ...original.prepared, product: {
      ...original.prepared.product, spec: { ...original.prepared.product.spec, "Voltaje batería (V)": "999 V" }
    } } });
    assert.equal(changed.totals.accreditedReconciliations, 0, reference);
    assert.ok(changed.totals.sourceNotPreserved > 0, reference);
  }
  for (const reference of ["1714", "2737", "2573", "2218"]) {
    const original = input(sourceRecord(reference));
    const changed = audit({ ...original, source: { ...original.source, title: "Identidad distinta" } });
    assert.equal(changed.totals.accreditedReconciliations, 0, reference);
    assert.ok(changed.totals.sourceNotPreserved > 0, reference);
  }
});

test("los campos Yale cruzados quedan reconciliados con origen y destinos acreditados", () => {
  const cases = [
    ...["2242", "2243", "2244", "2245", "2246", "2247"].map((reference) => ({
      reference, keys: ["Altura plataforma (mm)", "Capacidad de la batería (Ah)"],
      destinations: ["Batería (V / Ah)"]
    })),
    ...["2300", "2301"].map((reference) => ({
      reference, keys: ["Capacidad de la batería (Ah)", "Centro de carga (mm)", "Radio de giro (mm)"],
      destinations: ["Altura de elevación (mm)", "Batería (V / Ah)", "Peso (kg)"]
    }))
  ];
  for (const { reference, keys, destinations } of cases) {
    const original = sourceRecord(reference);
    const sourceSnapshot = structuredClone(original);
    const report = audit(input(original));
    assert.equal(report.totals.accreditedReconciliations, keys.length, reference);
    assert.equal(report.totals.sourceNotPreserved, 0, reference);
    assert.equal(report.totals.lostAfterPublication, 0, reference);
    for (const key of keys) {
      const item = report.cases.find((candidate) => candidate.key === key);
      assert.equal(item?.stage, "reconciliacion_acreditada", `${reference}: ${key}`);
      assert.deepEqual(item.reconciliation?.destinationKeys, destinations, `${reference}: ${key}`);
      assert.equal(item.reconciliation?.classification, "transformacion_acreditada", reference);
    }
    assert.deepEqual(original, sourceSnapshot, reference);
  }
});

test("las reconciliaciones Yale rechazan fuentes y preparaciones modificadas", () => {
  for (const reference of ["2242", "2246", "2300", "2301"]) {
    const original = input(sourceRecord(reference));
    const invalidSources: ProductRecord[] = [
      { ...original.source, reference: "9999" },
      { ...original.source, model: "MODELO NO ACREDITADO" },
      { ...original.source, specs: { ...original.source.specs, "Capacidad de la batería": "9999" } }
    ];
    for (const source of invalidSources) {
      const changed = audit({ ...original, source, prepared: { ...original.prepared, product: {
        ...original.prepared.product, reference: source.reference
      } }, published: { ...original.published, reference: source.reference } });
      assert.equal(changed.totals.accreditedReconciliations, 0, reference);
      assert.ok(changed.totals.sourceNotPreserved > 0, reference);
    }
    const prepared = { ...original.prepared, product: { ...original.prepared.product, spec: {
      ...original.prepared.product.spec, "Batería (V / Ah)": "otra configuración"
    } } };
    const changed = audit({ ...original, prepared });
    assert.equal(changed.totals.accreditedReconciliations, 0, reference);
    assert.ok(changed.totals.sourceNotPreserved > 0, reference);
  }
});

test("acredita el descarte de errores de hoja de cálculo sin ocultar discrepancias distintas", () => {
  const original = sourceRecord("2130");
  const snapshot = structuredClone(original);
  const initial = input(original);
  const report = audit(initial);
  assert.equal(report.totals.sourceNotPreserved, 0);
  assert.equal(report.totals.accreditedReconciliations, 1);
  const resolved = report.cases.find((item) => item.stage === "reconciliacion_acreditada" &&
    item.key === "Altura de elevación (mm)");
  assert.deepEqual(resolved?.reconciliation, {
    originalValue: "#VALUE! mm", destinationKeys: [], classification: "origen_no_utilizable"
  });
  const altered = { ...original, specs: { ...original.specs, "Altura de elevación (mm)": "#REF! mm" } };
  const invalidated = audit({ ...initial, source: altered });
  assert.equal(invalidated.totals.accreditedReconciliations, 0);
  assert.equal(invalidated.totals.sourceNotPreserved, 1);
  const reconstructed = audit({ ...initial, origin: "reconstruccion_publicada" });
  assert.equal(reconstructed.totals.accreditedReconciliations, 0);
  assert.deepEqual(original, snapshot);
});


test("los centinelas Mercaeleva se acreditan como origen no utilizable sin ocultar pérdidas", () => {
  for (const [reference, key, originalValue] of [
    ["M062-8951", "Distancia del centro de gravedad", "−1 mm"],
    ["M119-9334", "Horas laborales", "−1 h"]
  ] as const) {
    const source = sourceRecord(reference);
    const snapshot = structuredClone(source);
    const initial = input(source);
    const report = audit(initial);
    const resolved = report.cases.find((item) => item.key === key);
    assert.equal(report.totals.accreditedReconciliations, 1, reference);
    assert.equal(report.totals.sourceNotPreserved, 0, reference);
    assert.equal(report.totals.lostAfterPublication, 0, reference);
    assert.equal(resolved?.stage, "reconciliacion_acreditada", reference);
    assert.deepEqual(resolved?.reconciliation, {
      originalValue, destinationKeys: [], classification: "origen_no_utilizable"
    });
    const changed = { ...source, specs: { ...source.specs, [key]: "12 mm" } };
    const invalidated = audit({ ...initial, source: changed });
    assert.equal(invalidated.totals.accreditedReconciliations, 0, reference);
    assert.equal(invalidated.totals.sourceNotPreserved, 1, reference);
    const reconstructed = audit({ ...initial, origin: "reconstruccion_publicada" });
    assert.equal(reconstructed.totals.accreditedReconciliations, 0, reference);
    assert.deepEqual(source, snapshot);
  }
});


test("la batería desplazada exige identidad eléctrica para poder reconciliarse", () => {
  for (const reference of ["2218", "2219"]) {
    const original = sourceRecord(reference);
    const snapshot = structuredClone(original);
    const normalized = reconcileGamSourceTechnicalUnits(original);
    assert.equal(normalized.specs?.["Ancho promedio"], undefined, reference);
    assert.equal(normalized.specs?.["Voltaje batería (V)"], "24 V", reference);
    const changedIdentity = { ...original, title: "Máquina distinta" };
    assert.equal(reconcileGamSourceTechnicalUnits(changedIdentity), changedIdentity, reference);
    const changedUrl = { ...original, url: `${original.url}?otra=1` };
    assert.equal(reconcileGamSourceTechnicalUnits(changedUrl), changedUrl, reference);
    assert.deepEqual(original, snapshot, reference);
  }
});


test("la acreditación previa de Yale ERP15VC conserva su requisito de batería corroborada", () => {
  const original = input(sourceRecord("2219"));
  const altered = { ...original.source, longDescription: (original.source.longDescription ?? "")
    .replace(/bater[ií]a de 24\s*V/iu, "batería sin voltaje confirmado") };
  assert.notEqual(altered.longDescription, original.source.longDescription);
  const report = audit({ ...original, source: altered });
  assert.equal(report.totals.accreditedReconciliations, 0);
  assert.equal(report.cases.find((item) => item.key === "Ancho promedio (mm)")?.stage,
    "diferencia_origen_preparacion");
});
