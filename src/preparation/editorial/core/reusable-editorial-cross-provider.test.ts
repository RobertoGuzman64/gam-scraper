import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { resolveEditorialFacts } from "./editorial-facts.js";
import { resolveReusableEditorial } from "./editorial-composition.js";
import {
  controlledGamForklift, controlledGomarizForklift, controlledMercaelevaForklift,
  controlledGomarizPlatform, controlledMercaelevaPlatform
} from "./editorial-contract-records.js";

test("el mismo contrato de carretilla funciona en tres proveedores sin identificadores reales", () => {
  const sources = [controlledGamForklift(), controlledGomarizForklift(), controlledMercaelevaForklift()];
  for (const source of sources) {
    const snapshot = JSON.stringify(source);
    const facts = resolveEditorialFacts(source);
    assert.equal(facts?.family, "carretilla-elevadora", source.providerId);
    assert.equal(facts?.loadCapacityKg, 2500, source.providerId);
    assert.match(resolveReusableEditorial(source).short ?? "", /capacidad de carga de 2\.500 kg/u);
    assert.equal(JSON.stringify(source), snapshot);
  }
});

test("alturas de trabajo y elevación no se mezclan", () => {
  const work = resolveEditorialFacts(controlledGomarizPlatform());
  const lifting = resolveEditorialFacts(controlledGamForklift());
  assert.equal(work?.workingHeightM, 10);
  assert.equal(work?.liftingHeightM, null);
  assert.equal(lifting?.workingHeightM, null);
  assert.equal(lifting?.liftingHeightM, 4.5);
  assert.doesNotMatch(resolveReusableEditorial(controlledGomarizPlatform()).short ?? "", /altura de elevación/u);
  assert.doesNotMatch(resolveReusableEditorial(controlledGamForklift()).short ?? "", /altura de trabajo/u);
});

test("dos proveedores con la misma familia no comparten datos ausentes de la otra fuente", () => {
  const complete = controlledGomarizPlatform();
  const partial = controlledMercaelevaPlatform();
  assert.equal(resolveEditorialFacts(complete)?.family, "plataforma-tijera");
  assert.equal(resolveEditorialFacts(partial)?.family, "plataforma-tijera");
  assert.match(resolveReusableEditorial(complete).short ?? "", /capacidad de 450 kg/u);
  assert.doesNotMatch(resolveReusableEditorial(partial).short ?? "", /450 kg/u);
});

test("las fuentes incompatibles no propagan texto a otras variantes", () => {
  const source = controlledGamForklift();
  const variants: readonly ProductRecord[] = [
    { ...source, providerId: "gomariz" },
    { ...source, model: "MODELO99" },
    { ...source, url: "https://example.invalid/es/carretillas/CONTROL-03-carretilla-elevadora" },
    { ...source, specs: { ...source.specs, "Capacidad de carga (kg)": "2500 litros" } },
    { ...source, specs: { ...source.specs, "Capacidad de carga (kg)": "3500 kg" } }
  ];
  for (const [index, variant] of variants.entries()) {
    assert.equal(resolveEditorialFacts(variant), null, String(index));
    assert.deepEqual(resolveReusableEditorial(variant), { short: null, general: null });
  }
});

test("las cotas replegadas y de plataforma se interpretan con los alias de la misma unidad", () => {
  const gomariz = controlledGomarizPlatform();
  const mercaeleva = controlledMercaelevaPlatform();
  const manain: ProductRecord = {
    ...gomariz, providerId: "manain", categoryKey: "venta", categoryName: "Maquinaria en venta",
    title: "MODELO10", url: "https://manain.com/producto/venta-elevacion-tijera-marca-modelo10/",
    specs: { Marca: "MARCA", Modelo: "MODELO10", "Nueva o usada": "usada", Motor: "Eléctrico",
      "Altura trabajo": "10 m", "Capacidad carga": "450 kg" }
  };
  const cases: readonly (readonly [ProductRecord, NonNullable<ProductRecord["specs"]>])[] = [
    [gomariz, { "Longitud de plataforma": "2 m", "Anchura de plataforma": "800 mm" }],
    [mercaeleva, { "Longitud de plataforma": "2 m", "Anchura de plataforma": "800 mm" }],
    [manain, { "Longitud plataforma": "2 m", "Ancho plataforma": "800 mm" }]
  ];
  for (const [source, dimensions] of cases) {
    const record: ProductRecord = { ...source, specs: { ...source.specs, ...dimensions,
      "Altura replegada": "2,1 m", "Longitud total": "2,5 m", "Anchura total": "1 m" } };
    const before = JSON.stringify(record);
    const facts = resolveEditorialFacts(record);
    assert.equal(facts?.storedHeightM, 2.1, source.providerId);
    assert.equal(facts?.basketLengthM, 2, source.providerId);
    assert.equal(facts?.basketWidthM, 0.8, source.providerId);
    assert.match(resolveReusableEditorial(record).general ?? "", /altura replegada de 2,1 m.*plataforma de 2 × 0,8 m/u);
    assert.equal(JSON.stringify(record), before);
  }
});

test("las cotas nuevas no se narran con dimensiones incompatibles ni con evidencia de otra unidad", () => {
  const source = controlledGomarizPlatform();
  const record: ProductRecord = { ...source, specs: { ...source.specs,
    "Altura replegada": "2 m", "Longitud de plataforma": "2 m", "Anchura de plataforma": "0,8 m",
    "Longitud total": "2,5 m", "Anchura total": "1 m" } };
  const variants: readonly NonNullable<ProductRecord["specs"]>[] = [
    { "Anchura de plataforma": "3 m" },
    { "Longitud de plataforma": "4 m" },
    { "Anchura de plataforma": "0,8 kg" },
    { "Ancho plataforma": "0,9 m" },
    { "Dimensiones Cesta": "2 × 0,9 m" },
    { "Anchura de plataforma": "0,8 / 1 m" }
  ];
  for (const variant of variants) {
    const conflicting = { ...record, specs: { ...record.specs, ...variant } };
    assert.equal(resolveEditorialFacts(conflicting)?.basketLengthM, null);
    assert.equal(resolveEditorialFacts(conflicting)?.basketWidthM, null);
    assert.doesNotMatch(resolveReusableEditorial(conflicting).general ?? "", /plataforma de \d.*×/u);
  }
  const heightConflicts: readonly NonNullable<ProductRecord["specs"]>[] = [
    { "Altura replegada": "12 m" }, { "Altura almacenaje": "3 m" }, { "Altura replegada": "2 kg" }
  ];
  for (const specs of heightConflicts) {
    const conflicting = { ...record, specs: { ...record.specs, ...specs } };
    assert.equal(resolveEditorialFacts(conflicting)?.storedHeightM, null);
    assert.doesNotMatch(resolveReusableEditorial(conflicting).general ?? "", /altura replegada/u);
  }
  for (const original of [source, { ...record, reference: "CONTROL-OTRA" },
    { ...record, specs: { ...record.specs, "Altura replegada": "2,2 m", "Anchura de plataforma": "0,9 m" } }]) {
    const general = resolveReusableEditorial(record, null, original).general ?? "";
    assert.doesNotMatch(general, /altura replegada|plataforma de \d.*×/u);
  }
  const forklift = controlledGamForklift();
  const handling = { ...forklift, specs: { ...forklift.specs, "Altura replegada": "2 m",
    "Longitud de plataforma": "2 m", "Anchura de plataforma": "0,8 m" } };
  assert.equal(resolveEditorialFacts(handling)?.basketLengthM, null);
  assert.equal(resolveEditorialFacts(handling)?.storedHeightM, null);
});

test("la descripción general conserva la clase de peso acreditada de la unidad", () => {
  for (const [family, field, label] of [
    ["miniexcavadora", "Peso operativo", "peso operativo declarado"],
    ["minicargadora", "Peso sin carga", "peso sin carga declarado"]
  ] as const) {
    const source: ProductRecord = {
      ...controlledGomarizPlatform(), providerId: "manain", categoryKey: "venta", categoryName: "Maquinaria en venta",
      url: `https://manain.com/producto/venta-movimiento-tierra-${family}-marca-modelo10/`, title: "MODELO10",
      specs: { Marca: "MARCA", Modelo: "MODELO10", "Nueva o usada": "usada", Motor: "Diésel",
        Peso: "2000 kg", [field]: "2.000 kg", Longitud: "3 m" }
    };
    const original = JSON.stringify(source);
    const { [field]: omitted, ...genericSpecs } = source.specs ?? {};
    assert.ok(omitted);
    const generic = { ...source, specs: genericSpecs };
    const expected = resolveReusableEditorial(generic);
    assert.ok(expected.general);
    assert.match(expected.general, /peso declarado de 2\.000 kg/u);
    const result = resolveReusableEditorial(source);
    assert.equal(result.general, expected.general.replace("peso declarado", label));
    assert.equal(result.short, expected.short);
    assert.equal(JSON.stringify(source), original);
    const alternative = field === "Peso operativo" ? "Peso sin carga" : "Peso operativo";
    for (const variant of [
      generic,
      { ...source, reference: "OTRA-UNIDAD" },
      { ...source, specs: { ...source.specs, [field]: "2100 kg" } },
      { ...source, specs: { ...source.specs, [alternative]: "2000 kg" } },
      { ...source, specs: { ...source.specs, [field]: "2000" } },
      { ...source, specs: { ...source.specs, "Peso maquina": "2100 kg" } },
      { ...source, longDescription: "Peso pendiente de confirmar." }
    ]) {
      assert.equal(resolveReusableEditorial(source, null, variant).general, expected.general);
      assert.doesNotMatch(resolveReusableEditorial(variant, null, source).general ?? "", /peso (?:operativo|sin carga) declarado/u);
    }
  }
});


test("ambas descripciones distinguen el alcance horizontal máximo corroborado", () => {
  const original: ProductRecord = {
    ...controlledGomarizPlatform(), title: "Plataforma articulada eléctrica MARCA MODELO10",
    specs: { "Altura de trabajo": "10 m", Capacidad: "230 kg", Motor: "Eléctrico",
      "Alcance lateral": "6 m", "Alcance horizontal max.": "6 m" }
  };
  const { ["Alcance horizontal max."]: maximum, ...genericSpecs } = original.specs ?? {};
  assert.ok(maximum);
  const prepared = { ...original, specs: { ...genericSpecs, "Alcance horizontal máximo": "6 m" } };
  const generic = { ...original, specs: genericSpecs };
  const baseline = resolveReusableEditorial(generic);
  const improved = resolveReusableEditorial(prepared, null, original);
  assert.match(baseline.general ?? "", /alcance lateral de 6 m/u);
  assert.equal(improved.general, baseline.general?.replace("alcance lateral", "alcance horizontal máximo declarado"));
  assert.equal(improved.short, baseline.short?.replace("alcance lateral", "alcance horizontal máximo"));
  for (const source of [generic, { ...original, reference: "OTRA-UNIDAD" },
    { ...original, specs: { ...original.specs, "Alcance horizontal max.": "7 m" } },
    { ...original, specs: { ...original.specs, "Alcance horizontal": "5 m" } },
    { ...original, specs: { ...original.specs, "Alcance horizontal max.": "6/7 m" } },
    { ...original, longDescription: "Alcance pendiente de confirmar." }]) {
    assert.deepEqual(resolveReusableEditorial(prepared, null, source), baseline);
  }
  assert.deepEqual(resolveReusableEditorial(generic, null, original), baseline);
});

test("las dimensiones totales de plataforma se distinguen de las cotas de cesta sin alterar la corta", () => {
  for (const base of [controlledGomarizPlatform(), controlledMercaelevaPlatform()]) {
    const source: ProductRecord = { ...base, specs: { ...base.specs, Longitud: "3 m", Anchura: "1,2 m",
      "Longitud de plataforma": "2 m", "Anchura de plataforma": "0,8 m" } };
    const explicit = { ...source, specs: { ...source.specs, "Longitud total": "3000 mm", "Ancho total": "1,2 m" } };
    const prepared = { ...source, specs: { ...source.specs, "Longitud total": "3 m", "Anchura total": "1200 mm" } };
    const baseline = resolveReusableEditorial(source);
    const result = resolveReusableEditorial(prepared, null, explicit);
    assert.equal(result.general, baseline.general?.replace("longitud de 3 m", "longitud total: 3 m")
      .replace("anchura de 1,2 m", "anchura total: 1,2 m"));
    assert.match(result.general ?? "", /longitud total: 3 m, anchura total: 1,2 m.*plataforma de 2 × 0,8 m/u);
    assert.equal(result.short, baseline.short);
    for (const other of [source, { ...explicit, reference: "OTRA" },
      { ...explicit, longDescription: "Dimensiones pendientes de comprobar." },
      { ...explicit, specs: { ...explicit.specs, "Longitud total": "2/3 m", "Ancho total": "1,3 m" } }]) {
      assert.doesNotMatch(resolveReusableEditorial(prepared, null, other).general ?? "", /(?:longitud|anchura) total:/u);
    }
  }
});

test("la pendiente superable conserva su significado editorial con la clave técnica compartida", () => {
  const source = controlledGomarizPlatform();
  const legacy = { ...source, specs: { ...source.specs, "Pendiente superable": "25 %" } };
  const canonical = { ...source, specs: { ...source.specs, "Pendiente superable (%)": "25 %" } };
  assert.equal(resolveEditorialFacts(legacy)?.gradeabilityPercent, 25);
  assert.equal(resolveEditorialFacts(canonical)?.gradeabilityPercent, 25);
  assert.deepEqual(resolveReusableEditorial(canonical), resolveReusableEditorial(legacy));
  assert.equal(resolveEditorialFacts({ ...legacy, specs: { ...legacy.specs, "Pendiente superable (%)": "40 %" } })?.gradeabilityPercent, null);
});


test("la corta de tijera aprovecha la anchura del equipo corroborada, no la de plataforma", () => {
  for (const base of [controlledGomarizPlatform(), controlledMercaelevaPlatform()]) {
    const source: ProductRecord = { ...base, specs: { ...base.specs, Capacidad: "450 kg", Anchura: "0,81 m",
      "Longitud de plataforma": "2 m", "Anchura de plataforma": "0,74 m" } };
    const prepared: ProductRecord = { ...source, specs: { ...source.specs, Anchura: "810 mm" } };
    const result = resolveReusableEditorial(prepared, null, source);
    assert.match(result.short ?? "", /capacidad de 450 kg y anchura del equipo de 0,81 m/u);
    assert.doesNotMatch(result.short ?? "", / y capacidad de 450 kg y /u);
    assert.doesNotMatch(result.short ?? "", /0,74 m/u);
    assert.equal(result.general, resolveReusableEditorial(source).general);
    const withoutWidth = { ...source, specs: { ...base.specs, Capacidad: "450 kg", "Anchura de plataforma": "0,74 m" } };
    for (const other of [withoutWidth, { ...source, reference: "OTRA" }, { ...source, model: "OTRO" },
      { ...source, specs: { ...source.specs, Anchura: "1,2 m" } },
      { ...source, specs: { ...source.specs, "Anchura total": "1,2 m" } },
      { ...source, longDescription: "Anchura de 1,2 m." },
      { ...source, shortDescription: "Descripción original de la unidad." }]) {
      assert.doesNotMatch(resolveReusableEditorial(prepared, null, other).short ?? "", /anchura del equipo/u);
    }
    for (const value of ["0,3 m", "4 m", "0,81 kg", "0,8–1,2 m"]) {
      const invalid = { ...source, specs: { ...source.specs, Anchura: value } };
      assert.doesNotMatch(resolveReusableEditorial(invalid).short ?? "", /anchura del equipo/u);
    }
  }
});


test("la corta de brazo distingue la altura replegada corroborada de la altura de trabajo", () => {
  for (const family of ["articulada", "telescópica"]) {
    const source: ProductRecord = {
      ...controlledGomarizPlatform(), title: `Plataforma ${family} eléctrica MARCA MODELO10`,
      specs: { "Altura de trabajo": "10 m", Capacidad: "230 kg", Motor: "Eléctrico",
        "Alcance lateral": "6 m", "Altura replegada": "2100 mm" }
    };
    const prepared: ProductRecord = { ...source, specs: { ...source.specs, "Altura replegada": "2,1 m" } };
    const result = resolveReusableEditorial(prepared, null, source);
    assert.match(result.short ?? "", /altura de trabajo de 10 m, alcance lateral de 6 m, capacidad de 230 kg y altura replegada de 2,1 m/u);
    assert.equal(result.general, resolveReusableEditorial(source).general);
    const { ["Altura replegada"]: omitted, ...otherSpecs } = source.specs ?? {};
    assert.ok(omitted);
    for (const other of [
      { ...source, specs: otherSpecs },
      { ...source, reference: "OTRA" },
      { ...source, model: "OTRO" },
      { ...source, specs: { ...source.specs, "Altura replegada": "2,3 m" } },
      { ...source, specs: { ...source.specs, "Altura almacenaje": "2,3 m" } },
      { ...source, shortDescription: "Descripción firmada." },
      { ...source, longDescription: "Altura replegada pendiente de confirmar." }
    ]) assert.doesNotMatch(resolveReusableEditorial(prepared, null, other).short ?? "", /altura replegada/u);
    for (const value of ["10 m", "12 m", "2 kg", "2/3 m"]) {
      const invalid = { ...source, specs: { ...source.specs, "Altura replegada": value } };
      assert.doesNotMatch(resolveReusableEditorial(invalid).short ?? "", /altura replegada/u);
    }
  }
});


test("la corta de carretilla aprovecha la anchura exterior corroborada, no la de horquillas", () => {
  for (const base of [controlledGomarizForklift(), controlledMercaelevaForklift()]) {
    const source: ProductRecord = { ...base, specs: { ...base.specs, Anchura: "1,2 m", "Ancho horquillas": "100 mm" } };
    const prepared: ProductRecord = { ...source, specs: { ...source.specs, Anchura: "1200 mm" } };
    const result = resolveReusableEditorial(prepared, null, source);
    assert.match(result.short ?? "", /capacidad de carga de 2\.500 kg y anchura del equipo de 1,2 m/u);
    assert.doesNotMatch(result.short ?? "", /100 mm/u);
    assert.equal(result.general, resolveReusableEditorial(source).general);
    const { Anchura: omitted, ...otherSpecs } = source.specs ?? {};
    assert.ok(omitted);
    for (const other of [
      { ...source, specs: otherSpecs }, { ...source, reference: "OTRA" }, { ...source, model: "OTRO" },
      { ...source, specs: { ...source.specs, Anchura: "1,3 m" } },
      { ...source, specs: { ...source.specs, "Ancho total": "1,3 m" } },
      { ...source, longDescription: "Anchura pendiente de confirmar." },
      { ...source, shortDescription: "Descripción firmada." }
    ]) assert.doesNotMatch(resolveReusableEditorial(prepared, null, other).short ?? "", /anchura del equipo/u);
    for (const value of ["0,1 m", "5 m", "1,2 kg", "1,2/1,3 m"]) {
      const invalid = { ...source, specs: { ...source.specs, Anchura: value } };
      assert.doesNotMatch(resolveReusableEditorial(invalid).short ?? "", /anchura del equipo/u);
    }
  }
});


test("la corta de brazo conserva la cota de almacenaje sin atribuir una altura replegada", () => {
  for (const base of [controlledGomarizPlatform(), controlledMercaelevaPlatform()]) {
    const source: ProductRecord = { ...base, title: "Plataforma articulada eléctrica MARCA MODELO10",
      specs: { "Altura de trabajo": "10 m", "Alcance lateral": "6 m", Capacidad: "230 kg",
        "Altura almacenaje": "2,1 m" } };
    const prepared: ProductRecord = { ...source, specs: { ...source.specs, "Altura almacenaje": "2100 mm" } };
    const result = resolveReusableEditorial(prepared, null, source);
    assert.match(result.short ?? "", /capacidad de 230 kg y altura de almacenaje de 2,1 m/u);
    assert.doesNotMatch(result.short ?? "", /altura replegada/u);
    assert.equal(result.general, resolveReusableEditorial(source).general);
    for (const other of [
      { ...source, reference: "OTRA" }, { ...source, model: "OTRO" },
      { ...source, specs: { ...source.specs, "Altura almacenaje": "2,3 m" } },
      { ...source, specs: { ...source.specs, "Altura replegada": "2,1 m" } },
      { ...source, longDescription: "Altura de transporte de 2,3 m." },
      { ...source, shortDescription: "Descripción firmada." }
    ]) assert.doesNotMatch(resolveReusableEditorial(prepared, null, other).short ?? "", /altura de almacenaje/u);
    for (const value of ["10 m", "12 m", "2 kg", "2/3 m"]) {
      const invalid = { ...source, specs: { ...source.specs, "Altura almacenaje": value } };
      assert.doesNotMatch(resolveReusableEditorial(invalid).short ?? "", /altura de almacenaje/u);
    }
  }
});

test("la corta aprovecha el peso declarado corroborado sin atribuirle un alcance de transporte", () => {
  for (const base of [controlledGomarizForklift(), controlledMercaelevaForklift()]) {
    const source: ProductRecord = { ...base, specs: { ...base.specs, Peso: "3600 kg", Anchura: "1,2 m" } };
    const prepared: ProductRecord = { ...source, specs: { ...source.specs, Peso: "3.600 kg" } };
    const result = resolveReusableEditorial(prepared, null, source);
    assert.match(result.short ?? "", /capacidad de carga de 2\.500 kg, anchura del equipo de 1,2 m y peso declarado de 3\.600 kg/u);
    assert.doesNotMatch(result.short ?? "", /peso operativo|peso de transporte/u);
    assert.equal(result.general, resolveReusableEditorial(source).general);
    const { Peso: omitted, ...otherSpecs } = source.specs ?? {};
    assert.ok(omitted);
    for (const other of [
      { ...source, specs: otherSpecs }, { ...source, reference: "OTRA" }, { ...source, model: "OTRO" },
      { ...source, specs: { ...source.specs, Peso: "3700 kg" } },
      { ...source, specs: { ...source.specs, "Peso operativo": "3600 kg" } },
      { ...source, longDescription: "Peso pendiente de confirmar." },
      { ...source, shortDescription: "Descripción firmada." }
    ]) assert.doesNotMatch(resolveReusableEditorial(prepared, null, other).short ?? "", /peso declarado/u);
    for (const value of ["3,6 m", "3600–3700 kg", "0 kg"]) {
      const invalid = { ...source, specs: { ...source.specs, Peso: value } };
      assert.doesNotMatch(resolveReusableEditorial(invalid).short ?? "", /peso declarado/u);
    }
  }
  const generator: ProductRecord = { ...controlledGomarizPlatform(), title: "Grupo electrógeno diésel MARCA MODELO10",
    specs: { Potencia: "45 kVA", Motor: "Diésel", Peso: "1017 kg" } };
  assert.match(resolveReusableEditorial(generator).short ?? "", /potencia aparente de 45 kVA y peso declarado de 1\.017 kg/u);
  const telehandler: ProductRecord = { ...controlledGomarizPlatform(), title: "Manipulador telescópico diésel MARCA MODELO10",
    specs: { "Altura de trabajo": "10 m", Capacidad: "3000 kg", Motor: "Diésel", Peso: "6500 kg" } };
  assert.match(resolveReusableEditorial(telehandler).short ?? "", /capacidad de carga de 3\.000 kg y peso declarado de 6\.500 kg/u);
});


test("la corta de tijera distingue anchura y cota de almacenaje o replegada corroboradas", () => {
  for (const base of [controlledGomarizPlatform(), controlledMercaelevaPlatform()]) {
    for (const [key, label] of [["Altura almacenaje", "altura de almacenaje"], ["Altura replegada", "altura replegada"]] as const) {
      const source: ProductRecord = { ...base, specs: { ...base.specs, Capacidad: "450 kg", Anchura: "1 m", [key]: "2,1 m" } };
      const prepared: ProductRecord = { ...source, specs: { ...source.specs, [key]: "2100 mm" } };
      const result = resolveReusableEditorial(prepared, null, source);
      assert.ok(result.short?.includes(`anchura del equipo de 1 m y ${label} de 2,1 m`));
      assert.equal(result.general, resolveReusableEditorial(source).general);
      const { [key]: omitted, ...otherSpecs } = source.specs ?? {};
      assert.ok(omitted);
      for (const other of [
        { ...source, specs: otherSpecs }, { ...source, reference: "OTRA" }, { ...source, model: "OTRO" },
        { ...source, specs: { ...source.specs, [key]: "2,3 m" } },
        { ...source, longDescription: "Altura de transporte pendiente de confirmar." },
        { ...source, shortDescription: "Descripción firmada." }
      ]) assert.ok(!resolveReusableEditorial(prepared, null, other).short?.includes(label));
      for (const value of ["10 m", "12 m", "2 kg", "2/3 m"]) {
        const invalid = { ...source, specs: { ...source.specs, [key]: value } };
        assert.ok(!resolveReusableEditorial(invalid).short?.includes(label));
      }
    }
  }
});


test("la corta de brazo distingue anchura exterior y dimensiones de cesta corroboradas", () => {
  for (const base of [controlledGomarizPlatform(), controlledMercaelevaPlatform()]) {
    for (const family of ["articulada", "telescópica"]) {
      const source: ProductRecord = { ...base, title: `Plataforma ${family} eléctrica MARCA MODELO10`,
        specs: { "Altura de trabajo": "10 m", "Alcance lateral": "6 m", Capacidad: "230 kg",
          "Altura almacenaje": "2,1 m", "Anchura total": "2 m", "Dimensiones Cesta": "1,2 x 0,8 m" } };
      const prepared: ProductRecord = { ...source, specs: { ...source.specs, "Anchura total": "2000 mm" } };
      const result = resolveReusableEditorial(prepared, null, source);
      assert.match(result.short ?? "", /capacidad de 230 kg, anchura del equipo de 2 m y altura de almacenaje de 2,1 m/u);
      assert.equal(result.general, resolveReusableEditorial(source).general);
      const detailed: ProductRecord = { ...source, specs: { ...source.specs, "Altura plataforma": "8 m" } };
      assert.doesNotMatch(resolveReusableEditorial(detailed).short ?? "", /anchura del equipo/u);
      const { "Anchura total": omitted, ...otherSpecs } = source.specs ?? {};
      assert.ok(omitted);
      for (const other of [
        { ...source, specs: otherSpecs }, { ...source, reference: "OTRA" }, { ...source, model: "OTRO" },
        { ...source, specs: { ...source.specs, "Anchura total": "2,3 m" } },
        { ...source, specs: { ...source.specs, Anchura: "2,3 m" } },
        { ...source, longDescription: "Anchura pendiente de confirmar." },
        { ...source, shortDescription: "Descripción firmada." }
      ]) assert.doesNotMatch(resolveReusableEditorial(prepared, null, other).short ?? "", /anchura del equipo/u);
      for (const value of ["0,1 m", "4 m", "2 kg", "2/3 m"]) {
        const invalid = { ...source, specs: { ...source.specs, "Anchura total": value } };
        assert.doesNotMatch(resolveReusableEditorial(invalid).short ?? "", /anchura del equipo/u);
      }
    }
  }
});

test("la corta de carretilla incorpora el centro de carga corroborado sin inferir capacidades residuales", () => {
  for (const base of [controlledGamForklift(), controlledGomarizForklift(), controlledMercaelevaForklift()]) {
    const source: ProductRecord = { ...base, specs: { ...base.specs, "Centro de carga": "500 mm" } };
    const result = resolveReusableEditorial(source);
    assert.match(result.short ?? "", /capacidad de carga de 2\.500 kg y centro de carga declarado de 500 mm/u);
    assert.match(result.general ?? "", /centro de carga declarado de 500 mm/u);
    for (const other of [
      { ...base, reference: "OTRA" }, { ...source, model: "OTRO" },
      { ...base }, { ...source, specs: { ...source.specs, "Centro de carga": "600 mm" } },
      { ...source, longDescription: "Centro de carga de 600 mm." },
      { ...source, shortDescription: "Centro de carga de 600 mm." }
    ]) assert.doesNotMatch(resolveReusableEditorial(source, null, other).short ?? "", /centro de carga declarado/u);
    for (const value of ["120 mm", "500/600 mm", "500 kg"]) {
      const invalid = { ...source, specs: { ...source.specs, "Centro de carga": value } };
      assert.doesNotMatch(resolveReusableEditorial(invalid).short ?? "", /centro de carga declarado/u);
    }
  }
});


test("la corta de manutención aprovecha el radio de giro declarado de la misma unidad sin atribuirle otro alcance", () => {
  for (const base of [controlledGamForklift(), controlledGomarizForklift(), controlledMercaelevaForklift()]) {
    const source: ProductRecord = { ...base, specs: { ...base.specs, "Radio de giro": "1980 mm", "Centro de carga": "500 mm" } };
    const prepared: ProductRecord = { ...source, specs: { ...source.specs, "Radio de giro": "1,98 m" } };
    const result = resolveReusableEditorial(prepared, null, source);
    assert.match(result.short ?? "", /centro de carga declarado de 500 mm y radio de giro declarado de 1,98 m/u);
    assert.doesNotMatch(result.short ?? "", /radio de giro exterior|radio de giro interior/u);
    assert.equal(result.general, resolveReusableEditorial(source).general);
    for (const other of [
      { ...source, reference: "OTRA" }, { ...source, model: "OTRO" }, base,
      { ...source, specs: { ...source.specs, "Radio de giro": "2100 mm" } },
      { ...source, specs: { ...source.specs, "Radio de giro exterior": "2100 mm" } },
      { ...source, longDescription: "Radio de giro de 2100 mm." },
      { ...source, shortDescription: "Radio de giro de 2100 mm." }
    ]) assert.doesNotMatch(resolveReusableEditorial(prepared, null, other).short ?? "", /radio de giro declarado/u);
    for (const value of ["1980", "1980/2100 mm", "1980 kg"]) {
      const invalid = { ...source, specs: { ...source.specs, "Radio de giro": value } };
      assert.doesNotMatch(resolveReusableEditorial(invalid).short ?? "", /radio de giro declarado/u);
    }
  }
});

test("la corta de plataforma incorpora el peso declarado sin sustituir las cotas de acceso ni atribuirle un alcance distinto", () => {
  for (const base of [controlledGomarizPlatform(), controlledMercaelevaPlatform()]) {
    for (const family of ["tijera", "articulada", "telescópica"]) {
      const source: ProductRecord = { ...base, title: `Plataforma ${family} eléctrica MARCA MODELO10`,
        specs: { "Altura de trabajo": "10 m", Capacidad: "230 kg", Motor: "Eléctrico", Peso: "3600 kg" } };
      const prepared: ProductRecord = { ...source, specs: { ...source.specs, Peso: "3.600 kg" } };
      const result = resolveReusableEditorial(prepared, null, source);
      assert.match(result.short ?? "", /capacidad de 230 kg y peso declarado de 3\.600 kg/u);
      assert.doesNotMatch(result.short ?? "", /peso operativo|peso de transporte/u);
      assert.equal(result.general, resolveReusableEditorial(source).general);
      for (const other of [
        { ...source, reference: "OTRA" }, { ...source, model: "OTRO" },
        { ...source, specs: { ...source.specs, Peso: "3700 kg" } },
        { ...source, specs: { ...source.specs, "Peso operativo": "3600 kg" } },
        { ...source, shortDescription: "Peso pendiente de confirmar." },
        { ...source, longDescription: "Masa de transporte de 3700 kg." }
      ]) assert.doesNotMatch(resolveReusableEditorial(prepared, null, other).short ?? "", /peso declarado/u);
      for (const value of ["3,6 m", "3600/3700 kg", "10 kg"]) {
        const invalid = { ...source, specs: { ...source.specs, Peso: value } };
        assert.doesNotMatch(resolveReusableEditorial(invalid).short ?? "", /peso declarado/u);
      }
      const withAccess: ProductRecord = { ...source, specs: { ...source.specs, "Alcance lateral": "6 m", Anchura: "1 m" } };
      const access = resolveReusableEditorial(withAccess).short ?? "";
      assert.match(access, /anchura del equipo de 1 m/u);
      assert.doesNotMatch(access, /peso declarado/u);
    }
  }
});
