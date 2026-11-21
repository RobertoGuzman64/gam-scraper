import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import type { ProductRecord } from "../../../contracts/catalog.js";
import { editorialSourceDigest } from "../../../infrastructure/filesystem/editorial/knowledge.js";
import { readPanelSnapshot } from "../../evidence/read-panel-snapshot.js";
import { matchingPanelUnitKnowledge, readPanelUnitKnowledge } from "../../evidence/knowledge-evidence.js";
import type { PanelUnitKnowledgeEvidence } from "../../evidence/knowledge-evidence.js";
import type { PanelProviderEvidence, PanelProviderId } from "../../evidence/types.js";
import { createPanelEvidenceWorkspaceFixture } from "../../../testing/builders/panel-evidence-workspace-fixture.js";
import { compareOriginalToPublished } from "../field-differences.js";
import { classifySpecAdditions } from "../spec-addition-classification.js";
import { prepareSourceProduct } from "../../../preparation/prepare-product.js";
import { queryPanelFieldProvenance, resolvePanelFieldProvenance } from "../field-provenance.js";
import { readPanelExplorer } from "../read-panel-explorer.js";
import type { PanelProductView } from "../types.js";

const fixture = createPanelEvidenceWorkspaceFixture();
const source = (providerId: PanelProviderId, reference: string): ProductRecord => ({
  providerId, categoryKey: "venta", categoryName: "Maquinaria de ocasión",
  url: `https://www.gomarizrent.com/venta/elevacion-y-trabajos-en-altura/elevador-tijera/${reference}/`,
  title: "LGMG SS0507E", shortDescription: null, longDescription: "Descripción de proveedor",
  price: null, condition: "Segunda mano", yearSource: "ficha", reference,
  brand: "LGMG", model: "SS0507E", year: "2022", location: null, country: null,
  horometer: null, serialNumber: null, image: null, specs: {}
});
const view = (record: ProductRecord): PanelProductView => ({
  title: record.title, shortDescription: record.shortDescription,
  generalDescription: record.longDescription, category: record.categoryName,
  price: record.price, image: record.image, images: record.images ?? [], specs: record.specs ?? {}
});
const results = (
  original: ProductRecord, output: PanelProductView, provider: PanelProviderEvidence,
  knowledge: PanelUnitKnowledgeEvidence | null = null
) => {
  const differences = compareOriginalToPublished(view(original), output);
  return { differences, provenance: resolvePanelFieldProvenance(original, output, differences,
    provider, knowledge, original.reference, original.url) };
};

const evidenceProviders = async () => (await readPanelSnapshot(await fixture.root())).providers;

const knowledgeFor = (record: ProductRecord, general: string): PanelUnitKnowledgeEvidence => ({
  artifact: { path: "data/editorial/knowledge/verified-units.json", sha256: "e".repeat(64) },
  entries: new Map([[`${record.providerId}:${record.reference}`, [{
    key: `${record.providerId}:${record.reference}`, brand: record.brand ?? "", model: record.model ?? "",
    sourceUrl: record.url, sourceDigest: editorialSourceDigest(record), short: null,
    general, title: null, priority: 60
  }]]])
});

test("cada proveedor recibe el contrato de consulta con linaje y sin atribución histórica ficticia", async () => {
  const snapshot = await readPanelSnapshot(await fixture.root());
  const explorer = await readPanelExplorer(await fixture.root(), snapshot);
  for (const provider of snapshot.providers) {
    const items = explorer.products.filter((item) => item.providerId === provider.providerId);
    assert.ok(items.length > 0);
    for (const item of items) {
      assert.equal(item.provenance.length, item.changes.filter((change) => change.change !== "unchanged").length);
      for (const entry of item.provenance) {
        assert.equal(entry.historicalApplication, "not-demonstrated");
        assert.equal(entry.publicationSha256, provider.publication.sha256);
        assert.equal(entry.originalSha256, provider.original.status === "verified" ? provider.original.artifact.sha256 : null);
        assert.ok(item.changes.some((change) => change.field === entry.field && change.group === entry.group));
        if (entry.proof) assert.match(entry.proof.sha256, /^[a-f0-9]{64}$/);
      }
    }
  }
});

test("año de Gomariz: metadato de origen compatible, sin atribuir una recuperación", async () => {
  const provider = (await evidenceProviders()).find((item) => item.providerId === "gomariz");
  assert.ok(provider);
  const original = source("gomariz", "TE1858");
  const output = { ...view(original), specs: { "Año de fabricación": "2022" } };
  const { differences, provenance } = results(original, output, provider);
  const field = differences.find((item) => item.group === "technical" && item.change === "added");
  assert.ok(field);
  const matched = queryPanelFieldProvenance(provenance, field);
  assert.equal(matched?.status, "source-compatible");
  assert.equal(matched?.sourceField, "year");
  assert.equal(matched?.sourceValue, "2022");
  assert.equal(matched?.mechanism, null);
  assert.equal(matched?.proof?.sha256, provider.original.status === "verified" ? provider.original.artifact.sha256 : null);
  assert.equal(matched?.historicalApplication, "not-demonstrated");

  const invalid = { ...original, yearSource: "titulo" as const };
  assert.equal(results(invalid, output, provider).provenance.find((entry) => entry.group === "technical")?.status, "observed-only");
});

test("fase 09: el año de GAM se acredita desde una URL oficial exacta de la unidad", async () => {
  const provider = (await evidenceProviders()).find((item) => item.providerId === "gam");
  assert.ok(provider);
  const original: ProductRecord = {
    ...source("gam", "6588"), providerId: "gam", reference: "6588",
    url: "https://online.gamrentals.com/es/preparapedidos-segunda-mano/6588-2019-yale-mo20p",
    year: "2019", yearSource: "url"
  };
  const output = { ...view(original), specs: { "Año de fabricación": "2019" } };
  const proven = results(original, output, provider).provenance.find((entry) => entry.group === "technical");
  assert.equal(proven?.status, "source-compatible");
  assert.equal(proven?.scope, "unit");
  assert.equal(proven?.sourceField, "url");
  assert.equal(proven?.sourceValue, original.url);
  assert.equal(proven?.mechanism, "src/catalog/normalization/gam/year.ts");
  assert.equal(proven?.proof?.sha256, provider.original.status === "verified" ? provider.original.artifact.sha256 : null);
  assert.equal(results({ ...original, yearSource: "descripcion" }, output, provider)
    .provenance.find((entry) => entry.group === "technical")?.status, "source-compatible");
  for (const rejected of [
    { ...original, yearSource: "titulo" as const },
    { ...original, year: "2020" },
    { ...original, url: original.url.replace("6588-2019", "6588-2018") },
    { ...original, url: original.url.replace("6588-2019", "6599-2019") },
    { ...original, url: original.url.replace("online.gamrentals.com", "example.com") },
    { ...original, url: `${original.url}?unidad=6588` },
    { ...original, url: original.url.replace("https:", "http:") },
    { ...original, specs: { Año: "2019" } },
    { ...original, providerId: "mercaeleva" as const }
  ]) {
    assert.equal(results(rejected, output, provider).provenance
      .some((entry) => entry.group === "technical" && entry.status === "source-compatible"), false, rejected.url);
  }
  const withoutUrlYear = {
    ...original, reference: "6196", year: "2015", yearSource: "descripcion" as const,
    url: "https://online.gamrentals.com/es/plataformas/6196-jlg-1930es"
  };
  const withoutUrlYearOutput = { ...view(withoutUrlYear), specs: { "Año de fabricación": "2015" } };
  assert.equal(results(withoutUrlYear, withoutUrlYearOutput, provider).provenance
    .find((entry) => entry.group === "technical")?.status, "observed-only");
});

test("fase 10: año explícito único de la descripción GAM y rechazo de referencias ambiguas", async () => {
  const provider = (await evidenceProviders()).find((item) => item.providerId === "gam");
  assert.ok(provider);
  const description = "La plataforma JLG 1930ES permite trabajar en altura. Fabricada en 2015, mantiene su rendimiento.";
  const original: ProductRecord = {
    ...source("gam", "6196"), providerId: "gam", reference: "6196",
    url: "https://online.gamrentals.com/es/plataformas-elevadoras-tijera-electricas-segunda-mano/6196-jp-00309",
    year: "2015", yearSource: "descripcion", longDescription: description
  };
  const output = { ...view(original), specs: { "Año de fabricación": "2015" } };
  const prove = (record: ProductRecord) => results(record, output, provider).provenance
    .find((entry) => entry.group === "technical");
  const proof = prove(original);
  assert.equal(proof?.status, "source-compatible");
  assert.equal(proof?.sourceField, "longDescription");
  assert.equal(proof?.sourceValue, description);
  assert.equal(proof?.mechanism, "src/catalog/normalization/gam/year.ts");
  assert.equal(proof?.historicalApplication, "not-demonstrated");
  for (const rejected of [
    { ...original, yearSource: "titulo" as const },
    { ...original, yearSource: "url" as const },
    { ...original, year: "2016" },
    { ...original, longDescription: null },
    { ...original, longDescription: "JLG 1930ES, modelo 2015" },
    { ...original, longDescription: `${description} También fabricada en 2016.` },
    { ...original, longDescription: `${description} Revisión del año 2020.` },
    { ...original, specs: { Año: "2015" } },
    { ...original, url: original.url.replace("6196-jp-00309", "6196-2016-jlg-1930es") },
    { ...original, url: original.url.replace("online.gamrentals.com", "example.com") },
    { ...original, url: original.url.replace("6196-jp-00309", "6195-jp-00309") },
    { ...original, url: original.url + "?revision=2015" },
    { ...original, providerId: "mercaeleva" as const }
  ]) assert.notEqual(prove(rejected)?.status, "source-compatible");
});

test("normalización de magnitud: valor exacto y sin conflicto, solo compatibilidad de regla", async () => {
  const provider = (await evidenceProviders()).find((item) => item.providerId === "gam");
  assert.ok(provider);
  const original = { ...source("gam", "abc"), specs: { "peso kg": "985 kg" } };
  const output = { ...view(original), specs: { "Peso (kg)": 985 } };
  const row = results(original, output, provider).provenance.find((entry) => entry.group === "technical");
  assert.equal(row?.status, "mechanism-compatible");
  assert.equal(row?.sourceField, "peso kg");
  assert.equal(row?.historicalApplication, "not-demonstrated");
  const bad = { ...original, specs: { "peso kg": "985 kg", "Peso (kg)": "750 kg" } };
  assert.ok(results(bad, output, provider).provenance.every((entry) => entry.status !== "mechanism-compatible"));
});

test("registro editorial: identidad exacta, digest específico y texto completo, sin inferir afirmaciones", async () => {
  const provider = (await evidenceProviders()).find((item) => item.providerId === "mercaeleva");
  assert.ok(provider);
  const original = source("mercaeleva", "M547-2372");
  const general = "Descripción final acreditable como coincidencia literal, no como ejecución.";
  const output = { ...view(original), generalDescription: general };
  const knowledge = knowledgeFor(original, general);
  const row = results(original, output, provider, knowledge).provenance.find((entry) => entry.field === "Descripción general");
  assert.equal(row?.status, "source-compatible");
  assert.equal(row?.sourceDigest, editorialSourceDigest(original));
  assert.deepEqual(row?.proof, knowledge.artifact);
  assert.equal(row?.historicalApplication, "not-demonstrated");
  assert.equal(matchingPanelUnitKnowledge(original, knowledge, "general", general).length, 1);

  const otherUnit = { ...original, reference: "M547-2373" };
  assert.equal(results(otherUnit, output, provider, knowledge).provenance.find((entry) => entry.group === "content")?.status, "observed-only");
  const otherModel = { ...original, model: "SS0508E" };
  assert.equal(results(otherModel, output, provider, knowledge).provenance.find((entry) => entry.field === "Descripción general")?.status, "observed-only");
  const otherProvider = { ...original, providerId: "gam" };
  assert.equal(results(otherProvider, output, provider, knowledge).provenance.find((entry) => entry.field === "Descripción general")?.status, "observed-only");
  const mutated = { ...original, specs: { "Campo nuevo": "valor" } };
  assert.equal(results(mutated, output, provider, knowledge).provenance.find((entry) => entry.field === "Descripción general")?.status, "observed-only");
  const wrongSourceUrl = { ...original, url: `${original.url}extra` };
  assert.equal(results(wrongSourceUrl, output, provider, knowledge).provenance.find((entry) => entry.field === "Descripción general")?.status, "observed-only");
  const sameModelOtherUnit = { ...source("mercaeleva", "M547-9999"), model: original.model };
  assert.equal(results(sameModelOtherUnit, output, provider, knowledge).provenance.find((entry) => entry.field === "Descripción general")?.status, "observed-only");
});

test("unión cruzada y evidencia ausente impiden elevar nivel de certeza", async () => {
  const provider = (await evidenceProviders()).find((item) => item.providerId === "gomariz");
  assert.ok(provider);
  const original = source("gomariz", "TE1858");
  const output = { ...view(original), specs: { "Año de fabricación": "2022" } };
  const differences = compareOriginalToPublished(view(original), output);
  const badIdentity = resolvePanelFieldProvenance(original, output, differences, provider, null,
    "TE1621", original.url);
  assert.equal(badIdentity.find((item) => item.group === "technical")?.status, "observed-only");
  const noOriginal = resolvePanelFieldProvenance(null, output, differences, provider, null,
    original.reference, original.url);
  assert.equal(noOriginal.find((item) => item.group === "technical")?.status, "observed-only");
  const noSha = provider.original.status === "verified" ? {
    ...provider, original: { status: "unavailable" as const, expectedSha256: provider.original.artifact.sha256,
      reason: "No coincide la huella" }
  } : provider;
  assert.equal(results(original, output, noSha).provenance.find((item) => item.group === "technical")?.status, "observed-only");
  const invalidPublication = { ...provider, publication: { ...provider.publication, sha256: "sin-huella" } };
  assert.equal(results(original, output, invalidPublication).provenance.find((item) => item.group === "technical")?.status, "observed-only");
  const duplicate = knowledgeFor(original, "Texto final");
  const matching = duplicate.entries.get("gomariz:TE1858") ?? [];
  const ambiguous = { ...duplicate, entries: new Map([["gomariz:TE1858", [...matching, ...matching]]]) };
  const text = { ...view(original), generalDescription: "Texto final" };
  assert.equal(results(original, text, provider, ambiguous).provenance.find((entry) => entry.field === "Descripción general")?.status, "observed-only");
  assert.equal(queryPanelFieldProvenance([], differences[0]!), null);
});

test("un índice de conocimiento ausente no se inventa y uno inválido no pasa", async () => {
  const root = await mkdtemp(join(tmpdir(), "eqz-panel-knowledge-"));
  try {
    assert.equal(await readPanelUnitKnowledge(root), null);
    const folder = join(root, "data", "editorial", "knowledge");
    await mkdir(folder, { recursive: true });
    await writeFile(join(folder, "verified-units.json"), JSON.stringify({ version: 1, entries: [{ key: "gam:1" }] }));
    await assert.rejects(readPanelUnitKnowledge(root), /incompatible/);
    const original = source("gam", "1");
    await writeFile(join(folder, "verified-units.json"), JSON.stringify({ version: 1,
      entries: [...(knowledgeFor(original, "Texto").entries.get("gam:1") ?? [])] }));
    const loaded = await readPanelUnitKnowledge(root);
    assert.equal(matchingPanelUnitKnowledge(original, loaded, "general", "Texto").length, 1);
    assert.match(loaded?.artifact.sha256 ?? "", /^[a-f0-9]{64}$/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});


test("fase 17: el panel consume la emisión productiva acreditada sin reconstruir recuperadores", async () => {
  const provider = (await evidenceProviders()).find((item) => item.providerId === "gomariz");
  assert.ok(provider);
  const original = source("gomariz", "TE1858");
  const prepared = prepareSourceProduct(original);
  const emitted = prepared.technicalProvenance;
  assert.ok(emitted);
  const output: PanelProductView = { ...view(original), specs: prepared.product.spec };
  const differences = compareOriginalToPublished(view(original), output);
  const resolve = (record: ProductRecord, traces = emitted) =>
    resolvePanelFieldProvenance(record, output, differences, provider, null,
      record.reference, record.url, traces);
  const proven = resolve(original);
  const year = proven.find((entry) => entry.field === "Año");
  assert.equal(year?.status, "source-compatible");
  assert.equal(year?.mechanism, "src/preparation/gomariz/technical/mapping/source-year-spec.ts");
  assert.equal(year?.historicalApplication, "demonstrated");
  assert.equal(year?.sourceField, "year");
  assert.deepEqual(classifySpecAdditions(differences, provider, original.reference, original.url,
    null, original, proven).filter((item) => item.kind === "own").map((item) => item.field), ["Año"]);
  assert.throws(() => resolve({ ...original, year: "2023" }), /no corresponde al original/);
  assert.throws(() => resolve({ ...original, reference: "TE1859" }), /no corresponde al original/);
  const corrupted = { ...emitted, entries: emitted.entries.map((entry) => entry.scope === "unit" ? { ...entry, sourceValue: "2023" } : entry) };
  assert.throws(() => resolve(original, corrupted), /fuente de procedencia/);
});
