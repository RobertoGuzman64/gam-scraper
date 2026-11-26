import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import type { ProductRecord } from "../../contracts/catalog.js";
import type { ImportCandidate } from "../../commercial/legacy-export/contracts.js";
import type { CategoryScrapeResult } from "../../contracts/scraping.js";
import type { CampaignAccreditation } from "../../catalog/editorial/campaign-accreditation.js";
import { writeOutputs } from "../../scraping/output/publish.js";
import { consolidatePortableOriginal } from "../../infrastructure/filesystem/catalog/originals/portable-original.js";
import { prepareSourceProduct } from "../../preparation/prepare-product.js";
import { differenceBetween, selectActivePublication } from "../active-publication.js";
import { evaluateIndividualPublicationDifference } from "../publication-acceptance.js";
import { reconcileRemovedSpecifications } from "../specification-reconciliations.js";
import { writeTestPublicationVersion } from "../../testing/builders/publication-version-fixture.js";

const providerId = "gomariz";
const source: ProductRecord = {
  providerId, categoryKey: "venta", categoryName: "Maquinaria en venta",
  url: "https://www.gomarizrent.com/venta/elevacion-y-trabajos-en-altura/elevador-tijera/equiptest-tx2/",
  reference: "CAUSAL-TX2", title: "EQUIPTEST TX2", shortDescription: null, longDescription: null,
  price: "20000 €", brand: "EQUIPTEST", model: "TX2", year: null, location: null, country: null,
  horometer: null, serialNumber: null, condition: "Segunda mano", image: null,
  specs: { Capacidad: "230kg", "Altura de trabajo": "8 m", "Altura plataforma": "6.2 m" }
};

const candidates = () => {
  const prepared = prepareSourceProduct(source);
  assert.equal(prepared.status, "ready", prepared.issues.join("; "));
  const candidate = prepared.product;
  const spec = { ...candidate.spec };
  assert.equal(spec["Capacidad de la cesta"], "230 kg");
  assert.ok(Object.hasOwn(spec, "Altura de plataforma"));
  delete spec["Capacidad de la cesta"];
  delete spec["Altura de plataforma"];
  const previous: ImportCandidate = { ...candidate, spec: { ...spec, Capacidad: "230 kg", "Altura plataforma": "6,2 m" } };
  return { previous, candidate };
};

const withOriginal = async (action: (root: string) => Promise<void>): Promise<void> => {
  const root = await mkdtemp(join(tmpdir(), "equipzilla-causal-publication-"));
  try {
    const folder = join(root, "source");
    const category = { key: source.categoryKey, name: source.categoryName, url: "https://example.test/catalogo" };
    const result: CategoryScrapeResult = { category, products: [source], discoveredProductUrls: 1, failures: [] };
    await writeOutputs(folder, `scrape-${providerId}`, [result], "2026-01-01T10:00:00Z", "2026-01-01T11:00:00Z");
    await consolidatePortableOriginal(root, join(folder, `scrape-${providerId}-catalog.json`));
    await action(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
};

test("reconciliador y aceptación conservan el delta literal y rechazan fuentes ambiguas o pérdidas reales", () => {
  const { previous, candidate } = candidates();
  const diff = differenceBetween("before", "after", [previous], [candidate]);
  assert.equal(diff.removedSpecifications.length, 2);
  assert.deepEqual(reconcileRemovedSpecifications(providerId, diff, [previous], [candidate], [source]),
    { resolved: diff.removedSpecifications, unresolved: [] });
  assert.ok(evaluateIndividualPublicationDifference(providerId, diff, [previous], [candidate], null, [source]).accepted);
  for (const originals of [undefined, [], [source, source], [{ ...source, url: "https://example.test/other" }]]) {
    assert.deepEqual(reconcileRemovedSpecifications(providerId, diff, [previous], [candidate], originals).unresolved, diff.removedSpecifications);
    assert.equal(evaluateIndividualPublicationDifference(providerId, diff, [previous], [candidate], null, originals).accepted, false);
  }
  const old = { ...previous, spec: { ...previous.spec, "Prestación independiente": "230 kg" } };
  const loss = differenceBetween("before", "after", [old], [candidate]);
  const assessment = reconcileRemovedSpecifications(providerId, loss, [old], [candidate], [source]);
  assert.equal(assessment.resolved.length, 2);
  assert.deepEqual(assessment.unresolved, loss.removedSpecifications.filter((key) => key.endsWith(":Prestación independiente")));
  assert.equal(evaluateIndividualPublicationDifference(providerId, loss, [old], [candidate], null, [source]).accepted, false);
  assert.deepEqual(reconcileRemovedSpecifications(providerId, diff, [previous, previous], [candidate], [source]).unresolved, diff.removedSpecifications);
});

test("activación acredita el origen portátil y bloquea cambios no demostrados o concurrentes", async () => {
  await withOriginal(async (root) => {
    const { previous, candidate } = candidates();
    const oldSha = await writeTestPublicationVersion(root, previous, { version: 1, runId: `individual-${providerId}-before`,
      approved: true, approvalReason: "Acreditación sintética de prueba", sources: [], exclusions: [] });
    const folder = join(root, "catalogs", "providers", providerId, "publications");
    const index = join(folder, "active.json");
    await writeFile(index, JSON.stringify({ version: 1, providerId, approvalSha256: oldSha }));
    const initialIndex = await readFile(index, "utf8");
    const planned: CampaignAccreditation = { version: 1, runId: `individual-${providerId}-after`,
      approved: true, approvalReason: "Acreditación sintética de candidata", sources: [], exclusions: [] };
    const sha = await writeTestPublicationVersion(root, candidate, planned);
    const before = await readdir(folder);
    const activation = await selectActivePublication(root, providerId, sha);
    assert.deepEqual(activation.acceptance, { accepted: true, blockers: [] });
    assert.deepEqual(activation.difference, differenceBetween(oldSha, sha, [previous], [candidate]));
    assert.deepEqual(await readdir(folder), before);
    assert.equal(await readFile(index, "utf8"), initialIndex);
    const originalFolder = join(root, "catalogs", "providers", providerId, "original");
    const manifest = join(originalFolder, `scrape-${providerId}-catalog.manifest.json`);
    await writeFile(manifest, "{}");
    await assert.rejects(selectActivePublication(root, providerId, sha, true));
    assert.equal(await readFile(index, "utf8"), initialIndex);
    assert.deepEqual(await readdir(folder), before);
    await rm(originalFolder, { recursive: true });
    const missing = await selectActivePublication(root, providerId, sha);
    assert.equal(missing.acceptance.accepted, false);
    await assert.rejects(selectActivePublication(root, providerId, sha, true), /Activación bloqueada/);
    assert.equal(await readFile(index, "utf8"), initialIndex);
    assert.deepEqual(await readdir(folder), before);
    await consolidatePortableOriginal(root, join(root, "source", `scrape-${providerId}-catalog.json`));
    const damaged = { ...candidate, spec: { ...candidate.spec, "Capacidad de la cesta": "231 kg" } };
    const badApproval = { ...planned, approvalReason: "Acreditación sintética de un destino manipulado" };
    const badSha = await writeTestPublicationVersion(root, damaged, badApproval);
    const rejected = await selectActivePublication(root, providerId, badSha);
    assert.equal(rejected.acceptance.accepted, false);
    await assert.rejects(selectActivePublication(root, providerId, badSha, true), /Activación bloqueada/);
    assert.equal(await readFile(index, "utf8"), initialIndex);
    assert.equal(await writeTestPublicationVersion(root, damaged, planned), sha);
    await assert.rejects(selectActivePublication(root, providerId, sha, true), /Activación bloqueada/);
    assert.equal(await readFile(index, "utf8"), initialIndex);
    assert.equal(await writeTestPublicationVersion(root, candidate, planned), sha);
    const globalLock = join(root, "catalogs", ".active.lock");
    await writeFile(globalLock, "selección concurrente", { flag: "wx" });
    await assert.rejects(selectActivePublication(root, providerId, sha, true), /Otra activación/);
    assert.equal(await readFile(index, "utf8"), initialIndex);
    assert.equal(await readFile(globalLock, "utf8"), "selección concurrente");
    await rm(globalLock);
    assert.equal((await selectActivePublication(root, providerId, sha, true)).status, "activated");
    assert.equal(JSON.parse(await readFile(index, "utf8")).approvalSha256, sha);
  });
});

test("el delta de desarrollo es determinista y no convierte cambios de claves conservadas en retiradas", () => {
  const { previous, candidate } = candidates();
  const snapshot = structuredClone({ previous, candidate, source });
  const difference = differenceBetween("before", "after", [previous], [candidate]);
  const assessment = evaluateIndividualPublicationDifference(providerId, difference, [previous], [candidate], undefined, [source]);
  assert.equal(assessment.accepted, true);
  assert.deepEqual(evaluateIndividualPublicationDifference(providerId, difference, [previous], [candidate], undefined, [source]), assessment);
  assert.deepEqual({ previous, candidate, source }, snapshot);
  const changed = { ...candidate, spec: { ...candidate.spec, "Capacidad de la cesta": "231 kg" } };
  const retainedDifference = differenceBetween("before", "after", [candidate], [changed]);
  assert.equal(retainedDifference.removedSpecifications.length, 0);
  assert.equal(retainedDifference.changedSpecifications.length, 1);
  assert.equal(evaluateIndividualPublicationDifference(providerId, retainedDifference, [candidate], [changed], undefined, [source]).accepted, true);
  const substitutionDifference = differenceBetween("before", "after", [previous], [changed]);
  assert.equal(evaluateIndividualPublicationDifference(providerId, substitutionDifference, [previous], [changed], undefined, [source]).accepted, false);
  for (const after of [[], [{ ...candidate, description_general: "" }],
    [{ ...candidate, externalReference: "OTRA" }], [{ ...candidate, spec: { ...candidate.spec, "Altura de trabajo": "" } }]]) {
    const delta = differenceBetween("before", "after", [candidate], after);
    assert.equal(evaluateIndividualPublicationDifference(providerId, delta, [candidate], after, undefined, [source]).accepted, false);
  }
});

test("una sustitución de Manain solo se acredita si su unidad está presente en el registro verificado", () => {
  const record: ProductRecord = { ...source, providerId: "manain", title: "TX2", reference: "CONTROL-TX2",
    url: "https://manain.com/producto/venta-elevacion-tijera-equiptest-tx2/",
    specs: { Marca: "EQUIPTEST", Modelo: "TX2", Motor: "Eléctrico", "Nueva o usada": "usada", "Altura trabajo": "9 m",
      "Capacidad carga": "230 kg", "Longitud plataforma": "2,4 m", "Ancho plataforma": "0,8 m" } };
  const prepared = prepareSourceProduct(record);
  assert.equal(prepared.status, "ready", prepared.issues.join("; "));
  const candidate = prepared.product;
  const { ["Capacidad de la cesta"]: capacity, ...spec } = candidate.spec;
  assert.equal(capacity, "230 kg");
  const previous = { ...candidate, spec: { ...spec, "Capacidad carga": capacity } };
  const delta = differenceBetween("before", "after", [previous], [candidate]);
  const other = { ...record, reference: "OTRA", url: "https://manain.com/producto/otra-unidad/" };
  assert.deepEqual(reconcileRemovedSpecifications("manain", delta, [previous], [candidate], [record, other]).resolved, delta.removedSpecifications);
  for (const originals of [[other], [record, record], [{ ...record, providerId: "gomariz" }]]) {
    assert.deepEqual(reconcileRemovedSpecifications("manain", delta, [previous], [candidate], originals).unresolved, delta.removedSpecifications);
    assert.equal(evaluateIndividualPublicationDifference("manain", delta, [previous], [candidate], undefined, originals).accepted, false);
  }
});
