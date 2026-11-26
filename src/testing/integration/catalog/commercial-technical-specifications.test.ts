import assert from "node:assert/strict";
import test from "node:test";
import { resolveAccreditedPublication, readAccreditedPublication } from "../../../infrastructure/filesystem/catalog/publications/accredited-publication.js";
import type { ImportCandidate } from "../../../commercial/legacy-export/contracts.js";
import { analyzePresentationConsistency } from "../../../commercial/diagnostics/presentation-consistency.js";
import { hasLoadCapacityDisagreement, inspectTechnicalSpecifications } from "../../../commercial/validation/technical-specifications.js";

const publication = async (providerId: string): Promise<readonly ImportCandidate[]> => {
  const path = await resolveAccreditedPublication(process.cwd(), providerId);
  assert.ok(path, providerId);
  return (await readAccreditedPublication(path)).products;
};

test("la publicación GAM no contiene magnitudes técnicas incompatibles", async () => {
  const products = await publication("gam");
  assert.ok(products.length > 0);
  const before = JSON.stringify(products);
  assert.deepEqual(products.filter((product) => inspectTechnicalSpecifications(product.spec).length > 0), []);
  assert.equal(JSON.stringify(products), before);
});

test("las publicaciones GAM y Mercaeleva no presentan capacidades discordantes", async () => {
  const [gam, mercaeleva] = await Promise.all([publication("gam"), publication("mercaeleva")]);
  const products = [...gam, ...mercaeleva];
  assert.ok(gam.length > 0 && mercaeleva.length > 0);
  const before = JSON.stringify(products);
  assert.deepEqual(products.filter(hasLoadCapacityDisagreement), []);
  const report = analyzePresentationConsistency(products);
  assert.deepEqual(report.findings.filter((item) => item.code === "capacidad-titulo-spec-discordante"), []);
  assert.equal(JSON.stringify(products), before);
});
