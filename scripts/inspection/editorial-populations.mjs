import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { readPortableOriginalArtifacts } from '../../dist/infrastructure/filesystem/catalog/portable-original.js';
import { discoverAccreditedPublications, readAccreditedPublication } from '../../dist/infrastructure/filesystem/catalog/accredited-publication.js';
import { readActiveTechnicalPublication } from '../../dist/infrastructure/filesystem/catalog/technical-publication.js';
import { LEGACY_CAMPAIGN_PROVIDERS, CAMPAIGN_PROVIDERS } from '../../dist/contracts/campaign-providers.js';
import { loadPreparationInputs } from '../../dist/infrastructure/filesystem/preparation/preparation-inputs.js';

export const comparablePopulation = (left, right) =>
  left.stage === right.stage && left.providerId === right.providerId &&
  left.sourceSha256 === right.sourceSha256 && left.rulesSha256 === right.rulesSha256 &&
  left.sourceCut === right.sourceCut;

export const readEditorialPopulations = async (workspace) => {
  const root = resolve(workspace);
  const { fingerprints } = await loadPreparationInputs();
  const originals = [];
  for (const providerId of LEGACY_CAMPAIGN_PROVIDERS) {
    const { catalog, files } = await readPortableOriginalArtifacts(root, providerId);
    const original = files.find((item) => item.name.endsWith('-catalog.json'));
    if (!original) throw new Error(`Falta catálogo validado: ${providerId}`);
    originals.push({ stage: 'originales_canonicos', providerId, products: catalog.productCount,
      sourceSha256: createHash('sha256').update(original.content).digest('hex'),
      sourceCut: catalog.endedAt, scope: catalog.scope, prefix: catalog.prefix,
      rulesSha256: fingerprints.rulesSha256, complete: true });
  }
  const final = [];
  for (const path of await discoverAccreditedPublications(root)) {
    const publication = await readAccreditedPublication(path);
    final.push({ stage: 'publicacion_final', providerId: publication.providerId,
      products: publication.products.length, sourceSha256: publication.sha256,
      sourceCut: publication.runId, rulesSha256: null, complete: true });
  }
  const technical = [];
  for (const providerId of CAMPAIGN_PROVIDERS) {
    const active = await readActiveTechnicalPublication(root, providerId);
    if (!active) continue;
    technical.push({ stage: 'publicacion_tecnica', providerId,
      products: active.snapshot.products.length, sourceSha256: active.sha256,
      sourceCut: active.sha256, rulesSha256: active.snapshot.source.rulesSha256,
      source: active.snapshot.source, quality: active.snapshot.quality,
      complete: active.snapshot.quality === 'complete' });
  }
  const byStage = [
    { stage: 'originales_canonicos', providers: originals },
    { stage: 'publicacion_final', providers: final },
    { stage: 'publicacion_tecnica', providers: technical }
  ].map(({ stage, providers }) => ({
    stage, products: providers.length ? providers.reduce((total, item) => total + item.products, 0) : null,
    complete: providers.length > 0 && providers.every((item) => item.complete), providers
  }));
  return { version: 1, analyzedAt: new Date().toISOString(), byStage,
    comparableAcrossStages: false };
};

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    if (process.argv.length > 2) throw new Error('Uso: node scripts/inspection/editorial-populations.mjs');
    console.log(JSON.stringify(await readEditorialPopulations(process.cwd()), null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
