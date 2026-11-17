import assert from "node:assert/strict";
import test from "node:test";
import type { PublicationDifference } from "../active-publication.js";
import type { ProductRecord } from "../../contracts/catalog.js";
import type { ImportCandidate } from "../../commercial/legacy-export/contracts.js";
import { evaluatePublicationDifference } from "../publication-acceptance.js";

const base: PublicationDifference = {
  previous: "a".repeat(64), candidate: "b".repeat(64), previousProducts: 2, candidateProducts: 3,
  added: ["ref:4"], removed: [], modified: ["ref:1"], lostDescriptions: [], removedSpecifications: [],
  addedSpecifications: [], changedSpecifications: [], lostSpecificationValues: [], changedSources: []
};

test("se aceptan altas y transformaciones sin pérdidas estructurales", () => {
  assert.deepEqual(evaluatePublicationDifference(base), { accepted: true, blockers: [] });
});

test("se bloquean bajas de fichas, descripciones y especificaciones sin acreditación", () => {
  const evaluation = evaluatePublicationDifference({
    ...base, removed: ["ref:2"], lostDescriptions: ["ref:1:description_general"],
    removedSpecifications: ["ref:1:Horas laborales"]
  });
  assert.equal(evaluation.accepted, false);
  assert.equal(evaluation.blockers.length, 3);
  assert.match(evaluation.blockers[0] ?? "", /ref:2/);
  assert.match(evaluation.blockers[1] ?? "", /description_general/);
  assert.match(evaluation.blockers[2] ?? "", /Horas laborales/);
});


test("se bloquean los valores técnicos vaciados y los cambios de procedencia", () => {
  const evaluation = evaluatePublicationDifference({
    ...base, lostSpecificationValues: ["ref:1:Altura de trabajo"], changedSources: ["ref:1"]
  });
  assert.equal(evaluation.accepted, false);
  assert.equal(evaluation.blockers.length, 2);
});

test("FINISH admite únicamente exclusiones individuales GAM aprobadas y horómetros sin lectura", async () => {
  const { differenceBetween } = await import("../active-publication.js");
  const { evaluateIndividualPublicationDifference } = await import("../publication-acceptance.js");
  const sourceUrl = "https://online.gamrentals.com/es/maquina/6642";
  const removed = {
    providerId: "gam", reference: "6642", sourceUrl,
    title: "Máquina", categorySellID: null, category: null, condition: "Segunda_Mano" as const,
    price: null, description_title: null, description: "Ficha técnica", description_general: "Información técnica",
    image: null, images: [], spec: { "Capacidad": "200 kg" }, attributes: []
  };
  const unavailable = { ...removed, reference: "6775", sourceUrl: "https://online.gamrentals.com/es/maquina/6775",
    spec: { "Horómetro": "NA V72309090022 horas", "Capacidad": "200 kg" } };
  const previous = [removed, unavailable];
  const next = [{ ...unavailable, spec: { "Capacidad": "200 kg" } }];
  const approval = {
    version: 1, runId: `individual-gam-${"a".repeat(32)}`, approved: true,
    approvalReason: "Exclusiones acreditadas para la publicación individual",
    sources: [{ providerId: "gam", catalogSha256: "a".repeat(64), preparationSha256: "b".repeat(64) }], exclusions: [{
      providerId: "gam", reference: "6642", sourceUrl, status: "review",
      decision: "excluir", reason: "Dimensión no acreditada en el origen",
      evidenceUrls: [sourceUrl], issues: ["Dimensiones Cesta no acreditables"]
    }]
  };
  const difference = differenceBetween("a", "b", previous, next);
  assert.deepEqual(difference.removed, ["ref:6642"]);
  assert.deepEqual(difference.removedSpecifications, ["ref:6775:Horómetro"]);
  assert.deepEqual(evaluateIndividualPublicationDifference("gam", difference, previous, next, approval), {
    accepted: true, blockers: []
  });
  assert.equal(evaluateIndividualPublicationDifference("gomariz", difference, previous, next, approval).accepted, false);
  assert.equal(evaluateIndividualPublicationDifference("gam", difference, previous, next, null).accepted, false);
  assert.equal(evaluateIndividualPublicationDifference("gam", difference, previous, next, {
    ...approval, exclusions: [{ ...approval.exclusions[0], evidenceUrls: ["https://example.com/otra-maquina"] }]
  }).accepted, false);
  assert.equal(evaluateIndividualPublicationDifference("gam", difference, previous, next, {
    ...approval, exclusions: []
  }).accepted, false);
  const numeric = [{ ...unavailable, spec: { "Horómetro": "1780 horas", "Capacidad": "200 kg" } }];
  const forbiddenDifference = differenceBetween("a", "b", [removed, ...numeric], next);
  const forbidden = evaluateIndividualPublicationDifference("gam", forbiddenDifference, [removed, ...numeric], next, approval);
  assert.equal(forbidden.accepted, false);
  assert.match(forbidden.blockers.join(" "), /Horómetro/);
});

test("la equivalencia de horómetro no autoriza vaciar otros campos ni cambiar fuentes", async () => {
  const { evaluateIndividualPublicationDifference } = await import("../publication-acceptance.js");
  const difference: PublicationDifference = {
    ...base, removedSpecifications: ["ref:6775:Horómetro"],
    lostDescriptions: ["ref:6775:description_general"],
    changedSources: ["ref:6775"]
  };
  const evaluation = evaluateIndividualPublicationDifference("gam", difference, [], [], null);
  assert.equal(evaluation.accepted, false);
  assert.equal(evaluation.blockers.length, 3);
});

test("Gomariz admite solo las once ausencias históricas verificadas contra el origen actual", async () => {
  const { differenceBetween } = await import("../active-publication.js");
  const { evaluateIndividualPublicationDifference } = await import("../publication-acceptance.js");
  const oldUrl = "https://www.gomarizrent.com/venta/manipulacion-de-materiales/manipulador-telescopico/genie-gth-2506-5/";
  const previous: ImportCandidate = {
    providerId: "gomariz", reference: "MT1579", sourceUrl: oldUrl, title: "Manipulador", categorySellID: null,
    category: null, condition: null, price: null, description_title: null, description: null,
    description_general: null, image: null, images: [], spec: { "Peso": "4580 kg" }, attributes: []
  };
  const baseOriginal: ProductRecord = {
    providerId: "gomariz", categoryKey: "maquinaria", categoryName: "Maquinaria", reference: "NUEVA",
    url: "https://www.gomarizrent.com/venta/nueva", title: "Máquina nueva", shortDescription: null,
    longDescription: null, price: null, brand: null, model: null, year: null, location: null,
    country: null, horometer: null, serialNumber: null, image: null
  };
  const difference = differenceBetween("anterior", "nuevo", [previous], []);
  assert.equal(evaluateIndividualPublicationDifference("gomariz", difference, [previous], [], null, [baseOriginal]).accepted, true);
  assert.equal(evaluateIndividualPublicationDifference("gomariz", difference, [previous], [], null).accepted, false);
  assert.equal(evaluateIndividualPublicationDifference("gam", difference, [previous], [], null, [baseOriginal]).accepted, false);
  for (const original of [
    { ...baseOriginal, reference: "MT1579" },
    { ...baseOriginal, url: oldUrl },
    { ...baseOriginal, providerId: "gam" }
  ]) {
    assert.equal(evaluateIndividualPublicationDifference("gomariz", difference, [previous], [], null, [original]).accepted, false);
  }
  const changed = { ...previous, sourceUrl: "https://example.com/otro-origen" };
  const changedDifference = differenceBetween("anterior", "nuevo", [changed], []);
  assert.equal(evaluateIndividualPublicationDifference("gomariz", changedDifference, [changed], [], null, [baseOriginal]).accepted, false);
  const unknown = { ...previous, reference: "DESCONOCIDA" };
  const unknownDifference = differenceBetween("anterior", "nuevo", [unknown], []);
  assert.equal(evaluateIndividualPublicationDifference("gomariz", unknownDifference, [unknown], [], null, [baseOriginal]).accepted, false);
});

test("las once ausencias de la publicación histórica Gomariz no están en el original canónico vigente", async () => {
  const { resolve } = await import("node:path");
  const { readPortableOriginal } = await import("../../infrastructure/filesystem/catalog/portable-original.js");
  const { resolveAccreditedPublication, readAccreditedPublication } = await import("../../infrastructure/filesystem/catalog/accredited-publication.js");
  const { differenceBetween } = await import("../active-publication.js");
  const { evaluateIndividualPublicationDifference } = await import("../publication-acceptance.js");
  const root = resolve(process.cwd());
  const current = await readPortableOriginal(root, "gomariz");
  const path = await resolveAccreditedPublication(root, "gomariz");
  assert.ok(path);
  const previous = (await readAccreditedPublication(path)).products;
  const references = new Set(current.products.flatMap((item) =>
    item.reference?.trim() ? [item.reference.trim().toLowerCase()] : []));
  const selected = previous.filter((item) => item.reference && references.has(item.reference.trim().toLowerCase()));
  const difference = differenceBetween("vigente", "nuevo", previous, selected);
  assert.deepEqual([...difference.removed].sort(), [
    "ref:mt1579", "ref:te61", "ref:ba1347", "ref:5051bdx", "ref:1011jfb", "ref:gr1113",
    "ref:ba1262", "ref:cae1054", "ref:ro1197", "ref:ro457", "ref:te1606"
  ].sort());
  assert.equal(evaluateIndividualPublicationDifference("gomariz", difference, previous, selected, null, current.products).accepted, true);
});
