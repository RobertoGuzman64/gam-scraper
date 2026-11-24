import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { editorialAuditFingerprints, loadEditorialAuditPopulation } from './editorial-audit-population.mjs';
import { resolveKnowledgeEditorial } from '../../dist/preparation/editorial/core/knowledge-editorial.js';
import { loadEditorialKnowledge } from '../../dist/infrastructure/filesystem/editorial/knowledge.js';

const root = process.cwd();
const knowledge = loadEditorialKnowledge();
const summary = { version: 1, kind: 'diagnostico_sin_publicacion', providers: {}, total: {
  records: 0, ready: 0, review: 0, exceptions: 0, verifiedUnitGeneralApplied: 0,
  verifiedUnitShortApplied: 0, verifiedUnitTitlesApplied: 0, familyGuidanceApplied: 0,
  emptyShort: 0, emptyGeneral: 0, signedUnits: 0, signedUnitsWithoutExactMatch: 0,
  signedFields: 0, signedFieldsWithoutExactMatch: 0
}, problems: [], signedDifferences: [],
  provenance: { stage: 'preparacion_offline', universe: 'originales_canonicos', analyzedAt: new Date().toISOString(),
    sources: {}, complete: true } };
const fingerprints = await editorialAuditFingerprints();
for (const provider of ['gam', 'gomariz', 'mercaeleva']) {
  let population;
  try {
    population = await loadEditorialAuditPopulation(root, provider, fingerprints);
  } catch (error) {
    summary.problems.push({ provider, reference: null, error: error instanceof Error ? error.message : String(error) });
    continue;
  }
  const { records: products, prepared, provenance } = population;
  summary.provenance.sources[provider] = provenance;
  const counters = { records: products.length, ready: 0, review: 0, exceptions: 0,
    verifiedUnitGeneralApplied: 0, verifiedUnitShortApplied: 0, verifiedUnitTitlesApplied: 0,
    familyGuidanceApplied: 0, emptyShort: 0, emptyGeneral: 0, signedUnits: 0,
    signedUnitsWithoutExactMatch: 0, signedFields: 0, signedFieldsWithoutExactMatch: 0 };
  for (const [index, record] of products.entries()) {
    try {
      const result = prepared[index];
      const reference = resolveKnowledgeEditorial(record, record);
      if (result.status === 'ready') counters.ready++;
      else counters.review++;
      if (reference.general && result.product.description_general === reference.general) counters.verifiedUnitGeneralApplied++;
      if (reference.short && result.product.description === reference.short) counters.verifiedUnitShortApplied++;
      if (reference.title && result.product.title === reference.title) counters.verifiedUnitTitlesApplied++;
      if (reference.familyGuidance && result.product.description_general?.includes(reference.familyGuidance)) counters.familyGuidanceApplied++;
      const signedFields = [
        ['short', reference.short, result.product.description],
        ['general', reference.general, result.product.description_general],
        ['fallbackGeneral', reference.fallbackGeneral, result.product.description_general],
        ['title', reference.title, result.product.title]
      ].filter(([, value]) => typeof value === 'string' && value.trim());
      if (signedFields.length > 0) {
        counters.signedUnits++;
        counters.signedFields += signedFields.length;
        const unmatched = signedFields.filter(([, signed, actual]) => signed !== actual);
        counters.signedFieldsWithoutExactMatch += unmatched.length;
        if (unmatched.length === signedFields.length) counters.signedUnitsWithoutExactMatch++;
        for (const [field, signed, actual] of unmatched) {
          summary.signedDifferences.push({ provider, reference: record.reference, field,
            status: result.status, signed, prepared: actual,
            sources: (knowledge.units.get(`${provider}:${record.reference}`) ?? []).map((entry) =>
              entry.manufacturerSource ?? entry.manufacturerUrl ?? entry.verificationUrl ?? entry.sourceUrl) });
        }
      }
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
summary.provenance.complete = summary.problems.length === 0;
summary.evidence = { verifiedUnits: knowledge.units.size, consensusModels: knowledge.models.size,
  familyProfiles: Object.keys(knowledge.families).length, verifiedManufacturerRules: knowledge.modelRules.size };
const target = resolve(root, 'catalogs/reports/editorial-knowledge');
mkdirSync(target, { recursive: true });
writeFileSync(resolve(target, 'audit.json'), JSON.stringify(summary, null, 2) + '\n');
console.log('AUDITORÍA EDITORIAL | REUTILIZACIÓN SIN PUBLICACIÓN | ' + JSON.stringify(summary.total));
if (summary.problems.length) {
  console.error(`AUDITORÍA EDITORIAL INCOMPLETA | ${summary.problems.map((item) => `${item.provider}: ${item.error}`).join('; ')}`);
  process.exitCode = 1;
}
