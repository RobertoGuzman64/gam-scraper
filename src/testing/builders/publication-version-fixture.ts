import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { CampaignAccreditation } from "../../catalog/editorial/campaign-accreditation.js";
import { sha256 } from "../../catalog/editorial/campaign-accreditation.js";
import type { ImportCandidate } from "../../commercial/legacy-export/contracts.js";
import type { ProductRecord } from "../../contracts/catalog.js";
import { prepareSourceProduct } from "../../preparation/prepare-product.js";

export const writeTestPublicationVersion = async (root: string, product: ImportCandidate, approval: CampaignAccreditation): Promise<string> => {
  const accreditation = JSON.stringify(approval, null, 2);
  const sha = sha256(accreditation);
  const folder = join(root, "catalogs", "providers", product.providerId, "publications", sha);
  await mkdir(folder, { recursive: true });
  const file = `${product.providerId}-publishable.json`;
  const content = JSON.stringify([product]);
  await writeFile(join(folder, file), content);
  await writeFile(join(folder, "accreditation.json"), accreditation);
  await writeFile(join(folder, "manifest.json"), JSON.stringify({ version: 1, providerId: product.providerId, runId: approval.runId,
    approvalSha256: sha, totals: { publishable: 1 }, files: { [file]: sha256(content), "accreditation.json": sha } }));
  return sha;
};

export const seedHistoricalPlatformPublication = async (root: string, source: ProductRecord): Promise<string> => {
  const prepared = prepareSourceProduct(source);
  assert.equal(prepared.status, "ready", prepared.issues.join("; "));
  const { ["Altura de plataforma"]: height, ...spec } = prepared.product.spec;
  assert.equal(height, "6,2 m");
  const previous = { ...prepared.product, spec: { ...spec, "Altura plataforma": height } };
  const sha = await writeTestPublicationVersion(root, previous, { version: 1, runId: `individual-${source.providerId}-before`,
    approved: true, approvalReason: "Acreditación sintética de prueba", sources: [], exclusions: [] });
  await writeFile(join(root, "catalogs", "providers", source.providerId, "publications", "active.json"),
    JSON.stringify({ version: 1, providerId: source.providerId, approvalSha256: sha }));
  return sha;
};
