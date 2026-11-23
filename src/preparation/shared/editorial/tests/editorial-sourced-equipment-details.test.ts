import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord, SpecsMap } from "../../../../contracts/catalog.js";
import { resolveSourcedOperationalSpecs } from "../domain/editorial-sourced-operational-specs.js";
import { resolveReusableEditorial } from "../domain/editorial-composition.js";

const original = (family: string, specs: SpecsMap): ProductRecord => ({
  providerId: "manain",
  categoryKey: "venta",
  categoryName: "Maquinaria en venta",
  url: `https://manain.com/producto/venta-${family}-marca-modelo/`,
  title: "MODELO",
  shortDescription: null,
  longDescription: null,
  price: null,
  condition: "Segunda mano",
  reference: "CONTROL-01",
  brand: "MARCA",
  model: "MODELO",
  year: null,
  location: null,
  country: null,
  horometer: null,
  serialNumber: null,
  image: null,
  specs: { Marca: "MARCA", Modelo: "MODELO", "Nueva o usada": "usada", ...specs }
});

const compose = (source: ProductRecord, general: string, prepared: ProductRecord = source): string | null =>
  resolveSourcedOperationalSpecs(source, prepared, general, true);

test("las plataformas unipersonales conservan cotas replegadas y de plataforma sin confundirlas con las exteriores", () => {
  const source = original("elevacion-unipersonal", {
    "Altura replegada": "1,59 m", "Longitud plataforma": "1,22 m", "Ancho plataforma": "0.75 m", "Altura trabajo": "4.5 m"
  });
  const general = "La ficha técnica de plataforma unipersonal MARCA MODELO consigna altura de trabajo de 4,5 m.";
  const expanded = compose(source, general);
  assert.ok(expanded);
  assert.match(expanded, /altura replegada de 1,59 m/u);
  assert.match(expanded, /longitud de plataforma de 1,22 m/u);
  assert.match(expanded, /anchura de plataforma de 0,75 m/u);
  assert.equal(expanded.match(/La ficha técnica de/g)?.length, 1);
  assert.equal(compose(source, expanded), null);
});

test("los implementos conservan máquina y enganche como datos declarados, no compatibilidad acreditada", () => {
  const source = original("movimiento-tierra-martillo-miniex", {
    Maquina: "mini excavadora de 2700 kg y 3600 kg", Enganche: "klac d3 d4", Peso: "162 kg", Motor: "Diésel"
  });
  const general = "La ficha técnica de martillo para miniexcavadora MARCA MODELO indica peso declarado de 162 kg.";
  const expanded = compose(source, general);
  assert.ok(expanded);
  assert.match(expanded, /«mini excavadora de 2700 kg y 3600 kg»/u);
  assert.match(expanded, /enganche «klac d3 d4»/u);
  assert.match(expanded, /deben verificarse antes de utilizar el implemento/u);
  assert.doesNotMatch(expanded, /martillo diésel|compatible con/u);
  assert.equal(compose(source, general, { ...source, specs: { ...source.specs, Enganche: "otro" } }), null);
  assert.equal(compose({ ...source, specs: { ...source.specs, Maquina: "excavadora genérica" } }, general), null);
});

test("potencia y cotas técnicas mantienen unidades y magnitudes específicas de la familia", () => {
  const cases = [
    {
      family: "pequena-maquinaria-compactacion",
      specs: { "Ancho bandeja": "420 mm", "Largo bandeja": "570 mm", Potencia: "3.6 kw", Peso: "92 kg" },
      general: "La ficha técnica de compactadora MARCA MODELO consigna peso declarado de 92 kg.",
      matches: [/anchura de bandeja de 420 mm/u, /longitud de bandeja de 570 mm/u, /potencia indicada de 3,6 kW/u]
    },
    {
      family: "pequena-maquinaria-hidrolimpiadora",
      specs: { Alto: "395 mm", "Potencia absorbida": "2600 w", "Presion max.": "185 bar", "Caudal nominal": "9.3 l/min", Motor: "Eléctrico" },
      general: "La ficha técnica de hidrolimpiadora eléctrica MARCA MODELO indica peso y dimensiones declaradas.",
      matches: [/altura exterior de 0,395 m/u, /potencia eléctrica absorbida de 2.600 W/u, /presión máxima indicada de 185 bar/u, /caudal nominal indicado de 9,3 l\/min/u]
    },
    {
      family: "pequena-maquinaria-bomba-sumergible",
      specs: { Potencia: "0,4 kw", "Altura elevacion max": "10.5 m", Motor: "Eléctrico" },
      general: "La ficha técnica de bomba sumergible eléctrica MARCA MODELO indica un equipo eléctrico.",
      matches: [/potencia indicada de 0,4 kW/u, /altura máxima de elevación de 10,5 m/u]
    },
    {
      family: "manipulacion-transpaletas",
      specs: { Horquillas: "800 x 1150 mm", "Capacidad carga": "1800 kg", Motor: "Eléctrico" },
      general: "La ficha técnica de transpaleta eléctrica MARCA MODELO indica capacidad de carga de 1.800 kg.",
      matches: [/dimensiones de horquillas declaradas de 800 × 1.150 mm/u]
    },
    {
      family: "movimiento-tierra-dumper",
      specs: { "Altura total": "2245 mm", "Tracción": "4×4 hidrostatico", Motor: "Diésel" },
      general: "La ficha técnica de dúmper diésel MARCA MODELO indica peso declarado de 1.800 kg.",
      matches: [/altura total de 2,245 m/u, /tracción declarada 4×4 hidrostatico/u]
    }
  ] as const;
  for (const item of cases) {
    const source = original(item.family, item.specs);
    const expanded = compose(source, item.general);
    assert.ok(expanded, item.family);
    for (const match of item.matches) assert.match(expanded, match, item.family);
    assert.equal(expanded.match(/La ficha técnica de/g)?.length, 1, item.family);
    assert.match(expanded, /valores declarados por el proveedor/u, item.family);
    assert.equal(compose(source, expanded), null, item.family);
  }
});

test("rechaza discrepancias de identidad, procedencia y evidencia técnica entre unidades", () => {
  const source = original("pequena-maquinaria-martillos-electricos", {
    Motor: "Eléctrico", Alto: "235 mm", "Potencia absorbida": "1750 w"
  });
  const general = "La ficha técnica de martillo eléctrico MARCA MODELO indica un equipo eléctrico de demolición.";
  const expanded = compose(source, general);
  assert.ok(expanded);
  assert.match(expanded, /altura exterior de 0,235 m/u);
  assert.match(expanded, /potencia eléctrica absorbida de 1.750 W/u);
  assert.equal(resolveSourcedOperationalSpecs(source, source, general, false), null);
  const changed: readonly ProductRecord[] = [
    { ...source, providerId: "gomariz" },
    { ...source, reference: "CONTROL-02" },
    { ...source, url: "https://manain.com/producto/venta-pequena-maquinaria-martillos-electricos-marca-otro/" },
    { ...source, condition: "Nuevo" },
    { ...source, model: "OTRO", title: "OTRO" },
    { ...source, specs: { ...source.specs, Modelo: "OTRO" } }
  ];
  for (const variant of changed) {
    const result = compose(source, general, variant);
    assert.equal(result, null, JSON.stringify(variant));
  }
  assert.equal(compose({ ...source, longDescription: "Otra descripción" }, general), null);
  assert.equal(compose({ ...source, shortDescription: "Ficha de proveedor" }, general), null);
  assert.doesNotMatch(compose(source, general, { ...source, specs: { ...source.specs, Alto: "10 m" } }) ?? "", /altura exterior/u);
  assert.doesNotMatch(compose(source, general, { ...source, specs: { ...source.specs, "Potencia absorbida": "1750 kW" } }) ?? "", /potencia eléctrica absorbida/u);
  assert.equal(compose(source, general, { ...source, specs: { ...source.specs, Alto: "236 mm", "Potencia absorbida": "1750 kW" } }), null);
  assert.equal(JSON.stringify(source.specs), JSON.stringify(original("pequena-maquinaria-martillos-electricos", {
    Motor: "Eléctrico", Alto: "235 mm", "Potencia absorbida": "1750 w"
  }).specs));
});


test("la composición compartida distingue una hora registrada de varias sin alterar la cantidad", () => {
  const source = original("movimiento-tierra-rodillo-compactador", { Motor: "Gasolina", Peso: "92 kg" });
  const single = resolveReusableEditorial({ ...source, year: "2020", horometer: "1" }).general;
  const multiple = resolveReusableEditorial({ ...source, year: "2020", horometer: "2" }).general;
  const zero = resolveReusableEditorial({ ...source, year: "2020", horometer: "0" }).general;
  assert.match(single ?? "", /1 hora registrada/u);
  assert.doesNotMatch(single ?? "", /1 horas registradas/u);
  assert.match(multiple ?? "", /2 horas registradas/u);
  assert.match(zero ?? "", /0 horas registradas/u);
});
