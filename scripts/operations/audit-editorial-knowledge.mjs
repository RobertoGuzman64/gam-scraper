import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { prepareSourceProduct } from '../../dist/preparation/prepare-product.js';
import { resolveKnowledgeEditorial } from '../../dist/preparation/shared/editorial/mapping/knowledge-editorial.js';
import { loadEditorialKnowledge } from '../../dist/infrastructure/filesystem/editorial/knowledge.js';

const root = process.cwd();
const read = (path) => JSON.parse(readFileSync(resolve(root, path), 'utf8'));
const knowledge = loadEditorialKnowledge();
const summary = { version: 1, kind: 'diagnostico_sin_publicacion', providers: {}, total: {
  records: 0, ready: 0, review: 0, exceptions: 0, verifiedUnitGeneralApplied: 0,
  verifiedUnitShortApplied: 0, verifiedUnitTitlesApplied: 0, modelReferencesApplied: 0, familyGuidanceApplied: 0,
  emptyShort: 0, emptyGeneral: 0
}, problems: [] };
for (const provider of ['gam', 'gomariz', 'mercaeleva']) {
  const products = read(`catalogs/providers/${provider}/original/scrape-${provider}-catalog.json`).products;
  const counters = { records: products.length, ready: 0, review: 0, exceptions: 0,
    verifiedUnitGeneralApplied: 0, verifiedUnitShortApplied: 0, verifiedUnitTitlesApplied: 0, modelReferencesApplied: 0,
    familyGuidanceApplied: 0, emptyShort: 0, emptyGeneral: 0 };
  for (const record of products) {
    try {
      const result = prepareSourceProduct(record);
      const reference = resolveKnowledgeEditorial(record, record);
      if (result.status === 'ready') counters.ready++;
      else counters.review++;
      if (reference.general && result.product.description_general === reference.general) counters.verifiedUnitGeneralApplied++;
      if (reference.short && result.product.description === reference.short) counters.verifiedUnitShortApplied++;
      if (reference.title && result.product.title === reference.title) counters.verifiedUnitTitlesApplied++;
      if (reference.modelReference && result.product.description_general?.includes(reference.modelReference)) counters.modelReferencesApplied++;
      if (reference.familyGuidance && result.product.description_general?.includes(reference.familyGuidance)) counters.familyGuidanceApplied++;
      if (!result.product.description?.trim()) counters.emptyShort++;
      if (!result.product.description_general?.trim()) counters.emptyGeneral++;
    } catch (error) {
      counters.exceptions++;
      summary.problems.push({ provider, reference: record.reference, error: error instanceof Error ? error.message : String(error) });
    }
  }
  summary.providers[provider] = counters;
  for (const [key, value] of Object.entries(counters)) summary.total[key] += value;
}
summary.evidence = { verifiedUnits: knowledge.units.size, consensusModels: knowledge.models.size,
  familyProfiles: Object.keys(knowledge.families).length, verifiedManufacturerRules: knowledge.modelRules.size };
const target = resolve(root, 'reports/editorial-phase3');
mkdirSync(target, { recursive: true });
writeFileSync(resolve(target, 'audit.json'), JSON.stringify(summary, null, 2) + '\n');
console.log('ACREDITACIÓN PARCIAL | MOTOR EDITORIAL F3 | ' + JSON.stringify(summary.total));
if (summary.total.exceptions) process.exitCode = 1;
