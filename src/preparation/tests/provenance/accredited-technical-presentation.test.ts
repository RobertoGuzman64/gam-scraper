import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord, SpecsMap, SpecValue } from "../../../contracts/catalog.js";
import type { ImportCandidate } from "../../../commercial/legacy-export/contracts.js";
import { prepareSourceProduct } from "../../prepare-product.js";
import { accreditPublishedTechnicalPresentation, accreditSourceTechnicalPresentation } from "../../provenance/accredited-technical-presentation.js";

const gam: ProductRecord = {
  providerId: "gam", categoryKey: "elevacion-nueva", categoryName: "Plataformas elevadoras nuevas",
  url: "https://online.gamrentals.com/es/plataformas-de-tijera-electricas/99991-equiptest-tx2",
  reference: "99991", title: "Plataforma de tijera eléctrica EQUIPTEST TX2",
  shortDescription: "EQUIPTEST TX2. Capacidad de la cesta 230 kg.",
  longDescription: "Plataforma de tijera. Capacidad de la cesta 230 kg. Altura de trabajo de 12 metros.",
  price: "20000 €", brand: "EQUIPTEST", model: "TX2", year: null, location: null, country: null,
  horometer: null, serialNumber: null, condition: "Nuevo", image: null,
  specs: { Marca: "EQUIPTEST", Modelo: "TX2", "Capacidad de carga (kg)": "230 KG", "Altura de elevación (m)": "12 metros" }
};

const gomariz: ProductRecord = { ...gam, providerId: "gomariz", categoryKey: "venta", categoryName: "Maquinaria en venta",
  title: "EQUIPTEST TX2", condition: "Segunda mano", shortDescription: null, longDescription: null,
  url: "https://www.gomarizrent.com/venta/elevacion-y-trabajos-en-altura/elevador-tijera/equiptest-tx2/",
  specs: { Capacidad: "230kg", "Altura de trabajo": "8 m", "Altura plataforma": "6.2 m" } };

const manain: ProductRecord = { ...gomariz, providerId: "manain", title: "TX2", reference: "CONTROL-TX2",
  url: "https://manain.com/producto/venta-elevacion-tijera-equiptest-tx2/",
  specs: { Marca: "EQUIPTEST", Modelo: "TX2", Motor: "Eléctrico", "Nueva o usada": "usada", "Altura trabajo": "9 m",
    "Capacidad carga": "230 kg", "Longitud plataforma": "2,4 m", "Ancho plataforma": "0,8 m", "Ancho total": "1 m" } };

const previousFrom = (candidate: ImportCandidate, replacements: readonly [string, string, SpecValue][]): ImportCandidate => {
  const spec = { ...candidate.spec };
  for (const [from, to, value] of replacements) {
    assert.ok(Object.hasOwn(spec, to), to);
    assert.ok(!Object.hasOwn(spec, from), from);
    delete spec[to];
    spec[from] = value;
  }
  return { ...candidate, spec };
};

const preparedCandidate = (source: ProductRecord): ImportCandidate => {
  const result = prepareSourceProduct(source);
  assert.equal(result.status, "ready", result.issues.join("; "));
  return result.product;
};

test("acredita las capacidades y alturas mediante la observación real y su reproducción histórica", () => {
  const cases: readonly { readonly source: ProductRecord; readonly replacements: readonly [string, string, SpecValue][] }[] = [
    { source: gam, replacements: [["Capacidad de carga (kg)", "Capacidad de la cesta", "230 kg"], ["Altura de elevación (m)", "Altura de trabajo (m)", "12 m"]] },
    { source: gomariz, replacements: [["Capacidad", "Capacidad de la cesta", "230 kg"], ["Altura plataforma", "Altura de plataforma", "6,2 m"]] },
    { source: manain, replacements: [["Capacidad carga", "Capacidad de la cesta", "230 kg"], ["Longitud plataforma", "Longitud de plataforma", "2,4 m"],
      ["Ancho plataforma", "Anchura de plataforma", "0,8 m"], ["Ancho total", "Anchura total", "1 m"]] }
  ];
  for (const { source, replacements } of cases) {
    const candidate = preparedCandidate(source);
    const previous = previousFrom(candidate, replacements);
    const original = JSON.stringify([source, previous, candidate]);
    const result = accreditPublishedTechnicalPresentation(source, previous, candidate);
    assert.deepEqual([...result.keys()].sort(), replacements.map(([from]) => from).sort());
    for (const [from, to, value] of replacements) {
      const proof = result.get(from);
      assert.equal(proof?.destinationField, to);
      assert.equal(proof?.originalValue, source.specs?.[from]);
      assert.equal(proof?.previousValue, value);
      assert.equal(proof?.value, candidate.spec[to]);
      assert.ok(proof?.mechanism);
    }
    assert.deepEqual(accreditPublishedTechnicalPresentation(source, previous, candidate), result);
    assert.equal(JSON.stringify([source, previous, candidate]), original);
  }
});

test("las alternativas completas de batería y la disponibilidad booleana se conservan sin equiparar magnitudes", () => {
  const source: ProductRecord = { ...gam, categoryKey: "manutencion", categoryName: "Manutención",
    url: "https://online.gamrentals.com/es/carretillas-elevadoras-electricas/99991-equiptest-tx2",
    title: "Carretilla elevadora eléctrica EQUIPTEST TX2", shortDescription: null, longDescription: null,
    specs: { Marca: "EQUIPTEST", Modelo: "TX2", "Capacidad de carga (kg)": "2300 kg",
    "Capacidad de la batería": "24V / 315-375Ah | Li-ion 24V / 300Ah(V/Ah)", "Elevación libre": "SI" } };
  const candidate = preparedCandidate(source);
  const previous = previousFrom(candidate, [["Capacidad de la batería", "Batería (V / Ah)", "24 V / 315-375 Ah | Li-ion 24 V / 300 Ah"],
    ["Elevación libre", "Elevación libre disponible", "Sí"]]);
  const result = accreditPublishedTechnicalPresentation(source, previous, candidate);
  assert.equal(result.get("Capacidad de la batería")?.value, "24 V / 315-375 Ah | Li-ion 24 V / 300 Ah");
  assert.equal(result.get("Elevación libre")?.value, true);
  const invalid: readonly SpecsMap[] = [
    { "Capacidad de la batería": "24 V / 315-375 Ah" }, { "Capacidad de la batería": "24 V / 315 Ah | Li-ion 24 V / 300 Ah" },
    { "Capacidad de la batería": "24 V / 315-375 Ah | Li-ion 48 V / 300 Ah" }, { "Elevación libre": "12 mm" }, { "Elevación libre": "No" }
  ];
  for (const spec of invalid) {
    const proof = accreditPublishedTechnicalPresentation(source, { ...previous, spec: { ...previous.spec, ...spec } }, candidate);
    for (const field of Object.keys(spec)) assert.equal(proof.has(field), false);
  }
});

test("rechaza otra magnitud, pérdidas, duplicados y destinos que no son el resultado productivo", () => {
  const candidate = preparedCandidate(gomariz);
  const previous = previousFrom(candidate, [["Capacidad", "Capacidad de la cesta", "230 kg"]]);
  for (const value of ["230 l", "231 kg", "230/300 kg", "230 kg opcional", 230, ""]) {
    assert.equal(accreditPublishedTechnicalPresentation(gomariz, { ...previous, spec: { ...previous.spec, Capacidad: value } }, candidate).has("Capacidad"), false);
  }
  const competing = { ...previous, spec: { ...previous.spec, "Capacidad de la cesta": "230 kg" } };
  assert.equal(accreditPublishedTechnicalPresentation(gomariz, competing, candidate).has("Capacidad"), false);
  const spec = { ...candidate.spec };
  delete spec["Capacidad de la cesta"];
  for (const altered of [spec, { ...spec, Peso: "230 kg" }, { ...spec, "Capacidad máxima de elevación": "230 kg" },
    { ...spec, "Capacidad de la cesta": "" }, { ...spec, "Capacidad de la cesta": "231 kg" }]) {
    assert.equal(accreditPublishedTechnicalPresentation(gomariz, previous, { ...candidate, spec: altered }).size, 0);
  }
  const unrelated = { ...previous, spec: { ...previous.spec, "Prestación no reconciliada": "230 kg" } };
  const proof = accreditPublishedTechnicalPresentation(gomariz, unrelated, candidate);
  assert.ok(proof.has("Capacidad"));
  assert.ok(!proof.has("Prestación no reconciliada"));
});

test("la identidad de publicación y la fuente exacta no se sustituyen por la coincidencia de valor", () => {
  const candidate = preparedCandidate(gomariz);
  const previous = previousFrom(candidate, [["Capacidad", "Capacidad de la cesta", "230 kg"]]);
  for (const changed of [{ ...previous, providerId: "gam" }, { ...previous, reference: "OTRA" },
    { ...previous, sourceUrl: "https://example.test/otra" }, { ...previous, externalReference: "OTRA" },
    { ...previous, category: "Otra familia" }, { ...previous, title: "Otro modelo" },
    { ...previous, spec: { ...previous.spec, modelo: "OTRO" } }, { ...previous, spec: { ...previous.spec, "Nº de serie": "OTRO" } }]) {
    assert.equal(accreditPublishedTechnicalPresentation(gomariz, changed, candidate).size, 0);
  }
  for (const changed of [{ ...gomariz, reference: null }, { ...gomariz, reference: "OTRA" },
    { ...gomariz, model: "OTRO" }, { ...gomariz, categoryKey: "otra" }, { ...gomariz, specs: {} }]) {
    assert.equal(accreditPublishedTechnicalPresentation(changed, previous, candidate).size, 0);
  }
});

test("la cobertura desde origen reconoce la transformación sin atribuir una aprobación de publicación", () => {
  const candidate = preparedCandidate(manain);
  const sourceProof = accreditSourceTechnicalPresentation(manain, candidate);
  assert.equal(sourceProof.get("Ancho plataforma")?.destinationField, "Anchura de plataforma");
  assert.equal(sourceProof.get("Capacidad carga")?.destinationField, "Capacidad de la cesta");
  assert.equal(accreditSourceTechnicalPresentation({ ...manain, specs: {} }, candidate).size, 0);
});

test("una transformación observada durante una revisión no acredita una retirada de publicación", () => {
  const source: ProductRecord = { ...gomariz, specs: { ...gomariz.specs, "Elevación libre": "SI" } };
  const prepared = prepareSourceProduct(source);
  assert.equal(prepared.status, "review");
  assert.equal(accreditSourceTechnicalPresentation(source, prepared.product).get("Elevación libre")?.value, true);
  const previous = previousFrom(prepared.product, [["Elevación libre", "Elevación libre disponible", "Sí"]]);
  assert.equal(accreditPublishedTechnicalPresentation(source, previous, prepared.product).size, 0);
});

test("la altura requiere evidencia inequívoca de trabajo y no una coincidencia con la plataforma", () => {
  const candidate = preparedCandidate(gam);
  const previous = previousFrom(candidate, [["Altura de elevación (m)", "Altura de trabajo (m)", "12 m"]]);
  assert.ok(accreditPublishedTechnicalPresentation(gam, previous, candidate).has("Altura de elevación (m)"));
  const changedSources: readonly ProductRecord[] = [
    { ...gam, longDescription: null },
    { ...gam, longDescription: "Altura de plataforma: 12 m." },
    { ...gam, longDescription: "Altura de trabajo: 12 m. Altura de trabajo: 14 m." },
    { ...gam, specs: { ...gam.specs, "Altura de trabajo (m)": "12 m" } }
  ];
  for (const source of changedSources) {
    assert.equal(accreditPublishedTechnicalPresentation(source, previous, candidate).has("Altura de elevación (m)"), false);
  }
  for (const field of ["Altura de plataforma", "Altura de trabajo del modelo"]) {
    const unrelated = previousFrom(candidate, [[field, "Altura de trabajo (m)", "12 m"]]);
    assert.equal(accreditPublishedTechnicalPresentation(gam, unrelated, candidate).has(field), false);
  }
});

test("una capacidad de modelo o una magnitud coincidente no sustituye la evidencia de la unidad", () => {
  const candidate = preparedCandidate(gomariz);
  const previous = previousFrom(candidate, [["Capacidad", "Capacidad de la cesta", "230 kg"]]);
  assert.ok(accreditPublishedTechnicalPresentation(gomariz, previous, candidate).has("Capacidad"));
  const alternative: ProductRecord = { ...gomariz, specs: { ...gomariz.specs, "Capacidad máxima de elevación": "230 kg" } };
  assert.equal(accreditPublishedTechnicalPresentation(alternative, previous, candidate).has("Capacidad"), false);
  const modelOnly = previousFrom(candidate, [["Capacidad de carga del modelo", "Capacidad de la cesta", "230 kg"]]);
  assert.equal(accreditPublishedTechnicalPresentation(gomariz, modelOnly, candidate).size, 0);
  const conflicting = { ...previous, spec: { ...previous.spec, "Capacidad máxima de elevación": "230 kg" } };
  assert.equal(accreditPublishedTechnicalPresentation(gomariz, conflicting, candidate).has("Capacidad"), false);
});

test("una batería repartida entre destinos no se acredita por inferencia ni por coincidencias parciales", () => {
  const source: ProductRecord = { ...gam, categoryKey: "manutencion", categoryName: "Manutención",
    url: "https://online.gamrentals.com/es/carretillas-elevadoras-electricas/99991-equiptest-tx2",
    title: "Carretilla elevadora eléctrica EQUIPTEST TX2", shortDescription: null, longDescription: null,
    specs: { Marca: "EQUIPTEST", Modelo: "TX2", "Capacidad de carga (kg)": "2300 kg",
      "Capacidad de la batería": "24V / 315-375Ah(V/Ah)" } };
  const candidate = preparedCandidate(source);
  const previous = previousFrom(candidate, [["Capacidad de la batería", "Batería (V / Ah)", "24 V / 315-375 Ah"]]);
  assert.ok(accreditPublishedTechnicalPresentation(source, previous, candidate).has("Capacidad de la batería"));
  const { ["Batería (V / Ah)"]: battery, ...rest } = candidate.spec;
  assert.equal(battery, "24 V / 315-375 Ah");
  const divided = { ...candidate, spec: { ...rest, "Voltaje batería (V)": "24 V", "Capacidad de la batería (Ah)": "315-375 Ah" } };
  assert.equal(accreditPublishedTechnicalPresentation(source, previous, divided).size, 0);
  const competing = { ...source, specs: { ...source.specs, "Capacidad de la batería (Ah)": "315-375 Ah" } };
  assert.equal(accreditPublishedTechnicalPresentation(competing, previous, candidate).size, 0);
});
