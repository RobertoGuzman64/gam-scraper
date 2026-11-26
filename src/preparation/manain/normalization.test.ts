import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord, SpecsMap } from "../../contracts/catalog.js";
import { prepareSourceProduct } from "../prepare-product.js";
import { normalizeManainTechnicalSpecs, reconcileManainMassCapacityPresentation, reconcileManainScissorExtensionPresentation } from "./normalization.js";

const record: ProductRecord = {
  providerId: "manain",
  categoryKey: "venta",
  categoryName: "Maquinaria en venta",
  url: "https://manain.com/producto/venta-elevacion-tijera-equiptest-tx2/",
  title: "TX2",
  shortDescription: null,
  longDescription: null,
  price: null,
  condition: "Segunda mano",
  reference: "PRUEBA-TX2",
  brand: "EQUIPTEST",
  model: "TX2",
  year: "2022",
  location: null,
  country: null,
  horometer: "120",
  serialNumber: null,
  image: "https://manain.com/imagen-tx2.jpg",
  specs: {
    Marca: "EQUIPTEST",
    Modelo: "TX2",
    Motor: "Eléctrico",
    "Nueva o usada": "usada",
    "Altura trabajo": "9 m",
    "Capacidad carga": "230 kg",
    Peso: "1.550 kg",
    "Peso maquina": "1550 kg",
    "Peso operativo": "1 550 kg",
    "Peso sin carga": "1.550 kg",
    "Peso carretilla en vacio": "1550"
  }
};

test("Manain: elimina únicamente medidas de peso idénticas con unidades explícitas", () => {
  const original = JSON.stringify(record);
  const sourceSpecs = record.specs!;
  const normalized = normalizeManainTechnicalSpecs(record, sourceSpecs);
  assert.equal(normalized.Peso, "1.550 kg");
  assert.equal(normalized["Peso maquina"], undefined);
  assert.equal(normalized["Peso operativo"], undefined);
  assert.equal(normalized["Peso sin carga"], undefined);
  assert.equal(normalized["Peso carretilla en vacio"], "1550");
  assert.equal(JSON.stringify(record), original);
  assert.equal(sourceSpecs["Peso maquina"], "1550 kg");
});

test("Manain: conserva el significado del peso acreditado en movimiento de tierras", () => {
  for (const [family, field] of [
    ["miniexcavadora", "Peso operativo"], ["minicargadora", "Peso sin carga"]
  ] as const) {
    const specs: SpecsMap = { Peso: "1.550 kg", [field]: "1550 kg", "Peso maquina": "1550 kg" };
    const source: ProductRecord = { ...record, specs,
      url: `https://manain.com/producto/venta-movimiento-tierra-${family}-equiptest-tx2/` };
    const original = JSON.stringify(source);
    const expected = { [field]: "1550 kg" };
    const normalized = normalizeManainTechnicalSpecs(source, specs);
    assert.deepEqual(normalized, expected);
    assert.equal(normalizeManainTechnicalSpecs(source, normalized), normalized);
    assert.equal(JSON.stringify(source), original);
    const different: SpecsMap = { ...specs, [field]: "1600 kg" };
    assert.deepEqual(normalizeManainTechnicalSpecs({ ...source, specs: different }, different),
      { Peso: "1.550 kg", [field]: "1600 kg" });
    const changed: SpecsMap = { ...specs, Peso: "1600 kg" };
    assert.equal(normalizeManainTechnicalSpecs(source, changed), changed);
    const ambiguous: SpecsMap = { ...specs, "Peso carretilla en vacio": "1550" };
    assert.equal(normalizeManainTechnicalSpecs({ ...source, specs: ambiguous }, ambiguous).Peso, "1.550 kg");
    const contradictory = { ...source, shortDescription: "Plataforma de tijera" };
    assert.equal(normalizeManainTechnicalSpecs(contradictory, specs).Peso, "1.550 kg");
  }
});

test("Manain: conserva discrepancias, unidades ausentes y formatos no comparables", () => {
  const conflicting: SpecsMap = {
    Peso: "4.490 kg",
    "Peso maquina": "4.200 kg",
    "Peso operativo": "kg",
    "Peso sin carga": "4490",
    "Peso carretilla en vacio": "4.290 kg"
  };
  assert.equal(normalizeManainTechnicalSpecs(record, conflicting), conflicting);
  const unsupported: SpecsMap = { Peso: "kg", "Peso maquina": "5.000 kg" };
  assert.equal(normalizeManainTechnicalSpecs(record, unsupported), unsupported);
});

test("Manain: no aplica la deduplicación técnica a otros proveedores", () => {
  const other = { ...record, providerId: "gam" };
  assert.equal(normalizeManainTechnicalSpecs(other, record.specs!), record.specs);
});

test("Manain: la preparación completa conserva la medida y el original", () => {
  const original = JSON.stringify(record);
  const result = prepareSourceProduct(record);
  assert.equal(result.status, "ready");
  assert.equal(result.product.spec.Peso, "1.550 kg");
  assert.equal(result.product.spec["Peso maquina"], undefined);
  assert.equal(result.product.spec["Peso operativo"], undefined);
  assert.equal(result.product.spec["Peso sin carga"], undefined);
  assert.equal(result.product.spec["Peso carretilla en vacio"], "1550");
  assert.equal(JSON.stringify(record), original);
});

test("Manain: la preparación integra la unificación binaria sin alterar el registro de origen", () => {
  const source: ProductRecord = {
    ...record,
    specs: { ...record.specs, Estabilizadores: "si", "Trabajo negativo": "no", Matriculada: "SI" }
  };
  const original = JSON.stringify(source);
  const prepared = prepareSourceProduct(source);
  assert.equal(prepared.status, "ready");
  assert.equal(prepared.product.spec.Estabilizadores, "Sí");
  assert.equal(prepared.product.spec["Trabajo negativo"], "No");
  assert.equal(prepared.product.spec.Matriculada, "Sí");
  assert.equal(JSON.stringify(source), original);
});

test("Manain: unifica únicamente medidas explícitas en metros sin alterar su significado", () => {
  const specs: SpecsMap = {
    "Longitud plataforma": "1.81 m",
    "Ancho plataforma": "0.9 m",
    "Altura trabajo": "21.58 m",
    "Longitud total": "1.90 m",
    "Altura max. replegada": "3.70 m mm",
    "Peso": "5.2000 kg",
    "Año": "2024",
    Modelo: "1.2 m",
    "Tracción": "4x4"
  };
  const original = JSON.stringify(specs);
  const output = normalizeManainTechnicalSpecs(record, specs);
  assert.deepEqual(output, {
    ...specs,
    "Longitud plataforma": "1,81 m",
    "Ancho plataforma": "0,9 m",
    "Altura trabajo": "21,58 m",
    "Longitud total": "1,9 m"
  });
  assert.equal(normalizeManainTechnicalSpecs(record, output), output);
  assert.equal(JSON.stringify(specs), original);
  assert.equal(normalizeManainTechnicalSpecs({ ...record, providerId: "gomariz" }, specs), specs);
});

test("Manain: la preparación presenta metros con coma y preserva las magnitudes de origen", () => {
  const source: ProductRecord = {
    ...record,
    specs: { ...record.specs, "Altura trabajo": "9.50 m", "Longitud plataforma": "1.42 m" }
  };
  const original = JSON.stringify(source);
  const prepared = prepareSourceProduct(source);
  assert.equal(prepared.status, "ready");
  assert.equal(prepared.product.spec["Altura de trabajo"], "9,5 m");
  assert.equal(prepared.product.spec["Altura trabajo"], undefined);
  assert.equal(prepared.product.spec["Longitud de plataforma"], "1,42 m");
  assert.equal(prepared.product.spec["Longitud plataforma"], undefined);
  assert.equal(JSON.stringify(source), original);
});


test("Manain: corrige un modelo repetido solo con identidad de origen coincidente", () => {
  const source: ProductRecord = {
    ...record,
    model: "TX2 PRO, TX2 PRO",
    specs: { ...record.specs, Modelo: "TX2 PRO, TX2 PRO" }
  };
  const original = JSON.stringify(source);
  const normalized = normalizeManainTechnicalSpecs(source, source.specs!);
  assert.equal(normalized.Modelo, "TX2 PRO");
  assert.equal(normalizeManainTechnicalSpecs(source, normalized), normalized);
  assert.equal(JSON.stringify(source), original);
  assert.equal(normalizeManainTechnicalSpecs({ ...source, model: "TX2 PRO" }, source.specs!).Modelo,
    "TX2 PRO, TX2 PRO");
  assert.equal(normalizeManainTechnicalSpecs({ ...source, providerId: "gam" }, source.specs!).Modelo,
    "TX2 PRO, TX2 PRO");
  const alternatives: SpecsMap = { Modelo: "TX2 PRO, TX3 PRO" };
  assert.equal(normalizeManainTechnicalSpecs({ ...source, model: "TX2 PRO, TX3 PRO" }, alternatives), alternatives);
});


test("Manain: la capacidad explícita de plataformas conserva la masa y la procedencia de unidad", () => {
  const result = prepareSourceProduct(record);
  assert.equal(result.product.spec["Capacidad carga"], undefined);
  assert.equal(result.product.spec["Capacidad de la cesta"], "230 kg");
  assert.deepEqual(result.technicalProvenance?.entries.find((entry) => entry.field === "Capacidad de la cesta"), {
    field: "Capacidad de la cesta", value: "230 kg", scope: "unit", sourceField: "Capacidad carga",
    sourceValue: "230 kg", mechanism: "src/preparation/manain/normalization.ts"
  });
  assert.equal(reconcileManainMassCapacityPresentation(record, result.product.spec), result.product.spec);
});

test("Manain: la capacidad contextual excluye otras familias, conflictos, condiciones y unidades incompatibles", () => {
  const valid: SpecsMap = { ...record.specs, "Capacidad carga": "230 kg" };
  assert.equal(reconcileManainMassCapacityPresentation(record, valid)["Capacidad de la cesta"], "230 kg");
  const excluded: readonly ProductRecord[] = [
    { ...record, providerId: "gam" },
    { ...record, url: "https://manain.com/producto/venta-manipulacion-carretilla-equiptest-tx2/" },
    { ...record, shortDescription: "Miniexcavadora compacta" },
    { ...record, model: "OTRO" },
    { ...record, condition: "Nuevo" },
    { ...record, url: "https://example.com/producto/venta-elevacion-tijera-equiptest-tx2/" }
  ];
  for (const source of excluded) assert.equal(reconcileManainMassCapacityPresentation({ ...source, specs: valid }, valid), valid);
  for (const specs of [
    { "Capacidad carga": "230 kg", "Capacidad máxima de plataforma": "300 kg" },
    { "Capacidad carga": "230 kg", "Capacidad de la cesta": "230 kg" },
    { "Capacidad carga": "230/300 kg" }, { "Capacidad carga": "230 lb" },
    { "Capacidad carga": "230 kg con limitación" }, { "Capacidad carga": 230 },
    { "Capacidad carga": "2,300 kg" }, { "Capacidad carga": "0 kg" }
  ]) {
    const original = { ...record.specs, ...specs };
    assert.equal(reconcileManainMassCapacityPresentation({ ...record, specs: original }, original), original);
  }
  const changed = { ...valid, "Capacidad carga": "300 kg" };
  assert.equal(reconcileManainMassCapacityPresentation({ ...record, specs: valid }, changed), changed);
});


test("Manain: diferencia carga de manipulación y máxima de elevación sin incorporar capacidades ambiguas", () => {
  const specs: SpecsMap = { Marca: "EQUIPTEST", Modelo: "TX2", Motor: "Eléctrico", "Nueva o usada": "usada", "Capacidad carga": "2500 kg" };
  const source: ProductRecord = { ...record, specs, url: "https://manain.com/producto/venta-manipulacion-carretilla-equiptest-tx2/" };
  assert.equal(reconcileManainMassCapacityPresentation(source, specs)["Capacidad de carga"], "2500 kg");
  const manipulator = { ...source, url: source.url.replace("carretilla", "manipulador") };
  assert.equal(reconcileManainMassCapacityPresentation(manipulator, specs)["Capacidad máxima de elevación"], "2500 kg");
  const conflict = { ...specs, "Capacidad máxima de elevación": "3000 kg" };
  assert.equal(reconcileManainMassCapacityPresentation({ ...manipulator, specs: conflict }, conflict), conflict);
});


test("Manain: los grupos electrógenos conservan potencia aparente y tensiones con sufijo duplicado de origen", () => {
  const specs: SpecsMap = { Potencia: "80kva kva", Voltios: "400/230v v", Otro: "24v v" };
  const source = { ...record, url: "https://manain.com/producto/venta-energia-grupo-electrogeno-equiptest-g1/", specs };
  const expected = { ...specs, Potencia: "80 kVA", Voltios: "400 / 230 V" };
  const normalized = normalizeManainTechnicalSpecs(source, specs);
  assert.deepEqual(normalized, expected);
  assert.equal(normalizeManainTechnicalSpecs(source, normalized), normalized);
  assert.deepEqual(source.specs, { Potencia: "80kva kva", Voltios: "400/230v v", Otro: "24v v" });
  assert.equal(normalizeManainTechnicalSpecs({ ...record, specs }, specs), specs);
  assert.equal(normalizeManainTechnicalSpecs({ ...source, providerId: "gam" }, specs), specs);
  assert.equal(normalizeManainTechnicalSpecs({ ...source, specs: {} }, specs), specs);
  for (const invalid of [
    { Potencia: "80kva kw", Voltios: "400/230v a" },
    { Potencia: "80/90kva kva", Voltios: "400-230v v" },
    { Potencia: "80kva kva kva", Voltios: "400/230v v v" },
    { Potencia: "80kva kva opcional", Voltios: "400/0v v" }
  ]) assert.equal(normalizeManainTechnicalSpecs({ ...source, specs: invalid }, invalid), invalid);
});


test("Manain: la extensión de tijera conserva la medida original y su procedencia", () => {
  const specs: SpecsMap = { ...record.specs, "Longitud extensión": "0,9 m", "Longitud plataforma": "2,4 m" };
  const source = { ...record, specs };
  const result = prepareSourceProduct(source);
  assert.equal(result.product.spec["Longitud extensión"], undefined);
  assert.equal(result.product.spec["Extensión de plataforma"], "0,9 m");
  assert.equal(result.product.spec["Longitud de plataforma"], "2,4 m");
  assert.deepEqual(result.technicalProvenance?.entries.find((entry) => entry.field === "Extensión de plataforma"), {
    field: "Extensión de plataforma", value: "0,9 m", scope: "unit", sourceField: "Longitud extensión",
    sourceValue: "0,9 m", mechanism: "src/preparation/technical/technical-presentation.ts"
  });
  assert.equal(reconcileManainScissorExtensionPresentation(source, result.product.spec), result.product.spec);
  assert.equal(source.specs["Longitud extensión"], "0,9 m");
});

test("Manain: la extensión no se extrapola ni sustituye magnitudes ambiguas o concurrentes", () => {
  const specs: SpecsMap = { ...record.specs, "Longitud extensión": "0,9 m" };
  const source = { ...record, specs };
  for (const incompatible of [
    { ...source, providerId: "gam" as const }, { ...source, url: source.url.replace("tijera", "unipersonal") },
    { ...source, url: source.url.replace("tijera", "brazo-articulado") },
    { ...source, shortDescription: "Miniexcavadora compacta" }, { ...source, model: "OTRO" }
  ]) assert.equal(reconcileManainScissorExtensionPresentation(incompatible, specs), specs);
  for (const raw of ["0 m", "0,9/1,2 m", "900 mm", "0,9", "0,9 m opcional"]) {
    const invalid = { ...specs, "Longitud extensión": raw };
    assert.equal(reconcileManainScissorExtensionPresentation({ ...source, specs: invalid }, invalid), invalid);
  }
  for (const alias of ["Extensión de plataforma", "Longitud de extensión", "Extensión de cesta"]) {
    const conflict = { ...specs, [alias]: "1,2 m" };
    assert.equal(reconcileManainScissorExtensionPresentation({ ...source, specs: conflict }, specs), specs);
    assert.equal(reconcileManainScissorExtensionPresentation(source, conflict), conflict);
  }
  const changed = { ...specs, "Longitud extensión": "1,2 m" };
  assert.equal(reconcileManainScissorExtensionPresentation(source, changed), changed);
});
