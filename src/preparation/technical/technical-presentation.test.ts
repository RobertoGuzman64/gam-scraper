import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord, SpecsMap } from "../../contracts/catalog.js";
import { normalizeOriginalEnergyPresentation, normalizeOriginalLengthPresentation, normalizeOriginalMassPresentation, normalizeTechnicalPresentation, rejectImplausibleTechnicalWeight } from "./technical-presentation.js";
import { normalizePreparedTechnicalSpecs } from "./preparation-technical-stages.js";
import { prepareSourceProduct } from "../prepare-product.js";

const source: ProductRecord = {
  providerId: "gam",
  categoryKey: "prueba",
  categoryName: "Maquinaria",
  url: "https://example.com/producto/demo",
  title: "Equipo DEMO",
  shortDescription: null,
  longDescription: null,
  price: null,
  reference: "PRUEBA-1",
  brand: "EQUIPTEST",
  model: "DEMO",
  year: null,
  location: null,
  country: null,
  horometer: null,
  serialNumber: null,
  image: null
};

test("la presentación binaria se normaliza en el núcleo sin depender del proveedor", () => {
  const input: SpecsMap = {
    Estabilizadores: "si",
    "Trabajo negativo": "no",
    Matriculada: "SI",
    Restaurada: "No",
    "Barra antiatrapamiento": "sí",
    Marca: "NO",
    Modelo: "SI",
    Referencia: "SI",
    "Nº de serie": "no",
    "Baterías nuevas": "SIN BATERÍAS",
    Motor: "SI",
    "Tipo motor": "SI",
    Potencia: "3,6 kW",
    Activo: true,
    Unidades: 2,
    Observaciones: ["si", "no"]
  };
  const original = JSON.stringify(input);
  for (const providerId of ["gam", "gomariz", "mercaeleva", "manain"]) {
    const output = normalizePreparedTechnicalSpecs({ ...source, providerId }, input);
    assert.equal(output.Estabilizadores, "Sí");
    assert.equal(output["Trabajo negativo"], "No");
    assert.equal(output.Matriculada, "Sí");
    assert.equal(output.Restaurada, "No");
    assert.equal(output["Barra antiatrapamiento"], "Sí");
    assert.equal(output.Marca, "NO");
    assert.equal(output.Modelo, "SI");
    assert.equal(output.Referencia, "SI");
    assert.equal(output["Nº de serie"], "no");
    assert.equal(output["Baterías nuevas"], "SIN BATERÍAS");
    assert.equal(output.Motor, "SI");
    assert.equal(output["Tipo motor"], "SI");
    assert.equal(output.Potencia, "3,6 kW");
    assert.equal(output.Activo, true);
    assert.equal(output.Unidades, 2);
    assert.deepEqual(output.Observaciones, ["si", "no"]);
  }
  assert.equal(JSON.stringify(input), original);
});

test("el tipo de mástil unívoco se presenta con ortografía uniforme y sin inferencias", () => {
  const input: SpecsMap = {
    "Tipo mastil": "triplex",
    "Tipo de mástil": "DUPLEX",
    "Tipo Mástil": "simplex",
    "Tipo de mastil": "cuadruplex",
    "Tipos de mástil": "triplex",
    "Mástil opcional": "duplex / triplex",
    Modelo: "TRIPLEX"
  };
  const output = normalizeTechnicalPresentation(input);
  assert.equal(output["Tipo mastil"], "Tríplex");
  assert.equal(output["Tipo de mástil"], "Dúplex");
  assert.equal(output["Tipo Mástil"], "Simple");
  assert.equal(output["Tipo de mastil"], "Cuádruplex");
  assert.equal(output["Tipos de mástil"], "triplex");
  assert.equal(output["Mástil opcional"], "duplex / triplex");
  assert.equal(output.Modelo, "TRIPLEX");
  assert.equal(normalizeTechnicalPresentation(output), output);
  assert.equal(input["Tipo mastil"], "triplex");
  assert.equal(normalizeTechnicalPresentation({ Peso: "2.400 kg", Motor: "Diésel" }).Peso, "2.400 kg");
});

test("una entrada sin cambios conserva la identidad del mapa", () => {
  const input: SpecsMap = { Modelo: "SI", Motor: "Diésel", "Tipo mastil": "Tríplex", Activo: true };
  assert.equal(normalizeTechnicalPresentation(input), input);
});

test("un peso incompatible con la familia se retiene en el origen pero no en la presentación", () => {
  const platform: ProductRecord = {
    ...source,
    providerId: "manain",
    categoryKey: "venta",
    categoryName: "Maquinaria en venta",
    url: "https://manain.com/producto/venta-elevacion-brazo-articulado-equiptest-tx1/",
    title: "TX1",
    condition: "Segunda mano",
    brand: "EQUIPTEST",
    model: "TX1",
    specs: {
      Marca: "EQUIPTEST", Modelo: "TX1", Motor: "Diésel", "Nueva o usada": "usada",
      "Altura trabajo": "15 m", "Capacidad carga": "230 kg", Peso: "10 kg"
    }
  };
  const input = platform.specs ?? {};
  const output = rejectImplausibleTechnicalWeight(platform, input);
  assert.equal(output.Peso, undefined);
  assert.equal(input.Peso, "10 kg");
  assert.equal(output["Altura trabajo"], "15 m");
  assert.equal(rejectImplausibleTechnicalWeight(platform, output), output);
  const documented = { ...input, Peso: "1200 kg" };
  assert.equal(rejectImplausibleTechnicalWeight(platform, documented), documented);
  const acceptable = { ...platform, specs: documented };
  assert.equal(rejectImplausibleTechnicalWeight(acceptable, documented), documented);
  const foreign = { ...platform, providerId: "gam", categoryKey: "incompatible" };
  assert.equal(rejectImplausibleTechnicalWeight(foreign, input), input);
});


test("la presentación elimina una unidad duplicada solo en dimensiones triples de horquillas", () => {
  const sourceSpecs: SpecsMap = {
    Horquillas: "1200 mm x 125 mm x 45 mm mm",
    "Medida de horquillas": "1200 mm x 125 mm x 45 mm mm",
    "Horquillas adicionales": "1200 mm x 125 mm x 45 mm mm",
    "Dimensiones": "1200 mm x 125 mm x 45 cm mm",
    "Horquillas alternativas": "1200 mm x 125 mm"
  };
  const before = JSON.stringify(sourceSpecs);
  const presented = normalizeTechnicalPresentation(sourceSpecs);
  assert.equal(presented.Horquillas, "1200 mm x 125 mm x 45 mm");
  assert.equal(presented["Medida de horquillas"], sourceSpecs["Medida de horquillas"]);
  assert.equal(presented["Horquillas adicionales"], sourceSpecs["Horquillas adicionales"]);
  assert.equal(presented.Dimensiones, sourceSpecs.Dimensiones);
  assert.equal(presented["Horquillas alternativas"], sourceSpecs["Horquillas alternativas"]);
  assert.equal(normalizeTechnicalPresentation(presented), presented);
  assert.equal(JSON.stringify(sourceSpecs), before);
});


test("omite marcadores sin magnitud en campos técnicos inequívocos de cualquier proveedor", () => {
  const input: SpecsMap = {
    Peso: "kg", "Peso máquina": " KG ", "Peso operativo": "n/a kg",
    Bateria: "ah", "Capacidad de la batería": "N/A Ah", "Longitud extensión": "n/a m",
    "Extensión de plataforma": "mm", Marca: "KG", Modelo: "AH", Stage: "v",
    "Peso sin carga": "1.550 kg", "Longitud de extensión": "0 m", "Baterías nuevas": "no",
    "Altura max. replegada": "3.70 m mm", "Horquillas": "si mm", "Peso adicional": "kg",
    "Peso carretilla en vacio": "1550", "Observaciones": "n/a m"
  };
  const before = structuredClone(input);
  const expected: SpecsMap = {
    Marca: "KG", Modelo: "AH", Stage: "v", "Peso sin carga": "1.550 kg",
    "Longitud de extensión": "0 m", "Baterías nuevas": "No", "Altura max. replegada": "3.70 m mm",
    "Horquillas": "si mm", "Peso adicional": "kg", "Peso carretilla en vacio": "1550", "Observaciones": "n/a m"
  };
  const output = normalizeTechnicalPresentation(input);
  assert.deepEqual(output, expected);
  assert.equal(normalizeTechnicalPresentation(output), output);
  assert.deepEqual(input, before);
  for (const providerId of ["gam", "gomariz", "mercaeleva", "manain"]) {
    const prepared = normalizePreparedTechnicalSpecs({ ...source, providerId }, { Peso: "kg", Stage: "v", "Longitud extensión": "n/a m" });
    assert.deepEqual(prepared, { Stage: "v" });
  }
});


test("uniforma categorías técnicas inequívocas sin transformar alternativas ni identidades", () => {
  const input: SpecsMap = {
    "Tipo de motor": "Diesel", "Tipo motor": "Kubota Diesel / LPG", Motor: "DIESEL",
    "Tipo de mástil": "Triple", "Tipo mastil": "Dúplex/estándar",
    "Certificación CE": "Yes", "Accesorio de mástil de elevación": "YES",
    "Certificación adicional": "Yes", Modelo: "Triple", Marca: "YES"
  };
  const expected: SpecsMap = {
    ...input, "Tipo de mástil": "Tríplex",
    "Certificación CE": "Sí", "Accesorio de mástil de elevación": "Sí"
  };
  const before = structuredClone(input);
  for (const providerId of ["gam", "gomariz", "mercaeleva", "manain"]) {
    const output = normalizePreparedTechnicalSpecs({ ...source, providerId }, input);
    assert.deepEqual(output, expected);
    assert.equal(normalizeTechnicalPresentation(output), output);
  }
  assert.deepEqual(input, before);
  const uncertain: SpecsMap = { "Tipo de motor": "Diesel / GLP", "Certificación CE": "Yes / No",
    "Tipo de mástil": "Triple opcional", "Accesorio de mástil de elevación": "Pendiente" };
  assert.equal(normalizeTechnicalPresentation(uncertain), uncertain);
});

test("presenta recuentos y horas integrales sin eliminar decimales significativos ni millares ambiguos", () => {
  const input: SpecsMap = { "Número de ruedas": "4.0", Horas: "3916.0000", Modelo: "4.0", "Horas laborales": "4.0" };
  const output = normalizeTechnicalPresentation(input);
  assert.deepEqual(output, { ...input, "Número de ruedas": "4", Horas: "3916" });
  assert.equal(normalizeTechnicalPresentation(output), output);
  assert.deepEqual(normalizeTechnicalPresentation({ "Número de ruedas": "3,00", Horas: "0.0000" }),
    { "Número de ruedas": "3", Horas: "0" });
  for (const value of ["4.000", "4.001", "4.5", "4.0001", "4-6", "4 ruedas", "-4.0"]) {
    const uncertain: SpecsMap = { "Número de ruedas": value, Horas: value };
    assert.equal(normalizeTechnicalPresentation(uncertain), uncertain);
  }
  assert.deepEqual(input, { "Número de ruedas": "4.0", Horas: "3916.0000", Modelo: "4.0", "Horas laborales": "4.0" });
});


test("presenta las unidades de batería explícitas sin repetir sufijos ni perder alternativas", () => {
  const cases: ReadonlyArray<readonly [string, string]> = [
    ["80V / 840-930Ah(V/Ah)", "80 V / 840-930 Ah"],
    ["24V / 210 - 500Ah(V/Ah)", "24 V / 210-500 Ah"],
    ["24V / 315-375Ah | Li-ion 24V / 300Ah(V/Ah)", "24 V / 315-375 Ah | Li-ion 24 V / 300 Ah"],
    ["Li-ion 51,2V / 250AH (V/Ah)", "Li-ion 51,2 V / 250 Ah"]
  ];
  for (const providerId of ["gam", "gomariz", "mercaeleva", "manain"]) {
    for (const [raw, expected] of cases) {
      const input: SpecsMap = { "Capacidad de la batería": raw, Modelo: raw };
      const output = normalizePreparedTechnicalSpecs({ ...source, providerId }, input);
      assert.deepEqual(output, { ...input, "Capacidad de la batería": expected });
      assert.equal(normalizeTechnicalPresentation(output), output);
      assert.equal(input["Capacidad de la batería"], raw);
    }
  }
});

test("conserva expresiones de batería incompletas, alternativas ambiguas y campos de recuperación", () => {
  for (const raw of ["80 / 450(V/Ah)", "80V / 450(V/Ah)", "24V / 315Ah | 300Ah(V/Ah)",
    "24V / 315Ah opcional(V/Ah)", "24V / 315Ah(V/Ah) metros", "24 V / 315 Ah"]) {
    const input: SpecsMap = { "Capacidad de la batería": raw };
    assert.equal(normalizeTechnicalPresentation(input), input);
  }
  const raw = "24V / 315-500Ah(V/Ah)";
  const recovered: SpecsMap = { "Batería (V / Ah)": raw, Baterías: raw, Modelo: raw };
  assert.equal(normalizeTechnicalPresentation(recovered), recovered);
});

test("uniforma kilogramos de pesos y capacidades directas sin reinterpretar las magnitudes", () => {
  const input: SpecsMap = { Peso: "6322 KG", "Capacidad de carga (kg)": "230KG", "Peso operativo": "2.400 Kg",
    "Peso sin carga": "2,5 kg", Modelo: "230KG", "Peso adicional": "230KG", "Capacidad de carga": "200 / 300 KG" };
  const before = structuredClone(input);
  const expected: SpecsMap = { ...input, Peso: "6322 kg", "Capacidad de carga (kg)": "230 kg", "Peso operativo": "2.400 kg" };
  const output = normalizeOriginalMassPresentation(input, input);
  assert.deepEqual(output, expected);
  assert.equal(normalizeOriginalMassPresentation(output, input), output);
  assert.deepEqual(input, before);
  for (const value of ["2 t", "230", "230 kg / 500 kg", "230 KG opcionales", "2.400,5 KG", "-230 KG"]) {
    const ambiguous: SpecsMap = { Peso: value, "Capacidad de carga (kg)": value };
    assert.equal(normalizeOriginalMassPresentation(ambiguous, ambiguous), ambiguous);
  }
});

test("conserva las magnitudes reconciliadas y aplica la presentación final a los cuatro proveedores", () => {
  const original: SpecsMap = { Peso: "1500 KG", "Capacidad de carga (kg)": "2000 KG" };
  const recovered: SpecsMap = { Peso: "1600 KG", "Capacidad de carga": "2000 KG", "Peso operativo": "1700 KG" };
  assert.equal(normalizeOriginalMassPresentation(recovered, original), recovered);
  for (const providerId of ["gam", "gomariz", "mercaeleva", "manain"]) {
    const record: ProductRecord = { ...source, providerId, specs: original };
    const output = prepareSourceProduct(record);
    assert.equal(output.product.spec.Peso, "1500 kg");
    assert.equal(output.product.spec["Capacidad de carga (kg)"], "2000 kg");
    assert.deepEqual(output.technicalProvenance?.entries, []);
    assert.deepEqual(record.specs, original);
  }
});


test("uniforma el separador decimal de cotas explícitas conservando unidades y precisión", () => {
  const input: SpecsMap = { Altura: "2.50 m", Anchura: "1.18 M", Longitud: "3.7 metros",
    "Altura plataforma": "5.80 m", "Radio de giro": "6.02 m", Modelo: "2.50 m", "Altura de trabajo (m)": "2.5 mm" };
  const before = structuredClone(input);
  const output = normalizeOriginalLengthPresentation(input, input);
  assert.deepEqual(output, { ...input, Altura: "2,50 m", Anchura: "1,18 m", Longitud: "3,7 metros",
    "Altura plataforma": "5,80 m", "Radio de giro": "6,02 m" });
  assert.equal(normalizeOriginalLengthPresentation(output, input), output);
  assert.deepEqual(input, before);
  for (const value of ["2.168 m", "5.691mm", "1.200,5 mm", "2.5", "2.5 m / 3 m", "2.5 m opcional", "-2.5 m", "2,50 m"]) {
    const uncertain: SpecsMap = { Altura: value, Longitud: value };
    assert.equal(normalizeOriginalLengthPresentation(uncertain, uncertain), uncertain);
  }
});

test("presenta cotas directas después de reconciliar sin cambiar los valores recuperados", () => {
  const original: SpecsMap = { Anchura: "1.25 m", Longitud: "3.45 m" };
  const reconciled: SpecsMap = { Anchura: "1.50 m", "Longitud total": "3.45 m" };
  assert.equal(normalizeOriginalLengthPresentation(reconciled, original), reconciled);
  for (const providerId of ["gam", "gomariz", "mercaeleva", "manain"]) {
    const record: ProductRecord = { ...source, providerId, specs: original };
    const output = prepareSourceProduct(record);
    assert.equal(output.product.spec.Anchura, "1,25 m");
    assert.equal(output.product.spec.Longitud, "3,45 m");
    assert.deepEqual(output.technicalProvenance?.entries, []);
    assert.deepEqual(record.specs, original);
  }
});


test("uniforma motorización y unidades de potencia directas sin convertir magnitudes", () => {
  const input: SpecsMap = { "Tipo de motor": "Diesel", Potencia: "45 kva", "Potencia absorbida": "2200 w",
    "Potencia Motor (KW)": "30kw", "Potencia Motor (CV)": "3.6 cv", Modelo: "Diesel", Referencia: "45 kva" };
  const before = structuredClone(input);
  const expected: SpecsMap = { ...input, "Tipo de motor": "Diésel", Potencia: "45 kVA", "Potencia absorbida": "2200 W",
    "Potencia Motor (KW)": "30 kW", "Potencia Motor (CV)": "3,6 CV" };
  const output = normalizeOriginalEnergyPresentation(input, input);
  assert.deepEqual(output, expected);
  assert.equal(normalizeOriginalEnergyPresentation(output, input), output);
  assert.deepEqual(input, before);
  for (const value of ["Diesel / GLP", "4x1000 W", "2.700 kw", "150kva kva", "35", "35 kw opcional", "30 kVA / 24 kW"]) {
    const uncertain: SpecsMap = { "Tipo de motor": value, Potencia: value };
    assert.equal(normalizeOriginalEnergyPresentation(uncertain, uncertain), uncertain);
  }
  const incompatible: SpecsMap = { "Potencia Motor (KW)": "30 kva", "Potencia Motor (CV)": "30 kw" };
  assert.equal(normalizeOriginalEnergyPresentation(incompatible, incompatible), incompatible);
});

test("conserva motorizaciones y potencias recuperadas y presenta los datos directos de cualquier proveedor", () => {
  const original: SpecsMap = { "Tipo de motor": "Diesel", Potencia: "45 kva" };
  const recovered: SpecsMap = { Motor: "Diesel", Potencia: "50 kva" };
  assert.equal(normalizeOriginalEnergyPresentation(recovered, original), recovered);
  for (const providerId of ["gam", "gomariz", "mercaeleva", "manain"]) {
    const record: ProductRecord = { ...source, providerId, specs: original };
    const output = prepareSourceProduct(record);
    assert.equal(output.product.spec["Tipo de motor"], "Diésel");
    assert.equal(output.product.spec.Potencia, "45 kVA");
    assert.deepEqual(output.technicalProvenance?.entries, []);
    assert.deepEqual(record.specs, original);
  }
});
