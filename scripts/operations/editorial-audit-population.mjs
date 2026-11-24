import { createHash } from 'node:crypto';
import { readPortableOriginalArtifacts } from '../../dist/infrastructure/filesystem/catalog/portable-original.js';
import { loadPreparationInputs } from '../../dist/infrastructure/filesystem/preparation/preparation-inputs.js';
import { prepareImportBatch } from '../../dist/preparation/product/batch-identity.js';

export const loadEditorialAuditPopulation = async (workspace, providerId, fingerprints) => {
  const { catalog, files } = await readPortableOriginalArtifacts(workspace, providerId);
  const original = files.find((file) => file.name.endsWith('-catalog.json'));
  if (!original) throw new Error(`Original canónico ausente: ${providerId}`);
  const prepared = prepareImportBatch(catalog.products);
  return {
    records: catalog.products,
    prepared: prepared.products,
    provenance: {
      source: {
        providerId: catalog.providerId,
        prefix: catalog.prefix,
        scope: catalog.scope,
        catalogSha256: createHash('sha256').update(original.content).digest('hex'),
        productCount: catalog.productCount
      },
      fingerprints,
      startedAt: catalog.startedAt,
      endedAt: catalog.endedAt
    }
  };
};

export const editorialAuditFingerprints = async () => (await loadPreparationInputs()).fingerprints;
