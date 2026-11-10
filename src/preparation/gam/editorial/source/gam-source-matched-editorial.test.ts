import { reconcileGamHorometer } from "../../technical/reconciliation/gam-horometer.js";
import { phase2ExpectedSpecValue } from "../../../testing/phase2-basket-dimensions.js";
import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { resolveGamVerifiedSourceMatchedEditorial } from "./verified-source-matched-editorial.js";
import { verifiedCanonicalBriefEditorial } from "../../../shared/editorial/evidence/verified-canonical-brief-editorial.js";
import { verifiedGamSourceMatchedGenerals } from "./verified-source-matched-generals.js";

const gam = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-catalog.json");
const additional = new Set(["6206", "6817", "6585", "6545", "6707", "4776", "2159", "2061", "2049", "2172", "2241", "2649", "1022", "2138", "2167", "2168", "2173", "2162", "2183", "2074", "2016", "2028"]);
const revisedShorts = new Set(["6585", "2159", "2049", "2168", "2162", "2016"]);
const normalizedSpecValues: Readonly<Record<string, Readonly<Record<string, string | undefined>>>> = {
  "2300": { "Centro de carga": undefined, "Radio de giro": undefined, "Capacidad de la batería": undefined },
  "2301": { "Centro de carga": undefined, "Radio de giro": undefined, "Capacidad de la batería": undefined },
  "2302": { "Altura Plataforma": "4920 mm" },
  "2241": { "Centro de carga": undefined }
};
const selected = new Set(["2148", "6190", "6192", "6191", "6163", "2300", "5899", "2292", "2211", "6542", "2301", "2232", "4725", "2050", "3134", "2302", "2365", "52", "53", "5081"]);

const find = (reference: string): ProductRecord => {
  const record = gam.products.find((item) => item.reference === reference);
  assert.ok(record, reference);
  return record;
};

test("las redacciones verificadas preservan el original y las especificaciones de la preparación", () => {
  for (const reference of selected) {
    const record = find(reference);
    const initial = JSON.stringify(record);
    const result = prepareSourceProduct(record).product;
    const revised: Readonly<Record<string, { readonly general: string }>> = verifiedCanonicalBriefEditorial;
    const editorial = revised[`gam:${reference}`];
    if (editorial) {
      assert.equal(result.description_general, editorial.general, reference);
      assert.ok(result.description_general.length >= 200 && result.description_general.length < 900, reference);
    } else {
      assert.ok(result.description_general && result.description_general.length >= 200 && result.description_general.length < 650, reference);
    }
    assert.ok(record.longDescription && result.description_general.length < record.longDescription.length / 2, reference);
    assert.equal(JSON.stringify(record), initial, reference);
    for (const [key, value] of Object.entries(record.specs ?? {})) {
      const normalized = normalizedSpecValues[reference];
      const expected = normalized && Object.prototype.hasOwnProperty.call(normalized, key) ? normalized[key] :
        key === "Horómetro" ? reconcileGamHorometer(record).specs?.[key] :
        reference === "2016" && key === "Capacidad de carga (kg)"
        ? "1800 KG"
        : phase2ExpectedSpecValue(reference, key, value);
      assert.equal(result.spec[key], expected, `${reference}: ${key}`);
    }
  }
  for (const [reference, weight] of [["2300", "2280 kg"], ["2301", "2360 kg"]] as const) {
    const prepared = prepareSourceProduct(find(reference)).product;
    assert.equal(prepared.spec["Altura de elevación (mm)"], "5076 mm");
    assert.equal(prepared.spec.Peso, weight);
    assert.equal(prepared.spec["Batería (V / Ah)"], "24 V / 400 Ah");
  }
  assert.doesNotMatch(prepareSourceProduct(find("2148")).product.description_general ?? "", /Hyster RP2\.5N/);
  assert.doesNotMatch(prepareSourceProduct(find("5899")).product.description_general ?? "", /CTE ZED 14/);
  assert.doesNotMatch(prepareSourceProduct(find("2292")).product.description ?? "", /apilador/i);
  assert.match(prepareSourceProduct(find("2050")).product.description_general ?? "", /Hyster H32XD-9/);
});

test("la evidencia editorial no se traslada a otra fuente, identidad ni versión de preparación", () => {
  const record = find("2148");
  const product = prepareSourceProduct(record).product;
  assert.equal(resolveGamVerifiedSourceMatchedEditorial(record, product.description, product.description_general), null);
  const variants: readonly ProductRecord[] = [
    { ...record, providerId: "gomariz" },
    { ...record, reference: "2147" },
    { ...record, url: `${record.url}?revision=otra` },
    { ...record, title: "Otro producto" },
    { ...record, model: "RP2.5N" },
    { ...record, longDescription: "Descripción cambiada" },
    { ...record, specs: { ...record.specs, "Capacidad de carga (kg)": "2500 KG" } }
  ];
  for (const changed of variants) assert.notEqual(prepareSourceProduct(changed).product.description_general, product.description_general);
});

test("las fichas adicionales conservan identidad, especificaciones y contenido individual", () => {
  for (const reference of additional) {
    const record = find(reference);
    const original = JSON.stringify(record);
    const result = prepareSourceProduct(record).product;
    assert.ok(result.description_general && result.description_general.length >= 200, reference);
    assert.ok(record.longDescription && result.description_general.length < record.longDescription.length, reference);
    assert.notEqual(result.description_general, record.longDescription, reference);
    assert.equal(JSON.stringify(record), original, reference);
    for (const [key, value] of Object.entries(record.specs ?? {})) {
      const normalized = normalizedSpecValues[reference];
      const expected = normalized && Object.prototype.hasOwnProperty.call(normalized, key) ? normalized[key] :
        key === "Horómetro" ? reconcileGamHorometer(record).specs?.[key] :
        reference === "2016" && key === "Capacidad de carga (kg)"
        ? "1800 KG"
        : phase2ExpectedSpecValue(reference, key, value);
      assert.equal(result.spec[key], expected, `${reference}: ${key}`);
    }
    if (reference === "2241") assert.equal(result.spec["Altura de elevación (mm)"], "8895 mm");
    if (revisedShorts.has(reference)) assert.ok(result.description && !result.description.includes("➨"), reference);
  }
});

test("la cohorte adicional no se aplica a fuentes o especificaciones alteradas", () => {
  for (const reference of ["6206", "2159", "2168", "6585"]) {
    const record = find(reference);
    const current = prepareSourceProduct(record).product.description_general;
    const variants: readonly ProductRecord[] = [
      { ...record, providerId: "gomariz" },
      { ...record, url: `${record.url}?otra=1` },
      { ...record, model: "MODELO INEXISTENTE" },
      { ...record, longDescription: `${record.longDescription ?? ""} Texto añadido.` },
      { ...record, specs: { ...record.specs, "Capacidad de carga (kg)": "0 KG" } }
    ];
    for (const variant of variants) assert.notEqual(prepareSourceProduct(variant).product.description_general, current);
  }
});

test("GAM: aclara cuatro modelos de origen sin equiparar variantes y sin alterar otras fichas", () => {
  const cases = [
    ["2180", ["S1.6 SL", "S1.6SSL", "1.600 kg"]],
    ["4792", ["XGS58E", "XGS58E1", "58,6 metros", "450 kg con restricciones"]],
    ["4736", ["XG0807ACW-LI", "XG0807AC-LI", "batería de litio"]],
    ["6909", ["SJIII-3220", "SJIII-3220M", "363", "400 kg"]]
  ] as const;
  const expected = new Set(cases.map(([reference]) => reference));
  for (const [reference, fragments] of cases) {
    const record = find(reference);
    const before = JSON.stringify(record);
    const prepared = prepareSourceProduct(record);
    const evidence = verifiedGamSourceMatchedGenerals[reference];
    assert.equal(prepared.status, "ready", reference);
    assert.equal(prepared.product.description_general, evidence.general, reference);
    assert.ok(prepared.product.description_general);
    for (const fragment of fragments) assert.ok(prepared.product.description_general.includes(fragment), `${reference}:${fragment}`);
    assert.equal(JSON.stringify(record), before, reference);
    assert.deepEqual(prepared.product.spec.Marca, record.specs?.Marca, reference);
    for (const variant of [
      { ...record, reference: "0" },
      { ...record, url: `${record.url}?revision=otra` },
      { ...record, model: "VARIANTE NO ACREDITADA" },
      { ...record, longDescription: `${record.longDescription ?? ""} Otro texto.` },
      { ...record, specs: { ...record.specs, Modelo: "VARIANTE NO ACREDITADA" } }
    ] satisfies readonly ProductRecord[]) {
      assert.notEqual(prepareSourceProduct(variant).product.description_general, evidence.general, reference);
    }
  }
  assert.equal(expected.size, 4);
});

test("GAM 1219 recupera el equipamiento descrito por el proveedor sin extrapolar la potencia", () => {
  const original = find("1219");
  const before = JSON.stringify(original);
  const prepared = prepareSourceProduct(original);
  const general = verifiedGamSourceMatchedGenerals["1219"].general;
  assert.equal(prepared.status, "ready");
  assert.equal(prepared.product.description_general, general);
  assert.match(general, /combustible.*inyecci[oó]n directa|inyecci[oó]n directa.*combustible/iu);
  for (const detail of ["insonorizado", "antivibratorios", "aceite", "turbocompresores", "radiador"]) {
    assert.ok(general.includes(detail), detail);
  }
  assert.doesNotMatch(general, /GSW815P|3213 kWA/iu);
  assert.ok(!general.trimEnd().endsWith(":"));
  assert.deepEqual(prepared.product.spec["Modelo"], original.specs?.["Modelo"]);
  assert.equal(JSON.stringify(original), before);
  for (const variant of [
    { ...original, reference: "1218" },
    { ...original, url: `${original.url}?actualizado=1` },
    { ...original, model: "GSW1270M" },
    { ...original, longDescription: `${original.longDescription ?? ""} Otro dato.` },
    { ...original, specs: { ...original.specs, "Marca motor": "Otro motor" } }
  ] satisfies readonly ProductRecord[]) {
    assert.notEqual(prepareSourceProduct(variant).product.description_general, general);
  }
});
