import { reconcileGamHorometer } from "../../../../reconciliation/gam-horometer.js";
import { phase2ExpectedSpecValue } from "../../../support/phase2-basket-dimensions.js";
import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { resolveGamVerifiedSourceCondensedGeneral } from "../../../../evidence/providers/gam/editorial/verified-source-condensed-generals.js";
import { prepareSourceProduct } from "../../../../prepare-product.js";
import { gamTechnicalReviewReferences } from "../../../support/phase1-reviewed-identities.js";
import { verifiedGamUnitSourceGenerals } from "../../../../evidence/providers/gam/general-evidence/verified-unit-source-generals.js";
import { verifiedCanonicalBriefEditorial } from "../../../../evidence/verified-canonical-brief-editorial.js";
import { verifiedFamilyProportionEditorial } from "../../../../evidence/verified-family-proportion-editorial.js";

const verifiedUnitSourceEntries: Readonly<Record<string, { readonly general: string }>> = verifiedGamUnitSourceGenerals;

const checkPreparedGeneral = (reference: string, actual: string | null, previous: string): void => {
  const revised: Readonly<Record<string, { readonly general: string }>> = verifiedCanonicalBriefEditorial;
  const proportionEvidence: Readonly<Record<string, { readonly general: string }>> = verifiedFamilyProportionEditorial;
  const editorial = proportionEvidence[`gam:${reference}`] ?? revised[`gam:${reference}`] ?? verifiedUnitSourceEntries[reference];
  const corrected = reference === "6625"
    ? (editorial?.general ?? previous).replace("1.400 kg de capacidad de carga", "680 kg de capacidad de carga")
    : editorial?.general ?? previous;
  if (editorial) assert.equal(actual, corrected, reference);
  else assert.ok(actual?.includes(corrected), reference);
};

const source = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-catalog.json");
const references = [
  "6186", "6187", "6746", "5900", "5902", "5739", "5937", "6572", "5855", "6311", "6630",
  "6921", "3130", "6776", "2294", "2076", "6974", "6922", "6982", "6272", "2367"
] as const;

const additionalReferences = ["6126", "6228", "6778", "6779", "6859", "6845", "6130", "6937", "6967", "5845", "6912", "6492", "6972", "6983", "6483", "6642", "6886", "6669", "6631", "6984", "6139", "6233"] as const;

const sourceIdentifiedReferences = ["6641", "6640", "6639", "6638", "6880", "6860", "6024", "6950", "6893", "6650", "6634", "6632", "6663", "6997", "6625", "6644", "6436", "6915", "6626", "6372", "6675", "6823"] as const;

const sourceConfirmedHandlingReferences = ["6679", "6704", "6755", "5227", "6662", "6657", "5280", "6885", "5213", "6686", "6684", "5714", "6819", "6821", "6822", "6849", "6878", "5910", "6582", "6601", "6754", "6941"] as const;

const featureReferences = [
  "18", "1022", "6582", "6601", "2085", "6663", "6626", "6754",
  "2027", "2037", "6024", "6625", "4717"
] as const;

const findOriginal = (reference: string): ProductRecord => {
  const record = source.products.find((item) => item.reference === reference);
  assert.ok(record, reference);
  return record;
};

test("GAM: se condensan 21 generales con identidad exacta y sin alterar otros campos", () => {
  assert.equal(new Set(references).size, 21);
  for (const reference of [...references, ...additionalReferences, ...sourceIdentifiedReferences, ...sourceConfirmedHandlingReferences]) {
    const record = findOriginal(reference);
    const snapshot = JSON.stringify(record);
    const general = resolveGamVerifiedSourceCondensedGeneral(record);
    assert.ok(general, reference);
    assert.ok(general.length < (record.longDescription?.length ?? 0) / 2, reference);
    const prepared = prepareSourceProduct(record);
    checkPreparedGeneral(reference, prepared.product.description_general, general);
    assert.equal(prepared.status, (gamTechnicalReviewReferences.has(reference)) ? "review" : "ready", reference);
    assert.equal(prepared.issues.length, (gamTechnicalReviewReferences.has(reference)) ? 1 : 0, reference);
    assert.equal(JSON.stringify(record), snapshot, reference);
  }
});

test("GAM: una modificación de identidad, técnica o de fuente invalida la evidencia", () => {
  for (const reference of [...references, ...additionalReferences, ...sourceIdentifiedReferences, ...sourceConfirmedHandlingReferences]) {
    const record = findOriginal(reference);
    for (const altered of [
      { ...record, reference: `${reference}-alt` },
      { ...record, url: `${record.url}?rev=1` },
      { ...record, title: `${record.title} ALTERNATIVA` },
      { ...record, model: `${record.model ?? ""}-alt` },
      { ...record, shortDescription: `${record.shortDescription ?? ""} edición` },
      { ...record, longDescription: `${record.longDescription ?? ""} edición` },
      { ...record, specs: { ...record.specs, "Altura de elevación (m)": "dato alternativo" } }
    ] satisfies readonly ProductRecord[]) {
      assert.equal(resolveGamVerifiedSourceCondensedGeneral(altered), null, reference);
    }
  }
});

test("GAM: no se aplican textos acreditados a otros proveedores o fichas excluidas", () => {
  for (const reference of ["6004", "4802", "6169", "6171", "6421", "2313"]) {
    assert.equal(resolveGamVerifiedSourceCondensedGeneral(findOriginal(reference)), null, reference);
  }
  assert.equal(resolveGamVerifiedSourceCondensedGeneral({ ...findOriginal("5900"), providerId: "gomariz" }), null);
});


test("GAM: las descripciones verificadas de ocasión preservan identidad y lectura del horómetro", () => {
  assert.equal(new Set(additionalReferences).size, 22);
  for (const reference of additionalReferences) {
    const record = findOriginal(reference);
    const general = resolveGamVerifiedSourceCondensedGeneral(record);
    assert.ok(general, reference);
    assert.ok(general.length < (record.longDescription?.length ?? 0) / 2, reference);
    const serial = record.specs?.["Nº de serie"];
    assert.ok(typeof serial === "string" && general.includes(serial), reference);
    const hour = record.specs?.["Horómetro"];
    if (typeof hour === "string" && hour.includes("sustituido")) assert.ok(general.includes("sustituido"), reference);
    if (hour === "NA horas") assert.ok(general.includes("no acredita"), reference);
    const prepared = prepareSourceProduct(record);
    checkPreparedGeneral(reference, prepared.product.description_general, general);
    assert.equal(prepared.issues.length, (gamTechnicalReviewReferences.has(reference)) ? 1 : 0, reference);
  }
});


test("GAM: la condensación adicional conserva cifras y características de cada unidad", () => {
  assert.equal(new Set(sourceIdentifiedReferences).size, 22);
  for (const reference of sourceIdentifiedReferences) {
    const record = findOriginal(reference);
    const general = resolveGamVerifiedSourceCondensedGeneral(record);
    assert.ok(general, reference);
    const serial = record.specs?.["Nº de serie"];
    assert.ok(typeof serial === "string" && general.includes(serial), reference);
    assert.ok(general.includes(record.year ?? ""), reference);
    const prepared = prepareSourceProduct(record);
    assert.equal(prepared.status, (gamTechnicalReviewReferences.has(reference)) ? "review" : "ready", reference);
    assert.equal(prepared.issues.length, (gamTechnicalReviewReferences.has(reference)) ? 1 : 0, reference);
    checkPreparedGeneral(reference, prepared.product.description_general, general);
    for (const [key, value] of Object.entries(record.specs ?? {})) {
      assert.equal(prepared.product.spec?.[key], key === "Horómetro" ? reconcileGamHorometer(record).specs?.[key] : phase2ExpectedSpecValue(reference, key, value), `${reference}: ${key}`);
    }
  }
});


test("GAM: 22 fichas de manutención conservan datos individuales al condensar textos de origen", () => {
  assert.equal(new Set(sourceConfirmedHandlingReferences).size, 22);
  for (const reference of sourceConfirmedHandlingReferences) {
    const record = findOriginal(reference);
    const general = resolveGamVerifiedSourceCondensedGeneral(record);
    assert.ok(general, reference);
    assert.ok(general.length < (record.longDescription?.length ?? 0) * 0.7, reference);
    const serial = record.specs?.["Nº de serie"];
    assert.ok(typeof serial === "string" && general.includes(serial), reference);
    assert.ok(typeof record.year === "string" && general.includes(record.year), reference);
    const prepared = prepareSourceProduct(record);
    assert.equal(prepared.status, (gamTechnicalReviewReferences.has(reference)) ? "review" : "ready", reference);
    assert.equal(prepared.issues.length, (gamTechnicalReviewReferences.has(reference)) ? 1 : 0, reference);
    checkPreparedGeneral(reference, prepared.product.description_general, general);
    for (const [key, value] of Object.entries(record.specs ?? {})) {
      assert.equal(prepared.product.spec?.[key], key === "Horómetro" ? reconcileGamHorometer(record).specs?.[key] : phase2ExpectedSpecValue(reference, key, value), `${reference}: ${key}`);
    }
  }
});


const sourceVerifiedRemainingReferences = ["6861", "6761", "5848", "5792", "6738", "6664", "6691", "6788", "6627", "6835", "6587", "6951", "6084", "6949", "5228", "5880", "6510", "6123", "6571", "6879", "6977", "6752"] as const;

test("GAM: 22 descripciones pendientes incorporan evidencia individual y conservan los datos técnicos", () => {
  assert.equal(new Set(sourceVerifiedRemainingReferences).size, 22);
  for (const reference of sourceVerifiedRemainingReferences) {
    const record = findOriginal(reference);
    const before = JSON.stringify(record);
    const prepared = prepareSourceProduct(record);
    const general = resolveGamVerifiedSourceCondensedGeneral(record);
    assert.ok(general, reference);
    assert.ok(general.length < (record.longDescription?.length ?? 0) * 0.75, reference);
    assert.ok(general.includes(record.serialNumber ?? ""), reference);
    assert.ok(general.includes(record.year ?? ""), reference);
    checkPreparedGeneral(reference, prepared.product.description_general, general);
    assert.equal(prepared.status, (gamTechnicalReviewReferences.has(reference)) ? "review" : "ready", reference);
    assert.equal(prepared.issues.length, (gamTechnicalReviewReferences.has(reference)) ? 1 : 0, reference);
    assert.equal(JSON.stringify(record), before, reference);
    for (const [key, value] of Object.entries(record.specs ?? {})) {
      assert.equal(prepared.product.spec?.[key], key === "Horómetro" ? reconcileGamHorometer(record).specs?.[key] : phase2ExpectedSpecValue(reference, key, value), `${reference}: ${key}`);
    }
  }
});

test("GAM: 22 descripciones acreditadas no se transfieren a identidades o versiones alteradas", () => {
  for (const reference of sourceVerifiedRemainingReferences) {
    const record = findOriginal(reference);
    for (const altered of [
      { ...record, providerId: "gomariz" },
      { ...record, reference: `${reference}-alt` },
      { ...record, url: `${record.url}?rev=1` },
      { ...record, title: `${record.title} alternativa` },
      { ...record, model: `${record.model ?? ""} alternativa` },
      { ...record, longDescription: `${record.longDescription ?? ""} nueva` },
      { ...record, specs: { ...record.specs, Modelo: "VARIANTE" } }
    ] satisfies readonly ProductRecord[]) {
      assert.equal(resolveGamVerifiedSourceCondensedGeneral(altered), null, reference);
    }
  }
});


const sourcedRemainingUsedReferences = ["6980", "6846", "6945", "6726", "5962", "5719", "6618", "6116", "6486", "6284"] as const;
const sourcedNewMachineReferences = ["2082", "2084", "2085", "2041", "2045", "2046", "2048", "2047", "22", "18", "2027", "2037"] as const;

test("GAM: condensación acreditada preserva identificación de ocasión y prestaciones de modelos nuevos", () => {
  assert.equal(new Set([...sourcedRemainingUsedReferences, ...sourcedNewMachineReferences]).size, 22);
  for (const reference of [...sourcedRemainingUsedReferences, ...sourcedNewMachineReferences]) {
    const record = findOriginal(reference);
    const general = resolveGamVerifiedSourceCondensedGeneral(record);
    assert.ok(general, reference);
    assert.ok(general.length < (record.longDescription?.length ?? 0) * 0.78, reference);
    assert.ok(general.includes(record.model ?? ""), reference);
    if (record.condition === "Segunda mano") {
      assert.ok(general.includes(record.serialNumber ?? ""), reference);
      assert.ok(general.includes(record.year ?? ""), reference);
    } else {
      assert.equal(record.condition, "Nuevo", reference);
      const capacity = record.specs?.["Capacidad de carga (kg)"];
      assert.ok(capacity != null, reference);
      assert.ok(general.includes(String(capacity)), reference);
    }
    const prepared = prepareSourceProduct(record);
    assert.equal(prepared.status, (gamTechnicalReviewReferences.has(reference)) ? "review" : "ready", reference);
    assert.equal(prepared.issues.length, (gamTechnicalReviewReferences.has(reference)) ? 1 : 0, reference);
    checkPreparedGeneral(reference, prepared.product.description_general, general);
    for (const [key, value] of Object.entries(record.specs ?? {})) {
      assert.equal(prepared.product.spec?.[key], key === "Horómetro" ? reconcileGamHorometer(record).specs?.[key] : phase2ExpectedSpecValue(reference, key, value), `${reference}: ${key}`);
    }
    assert.equal(resolveGamVerifiedSourceCondensedGeneral({ ...record, title: `${record.title} otra variante` }), null, reference);
    assert.equal(resolveGamVerifiedSourceCondensedGeneral({ ...record, specs: { ...record.specs, Modelo: "otra variante" } }), null, reference);
  }
});


const additionalSourceCondensedReferences = [
  "6976", "6975", "6966", "6391", "6858",
  "6947", "5961", "6196", "6195", "6122",
  "4717", "3802", "4814", "2086", "2065",
  "2293", "157", "4741", "4745", "4747",
] as const;

test("GAM: la evidencia editorial posterior conserva identidad, original y especificaciones", () => {
  assert.equal(new Set(additionalSourceCondensedReferences).size, 20);
  for (const reference of additionalSourceCondensedReferences) {
    const record = findOriginal(reference);
    const originalSnapshot = JSON.stringify(record);
    const general = resolveGamVerifiedSourceCondensedGeneral(record);
    assert.ok(general, reference);
    assert.ok(general.length < (record.longDescription?.length ?? 0) * 0.76, reference);
    assert.ok(general.includes(record.model ?? ""), reference);
    if (record.condition === "Segunda mano") {
      assert.ok(general.includes(record.year ?? ""), reference);
      assert.ok(general.includes(record.serialNumber ?? ""), reference);
    }
    const prepared = prepareSourceProduct(record);
    assert.equal(prepared.status, (gamTechnicalReviewReferences.has(reference)) ? "review" : "ready", reference);
    assert.equal(prepared.issues.length, (gamTechnicalReviewReferences.has(reference)) ? 1 : 0, reference);
    checkPreparedGeneral(reference, prepared.product.description_general, general);
    assert.equal(JSON.stringify(record), originalSnapshot, reference);
    for (const [key, value] of Object.entries(record.specs ?? {})) {
      assert.equal(prepared.product.spec?.[key], key === "Horómetro" ? reconcileGamHorometer(record).specs?.[key] : phase2ExpectedSpecValue(reference, key, value), `${reference}: ${key}`);
    }
    for (const altered of [
      { ...record, url: `${record.url}?other=1` },
      { ...record, title: `${record.title} otra variante` },
      { ...record, specs: { ...record.specs, Modelo: "OTRO" } }
    ] satisfies readonly ProductRecord[]) {
      assert.equal(resolveGamVerifiedSourceCondensedGeneral(altered), null, reference);
    }
  }
});


test("GAM: las mejoras de contexto técnico verificadas conservan la identidad original", () => {
  for (const reference of featureReferences) {
    const record = findOriginal(reference);
    const snapshot = JSON.stringify(record);
    const general = resolveGamVerifiedSourceCondensedGeneral(record);
    assert.ok(general, reference);
    const prepared = prepareSourceProduct(record).product;
    checkPreparedGeneral(reference, prepared.description_general, general);
    assert.equal(JSON.stringify(record), snapshot, reference);
    for (const altered of [
      { ...record, url: `${record.url}?revision=1` },
      { ...record, longDescription: `${record.longDescription ?? ""} otra variante` },
      { ...record, specs: { ...record.specs, "Dato adicional": "nuevo" } }
    ] satisfies readonly ProductRecord[]) {
      assert.equal(resolveGamVerifiedSourceCondensedGeneral(altered), null, reference);
    }
  }
});

const additionalVerifiedEditorial = [
  ["2087", "ruedas superelásticas, neumáticas y radiales"],
  ["2058", "100 l/min y presión de 195 bar"],
  ["2060", "100 l/min a 195 bar"],
  ["2068", "100 l/min y 195 bar"],
  ["2066", "100 l/min de caudal hidráulico y 195 bar"],
] as const;

test("GAM: fase 125 recupera cinco detalles técnicos editoriales individuales", () => {
  assert.equal(new Set(additionalVerifiedEditorial.map(([reference]) => reference)).size, 5);
  for (const [reference, marker] of additionalVerifiedEditorial) {
    const record = findOriginal(reference);
    const before = structuredClone(record);
    const general = resolveGamVerifiedSourceCondensedGeneral(record);
    assert.ok(general?.includes(marker), reference);
    const prepared = prepareSourceProduct(record);
    assert.equal(prepared.status, (gamTechnicalReviewReferences.has(reference)) ? "review" : "ready", reference);
    assert.ok(prepared.product.description_general?.includes(marker), reference);
    for (const [key, value] of Object.entries(record.specs ?? {})) {
      assert.equal(prepared.product.spec[key], value, `${reference}: ${key}`);
    }
    assert.deepEqual(record, before, reference);
    for (const altered of [
      { ...record, providerId: "gomariz" },
      { ...record, reference: `${reference}-otro` },
      { ...record, url: `${record.url}?variante=otra` },
      { ...record, title: `${record.title} variante"` },
      { ...record, model: "MODELO-DISTINTO" },
      { ...record, longDescription: `${record.longDescription ?? ""} texto alterado` },
      { ...record, specs: { ...record.specs, Marca: "OTRA" } }
    ] satisfies readonly ProductRecord[]) {
      assert.equal(resolveGamVerifiedSourceCondensedGeneral(altered), null, `${reference}: variante`);
    }
  }
});


test("GAM: descripciones extensas 6002 y 6003 se sintetizan sin perder capacidades ni características", () => {
  for (const [reference, model, capacity, length, weight, turnRadius] of [
    ["6002", "J5.0XTLG6", "5.000 kg", "4.715", "8.510", "3.250"],
    ["6003", "J6.0XTLG6", "6.000 kg", "4.785", "9.185", "3.300"]
  ] as const) {
    const record = findOriginal(reference);
    const original = structuredClone(record);
    const general = resolveGamVerifiedSourceCondensedGeneral(record);
    assert.ok(general, reference);
    assert.ok(record.longDescription);
    assert.ok(record.longDescription.split(/\s+/u).length > 2_000, reference);
    assert.ok(general.split(/\s+/u).length < 300, reference);
    const prepared = prepareSourceProduct(record);
    assert.equal(prepared.status, "ready", reference);
    assert.ok(prepared.product.description_general);
    assert.ok(prepared.product.description_general.split(/\s+/u).length < 500, reference);
    for (const value of [model, capacity, "600 mm", "3.000 mm", length, weight, turnRadius,
      "80,8 kWh", "230 mm", "200 mm", "IPX4", "imanes permanentes", "por agua",
      "recargas parciales", "calentamiento automático", "ruedas delanteras dobles", "sistema de presencia"]) {
      assert.ok(prepared.product.description_general.includes(value), `${reference}: ${value}`);
    }
    assert.equal(prepared.product.spec.Marca, "HYSTER", reference);
    assert.deepEqual(record, original, reference);
    for (const altered of [
      { ...record, providerId: "gomariz" },
      { ...record, reference: `${reference}-otro` },
      { ...record, url: `${record.url}?version=2` },
      { ...record, title: `${record.title} otra variante` },
      { ...record, model: "OTRO" },
      { ...record, longDescription: `${record.longDescription} edición` },
      { ...record, specs: { ...record.specs, "Capacidad de carga (kg)": "OTRA" } },
      { ...record, brand: "HYSTER" },
      { ...record, condition: "Segunda mano" }
    ] satisfies readonly ProductRecord[]) {
      assert.equal(resolveGamVerifiedSourceCondensedGeneral(altered), null, reference);
    }
  }
});
