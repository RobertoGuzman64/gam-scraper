import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { containsEditorialIdentity, containsEditorialBrandModel } from "./editorial-identity-match.js";
import { verifiedEditorialIdentity, verifiedEditorialStructuredIdentity } from "../core/editorial-source-contract.js";
import { resolveSourceEditorialClaims } from "../claims/editorial-source-claims.js";
import { cleanAuthenticatedSourceEditorial } from "../writing/editorial-text-hygiene.js";
import { conciseVerifiedUnitGeneral, resolveCorroboratedEditorialVariantGeneral } from "./editorial-identity-summary.js";
import { normalizeVerifiedEditorialCapacity } from "../measurements/coherence/editorial-capacity-coherence.js";
import { prepareSourceProduct } from "../../prepare-product.js";
import {
  controlledGamForklift, controlledGomarizForklift, controlledMercaelevaForklift
} from "../core/editorial-contract-records.js";

const sources = [controlledGamForklift, controlledGomarizForklift, controlledMercaelevaForklift];
const general = "La ficha técnica identifica las prestaciones documentadas de esta unidad.";

const update = (source: ProductRecord, title: string): ProductRecord => ({ ...source, title });

test("marca y modelo admiten separadores equivalentes, pero no sufijos ni prefijos de variantes", () => {
  for (const text of ["Carretilla MARCA MODELO10", "Carretilla Marca MODELO-10", "Carretilla MARCA MODELO 10"]) {
    assert.equal(containsEditorialBrandModel(text, "MARCA", "MODELO10"), true, text);
  }
  for (const text of ["Carretilla MARCA MODELO100", "Carretilla MARCA XMODELO10", "Carretilla XMARCA MODELO10", "Carretilla MARCAN MODELO10"]) {
    assert.equal(containsEditorialBrandModel(text, "MARCA", "MODELO10"), false, text);
  }
  assert.equal(containsEditorialIdentity("GENIE Z45/25 J", "Z45/25J"), true);
  assert.equal(containsEditorialIdentity("GENIE Z45/250J", "Z45/25J"), false);
  assert.equal(containsEditorialIdentity("GAM equipo", ""), false);
});

test("los tres proveedores rechazan la identidad parecida y conservan la unidad compatible", () => {
  for (const factory of sources) {
    const record = factory();
    assert.equal(verifiedEditorialIdentity(record), true, record.providerId);
    assert.equal(verifiedEditorialIdentity(update(record, "Carretilla elevadora MARCA MODELO100 2500 kg")), false);
    assert.equal(verifiedEditorialIdentity(update(record, "Carretilla elevadora MARCAS MODELO10 2500 kg")), false);
    assert.equal(verifiedEditorialIdentity(update(record, "Carretilla elevadora MARCA MODELO-10 2500 kg")), true);
    const described = { ...record, longDescription: "La carretilla incorpora dirección asistida." };
    assert.match(resolveSourceEditorialClaims(described, described, general) ?? "", /dirección asistida/u);
    const wrongTitle = update(described, "Carretilla elevadora MARCA MODELO100 2500 kg");
    assert.equal(resolveSourceEditorialClaims(wrongTitle, wrongTitle, general), general);
    const wrongSpecs = { ...described, specs: { ...described.specs, Modelo: "MODELO100" } };
    assert.equal(resolveSourceEditorialClaims(wrongSpecs, wrongSpecs, general), general);
  }
});

test("la limpieza de textos no acepta un modelo que solo aparece como subcadena de otra variante", () => {
  for (const factory of sources) {
    const record = factory();
    const confused = "¡Hola! Esta máquina MARCA MODELO100 dispone de una oferta comercial con abundante equipamiento técnico para trabajos de manutención.";
    const valid = "¡Hola! Esta máquina MARCA MODELO10 dispone de una oferta comercial con abundante equipamiento técnico para trabajos de manutención.";
    assert.equal(cleanAuthenticatedSourceEditorial({ ...record, longDescription: confused }, null, confused).general, confused);
    assert.equal(cleanAuthenticatedSourceEditorial({ ...record, longDescription: valid }, null, valid).general, valid.replace(/^¡Hola!\s+/u, ""));
  }
});

test("el resumen verificado exige identidad completa en su oración y no solo una subcadena", () => {
  const source = controlledGamForklift();
  const correct = "La carretilla MARCA MODELO10 conserva las prestaciones verificadas para su uso en almacenes industriales.";
  const mismatched = "La carretilla MARCA MODELO100 conserva las prestaciones verificadas para su uso en almacenes industriales.";
  assert.equal(conciseVerifiedUnitGeneral(source, correct), correct);
  assert.equal(conciseVerifiedUnitGeneral(source, mismatched), null);
});

test("la normalización de capacidad no corrige textos de una variante con nombre más largo", () => {
  const record = controlledGamForklift();
  const source: ProductRecord = {
    ...record,
    shortDescription: "Carretilla MARCA MODELO10 con capacidad de carga de 2500 kg.",
    longDescription: "La carretilla MARCA MODELO10 declara capacidad nominal de 2500 kg.",
    specs: { ...record.specs, Marca: record.brand ?? "", Modelo: record.model ?? "" }
  };
  const unrelated = {
    title: "Carretilla MARCA MODELO100 con 2000 kg",
    description: "Carretilla MARCA MODELO100 con capacidad de carga de 2000 kg.",
    description_general: "La ficha de MARCA MODELO100 indica capacidad nominal de 2000 kg.",
    sourceUrl: source.url,
    reference: source.reference,
    spec: { ...source.specs }
  };
  const result = normalizeVerifiedEditorialCapacity(source, unrelated);
  assert.equal(result.title, unrelated.title);
  assert.equal(result.description, unrelated.description);
  assert.equal(result.description_general, unrelated.description_general);
});

test("una variante discordante en el título no contamina los hechos técnicos acreditados", () => {
  for (const factory of sources) {
    const original = factory();
    const title = original.title?.replace("MODELO10", "MODELO100") ?? "";
    const source: ProductRecord = {
      ...original,
      title,
      specs: { ...original.specs, Marca: original.brand ?? "", Modelo: original.model ?? "" },
      longDescription: "La carretilla cuenta con dirección asistida."
    };
    assert.equal(verifiedEditorialIdentity(source), false);
    assert.equal(verifiedEditorialStructuredIdentity(source), true);
    const published = prepareSourceProduct(source).product;
    assert.match(published.title ?? "", /MODELO10(?!0)/u, original.providerId);
    assert.doesNotMatch(published.title ?? "", /MODELO100/u, original.providerId);
    assert.doesNotMatch(published.description_general ?? "", /declara dirección asistida/u, original.providerId);
  }
});

test("sin corroboración de ficha técnica no se permite el modo de composición estructurada", () => {
  for (const factory of sources) {
    const original = factory();
    const conflict: ProductRecord = {
      ...original,
      title: "Carretilla MARCA MODELO100 de 2500 kg",
      specs: { ...original.specs, Marca: original.brand ?? "", Modelo: "MODELO100" }
    };
    assert.equal(verifiedEditorialIdentity(conflict), false);
    assert.equal(verifiedEditorialStructuredIdentity(conflict), false);
    assert.equal(resolveSourceEditorialClaims(conflict, conflict, general), general);
  }
});


const variantSource = (basis: ProductRecord, descriptor: "MWB" | "LWB" | "pedestrian" = "MWB"): ProductRecord => {
  const family = descriptor === "pedestrian" ? "Apilador eléctrico a pie" : "Carretilla elevadora eléctrica";
  return {
    ...basis,
    url: basis.providerId === "gam" ? `https://online.gamrentals.com/es/manutencion/${basis.reference}-marca-modelo10` :
      "https://www.gomarizrent.com/producto/marca-modelo10/",
    model: `MODELO10 (${descriptor})`,
    title: `${family} MARCA MODELO10`,
    shortDescription: `MARCA MODELO10. ${family} con capacidad de carga de 2500 kg.`,
    longDescription: `La ${family.toLowerCase()} MARCA MODELO10 dispone de un sistema de accionamiento eléctrico.`,
    specs: { Marca: "MARCA", Modelo: `MODELO10 (${descriptor})`, "Capacidad de carga (kg)": "2500 kg" }
  };
};

test("recupera la denominación literal de la variante y distingue el texto del modelo base", () => {
  for (const factory of [controlledGamForklift, controlledGomarizForklift]) {
    for (const descriptor of ["MWB", "LWB", "pedestrian"] as const) {
      const source = variantSource(factory(), descriptor);
      const before = structuredClone(source);
      const output = resolveCorroboratedEditorialVariantGeneral(source, source, source.longDescription, true) ?? "";
      assert.ok(output.includes(`MARCA MODELO10 (${descriptor})`), `${source.providerId}: ${descriptor}`);
      assert.match(output, /capacidad de carga declarada de 2\.500 kg/u);
      assert.match(output, /denominación base MARCA MODELO10/u);
      assert.ok(output.endsWith(source.longDescription ?? ""));
      assert.equal(resolveCorroboratedEditorialVariantGeneral(source, source, output, true), null);
      assert.deepEqual(source, before);
    }
  }
});

test("la identificación de una variante requiere coincidencia de familia, denominación, origen y capacidad", () => {
  const source = variantSource(controlledGamForklift());
  const invalid: readonly ProductRecord[] = [
    { ...source, providerId: "gomariz" },
    { ...source, reference: "OTRA-UNIDAD" },
    { ...source, url: source.url.replace("modelo10", "modelo100") },
    { ...source, url: `${source.url}-lwb` },
    { ...source, url: source.url.replace("online.gamrentals.com", "example.org") },
    { ...source, title: "Carretilla elevadora MARCA MODELO10-X" },
    { ...source, shortDescription: "MARCA MODELO10. Apilador con capacidad de carga de 2500 kg." },
    { ...source, shortDescription: "MARCA MODELO10. Carretilla elevadora con capacidad de carga de 2000 kg." },
    { ...source, longDescription: `${source.longDescription} La versión LWB es la anunciada.` },
    { ...source, longDescription: `${source.longDescription} La carretilla MARCA MODELO10-XX incorpora otro mástil.` },
    { ...source, longDescription: `${source.longDescription} Tiene capacidad de carga de 2.000 kg.` },
    { ...source, specs: { ...source.specs, Modelo: "MODELO10 (LWB)" } }
  ];
  for (const variant of invalid) {
    assert.equal(resolveCorroboratedEditorialVariantGeneral(source, variant, source.longDescription, true), null);
    assert.equal(resolveCorroboratedEditorialVariantGeneral(variant, variant, variant.longDescription, true), null);
  }
  assert.equal(resolveCorroboratedEditorialVariantGeneral(source, source, source.longDescription, false), null);
  assert.equal(resolveCorroboratedEditorialVariantGeneral(source, source, "Carretilla MARCA MODELO11.", true), null);
});

test("rechaza una variante con batería discordante y admite la configuración concordante sin inferir equipamiento", () => {
  const source = variantSource(controlledGamForklift());
  const battery = { ...source, specs: { ...source.specs, "Capacidad de la batería": "80 V / 450 Ah (V/Ah)" },
    longDescription: `${source.longDescription} La batería declarada es de 80 V y 450 Ah.` };
  assert.ok(resolveCorroboratedEditorialVariantGeneral(battery, battery, battery.longDescription, true));
  const incompatible = { ...battery, longDescription: `${battery.longDescription} Otra mención indica 600 Ah.` };
  assert.equal(resolveCorroboratedEditorialVariantGeneral(incompatible, incompatible, incompatible.longDescription, true), null);
  assert.equal(resolveCorroboratedEditorialVariantGeneral(battery,
    { ...battery, specs: { ...battery.specs, "Capacidad de la batería": "80 V / 600 Ah (V/Ah)" } }, battery.longDescription, true), null);
});

const lithiumVariantSource = (basis: ProductRecord): ProductRecord => ({
  ...basis,
  url: basis.providerId === "gam" ? `https://online.gamrentals.com/es/plataformas/${basis.reference}-marca-modelo10-li` :
    "https://www.gomarizrent.com/producto/marca-modelo10-li/",
  model: "MODELO10-LI",
  title: "Plataforma de tijera MARCA MODELO10 con batería de litio",
  shortDescription: "MARCA MODELO10-LI. Plataforma de tijera con capacidad de la cesta de 250 kg.",
  longDescription: "La plataforma de tijera MARCA MODELO10 con batería de litio tiene capacidad de carga de 250 kg.",
  specs: { Marca: "MARCA", Modelo: "MODELO10-LI", "Tipo de batería": "Batería de litio", "Capacidad de carga (kg)": "250 kg" }
});

test("la variante de litio requiere identificación completa y tecnología de batería declarada", () => {
  for (const factory of [controlledGamForklift, controlledGomarizForklift]) {
    const source = lithiumVariantSource(factory());
    const before = structuredClone(source);
    const output = resolveCorroboratedEditorialVariantGeneral(source, source, source.longDescription, true);
    assert.ok(output);
    assert.ok(output.startsWith("La tabla técnica identifica esta referencia como MARCA MODELO10-LI, con batería de litio declarada."));
    assert.ok(output.endsWith(source.longDescription ?? ""));
    assert.equal(resolveCorroboratedEditorialVariantGeneral(source, source, output, true), null);
    assert.deepEqual(source, before);
  }
});

test("la variante de litio no se deduce del sufijo ni de un anuncio contradictorio", () => {
  const source = lithiumVariantSource(controlledGamForklift());
  const invalid: readonly ProductRecord[] = [
    { ...source, url: source.url.replace("modelo10-li", "modelo10") },
    { ...source, url: source.url.replace("online.gamrentals.com", "example.org") },
    { ...source, shortDescription: source.shortDescription?.replace("MODELO10-LI", "XMODELO10-LI") ?? "" },
    { ...source, shortDescription: source.shortDescription?.replace("250 kg", "450 kg") ?? "" },
    { ...source, longDescription: `${source.longDescription} La capacidad de carga es de 450 kg.` },
    { ...source, longDescription: `${source.longDescription} Capacidad de carga de 450 kg.` },
    { ...source, longDescription: `${source.longDescription} Batería de litio opcional.` },
    { ...source, longDescription: `${source.longDescription} Batería de 48 V.` },
    { ...source, longDescription: `${source.longDescription} La plataforma MARCA MODELO10-P tiene otra configuración.` },
    { ...source, specs: { ...source.specs, "Tipo de batería": "Batería de plomo" } },
    { ...source, specs: { ...source.specs, "Tipo de batería": "Litio o plomo" } }
  ];
  for (const variant of invalid) {
    assert.equal(resolveCorroboratedEditorialVariantGeneral(variant, variant, variant.longDescription, true), null, JSON.stringify(variant));
  }
  assert.equal(resolveCorroboratedEditorialVariantGeneral(source, source, source.longDescription, false), null);
  assert.equal(resolveCorroboratedEditorialVariantGeneral(source, { ...source, reference: "OTRA" }, source.longDescription, true), null);
});
