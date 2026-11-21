import assert from "node:assert/strict";
import { test } from "node:test";
import { readPortableOriginal } from "../../../infrastructure/filesystem/catalog/portable-original.js";
import { prepareSourceProduct } from "../../../preparation/prepare-product.js";
import { classifyPublishedTechnicalAdditions } from "../../../preparation/technical-spec-classification.js";
import { readPanelSnapshot } from "../../evidence/read-panel-snapshot.js";
import { readPanelExplorer } from "../read-panel-explorer.js";

const examples = [
  { providerId: "gam", reference: "231", field: "", kind: "reused" },
  { providerId: "gam", reference: "6994", field: "Yale ERP16VT MWB · Capacidad de carga", kind: "own" },
  { providerId: "mercaeleva", reference: "M879-4639", field: "Capacidad nominal de carga", kind: "reused" }
] as const;

test("el motor es la única autoridad para clasificar evidencias técnicas emitidas", async () => {
  for (const providerId of ["gam", "mercaeleva"] as const) {
    const catalog = await readPortableOriginal(process.cwd(), providerId);
    for (const sample of examples.filter((item) => item.providerId === providerId)) {
      const original = catalog.products.find((item) => item.reference === sample.reference);
      assert.ok(original);
      const emitted = prepareSourceProduct(original).technicalProvenance;
      assert.ok(emitted);
      const entry = sample.field ? emitted.entries.find((item) => item.field === sample.field) :
        emitted.entries.find((item) => item.scope === "model-document" && item.verification);
      assert.ok(entry);
      const additions = [{ field: entry.field, value: entry.value }];
      const classify = (trace = emitted, ref = original.reference, source = original) =>
        classifyPublishedTechnicalAdditions(source, trace, providerId, ref, original.url, true, additions);
      assert.deepEqual(classify().map((item) => item.kind), [sample.kind]);
      assert.equal(classifyPublishedTechnicalAdditions(original, null, providerId, original.reference,
        original.url, true, additions)[0]?.kind, sample.kind);
      assert.equal(classifyPublishedTechnicalAdditions(original, emitted, providerId, original.reference,
        original.url, false, additions)[0]?.kind, "pending");
      assert.equal(classify(emitted, `${original.reference}-cambiada`)[0]?.kind, "pending");
      assert.equal(classify({ ...emitted, originalRecordSha256: "0".repeat(64) })[0]?.kind, "pending");
      assert.equal(classify(emitted, original.reference, { ...original, model: "Variante ajena" })[0]?.kind, "pending");
      assert.equal(classifyPublishedTechnicalAdditions(original, emitted, providerId,
        original.reference, original.url, true, [{ field: entry.field, value: `${entry.value}-cambiado` }])[0]?.kind,
        "pending");
    }
  }
});

test("el explorador refleja exclusivamente las clasificaciones reproducibles por el motor", async () => {
  const root = process.cwd();
  const snapshot = await readPanelSnapshot(root);
  const explorer = await readPanelExplorer(root, snapshot);
  const additions = explorer.products.flatMap((product) => product.specAdditions);
  assert.ok(additions.length > 0);
  assert.ok(additions.some((addition) => addition.kind === "own"));
  assert.ok(additions.some((addition) => addition.kind === "reused"));
  assert.ok(additions.some((addition) => addition.kind === "pending"));
  for (const product of explorer.products) {
    assert.deepEqual(product.specAdditions.map((addition) => addition.field),
      product.changes.filter((difference) => difference.group === "technical" &&
        difference.change === "added").map((difference) => difference.field));
  }
});
