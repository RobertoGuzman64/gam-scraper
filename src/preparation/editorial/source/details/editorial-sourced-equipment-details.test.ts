import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord, SpecsMap } from "../../../../contracts/catalog.js";
import { resolveSourcedOperationalFeatures } from "./editorial-sourced-operational-features.js";
import { resolveSourcedOperationalSpecs } from "./editorial-sourced-operational-specs.js";
import { resolveReusableEditorial } from "../../core/editorial-composition.js";
import { resolveEquipmentConfigurationDetails, resolveHandlingOperationalDetails, resolvePlatformOperationalDetails, resolveTransportOperationalDetails } from "./editorial-sourced-equipment-details.js";
import { controlledGamForklift, controlledGomarizForklift, controlledMercaelevaForklift, controlledGomarizPlatform, controlledMercaelevaPlatform } from "../../core/editorial-contract-records.js";

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


test("las prestaciones de plataformas se narran desde la misma tabla técnica en distintos proveedores", () => {
  const manain = original("elevacion-tijera", { "Altura trabajo": "10 m", Motor: "Eléctrico" });
  const sources = [manain, controlledGomarizPlatform(), controlledMercaelevaPlatform()];
  for (const source of sources) {
    const unit: ProductRecord = { ...source, specs: { ...source.specs,
      "Tracción": "4x2", "Altura replegada": "2 m", "Altura barandilla bajada": "1800 mm",
      "Longitud plataforma": "2 m", "Longitud extensión": "0,8 m", Estabilizadores: true } };
    const baseline = resolveReusableEditorial(source);
    const before = JSON.stringify(unit);
    const editorial = resolveReusableEditorial(unit);
    assert.match(editorial.general ?? "", /tracción 4×2 declarada, altura con barandillas bajadas de 1,8 m, extensión de plataforma de 0,8 m y estabilizadores declarados/u, source.providerId);
    assert.doesNotMatch(editorial.short ?? "", /tracción|barandillas|extensión|estabilizadores/u);
    assert.doesNotMatch(baseline.general ?? "", /tracción|barandillas|extensión|estabilizadores/u);
    assert.equal(JSON.stringify(unit), before);
  }
});

test("las prestaciones operativas rechazan variantes, alias discordantes y geometría incompatible", () => {
  const source = original("elevacion-tijera", { "Altura trabajo": "10 m", Motor: "Eléctrico",
    "Tracción": "4×4", "Altura replegada": "2 m", "Altura barandilla bajada": "1,8 m",
    "Longitud plataforma": "2 m", "Longitud extensión": "0,8 m", Estabilizadores: "sí" });
  const details = (prepared: ProductRecord, original: ProductRecord = source): readonly string[] =>
    resolvePlatformOperationalDetails(original, prepared, "plataforma-tijera");
  assert.equal(details(source).length, 4);
  const variants: readonly ProductRecord[] = [{ ...source, reference: "CONTROL-02" }, { ...source, providerId: "gomariz" },
    { ...source, url: "https://manain.com/producto/venta-elevacion-tijera-marca-modelo-2/" },
    { ...source, condition: "Nuevo" }, { ...source, specs: { ...source.specs, Modelo: "OTRO" } }];
  for (const changed of variants) {
    assert.deepEqual(details(changed), []);
  }
  const conflict = (specs: SpecsMap, mention: RegExp): void => {
    const changed = { ...source, specs: { ...source.specs, ...specs } };
    assert.doesNotMatch(details(changed, changed).join(" "), mention);
  };
  conflict({ "Tracción 4x4": false }, /tracción/u);
  conflict({ "Tracción": "4x2/4x4" }, /tracción/u);
  conflict({ "Altura barandilla bajada": "2,5 m" }, /barandillas/u);
  conflict({ "Altura replegada": "12 m" }, /barandillas/u);
  conflict({ "Longitud extensión": "3 m" }, /extensión/u);
  conflict({ "Extensión de plataforma": "0,9 m" }, /extensión/u);
  conflict({ "Longitud extensión": "0,8 kg" }, /extensión/u);
  conflict({ Estabilizadores: "no" }, /estabilizadores/u);
  conflict({ Estabilizadores: "opcional" }, /estabilizadores/u);
  assert.doesNotMatch(details({ ...source, specs: { ...source.specs, "Tracción": "4x2" } }).join(" "), /tracción/u);
  assert.doesNotMatch(details({ ...source, specs: { ...source.specs, "Longitud extensión": "0,7 m" } }).join(" "), /extensión/u);
  const described = { ...source, longDescription: "Tracción 4x2. Sin estabilizadores. Extensión opcional." };
  assert.doesNotMatch(details(described, described).join(" "), /tracción|estabilizadores|extensión/u);
});

test("la articulación y el equipamiento declarado requieren familia compatible y afirmación inequívoca", () => {
  const source = original("elevacion-brazo-articulado", { "Altura trabajo": "15 m", Motor: "Eléctrico",
    "Altura articulacion": "6 m", "Trabajo negativo": "sí", "Barra antiatrapamiento": true });
  const resolve = (record: ProductRecord): readonly string[] => resolvePlatformOperationalDetails(record, record, "plataforma-articulada");
  assert.deepEqual(resolve(source), ["altura de articulación de 6 m", "trabajo en negativo declarado", "barra antiatrapamiento declarada"]);
  assert.deepEqual(resolve({ ...source, specs: { ...source.specs, "Altura articulacion": "16 m",
    "Trabajo en negativo": "no", "Barra antiatrapamiento": "no" } }), []);
  assert.deepEqual(resolve({ ...source, longDescription: "Sin barra antiatrapamiento. Trabajo negativo opcional. Altura de articulación de 7 m." }), []);
  assert.deepEqual(resolvePlatformOperationalDetails(source, source, "plataforma-tijera"), []);
  const forklift = original("manipulacion-carretilla", source.specs ?? {});
  assert.deepEqual(resolvePlatformOperationalDetails(forklift, forklift, "carretilla-elevadora"), []);
});


test("la manutención incorpora cotas y equipamiento declarados sin alterar la descripción corta", () => {
  for (const source of [controlledGamForklift(), controlledGomarizForklift(), controlledMercaelevaForklift()]) {
    const unit = { ...source, specs: { ...source.specs, "Altura mástil replegado": "2100 mm",
      "Dimensiones Horquillas": "1100 x 120 x 45 mm", "Desplazador lateral": "SI", "Elevación libre": true } };
    const output = resolveReusableEditorial(unit);
    assert.match(output.general ?? "", /altura de mástil replegado declarada de 2.100 mm/u);
    assert.match(output.general ?? "", /dimensiones de horquillas declaradas de 1.100 × 120 × 45 mm/u);
    assert.match(output.general ?? "", /desplazador lateral declarado y elevación libre declarada/u);
    assert.equal(output.short, resolveReusableEditorial(source).short);
  }
});

test("las cotas separadas conservan el concepto de replegado y las dimensiones individuales", () => {
  const source = { ...controlledGamForklift(), specs: { ...controlledGamForklift().specs,
    "Altura max. replegada": "2,1 m", "Largo horquillas": "1200 mm", "Ancho horquillas": "100 mm", "Grosor horquillas": "40 mm" } };
  assert.deepEqual(resolveHandlingOperationalDetails(source, source, "carretilla-elevadora"), [
    "altura máxima replegada declarada de 2.100 mm", "longitud de horquillas declarada de 1.200 mm",
    "anchura de horquillas declarada de 100 mm", "grosor de horquillas declarado de 40 mm"]);
});

test("rechaza opciones, magnitudes ambiguas, conflictos y cambios de unidad en la manutención", () => {
  const source = { ...controlledGamForklift(), specs: { ...controlledGamForklift().specs,
    "Altura mástil replegado": "2100 mm", "Dimensiones Horquillas": "1100 x 120 x 45 mm", "Desplazador lateral": "SI", "Elevación libre": "SI" } };
  const details = (prepared: ProductRecord, original: ProductRecord = source): readonly string[] =>
    resolveHandlingOperationalDetails(original, prepared, "carretilla-elevadora");
  assert.deepEqual(details({ ...source, reference: "OTRA" }), []);
  assert.deepEqual(resolveHandlingOperationalDetails(source, source, "plataforma-tijera"), []);
  const invalid = { ...source, specs: { ...source.specs, "Altura de mástil replegado": "2200 mm",
    "Dimensiones Horquillas": "1100 x 1500 x 45 mm", "Desplazamiento lateral": "No", "Elevación libre": "1600" } };
  assert.deepEqual(details(invalid, invalid), []);
  const mentioned = { ...source, longDescription: "Mástil replegado, horquillas opcionales, sin desplazador lateral ni elevación libre." };
  assert.deepEqual(details(mentioned, mentioned), []);
  const altered = { ...source, specs: { ...source.specs, "Altura mástil replegado": "2300 mm",
    "Dimensiones Horquillas": "1100 x 150 x 45 mm", "Desplazador lateral": "No", "Elevación libre": "No" } };
  assert.deepEqual(details(altered), []);
});


test("la longitud de transporte conserva su concepto y se reutiliza entre proveedores", () => {
  for (const source of [controlledGamForklift(), controlledGomarizForklift(), controlledMercaelevaForklift()]) {
    const unit = { ...source, specs: { ...source.specs, "Longitud sin horquillas": "2400 mm" } };
    const output = resolveReusableEditorial(unit);
    assert.match(output.general ?? "", /longitud sin horquillas declarada de 2,4 m/u);
    assert.equal(output.short, resolveReusableEditorial(source).short);
    assert.deepEqual(resolveTransportOperationalDetails(unit, { ...unit, reference: "OTRA" }, "carretilla-elevadora", false), []);
    for (const specs of [{ "Largo sin horquillas": "2,6 m" }, { Longitud: "2 m" }, { Longitud: "2,4 m" }, { "Longitud al tablero": "2,4 m" }]) {
      const conflicting = { ...unit, specs: { ...unit.specs, ...specs } };
      assert.deepEqual(resolveTransportOperationalDetails(conflicting, conflicting, "carretilla-elevadora", false), []);
    }
    const changed = { ...unit, specs: { ...unit.specs, "Longitud sin horquillas": "2,5 m" } };
    assert.deepEqual(resolveTransportOperationalDetails(unit, changed, "carretilla-elevadora", false), []);
    const described = { ...unit, longDescription: "Longitud sin horquillas de 2,8 m." };
    assert.deepEqual(resolveTransportOperationalDetails(described, described, "carretilla-elevadora", false), []);
  }
});

test("la altura exterior exige magnitud coherente y no sustituye cotas de trabajo", () => {
  const source = original("energia-grupo-electrogeno", { Potencia: "35 kVA", Motor: "Diésel", Alto: "1350 mm" });
  const details = (record: ProductRecord, heightAlreadyIncluded = false): readonly string[] =>
    resolveTransportOperationalDetails(record, record, "grupo-electrogeno", heightAlreadyIncluded);
  assert.deepEqual(details(source), ["altura exterior declarada de 1,35 m"]);
  assert.deepEqual(details(source, true), []);
  for (const specs of [{ Altura: "1,4 m" }, { Alto: "1350" }, { Alto: "13,5 m" }, { "Altura de trabajo": "8 m" }]) {
    assert.deepEqual(details({ ...source, specs: { ...source.specs, ...specs } }), []);
  }
  assert.deepEqual(details({ ...source, longDescription: "Altura exterior de 1,5 m." }), []);
  assert.deepEqual(resolveTransportOperationalDetails(source, source, "plataforma-tijera", false), []);
  const dumper = original("movimiento-tierra-dumper", { Peso: "1800 kg", "Altura total": "2245 mm", "Tracción": "4×4" });
  assert.deepEqual(resolveTransportOperationalDetails(dumper, dumper, "dumper", false), []);
  const compacting = original("pequena-maquinaria-compactacion", { Peso: "92 kg", Alto: "600 mm", "Ancho bandeja": "420 mm", Potencia: "3,6 kW" });
  assert.deepEqual(resolveTransportOperationalDetails(compacting, compacting, "compactadora", false), []);
});

test("la longitud al tablero se atribuye al manipulador telescópico y no a sus horquillas", () => {
  const source = original("manipulacion-manipulador", { "Altura de elevacion max": "14 m", "Alcance maximo": "9 m",
    "Longitud al tablero": "5,5 m", Motor: "Diésel" });
  assert.deepEqual(resolveTransportOperationalDetails(source, source, "manipulador-telescopico", false), ["longitud al tablero declarada de 5,5 m"]);
  const invalid = { ...source, specs: { ...source.specs, "Longitud sin horquillas": "5,5 m" } };
  assert.deepEqual(resolveTransportOperationalDetails(invalid, invalid, "manipulador-telescopico", false), []);
  assert.deepEqual(resolveTransportOperationalDetails(source, source, "carretilla-elevadora", false), []);
});

test("la longitud de transporte diferenciada exige una longitud total mayor y evidencia de la unidad", () => {
  for (const base of [controlledGomarizPlatform(), controlledMercaelevaPlatform()]) {
    const source = { ...base, title: "Plataforma articulada eléctrica MARCA MODELO10", specs: {
      ...base.specs, "Longitud total": "6 m", "Longitud de transporte": "4500 mm"
    } };
    const details = (record: ProductRecord, prepared: ProductRecord = record): readonly string[] =>
      resolvePlatformOperationalDetails(record, prepared, "plataforma-articulada");
    assert.deepEqual(details(source), ["longitud de transporte declarada de 4,5 m"]);
    assert.match(resolveReusableEditorial(source).general ?? "", /longitud de transporte declarada de 4,5 m/u);
    for (const value of ["6 m", "7 m", "4500", "0,5 m", "4-5 m"]) {
      const invalid = { ...source, specs: { ...source.specs, "Longitud de transporte": value } };
      assert.deepEqual(details(invalid), []);
    }
    assert.deepEqual(details(source, { ...source, reference: "OTRA" }), []);
    assert.deepEqual(details(source, { ...source, specs: { ...source.specs, "Longitud de transporte": "5 m" } }), []);
    assert.deepEqual(details({ ...source, specs: { ...source.specs, "Longitud transporte": "5 m" } }), []);
    assert.deepEqual(details({ ...source, longDescription: "Longitud de transporte de 5 m." }), []);
  }
});

test("la capacidad de depósito conserva el concepto y rechaza unidades o valores contradictorios", () => {
  const source = original("energia-grupo-electrogeno", { Potencia: "35 kVA", Motor: "Diésel", "Capacidad depósito": "125,5 l" });
  const details = (record: ProductRecord, prepared: ProductRecord = record): readonly string[] =>
    resolveEquipmentConfigurationDetails(record, prepared, "grupo-electrogeno");
  assert.deepEqual(details(source), ["capacidad de depósito declarada de 125,5 l"]);
  assert.match(resolveReusableEditorial(source).general ?? "", /capacidad de depósito declarada de 125,5 l/u);
  for (const value of ["125", "125 kg", "0 l", "100-125 l"]) {
    const invalid = { ...source, specs: { ...source.specs, "Capacidad depósito": value } };
    assert.deepEqual(details(invalid), []);
  }
  assert.deepEqual(details(source, { ...source, specs: { ...source.specs, "Capacidad depósito": "150 l" } }), []);
  assert.deepEqual(details({ ...source, specs: { ...source.specs, "Capacidad del depósito": "150 l" } }), []);
  assert.deepEqual(details({ ...source, longDescription: "Depósito opcional de 125 l." }), []);
  assert.deepEqual(resolveEquipmentConfigurationDetails(source, source, "miniexcavadora"), []);
});

test("las medidas de cazos se atribuyen a la tabla de la misma unidad sin inferir compatibilidad ni montaje", () => {
  const source = original("movimiento-tierra-miniexcavadora", { Peso: "2000 kg", Motor: "Diésel", "Cazo 1 limpieza": "1200 mm", "Cazo 2": "500 mm", "Cazo 3": "300 mm" });
  const details = (record: ProductRecord, prepared: ProductRecord = record): readonly string[] =>
    resolveEquipmentConfigurationDetails(record, prepared, "miniexcavadora");
  assert.deepEqual(details(source), ["medidas de cazos declaradas de 300, 500 y 1.200 mm"]);
  assert.match(resolveReusableEditorial(source).general ?? "", /medidas de cazos declaradas de 300, 500 y 1\.200 mm/u);
  assert.deepEqual(details(source, { ...source, reference: "OTRA" }), []);
  assert.deepEqual(details(source, { ...source, specs: { ...source.specs, "Cazo 3": "400 mm" } }), []);
  for (const value of ["300", "300 kg", "0 mm", "300/400 mm"]) {
    const invalid = { ...source, specs: { ...source.specs, "Cazo 3": value } };
    assert.deepEqual(details(invalid), []);
  }
  assert.deepEqual(details({ ...source, longDescription: "Cazos opcionales." }), []);
  assert.deepEqual(resolveEquipmentConfigurationDetails(source, source, "dumper"), []);
});

test("la configuración de mandos y ruedas de manutención se reutiliza entre proveedores", () => {
  for (const base of [controlledGamForklift(), controlledGomarizForklift(), controlledMercaelevaForklift()]) {
    const source = { ...base, specs: { ...base.specs, "Controles Hidraúlicos": "Minilevers", Ruedas: "Super elásticas" } };
    assert.deepEqual(resolveHandlingOperationalDetails(source, source, "carretilla-elevadora"), [
      "mandos hidráulicos declarados de tipo minipalancas", "ruedas superelásticas declaradas"]);
    const output = resolveReusableEditorial(source);
    assert.match(output.general ?? "", /mandos hidráulicos declarados de tipo minipalancas y ruedas superelásticas declaradas/u);
    assert.equal(output.short, resolveReusableEditorial(base).short);
    const equivalent = { ...source, specs: { ...source.specs, "Mandos hidráulicos": "Mini palancas", "Tipo de ruedas": "Superelásticas" } };
    assert.deepEqual(resolveHandlingOperationalDetails(equivalent, equivalent, "carretilla-elevadora"),
      resolveHandlingOperationalDetails(source, source, "carretilla-elevadora"));
  }
});

test("los mandos y ruedas rechazan alternativas, contradicciones y configuraciones no acreditadas", () => {
  const base = controlledGamForklift();
  const source = { ...base, specs: { ...base.specs, "Controles Hidraúlicos": "Mini palancas", Ruedas: "Macizas" } };
  const details = (record: ProductRecord, prepared: ProductRecord = record): readonly string[] =>
    resolveHandlingOperationalDetails(record, prepared, "carretilla-elevadora");
  assert.deepEqual(details(source), ["mandos hidráulicos declarados de tipo minipalancas", "ruedas macizas declaradas"]);
  const ambiguous = { ...source, specs: { ...source.specs, "Controles Hidraúlicos": "Palancas / Joystick", Ruedas: "Macizas / neumáticas" } };
  assert.deepEqual(details(ambiguous), []);
  const conflicting = { ...source, specs: { ...source.specs, "Mandos hidráulicos": "Joystick", "Tipo de ruedas": "Neumáticas" } };
  assert.deepEqual(details(conflicting), []);
  const mentioned = { ...source, longDescription: "Joystick opcional. Neumáticos no confirmados." };
  assert.deepEqual(details(mentioned), []);
  assert.deepEqual(details(source, { ...source, specs: { ...source.specs, "Controles Hidraúlicos": "Palancas", Ruedas: "Superelásticas" } }), []);
  assert.deepEqual(details(source, { ...source, reference: "OTRA" }), []);
  assert.deepEqual(details(source, { ...source, providerId: "gomariz" }), []);
  const newUnit: ProductRecord = { ...source, condition: "Nuevo" };
  assert.deepEqual(details(newUnit), []);
  assert.deepEqual(resolveHandlingOperationalDetails(source, source, "plataforma-tijera"), []);
});

test("los grupos electrógenos incorporan tensiones y polos declarados sin inferir la configuración de salida", () => {
  const sources: readonly ProductRecord[] = [
    original("energia-grupo-electrogeno", { Potencia: "35 kVA", Motor: "Diésel", Voltios: "400/230 v", Polos: "4" }),
    { ...controlledGomarizPlatform(), title: "Grupo electrógeno diésel MARCA MODELO10",
      specs: { Potencia: "35 kVA", Motor: "Diésel", Voltios: "400/230 V", Polos: "4" } }
  ];
  for (const source of sources) {
    assert.deepEqual(resolveEquipmentConfigurationDetails(source, source, "grupo-electrogeno"), [
      "tensiones eléctricas declaradas de 400/230 V", "4 polos declarados"]);
    const editorial = resolveReusableEditorial(source);
    assert.match(editorial.general ?? "", /tensiones eléctricas declaradas de 400\/230 V y 4 polos declarados/u);
    assert.doesNotMatch(editorial.general ?? "", /trif[aá]sic|monof[aá]sic|\bHz\b|\brpm\b/iu);
    const baseline = { ...source, specs: { ...source.specs } };
    delete baseline.specs.Voltios;
    delete baseline.specs.Polos;
    assert.equal(editorial.short, resolveReusableEditorial(baseline).short);
    const single = { ...source, specs: { ...source.specs, Voltios: "230 V" } };
    assert.deepEqual(resolveEquipmentConfigurationDetails(single, single, "grupo-electrogeno"), [
      "tensión eléctrica declarada de 230 V", "4 polos declarados"]);
  }
});

test("las tensiones y polos requieren concordancia, unidades y familia acreditada", () => {
  const source = original("energia-grupo-electrogeno", { Potencia: "35 kVA", Motor: "Diésel", Voltios: "400/230 V", Polos: "4" });
  const details = (record: ProductRecord, prepared: ProductRecord = record): readonly string[] =>
    resolveEquipmentConfigurationDetails(record, prepared, "grupo-electrogeno");
  for (const value of ["400/230", "400/230v v", "400-230 V", "400/400 V", "12 V", "750 V", "400 W"]) {
    assert.deepEqual(details({ ...source, specs: { ...source.specs, Voltios: value } }), ["4 polos declarados"]);
  }
  for (const value of ["0", "3", "2/4", "4 polos", "4.5"]) {
    assert.deepEqual(details({ ...source, specs: { ...source.specs, Polos: value } }), ["tensiones eléctricas declaradas de 400/230 V"]);
  }
  assert.deepEqual(details(source, { ...source, specs: { ...source.specs, Voltios: "230 V", Polos: "2" } }), []);
  assert.deepEqual(details({ ...source, specs: { ...source.specs, Voltaje: "230 V" } }), ["4 polos declarados"]);
  assert.deepEqual(details({ ...source, specs: { ...source.specs, "Voltaje de la batería": "24 V" } }), ["4 polos declarados"]);
  assert.deepEqual(details({ ...source, longDescription: "Tensión y polos pendientes de comprobación." }), []);
  assert.deepEqual(details(source, { ...source, reference: "OTRA" }), []);
  assert.deepEqual(resolveEquipmentConfigurationDetails(source, source, "carretilla-elevadora"), []);
});

test("los camiones cesta conservan las cotas de transporte y la superficie de cesta declaradas", () => {
  const specs = { "Altura de trabajo": "18 m", Capacidad: "230 kg", Motor: "Diésel",
    "Altura de transporte": "3200 mm", "Longitud de cesta": "1,1 m", "Anchura de cesta": "700 mm" };
  const sources: readonly ProductRecord[] = [
    original("elevacion-camion-cesta", specs),
    { ...controlledGomarizPlatform(), title: "Camión cesta diésel MARCA MODELO10", specs }
  ];
  for (const source of sources) {
    assert.deepEqual(resolvePlatformOperationalDetails(source, source, "camion-cesta"), [
      "altura de transporte declarada de 3,2 m", "dimensiones de cesta declaradas de 1,1 × 0,7 m"]);
    const output = resolveReusableEditorial(source);
    assert.match(output.general ?? "", /altura de transporte declarada de 3,2 m y dimensiones de cesta declaradas de 1,1 × 0,7 m/u);
    assert.doesNotMatch(output.short ?? "", /transporte declarada|dimensiones de cesta/u);
  }
});

test("las cotas de camión cesta rechazan magnitudes ambiguas, contradictorias o de otra unidad", () => {
  const source = original("elevacion-camion-cesta", { "Altura de trabajo": "18 m", Capacidad: "230 kg", Motor: "Diésel",
    "Altura transporte": "3,2 m", "Longitud cesta": "1,1 m", "Ancho cesta": "0,7 m" });
  const details = (record: ProductRecord, prepared: ProductRecord = record): readonly string[] =>
    resolvePlatformOperationalDetails(record, prepared, "camion-cesta");
  assert.equal(details(source).length, 2);
  for (const value of ["3,2", "3-4 m", "18 m", "3200 kg"]) {
    assert.deepEqual(details({ ...source, specs: { ...source.specs, "Altura transporte": value } }), [
      "dimensiones de cesta declaradas de 1,1 × 0,7 m"]);
  }
  for (const value of ["0,7", "7 m", "0,7 kg"]) {
    assert.deepEqual(details({ ...source, specs: { ...source.specs, "Ancho cesta": value } }), ["altura de transporte declarada de 3,2 m"]);
  }
  assert.deepEqual(details({ ...source, specs: { ...source.specs, "Altura de transporte": "4 m", "Dimensiones Cesta": "2 x 1 m" } }), []);
  assert.deepEqual(details(source, { ...source, specs: { ...source.specs, "Altura transporte": "4 m", "Ancho cesta": "0,9 m" } }), []);
  assert.deepEqual(details({ ...source, longDescription: "Altura de transporte pendiente de comprobar. Medidas de la cesta no confirmadas." }), []);
  assert.deepEqual(details(source, { ...source, reference: "OTRA" }), []);
  assert.deepEqual(resolvePlatformOperationalDetails(source, source, "plataforma-articulada"), []);
});


const operationalGeneral = "La ficha técnica de carretilla elevadora MARCA MODELO10 identifica una máquina para la manutención de mercancías en instalaciones logísticas. La selección del equipo exige comprobar la distribución de la carga y los recorridos disponibles. El ancho de los pasillos, la superficie de apoyo y las condiciones del recinto condicionan las maniobras con la unidad anunciada.";
const operationalDescription = (claim: string): string =>
  `${operationalGeneral} ${claim} El anuncio describe el equipo para operaciones de movimiento interno de mercancías. La organización de las tareas debe tener en cuenta el espacio disponible para circular y la distribución de los puestos de trabajo dentro de las instalaciones, sin presuponer las condiciones específicas de una operación concreta.`;

test("recupera equipamiento operativo declarado sin certificar la configuración de la unidad", () => {
  for (const base of [controlledGamForklift(), controlledGomarizForklift(), controlledMercaelevaForklift()]) {
    const source = { ...base, longDescription: operationalDescription("El equipo dispone de freno automático, alarma de inclinación y sistema de diagnóstico.") };
    const result = resolveSourcedOperationalFeatures(source, source, operationalGeneral, true);
    assert.ok(result, base.providerId);
    assert.ok(result.startsWith(operationalGeneral));
    assert.match(result, /freno automático, alarma de inclinación y sistema de diagnóstico/u);
    assert.match(result, /disponibilidad y configuración deben comprobarse/u);
    assert.equal(resolveSourcedOperationalFeatures(source, source, result, true), null);
    assert.equal(resolveSourcedOperationalFeatures(source, source, operationalGeneral, false), null);
    assert.equal(resolveSourcedOperationalFeatures(source, { ...source, reference: "OTRA" }, operationalGeneral, true), null);
  }
});

test("no incorpora equipamiento opcional, ausente o ya narrado ni desplaza menciones previas", () => {
  const base = controlledGamForklift();
  for (const claim of ["El freno automático es opcional.", "No dispone de alarma de inclinación.", "Puede incorporar un sistema de diagnóstico."]) {
    const source = { ...base, longDescription: operationalDescription(claim) };
    assert.equal(resolveSourcedOperationalFeatures(source, source, operationalGeneral, true), null, claim);
  }
  const source = { ...base, longDescription: operationalDescription("Dispone de freno automático, alarma de inclinación y sistema de diagnóstico. Incorpora dirección asistida, control proporcional y sistema de baja velocidad.") };
  const result = resolveSourcedOperationalFeatures(source, source, operationalGeneral, true);
  assert.match(result ?? "", /dirección asistida, control proporcional y sistema de baja velocidad/u);
  assert.doesNotMatch(result ?? "", /freno automático|alarma de inclinación|sistema de diagnóstico/u);
  const brake = { ...base, longDescription: operationalDescription("Dispone de freno automático.") };
  assert.equal(resolveSourcedOperationalFeatures(brake, brake, `${operationalGeneral} Dispone de frenado automático.`, true), null);
});

test("recupera protecciones y frenos declarados con identidad y energía corroboradas", () => {
  for (const base of [controlledGamForklift(), controlledGomarizForklift(), controlledMercaelevaForklift()]) {
    const source = { ...base, specs: { ...base.specs, "Tipo de motor": "Eléctrico" },
      longDescription: operationalDescription("El equipo dispone de protección contra sobrecarga y frenos en baño de aceite.") };
    const result = resolveSourcedOperationalFeatures(source, source, operationalGeneral, true);
    assert.ok(result?.includes("menciona protección contra sobrecarga y frenos en baño de aceite para este modelo"), base.providerId);
    assert.equal(resolveSourcedOperationalFeatures(source, source, result, true), null);
    assert.equal(resolveSourcedOperationalFeatures(source, { ...source, reference: "OTRA" }, operationalGeneral, true), null);
  }
});

test("no duplica protecciones o frenos ni incorpora equipamiento opcional o con energía discordante", () => {
  const base = controlledGamForklift();
  const brake = { ...base, specs: { ...base.specs, "Tipo de motor": "Eléctrico" }, longDescription: operationalDescription("Dispone de frenos en baño de aceite.") };
  for (const claim of ["No dispone de protección contra sobrecarga.", "Puede incorporar frenos en baño de aceite.", "La protección contra sobrecarga es opcional."]) {
    const source = { ...brake, longDescription: operationalDescription(claim) };
    assert.equal(resolveSourcedOperationalFeatures(source, source, operationalGeneral, true), null, claim);
  }
  assert.equal(resolveSourcedOperationalFeatures(brake, brake, `${operationalGeneral} Dispone de frenos húmedos.`, true), null);
  assert.equal(resolveSourcedOperationalFeatures(brake, { ...brake, specs: { ...base.specs, "Tipo de motor": "Diésel" } }, operationalGeneral, true), null);
  const unknown = { ...brake, specs: { ...base.specs } };
  assert.equal(resolveSourcedOperationalFeatures(unknown, unknown, operationalGeneral, true), null);
  const conflict = { ...brake, longDescription: operationalDescription("Motor diésel. Dispone de frenos en baño de aceite.") };
  assert.equal(resolveSourcedOperationalFeatures(conflict, conflict, operationalGeneral, true), null);
  const overload = { ...base, longDescription: operationalDescription("Dispone de protección contra sobrecarga.") };
  assert.equal(resolveSourcedOperationalFeatures(overload, overload, `${operationalGeneral} Dispone de limitador de carga.`, true), null);
});

test("recupera corriente alterna y controles de desplazamiento declarados en distintos proveedores", () => {
  for (const base of [controlledGamForklift(), controlledGomarizForklift(), controlledMercaelevaForklift()]) {
    for (const motor of ["motor de corriente alterna", "motores de CA", "motor de tracción AC"]) {
      const source = { ...base, specs: { ...base.specs, "Tipo de motor": "Eléctrico" },
        longDescription: operationalDescription(`Dispone de ${motor}, sistema de velocidad reducida en las curvas y sistema de control de tracción.`) };
      const result = resolveSourcedOperationalFeatures(source, source, operationalGeneral, true);
      assert.ok(result?.includes("motorización de corriente alterna, reducción de velocidad en curvas y sistema de control de tracción"), base.providerId);
      assert.equal(resolveSourcedOperationalFeatures(source, source, result, true), null);
      assert.equal(resolveSourcedOperationalFeatures(source, { ...source, reference: "OTRA" }, operationalGeneral, true), null);
      assert.equal(resolveSourcedOperationalFeatures(source, source, operationalGeneral, false), null);
    }
  }
});

test("las prestaciones de desplazamiento respetan energía, variantes, negaciones y menciones previas", () => {
  const base = controlledGamForklift();
  const electric = { ...base, specs: { ...base.specs, "Tipo de motor": "Eléctrico" } };
  const motor = { ...electric, longDescription: operationalDescription("Dispone de motores de corriente alterna.") };
  assert.equal(resolveSourcedOperationalFeatures(motor, { ...motor, specs: { ...base.specs, "Tipo de motor": "Diésel" } }, operationalGeneral, true), null);
  assert.equal(resolveSourcedOperationalFeatures({ ...motor, specs: { ...base.specs } }, { ...motor, specs: { ...base.specs } }, operationalGeneral, true), null);
  for (const claim of ["El motor AC es opcional.", "No dispone de sistema de control de tracción.", "Puede incorporar un sistema de velocidad reducida en las curvas.", "La versión LWB dispone de motor AC.", "La MARCA MODELO20 dispone de motor AC."]) {
    const source = { ...electric, longDescription: operationalDescription(claim) };
    assert.equal(resolveSourcedOperationalFeatures(source, source, operationalGeneral, true), null, claim);
  }
  const brushless = { ...electric, longDescription: operationalDescription("Dispone de motor AC sin escobillas.") };
  const result = resolveSourcedOperationalFeatures(brushless, brushless, operationalGeneral, true);
  assert.match(result ?? "", /motor eléctrico sin escobillas/u);
  assert.doesNotMatch(result ?? "", /motorización de corriente alterna/u);
  const traction = { ...electric, longDescription: operationalDescription("Dispone de sistema de velocidad reducida en las curvas y sistema de control de tracción.") };
  assert.equal(resolveSourcedOperationalFeatures(traction, traction, `${operationalGeneral} Dispone de reducción de velocidad en curvas y control de la tracción.`, true), null);
});

test("recupera el asiento regulable y el cargador integrado con familia, identidad y energía coherentes", () => {
  for (const base of [controlledGamForklift(), controlledGomarizForklift(), controlledMercaelevaForklift()]) {
    for (const charger of ["cargador integrado", "cargador incorporado", "cargador a bordo"]) {
      const source = { ...base, specs: { ...base.specs, "Tipo de motor": "Eléctrico" },
        longDescription: operationalDescription(`Dispone de asiento ajustable y ${charger}.`) };
      const result = resolveSourcedOperationalFeatures(source, source, operationalGeneral, true);
      assert.ok(result?.includes("menciona asiento regulable y cargador integrado para este modelo"), base.providerId);
      assert.equal(resolveSourcedOperationalFeatures(source, source, result, true), null);
      assert.equal(resolveSourcedOperationalFeatures(source, { ...source, reference: "OTRA" }, operationalGeneral, true), null);
      assert.equal(resolveSourcedOperationalFeatures(source, source, operationalGeneral, false), null);
    }
  }
});

test("no atribuye asientos a otras familias ni cargadores opcionales o sin energía corroborada", () => {
  const base = controlledGamForklift();
  const electric = { ...base, specs: { ...base.specs, "Tipo de motor": "Eléctrico" } };
  for (const claim of ["El asiento ajustable es opcional.", "No dispone de cargador integrado.", "Puede incorporar un cargador a bordo.", "La MARCA MODELO20 dispone de asiento regulable."]) {
    const source = { ...electric, longDescription: operationalDescription(claim) };
    assert.equal(resolveSourcedOperationalFeatures(source, source, operationalGeneral, true), null, claim);
  }
  const charger = { ...electric, longDescription: operationalDescription("Dispone de cargador incorporado.") };
  assert.equal(resolveSourcedOperationalFeatures(charger, { ...charger, specs: { ...base.specs, "Tipo de motor": "Diésel" } }, operationalGeneral, true), null);
  const seat = { ...electric, longDescription: operationalDescription("Dispone de asiento ajustable.") };
  assert.equal(resolveSourcedOperationalFeatures(seat, seat, `${operationalGeneral} Cuenta con asiento regulable.`, true), null);
  const platform = { ...controlledGomarizPlatform(), longDescription: operationalDescription("Dispone de asiento regulable.") };
  assert.equal(resolveSourcedOperationalFeatures(platform, platform, operationalGeneral, true), null);
});
