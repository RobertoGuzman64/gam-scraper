import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { prepareSourceProduct } from "../../prepare-product.js";
import { resolveDocumentedFamilyTitle } from "./editorial-documented-title.js";
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
      { ...source, longDescription: `${source.longDescription} También se anuncia como motocicleta.` },
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
