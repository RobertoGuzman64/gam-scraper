import assert from "node:assert/strict";
import test from "node:test";
import { readPortableOriginal } from "../../../infrastructure/filesystem/catalog/portable-original.js";
import { readPanelSnapshot } from "../../evidence/read-panel-snapshot.js";
import { readPanelExplorer } from "../read-panel-explorer.js";
import { resolvePanelFieldProvenance } from "../field-provenance.js";
import { classifySpecAdditions, loadSpecAdditionAudit } from "../spec-addition-classification.js";
import { prepareSourceProduct } from "../../../preparation/prepare-product.js";

test("fase 25: la clasificación de una publicación nueva consume pruebas documentales emitidas, sin auditoría histórica", async () => {
  const root = process.cwd();
  const snapshot = await readPanelSnapshot(root);
  const explorer = await readPanelExplorer(root, snapshot);
  const provider = snapshot.providers.find((item) => item.providerId === "gam");
  assert.ok(provider);
  const catalog = await readPortableOriginal(root, "gam");
  const reference = "211";
  const original = catalog.products.find((item) => item.reference === reference);
  const published = explorer.products.find((item) => item.providerId === "gam" && item.reference === reference);
  assert.ok(original);
  assert.ok(published?.published);
  const newTrace = prepareSourceProduct(original).technicalProvenance;
  assert.ok(newTrace);
  const additions = published.changes.filter((item) => item.group === "technical" && item.change === "added" &&
    newTrace.entries.some((entry) => entry.field === item.field && entry.scope === "model-document" &&
      entry.verification !== undefined));
  assert.equal(additions.length, 3);
  const provenance = resolvePanelFieldProvenance(original, published.published, additions,
    provider, null, original.reference, original.url, newTrace);
  assert.equal(provenance.length, 3);
  assert.ok(provenance.every((item) => item.status === "mechanism-compatible" &&
    item.historicalApplication === "demonstrated" && item.verification));
  const classify = (evidences = provenance) => classifySpecAdditions(additions, provider,
    original.reference, original.url, null, original, evidences);
  assert.ok(classify().every((item) => item.kind === "reused"));
  assert.ok(classify([]).every((item) => item.kind === "pending"));
  const audit = await loadSpecAdditionAudit(root);
  assert.ok(audit?.version === 2);
  const historic = audit.entries.find((item) => item.providerId === "gam" && item.reference === reference &&
    item.field === additions[0]?.field);
  assert.ok(historic);
  const conflicting = { ...audit, entries: audit.entries.map((item) => item === historic ?
    { ...item, value: "VALOR HISTÓRICO DISTINTO" } : item) };
  assert.equal(classifySpecAdditions(additions, provider, original.reference, original.url,
    conflicting, original, provenance)[0]?.kind, "reused");
  assert.equal(classifySpecAdditions(additions, provider, original.reference, original.url,
    conflicting, original, [])[0]?.kind, "pending");
  for (const [index, proof] of provenance.entries()) {
    assert.ok(proof.verification);
    const changed = [...provenance];
    changed[index] = { ...proof, verification: { ...proof.verification, support: "alterado" } };
    assert.equal(classify(changed)[index]?.kind, "pending");
    assert.ok(proof.document);
    changed[index] = { ...proof, document: { ...proof.document, model: "OTRO MODELO" } };
    assert.equal(classify(changed)[index]?.kind, "pending");
    changed[index] = { ...proof, originalSha256: "f".repeat(64) };
    assert.equal(classify(changed)[index]?.kind, "pending");
    changed[index] = { ...proof, historicalApplication: "not-demonstrated" };
    assert.equal(classify(changed)[index]?.kind, "pending");
  }
});

test("fase 26: una nueva publicación reutiliza afirmaciones oficiales de modelo antes registradas como documentación de unidad", async () => {
  const root = process.cwd();
  const snapshot = await readPanelSnapshot(root);
  const explorer = await readPanelExplorer(root, snapshot);
  const provider = snapshot.providers.find((item) => item.providerId === "mercaeleva");
  assert.ok(provider);
  const catalog = await readPortableOriginal(root, "mercaeleva");
  for (const [reference, expected] of [["M736-5615", 5], ["M569-9029", 4]] as const) {
    const original = catalog.products.find((item) => item.reference === reference);
    const published = explorer.products.find((item) => item.providerId === "mercaeleva" && item.reference === reference);
    assert.ok(original);
    assert.ok(published?.published);
    const trace = prepareSourceProduct(original).technicalProvenance;
    assert.ok(trace);
    const additions = published.changes.filter((item) => item.group === "technical" && item.change === "added" &&
      trace.entries.some((entry) => entry.field === item.field && entry.scope === "model-document" && entry.verification));
    assert.equal(additions.length, expected);
    const provenance = resolvePanelFieldProvenance(original, published.published, additions,
      provider, null, original.reference, original.url, trace);
    assert.ok(provenance.every((item) => item.scope === "model-document" && item.verification &&
      item.historicalApplication === "demonstrated"));
    assert.ok(classifySpecAdditions(additions, provider, original.reference, original.url, null,
      original, provenance).every((item) => item.kind === "reused"));
    assert.ok(classifySpecAdditions(additions, provider, original.reference, original.url, null,
      original, []).every((item) => item.kind === "pending"));
    const first = provenance[0];
    assert.ok(first);
    assert.ok(first.document);
    assert.equal(classifySpecAdditions(additions, provider, original.reference, original.url, null,
      original, [{ ...first, document: { ...first.document, model: "OTRA VARIANTE" } }, ...provenance.slice(1)])[0]?.kind,
    "pending");
  }
});
