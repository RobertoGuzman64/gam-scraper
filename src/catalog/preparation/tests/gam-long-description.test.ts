import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { readCanonicalCatalog } from "../../../infrastructure/filesystem/catalog/canonical-catalog.js";
import { removeGamDetachedAffirmatives, removeGamOrphanAffirmative, removeGamResidualEditorialArtifacts, resolveGamLongDescription } from "../mapping/providers/gam/long-description.js";
import { resolveGamResidualConciseShort } from "../mapping/providers/gam/short-description.js";
import { resolveGamCondensedGeneral } from "../mapping/providers/gam/verified-condensed-general.js";
import { resolveGamHysterCondensedGeneral, resolveGamHysterCondensedShort } from "../mapping/providers/gam/verified-condensed-hyster.js";
import { resolveGamAdditionalCondensedGeneral, resolveGamAdditionalCondensedShort } from "../mapping/providers/gam/verified-condensed-additional.js";
import { resolveGamVerifiedConciseGeneral } from "../mapping/providers/gam/verified-concise-long.js";
import { prepareSourceProduct } from "../prepare-product.js";
import { resolveGamVerifiedSourceCondensedGeneral } from "../evidence/providers/gam/verified-source-condensed-generals.js";

const gam = await readCanonicalCatalog("catalogs/providers/gam/original/scrape-gam-marzo-2026-catalog.json");
const find = (reference: string): ProductRecord => {
  const record = gam.products.find((item) => item.reference === reference);
  assert.ok(record, reference);
  return record;
};

const changedReferences = new Set([
  "6963", "4988", "5988", "4989", "5989", "4990", "5990", "4991", "5998", "5993",
  "5999", "6000", "5994", "6001", "5995", "5996", "5997", "6480", "6481", "6990", "6991"
]);

const sourceSentences = (text: string): string[] => text.trim()
  .split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÑ¿])/u).map((sentence) => sentence.trim()).filter(Boolean);
const numbers = (text: string): string[] => [...new Set(text.match(/\d+(?:[.,]\d+)*/gu) ?? [])].sort();
const wordCount = (text: string): number => text.trim().split(/\s+/u).filter(Boolean).length;

test("GAM: las generales extensas se organizan sin perder cifras, frases técnicas ni orden", () => {
  const changed: string[] = [];
  let trimmed = 0;
  let removedWords = 0;
  for (const record of gam.products) {
    const snapshot = JSON.stringify(record);
    const general = resolveGamLongDescription(record);
    if (general) {
      assert.ok(record.reference);
      changed.push(record.reference);
      assert.ok(record.longDescription);
      assert.ok(general.includes("\n\n"));
      assert.deepEqual(numbers(general), numbers(record.longDescription), record.reference);
      const originalSentences = sourceSentences(record.longDescription);
      let previousIndex = -1;
      for (const sentence of sourceSentences(general)) {
        const index = originalSentences.findIndex((candidate, at) => at > previousIndex && candidate === sentence);
        assert.ok(index > previousIndex, `${record.reference}: frase nueva o desordenada`);
        previousIndex = index;
      }
      const difference = wordCount(record.longDescription) - wordCount(general);
      assert.ok(difference >= 0);
      if (difference > 0) trimmed++;
      removedWords += difference;
      const prepared = prepareSourceProduct(record);
      const baseGeneral = removeGamOrphanAffirmative(record, general) ?? removeGamDetachedAffirmatives(record, general) ?? general;
      const finalGeneral = removeGamResidualEditorialArtifacts(record, baseGeneral) ?? baseGeneral;
      const previousGeneral = resolveGamCondensedGeneral(record) ?? resolveGamAdditionalCondensedGeneral(record) ?? resolveGamHysterCondensedGeneral(record) ?? finalGeneral;
      if (record.reference === "5988") {
        assert.match(prepared.product.description_general ?? "", /Yale ERP2\.0MXLG/u);
        assert.match(prepared.product.description_general ?? "", /3\.000 mm/u);
        assert.match(prepared.product.description_general ?? "", /4,4 metros/u);
        assert.match(prepared.product.description ?? "", /3\.000 mm/u);
      } else {
        assert.equal(prepared.product.description_general, resolveGamVerifiedSourceCondensedGeneral(record) ?? resolveGamVerifiedConciseGeneral(record, previousGeneral) ?? previousGeneral);
        assert.equal(prepared.product.description,
          resolveGamAdditionalCondensedShort(record) ?? resolveGamHysterCondensedShort(record) ?? resolveGamResidualConciseShort(record, general) ?? record.shortDescription?.trim() ?? null);
      }
      assert.deepEqual(numbers(finalGeneral), numbers(general), record.reference);
      const addedSpecs = record.reference === "6963"
        ? { "Altura de trabajo (m)": "7,8 m", "Capacidad de carga (kg)": "280 KG", "Anchura (mm)": "810 mm" }
        : record.reference === "6480" || record.reference === "6481" ? { "Radio de giro (mm)": "1455 mm" } : {};
      const speed = ["5993", "5994"].includes(record.reference)
        ? { "Velocidad de desplazamiento (km/h)": "18 km/h" }
        : ["5995", "5996", "5997"].includes(record.reference)
        ? { "Velocidad de desplazamiento con/sin carga (km/h)": "19 / 20 km/h" }
        : ["6480", "6481"].includes(record.reference)
          ? { "Velocidad de desplazamiento con/sin carga (km/h)": "4 / 4,5 km/h" } : {};
      const power = ["5993", "5994", "5995", "5996", "5997"].includes(record.reference ?? "")
        ? {
          "Potencia de tracción (kW)": ["5993", "5994"].includes(record.reference ?? "") ? "30 kW" : "40 kW",
          "Potencia de elevación (kW)": ["5993", "5994"].includes(record.reference ?? "") ? "25 kW" : "40 kW"
        }
        : ["6480", "6481"].includes(record.reference ?? "") ? { "Potencia de elevación (kW)": "2,5 kW" } : {};
      const battery = record.reference === "6963" ? ["24 V", "75 Ah"] :
        ["5993", "5994"].includes(record.reference ?? "") ? ["154,5 V", "302 Ah"] :
          ["5995", "5996", "5997"].includes(record.reference ?? "") ? ["354,2 V", "228 Ah"] : null;
      const clearanceByReference: Readonly<Record<string, number>> = {
        "5988": 130, "5989": 130, "5990": 155, "5993": 186, "5999": 186,
        "6000": 186, "5994": 186, "6001": 230, "5995": 230, "5996": 230, "5997": 230
      };
      const clearance = record.reference ? clearanceByReference[record.reference] : undefined;
      const expectedSpecs = { ...record.specs, ...addedSpecs, ...speed, ...power,
        ...(battery === null ? {} : { "Voltaje batería (V)": battery[0], "Capacidad de la batería (Ah)": battery[1] }),
        ...(["6480", "6481", "6990", "6991"].includes(record.reference ?? "") ? { "Centro de carga (mm)": "600 mm" } : {}),
        ...(clearance === undefined ? {} : { "Altura al suelo (mm)": `${clearance} mm` }) };
      for (const [key, value] of Object.entries(expectedSpecs)) {
        assert.deepEqual(prepared.product.spec[key], value, `${record.reference}: ${key}`);
      }
      assert.equal(prepared.product.reference, record.reference);
      assert.equal(prepared.product.sourceUrl, record.url);
    }
    assert.equal(JSON.stringify(record), snapshot);
  }
  assert.equal(gam.products.length, 983);
  assert.deepEqual(new Set(changed), changedReferences);
  assert.equal(trimmed, 21);
  assert.ok(removedWords > 10000, `síntesis insuficiente: ${removedWords} palabras`);
});

test("GAM: las generales gigantes mantienen los hechos técnicos y dejan de ser extremas", () => {
  for (const reference of ["5989", "5990", "5993", "5994", "5995", "5996", "5997", "5999", "6000", "6001"]) {
    const record = find(reference);
    const summary = resolveGamLongDescription(record);
    assert.ok(summary, reference);
    assert.ok(record.longDescription);
    assert.ok(wordCount(summary) <= 800, reference);
    assert.deepEqual(numbers(summary), numbers(record.longDescription), reference);
    assert.ok(summary.includes(record.model ?? ""), reference);
    assert.match(summary, /bater[ií]a|litio/iu, reference);
    assert.match(summary, /capacidad de carga/iu, reference);
  }
});

test("GAM: los dos extremos mantienen identidad, medidas, capacidades y datos energéticos", () => {
  for (const reference of ["5996", "5997"]) {
    const original = find(reference);
    const result = resolveGamLongDescription(original);
    assert.ok(result);
    assert.ok(original.longDescription);
    for (const fragment of [original.model ?? "", "80,8 kWh", "354,2 V", "228 Ah", "IPX4", "3.000 mm", "600 mm"]) {
      assert.ok(result.includes(fragment), `${reference}: ${fragment}`);
    }
    assert.ok(wordCount(result) < wordCount(original.longDescription));
  }
});

test("GAM: bloquea identidad ajena, referencias y fichas técnicas contradictorias", () => {
  const record = find("5996");
  const variants: readonly ProductRecord[] = [
    { ...record, providerId: "gomariz" },
    { ...record, condition: "Segunda mano" },
    { ...record, categoryKey: "otros" },
    { ...record, reference: "5997" },
    { ...record, url: record.url.replace("online.gamrentals.com", "example.com") },
    { ...record, url: `${record.url}?tracking=1` },
    { ...record, title: "Carretilla elevadora eléctrica 6000KG Hyster ERP6.0MXLG6" },
    { ...record, model: "ERP7.0MXLG6" },
    { ...record, brand: "HYSTER" },
    { ...record, externalReference: "ERP7.0MXLG6" },
    { ...record, specs: { ...record.specs, Modelo: "ERP7.0MXLG6" } },
    { ...record, specs: { ...record.specs, Marca: "HYSTER" } },
    { ...record, specs: { ...record.specs, Marca: ["YALE"] } },
    { ...record, longDescription: "Descripción general correcta y breve." }
  ];
  for (const [index, variant] of variants.entries()) {
    assert.equal(resolveGamLongDescription(variant), null, String(index));
  }
  for (const reference of ["5991", "5992", "6002", "6003", "6004"]) {
    assert.equal(resolveGamLongDescription(find(reference)), null, reference);
  }
});

test("GAM: protege una prestación no repetida aunque aparezca dentro de un cierre comercial", () => {
  const record = find("5996");
  assert.ok(record.longDescription);
  const source = record.longDescription.replace(
    "Por todo ello, la Yale ERP6.0MXLG6 constituye una alternativa",
    "Por todo ello, la Yale ERP6.0MXLG6 con frenado regenerativo certificado constituye una alternativa"
  );
  assert.notEqual(source, record.longDescription);
  const result = resolveGamLongDescription({ ...record, longDescription: source });
  assert.ok(result);
  assert.ok(result.includes("frenado regenerativo certificado"));
});

test("GAM: la regla no interviene en el catálogo Gomariz", async () => {
  const gomariz = await readCanonicalCatalog("catalogs/providers/gomariz/original/scrape-gomariz-catalog.json");
  assert.equal(gomariz.products.length, 143);
  for (const record of gomariz.products) assert.equal(resolveGamLongDescription(record), null);
});
