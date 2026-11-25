import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import type { EditorialKnowledge, EditorialUnitKnowledge } from "../core/editorial-knowledge.js";
import { editorialSourceDigest } from "../../../infrastructure/filesystem/editorial/knowledge.js";
import { prepareSourceProduct } from "../../prepare-product.js";
import { resolveCorroboratedTitleBrand, resolveDocumentedFamilyTitle, resolveManufacturerFamilyTitle } from "./editorial-documented-title.js";
import { editorialFamilyOf } from "../core/editorial-families.js";
import { resolvePreparedEditorialTitle } from "./prepared-editorial-title.js";
import { controlledGomarizPlatform, controlledMercaelevaForklift } from "../core/editorial-contract-records.js";

const gomarizFamily = (
  familyPath: string, brand: string, model: string, general: string
): ProductRecord => ({
  ...controlledGomarizPlatform(),
  url: `https://www.gomarizrent.com/venta/${familyPath}/${brand.toLocaleLowerCase("es")}-${model.toLocaleLowerCase("es")}/`,
  title: `${brand} ${model}`,
  brand,
  model,
  longDescription: general,
  specs: { Marca: brand, Modelo: model }
});

const families = [
  {
    path: "elevacion-y-trabajos-en-altura/oruga",
    name: "Plataforma sobre orugas",
    text: "La plataforma sobre orugas MARCA MODELO10 permite acceder a terrenos irregulares."
  },
  {
    path: "energia-electrica-e-iluminacion/generador",
    name: "Grupo electrógeno",
    text: "El grupo electrógeno MARCA MODELO10 abastece de energía a instalaciones aisladas."
  },
  {
    path: "energia-electrica-e-iluminacion/torre-de-luz",
    name: "Torre de iluminación",
    text: "La torre de iluminación MARCA MODELO10 permite iluminar zonas de trabajo."
  }
] as const;

test("las familias documentadas por el proveedor se resuelven en el dominio editorial común", () => {
  for (const family of families) {
    const source = gomarizFamily(family.path, "MARCA", "MODELO10", family.text);
    const expected = `${family.name} MARCA MODELO10`;
    assert.equal(resolveDocumentedFamilyTitle(source), expected);
    assert.equal(resolvePreparedEditorialTitle(source, source), expected);
    assert.equal(prepareSourceProduct(source).product.title, expected);
    if (family.name === "Plataforma sobre orugas") {
      const sourceProse = { ...source, longDescription:
        "La Oruga MARCA MODELO10 es una plataforma elevadora todoterreno para terrenos difíciles gracias a sus orugas." };
      assert.equal(resolveDocumentedFamilyTitle(sourceProse), expected);
    }
    const next = {
      ...source,
      reference: "NUEVA-UNIDAD",
      model: "MODELO11",
      title: "MARCA MODELO11",
      url: source.url.replace("modelo10", "modelo11"),
      longDescription: source.longDescription?.replace("MODELO10", "MODELO11") ?? null,
      specs: { Marca: "MARCA", Modelo: "MODELO11" }
    };
    assert.equal(resolvePreparedEditorialTitle(next, next), `${family.name} MARCA MODELO11`);
  }
});

test("el dominio no inventa familia ante procedencias, identidades o descripciones contradictorias", () => {
  for (const family of families) {
    const source = gomarizFamily(family.path, "MARCA", "MODELO10", family.text);
    for (const changed of [
      { ...source, providerId: "gam" },
      { ...source, url: source.url.replace("gomarizrent.com", "example.invalid") },
      { ...source, title: "MARCA MODELO11" },
      { ...source, model: "MODELO11" },
      { ...source, specs: { ...source.specs, Marca: "OTRA" } },
      { ...source, longDescription: "La carretilla elevadora MARCA MODELO10 sirve para transportar palés." },
      { ...source, longDescription: null }
    ]) {
      assert.equal(resolveDocumentedFamilyTitle(changed), null);
    }
  }
});

test("la mención de orugas no transforma una tijera en otra familia", () => {
  assert.equal(editorialFamilyOf("Plataforma de tijera eléctrica orugas de 8 m"), "plataforma-tijera");
});

test("la descripción compartida de manutención reutiliza hechos acreditados sin un narrador de origen", () => {
  const source = controlledMercaelevaForklift();
  const baseline = prepareSourceProduct(source);
  assert.match(baseline.product.description ?? "", /MARCA MODELO10/u);
  assert.match(baseline.product.description_general ?? "", /MARCA MODELO10/u);
  assert.equal(baseline.product.sourceUrl, source.url);
  const variant = { ...source, reference: "CONTROL-OTRA", url: source.url.replace("CONTROL-04", "CONTROL-OTRA") };
  const prepared = prepareSourceProduct(variant);
  assert.equal(prepared.product.description, baseline.product.description);
  assert.equal(prepared.product.description_general, baseline.product.description_general);
  assert.equal(prepared.product.reference, variant.reference);
});

test("la descripción común rechaza identidad contradictoria y no publica datos no acreditados", () => {
  const source = controlledMercaelevaForklift();
  for (const invalid of [
    { ...source, model: "MODELO11" },
    { ...source, brand: "OTRA" },
    { ...source, url: "https://example.invalid/for-sale/machine/CONTROL-04" },
    { ...source, specs: { ...source.specs, "Capacidad máxima de elevación": "2000 litros" } }
  ]) {
    const result = prepareSourceProduct(invalid);
    assert.ok(result.status === "review" || result.product.description_general === null);
  }
});

test("los encabezados de familia y las magnitudes concordantes enriquecen títulos sin categoría en la URL", () => {
  const platform: ProductRecord = {
    ...controlledGomarizPlatform(),
    title: "MARCA MODELO10",
    longDescription: "Las tijeras eléctricas permiten trabajos en altura.",
    specs: { "Altura de trabajo": "10 m", "Altura plataforma": "8 m", Capacidad: "450 kg", Motor: "Eléctrico" }
  };
  assert.equal(resolveDocumentedFamilyTitle(platform), "Plataforma de tijera MARCA MODELO10");
  assert.equal(prepareSourceProduct(platform).product.title, "Plataforma de tijera eléctrica MARCA MODELO10");
  const generator: ProductRecord = {
    ...platform,
    providerId: "gam",
    url: "https://online.gamrentals.com/es/maquinaria/CONTROL-01-marca-modelo10",
    longDescription: "Contamos con grupos electrógenos para trabajos de campo.",
    specs: { Marca: "MARCA", Modelo: "MODELO10", Potencia: "45 kVA" }
  };
  assert.equal(resolveDocumentedFamilyTitle(generator), "Grupo electrógeno MARCA MODELO10");
  assert.equal(resolvePreparedEditorialTitle(generator, generator), "Grupo electrógeno MARCA MODELO10");
});

test("los encabezados sin corroboración técnica o con identidad y familia discordantes no generan títulos", () => {
  const source: ProductRecord = {
    ...controlledGomarizPlatform(),
    title: "MARCA MODELO10",
    longDescription: "Las articuladas diésel facilitan el acceso en altura.",
    specs: { "Altura de trabajo": "16 m", "Altura plataforma": "14 m", "Alcance lateral": "8 m", Capacidad: "230 kg", Motor: "Diésel" }
  };
  assert.equal(resolveDocumentedFamilyTitle(source), "Plataforma articulada MARCA MODELO10");
  for (const invalid of [
    { ...source, specs: { ...source.specs, Motor: "Eléctrico" } },
    { ...source, specs: { ...source.specs, "Altura plataforma": "17 m" } },
    { ...source, specs: { ...source.specs, Capacidad: "230" } },
    { ...source, longDescription: "Las carretillas permiten manejar cargas." },
    { ...source, shortDescription: "Plataforma de tijera MARCA MODELO10." },
    { ...source, url: "https://example.invalid/producto/marca-modelo10/" },
    { ...source, specs: { ...source.specs, "Título adicional": "PLATAFORMA DE TIJERA" } }
  ]) assert.equal(resolveDocumentedFamilyTitle(invalid), null);
  assert.equal(resolveDocumentedFamilyTitle(source, { ...source, reference: "OTRA" }), null);
  assert.equal(resolveDocumentedFamilyTitle(source, { ...source, specs: { ...source.specs, Capacidad: "250 kg" } }), null);
});

test("la movilidad eléctrica recupera la familia explícita del título sin alterar la identidad de la unidad", () => {
  for (const family of [
    { route: "bicicletas-electricas", claim: "una bicicleta eléctrica", title: "Bicicleta eléctrica" },
    { route: "motocicletas-electricas", claim: "una motocicleta eléctrica", title: "Motocicleta eléctrica" },
    { route: "ciclomotores-electricos", claim: "un ciclomotor eléctrico", title: "Ciclomotor eléctrico" }
  ]) {
    const source: ProductRecord = {
      ...controlledGomarizPlatform(),
      providerId: "gam",
      url: `https://online.gamrentals.com/es/${family.route}/CONTROL-01-marca-modelo10`,
      title: "MARCA MODELO10",
      shortDescription: `MARCA MODELO10 es ${family.claim} de ocasión.`,
      longDescription: `MARCA MODELO10 es ${family.claim} para desplazamientos urbanos.`,
      specs: { Marca: "MARCA", Modelo: "MODELO10" }
    };
    const expected = `${family.title} MARCA MODELO10`;
    assert.equal(resolvePreparedEditorialTitle(source, source), expected);
    assert.equal(prepareSourceProduct(source).product.title, expected);
    const withDisclaimer = { ...source, longDescription: `Cambio de titularidad y transporte no incluidos ${source.longDescription}` };
    assert.equal(resolveDocumentedFamilyTitle(withDisclaimer), expected);
    const other: ProductRecord = {
      ...source,
      providerId: "gomariz",
      url: `https://www.gomarizrent.com/venta/movilidad/${family.route}/marca-modelo10/`
    };
    assert.equal(resolvePreparedEditorialTitle(other, other), expected);
    for (const invalid of [
      { ...source, url: source.url.replace(family.route, "maquinaria") },
      { ...source, url: source.url.replace("modelo10", "modelo11") },
      { ...source, shortDescription: source.shortDescription?.replace("MODELO10", "MODELO11") ?? null },
      { ...source, longDescription: source.longDescription?.replace(" es ", " no es ") ?? null },
      { ...source, longDescription: `${source.longDescription} También se anuncia como ${family.title === "Motocicleta eléctrica" ? "ciclomotor" : "motocicleta"}.` },
      { ...source, specs: { ...source.specs, Motor: "Gasolina" } },
      { ...source, specs: { ...source.specs, Modelo: "MODELO11" } }
    ]) assert.equal(resolveDocumentedFamilyTitle(invalid), null);
    assert.equal(resolveDocumentedFamilyTitle(source, { ...source, reference: "OTRA" }), null);
    assert.equal(resolveDocumentedFamilyTitle(source, { ...source, specs: { ...source.specs, Motor: "Diésel" } }), null);
  }
});

test("las rutas de iluminación y compactación corroboradas enriquecen únicamente el título documentado", () => {
  for (const item of [
    { route: "torre-de-luz", general: "Las torres de iluminación permiten iluminar zonas de trabajo. Hay equipos diésel y mixtos.", title: "Torre de iluminación" },
    { route: "rodillo", general: "El MODELO10 es un rodillo para la compactación de tierra.", title: "Rodillo compactador" }
  ]) {
    const source: ProductRecord = {
      ...controlledGomarizPlatform(),
      url: `https://www.gomarizrent.com/venta/maquinaria/${item.route}/marca-modelo10/`,
      title: "MARCA MODELO10",
      longDescription: item.general,
      specs: { Peso: "1000 kg", Anchura: "1,2 m" }
    };
    const expected = `${item.title} MARCA MODELO10`;
    assert.equal(resolveDocumentedFamilyTitle(source), expected);
    assert.equal(resolvePreparedEditorialTitle(source, source), expected);
    assert.equal(prepareSourceProduct(source).product.title, expected);
    const other: ProductRecord = {
      ...source,
      providerId: "gam",
      url: `https://online.gamrentals.com/es/${item.route}/CONTROL-01-marca-modelo10`
    };
    assert.equal(resolveDocumentedFamilyTitle(other), expected);
    for (const invalid of [
      { ...source, url: source.url.replace(item.route, "maquinaria") },
      { ...source, url: source.url.replace("modelo10", "modelo11") },
      { ...source, longDescription: "La carretilla elevadora MARCA MODELO10 transporta cargas." },
      { ...source, specs: { ...source.specs, Peso: "1000" } },
      { ...source, specs: { ...source.specs, Anchura: "1,2 kg" } },
      { ...source, specs: { ...source.specs, Modelo: "MODELO11" } },
      { ...source, subcategory: "Carretilla elevadora" }
    ]) assert.equal(resolveDocumentedFamilyTitle(invalid), null);
    assert.equal(resolveDocumentedFamilyTitle(source, { ...source, reference: "OTRA" }), null);
    assert.equal(resolveDocumentedFamilyTitle(source, { ...source, specs: { ...source.specs, Anchura: "1,4 m" } }), null);
  }
});


test("la marca omitida o errónea se recupera con identidad estructurada y evidencia de origen", () => {
  for (const base of [controlledGomarizPlatform(), { ...controlledGomarizPlatform(), providerId: "gam" }]) {
    const source: ProductRecord = {
      ...base,
      url: base.providerId === "gam" ?
        `https://online.gamrentals.com/es/carretillas/${base.reference}-marcaindustrial-modelo10` :
        "https://www.gomarizrent.com/producto/marcaindustrial-modelo10/",
      brand: "MARCAINDUSTRIAL",
      model: "MODELO10",
      title: "Carretilla elevadora MODELO10",
      shortDescription: "MARCAINDUSTRIAL MODELO10 para manutención.",
      longDescription: "La carretilla elevadora MARCAINDUSTRIAL MODELO10 permite mover cargas.",
      specs: { Marca: "MARCAINDUSTRIAL", Modelo: "MODELO10" }
    };
    const expected = "Carretilla elevadora MARCAINDUSTRIAL MODELO10";
    assert.equal(resolveCorroboratedTitleBrand(source, source), expected);
    assert.equal(resolvePreparedEditorialTitle(source, source), expected);
    const corrected = prepareSourceProduct(source);
    assert.equal(corrected.product.title, expected);
    assert.equal(corrected.product.description_title, expected);
    const typo = { ...source, title: "Carretilla elevadora MARCAINDUSTIAL MODELO10" };
    assert.equal(resolveCorroboratedTitleBrand(typo, typo), expected);
    const complete = { ...source, title: expected };
    assert.equal(resolveCorroboratedTitleBrand(complete, complete), null);
    for (const invalid of [
      { ...source, title: "Carretilla elevadora OTRA MODELO10" },
      { ...source, title: "Carretilla elevadora MODELO11" },
      { ...source, url: source.url.replace("marcaindustrial", "otra") },
      { ...source, url: source.url.replace("modelo10", "modelo11") },
      { ...source, url: source.url.replace(new URL(source.url).hostname, "example.invalid") },
      { ...source, shortDescription: "MARCAINDUSTRIAL MODELO11 para manutención." },
      { ...source, specs: { ...source.specs, Marca: "OTRA" } },
      { ...source, specs: { ...source.specs, "Título adicional": "IDENTIDAD PROTEGIDA" } }
    ]) assert.equal(resolveCorroboratedTitleBrand(invalid, invalid), null);
    assert.equal(resolveCorroboratedTitleBrand(source, { ...source, reference: "OTRA" }), null);
    assert.equal(resolveCorroboratedTitleBrand(source, { ...source, specs: { ...source.specs, Modelo: "MODELO11" } }), null);
  }
});

test("el encabezado de manipulación y las prestaciones concordantes identifican el tipo sin añadir magnitudes", () => {
  const source: ProductRecord = {
    ...controlledGomarizPlatform(),
    title: "MARCA MODELO10",
    longDescription: "Manipuladores. Unifica las características de una carretilla elevadora con las de un brazo telescópico.",
    specs: { "Altura de trabajo": "6 m", Capacidad: "2500 kg" }
  };
  const expected = "Manipulador telescópico MARCA MODELO10";
  assert.equal(resolveDocumentedFamilyTitle(source), expected);
  assert.equal(prepareSourceProduct(source).product.title, expected);
  const other = { ...source, reference: "OTRA-UNIDAD", model: "MODELO11", title: "MARCA MODELO11", url: source.url.replace("modelo10", "modelo11") };
  assert.equal(resolveDocumentedFamilyTitle(other), "Manipulador telescópico MARCA MODELO11");
  for (const invalid of [
    { ...source, longDescription: "Manipuladores. Equipo para elevar personas." },
    { ...source, longDescription: "Carretilla elevadora para mover palés." },
    { ...source, specs: { ...source.specs, Capacidad: "2500 litros" } },
    { ...source, specs: { ...source.specs, "Altura de trabajo": "6 kg" } },
    { ...source, subcategory: "Carretilla elevadora" }
  ]) assert.equal(resolveDocumentedFamilyTitle(invalid), null);
  assert.equal(resolveDocumentedFamilyTitle(source, { ...source, reference: "OTRA" }), null);
  assert.equal(resolveDocumentedFamilyTitle(source, { ...source, specs: { ...source.specs, Capacidad: "3000 kg" } }), null);
});


test("la familia acreditada por fabricante identifica títulos desnudos sin deducir prestaciones", () => {
  const rule = { brand: "MARCA", model: "MODELO10", family: "carretilla-elevadora", manufacturerSource: "https://example.invalid/modelo10" } as const;
  const source: ProductRecord = {
    ...controlledGomarizPlatform(), title: "MARCA MODELO10", longDescription: "Equipo para operaciones de almacén.",
    specs: { Capacidad: "2500 kg", Motor: "Eléctrico" }
  };
  const expected = "Carretilla elevadora MARCA MODELO10";
  assert.equal(resolveManufacturerFamilyTitle(source, source, rule), expected);
  const other: ProductRecord = { ...source, providerId: "gam", categoryKey: "segunda-mano",
    reference: "OTRA-UNIDAD", url: "https://online.gamrentals.com/es/carretillas/OTRA-UNIDAD-marca-modelo10" };
  assert.equal(resolveManufacturerFamilyTitle(other, other, rule), expected);
  assert.equal(resolveManufacturerFamilyTitle(source, source, undefined), null);
  assert.equal(resolveManufacturerFamilyTitle(source, source, { ...rule, model: "MODELO11" }), null);
  assert.equal(resolveManufacturerFamilyTitle(source, source, { ...rule, brand: "OTRA" }), null);
  for (const invalid of [
    { ...source, title: expected },
    { ...source, model: "MODELO11", title: "MARCA MODELO11" },
    { ...source, longDescription: "Plataforma de tijera para elevar personas." },
    { ...source, subcategory: "Plataforma de tijera" },
    { ...source, url: "https://example.invalid/producto/marca-modelo10/" },
    { ...source, specs: { ...source.specs, "Título adicional": "Otra familia" } }
  ]) assert.equal(resolveManufacturerFamilyTitle(invalid, invalid, rule), null);
  assert.equal(resolveManufacturerFamilyTitle(source, { ...source, reference: "DISTINTA" }, rule), null);
  assert.equal(resolveManufacturerFamilyTitle(source, { ...source, title: "MARCA MODELO11" }, rule), null);
});

test("la familia del camión cesta se añade a la denominación compuesta literal sin reconstruir identidad", () => {
  const source: ProductRecord = {
    ...controlledGomarizPlatform(), brand: null, model: null, title: "MARCA CHASIS MODELO10",
    url: "https://www.gomarizrent.com/venta/elevacion-y-trabajos-en-altura/camion-plataforma/marca-chasis-modelo10/",
    longDescription: "Los camiones cesta permiten realizar trabajos en altura.",
    specs: { "Altura de trabajo": "18 m", "Alcance lateral": "9 m", Anchura: "2,2 m", Longitud: "7 m" }
  };
  const expected = "Camión cesta MARCA CHASIS MODELO10";
  assert.equal(resolveDocumentedFamilyTitle(source), expected);
  assert.equal(resolvePreparedEditorialTitle(source, source), expected);
  const duplicate = { ...source, reference: "OTRA-UNIDAD", url: source.url.replace("modelo10/", "modelo10-2/") };
  assert.equal(resolveDocumentedFamilyTitle(duplicate), expected);
  for (const invalid of [
    { ...source, title: "MARCA CHASIS MODELO11" },
    { ...source, url: source.url.replace("gomarizrent.com", "example.invalid") },
    { ...source, url: source.url.replace("camion-plataforma", "tijera") },
    { ...source, longDescription: "Las plataformas de tijera permiten trabajos en altura." },
    { ...source, specs: { ...source.specs, "Alcance lateral": "20 m" } },
    { ...source, specs: { ...source.specs, Anchura: "2 kg" } },
    { ...source, specs: { ...source.specs, "Título adicional": "Otra familia" } },
    { ...source, subcategory: "Carretilla elevadora" }
  ]) assert.equal(resolveDocumentedFamilyTitle(invalid), null);
  assert.equal(resolveDocumentedFamilyTitle(source, { ...source, reference: "DISTINTA" }), null);
  assert.equal(resolveDocumentedFamilyTitle(source, { ...source, specs: { ...source.specs, Longitud: "8 m" } }), null);
  const already = { ...source, title: expected };
  assert.equal(resolvePreparedEditorialTitle(already, already), expected);
});

test("la familia literal de iluminación admite el modelo reconciliado sin admitir otra identidad", () => {
  const source: ProductRecord = { ...controlledGomarizPlatform(), brand: "MARCA", model: null, title: "MARCA MODELO10",
    subcategory: null, categoryName: "Iluminación", url: "https://www.gomarizrent.com/energia-electrica-e-iluminacion/torre-de-luz/marca-modelo10/",
    shortDescription: null, longDescription: "Las torres de iluminación son regulables en altura.",
    specs: { "Altura de trabajo": "8 m", Longitud: "3 m", Anchura: "1,4 m", Peso: "1100 kg", Potencia: "4x120 W" } };
  const prepared = { ...source, model: "MODELO10" };
  assert.equal(resolveDocumentedFamilyTitle(source, prepared), "Torre de iluminación MARCA MODELO10");
  assert.equal(resolveDocumentedFamilyTitle(source, { ...prepared, model: "MODELO11" }), null);
  assert.equal(resolveDocumentedFamilyTitle(source, { ...prepared, specs: { ...prepared.specs, Potencia: "4x150 W" } }), null);
});

test("la familia de camión admite la inversión reconciliada de marca y chasis sin cambiar la identidad literal", () => {
  const source: ProductRecord = { ...controlledGomarizPlatform(), brand: "CHASIS", model: "MARCA MODELO10", title: "MARCA CHASIS MODELO10",
    shortDescription: null, url: "https://www.gomarizrent.com/producto/marca-chasis-modelo10/",
    longDescription: "Los camiones cesta permiten realizar trabajos en altura.",
    specs: { "Altura de trabajo": "18 m", "Alcance lateral": "9 m", Anchura: "2,2 m", Longitud: "7 m" } };
  const prepared = { ...source, brand: "MARCA", model: "CHASIS MODELO10" };
  assert.equal(resolveDocumentedFamilyTitle(source, prepared), "Camión cesta MARCA CHASIS MODELO10");
  assert.equal(resolveDocumentedFamilyTitle(source, { ...prepared, model: "CHASIS MODELO11" }), null);
});


test("la errata repetida en el enlace solo se corrige con resumen e identidad técnica concordantes", () => {
  for (const providerId of ["gam", "gomariz"] as const) {
    const source: ProductRecord = {
      ...controlledGomarizPlatform(), providerId, brand: "MARCAINDUSTRIAL", model: "MODELO10",
      url: providerId === "gam" ? "https://online.gamrentals.com/es/maquinaria/CONTROL-01-marcaindustial-modelo10" :
        "https://www.gomarizrent.com/producto/marcaindustial-modelo10/",
      title: "Equipo MARCAINDUSTIAL MODELO10", shortDescription: "Equipo MARCAINDUSTIAL MODELO10",
      longDescription: "Equipo matriculado.", specs: { Marca: "MARCAINDUSTRIAL", Modelo: "MODELO10" }
    };
    const expected = "Equipo MARCAINDUSTRIAL MODELO10";
    assert.equal(resolveCorroboratedTitleBrand(source, source), expected);
    const prepared = prepareSourceProduct(source);
    assert.equal(prepared.product.title, expected);
    assert.equal(prepared.product.description_title, expected);
    assert.equal(resolveCorroboratedTitleBrand({ ...source, title: expected }, { ...source, title: expected }), null);
    for (const invalid of [
      { ...source, shortDescription: null },
      { ...source, shortDescription: "Equipo MARCAINDUSTIAL MODELO11" },
      { ...source, url: source.url.replace("marcaindustial", "marcaindustral") },
      { ...source, url: source.url.replace("modelo10", "modelo11") },
      { ...source, specs: { ...source.specs, Marca: "OTRA" } }
    ]) assert.equal(resolveCorroboratedTitleBrand(invalid, invalid), null);
    assert.equal(resolveCorroboratedTitleBrand(source, { ...source, reference: "OTRA" }), null);
    assert.equal(resolveCorroboratedTitleBrand(source, { ...source, specs: { Modelo: "MODELO10" } }), null);
  }
});

test("la movilidad eléctrica aprovecha una corrección editorial firmada sin heredar datos de otra variante", () => {
  for (const providerId of ["gam", "gomariz"] as const) {
    const source: ProductRecord = {
      ...controlledGomarizPlatform(), providerId,
      url: providerId === "gam" ? "https://online.gamrentals.com/es/bicicletas-electricas/CONTROL-01-marca-modelo10" :
        "https://www.gomarizrent.com/venta/movilidad/bicicletas-electricas/marca-modelo10/",
      title: "MARCA MODELO10", shortDescription: "MARCA MODELO11 es una bicicleta eléctrica de ocasión.",
      longDescription: "MARCA MODELO11 es una bicicleta eléctrica con otra configuración.",
      specs: { Marca: "MARCA", Modelo: "MODELO10" }
    };
    const entry: EditorialUnitKnowledge = {
      key: `${providerId}:${source.reference}`, brand: "MARCA", model: "MODELO10", sourceUrl: source.url,
      sourceDigest: editorialSourceDigest(source), identityOverride: true, priority: 1, title: null,
      short: "Bicicleta eléctrica MARCA MODELO10 de ocasión.",
      general: "La ficha del proveedor identifica una bicicleta eléctrica MARCA MODELO10 de segunda mano."
    };
    const knowledge = (unit: EditorialUnitKnowledge): EditorialKnowledge => ({
      units: new Map([[unit.key, [unit]]]), models: new Map(), families: {}, modelRules: new Map(), technicalReferences: new Map()
    });
    const expected = "Bicicleta eléctrica MARCA MODELO10";
    assert.equal(resolveDocumentedFamilyTitle(source, source, knowledge(entry)), expected);
    assert.equal(resolveDocumentedFamilyTitle(source, source, knowledge({ ...entry,
      general: "MARCA MODELO10 es una bicicleta eléctrica de ocasión." })), expected);
    for (const invalid of [
      { ...entry, identityOverride: false },
      { ...entry, sourceDigest: "0".repeat(64) },
      { ...entry, sourceUrl: "https://example.invalid/otra-unidad" },
      { ...entry, short: "Bicicleta eléctrica MARCA MODELO11 de ocasión." },
      { ...entry, general: "MARCA MODELO10 es una motocicleta eléctrica de ocasión." },
      { ...entry, general: null }
    ]) assert.equal(resolveDocumentedFamilyTitle(source, source, knowledge(invalid)), null);
    assert.equal(resolveDocumentedFamilyTitle(source, { ...source, reference: "OTRA" }, knowledge(entry)), null);
    assert.equal(resolveDocumentedFamilyTitle(source, { ...source, specs: { ...source.specs, Motor: "Gasolina" } }, knowledge(entry)), null);
    const changed = { ...source, longDescription: `${source.longDescription} Cambio posterior.` };
    assert.equal(resolveDocumentedFamilyTitle(changed, changed, knowledge(entry)), null);
  }
});
