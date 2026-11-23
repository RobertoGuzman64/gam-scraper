import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { buildProductIdentity } from "../../../catalog/identity.js";
import { readVerifiedManainRecordSource } from "../../../infrastructure/filesystem/catalog/manain-record-source.js";
import { prepareImportBatch } from "../../batch-identity.js";
import { prepareSourceProduct } from "../../prepare-product.js";
import { captureSourceEditorialEvidence } from "../../shared/editorial/mapping/source-editorial-evidence.js";
import { resolveEditorialSource } from "../../shared/editorial/domain/editorial-source.js";
import { prepareVerifiedManainRecord } from "../prepare.js";
import { manainRecordPreparationSource } from "../manain-record-source.js";

const workspace = process.cwd();

test("Manain: el original verificado atraviesa íntegramente el motor editorial y la preparación compartida", async (t) => {
  const verified = await readVerifiedManainRecordSource(workspace);
  const original = await readFile(verified.recordFile);
  const batch = prepareImportBatch(verified.originalProducts);
  const result = await prepareVerifiedManainRecord(workspace, {
    out: join(workspace, "storage", "prepared", "manain", "manain-record-inspection-preparation.json"),
    compare: null,
    dryRun: true
  });
  const preparation = result.preparation;

  assert.ok(verified.originalProducts.length > 0);
  assert.equal(preparation.quality, "complete");
  assert.equal(preparation.source.record?.quality, "partial");
  assert.deepEqual(preparation.source, manainRecordPreparationSource(verified));
  assert.deepEqual(preparation.identities, verified.originalProducts.map((product) => buildProductIdentity(product).key));
  assert.equal(new Set(preparation.identities).size, verified.originalProducts.length);
  assert.deepEqual(preparation.products, batch.products);
  assert.deepEqual(preparation.totals, batch.totals);
  assert.equal(preparation.products.length, verified.originalProducts.length);
  assert.deepEqual(await readFile(verified.recordFile), original);

  let images = 0;
  let specifications = 0;
  for (const [index, source] of verified.originalProducts.entries()) {
    const prepared = preparation.products[index];
    assert.ok(prepared);
    assert.deepEqual(prepared, prepareSourceProduct(source));
    assert.equal(prepared.product.providerId, source.providerId);
    assert.equal(prepared.product.sourceUrl, source.url);
    assert.equal(prepared.product.reference, source.reference);
    assert.deepEqual(prepared.product.images, source.images);
    assert.deepEqual(prepared.product.spec, source.specs);
    assert.equal(prepared.product.categorySellID, null);
    assert.deepEqual(prepared.product.attributes, []);
    assert.equal(prepared.status, prepared.issues.length === 0 ? "ready" : "review");
    images += prepared.product.images.length;
    specifications += Object.keys(prepared.product.spec).length;
  }
  t.diagnostic(`${preparation.products.length} fichas por el motor compartido; ${images} imágenes y ${specifications} especificaciones preservadas; ${preparation.totals.ready} ready, ${preparation.totals.review} review`);
});

test("Manain: la cobertura editorial y la autenticación de fuente permanecen observables, sin falsear ready", async (t) => {
  const verified = await readVerifiedManainRecordSource(workspace);
  const batch = prepareImportBatch(verified.originalProducts);
  let inputShort = 0;
  let inputGeneral = 0;
  let outputShort = 0;
  let outputGeneral = 0;
  let authenticated = 0;
  let recognizedSources = 0;
  const issues = new Map<string, number>();

  for (const [index, source] of verified.originalProducts.entries()) {
    const prepared = batch.products[index];
    assert.ok(prepared);
    if (source.shortDescription?.trim()) inputShort++;
    if (source.longDescription?.trim()) inputGeneral++;
    if (prepared.product.description?.trim()) outputShort++;
    else assert.ok(prepared.issues.includes("Cobertura editorial insuficiente: descripción corta"));
    if (prepared.product.description_general?.trim()) outputGeneral++;
    else assert.ok(prepared.issues.includes("Cobertura editorial insuficiente: descripción general"));
    const evidence = captureSourceEditorialEvidence(source);
    if (evidence.sourceVerified && evidence.identityVerified) authenticated++;
    if (resolveEditorialSource(source) !== null) recognizedSources++;
    for (const issue of prepared.issues) issues.set(issue, (issues.get(issue) ?? 0) + 1);
  }
  assert.equal(batch.totals.ready + batch.totals.review, verified.originalProducts.length);
  assert.ok(batch.totals.ready > batch.totals.review);
  t.diagnostic(`Textos de origen: corta ${inputShort}, general ${inputGeneral}. Textos preparados: corta ${outputShort}, general ${outputGeneral}. Fuente editorial reconocida: ${recognizedSources}. Fuente e identidad autenticadas: ${authenticated}`);
  for (const [issue, count] of [...issues].sort((left, right) => right[1] - left[1])) {
    t.diagnostic(`${count} · ${issue}`);
  }
});
