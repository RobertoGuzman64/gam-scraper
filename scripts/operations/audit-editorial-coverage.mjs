import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { editorialAuditFingerprints, loadEditorialAuditPopulation } from './editorial-audit-population.mjs';
import { resolveEditorialFacts } from '../../dist/preparation/shared/editorial/domain/editorial-facts.js';
import { resolveReusableEditorial } from '../../dist/preparation/shared/editorial/domain/editorial-composition.js';
import { resolveSourceEditorialClaims } from '../../dist/preparation/shared/editorial/domain/editorial-source-claims.js';
import { resolveUnbrandedEditorial } from '../../dist/preparation/shared/editorial/domain/editorial-unbranded-equipment.js';
import { resolveKnowledgeEditorial } from '../../dist/preparation/shared/editorial/mapping/knowledge-editorial.js';
import { loadEditorialKnowledge } from '../../dist/infrastructure/filesystem/editorial/knowledge.js';

const root = process.cwd();
const knowledge = loadEditorialKnowledge();
const keys = ['records','ready','review','exceptions','facts','loadCenters','turningRadii',
  'cleaningWidths','baskets','drawbarPulls','verifiedUnbranded','sourceClaimEligible',
  'sourceClaimApplied','signedShortApplied','signedGeneralApplied','signedTitlesApplied',
  'signedIdentityExceptionsApplied','unitContextApplied','modelReferencesApplied',
  'emptyShort','emptyGeneral'];
const counters = () => Object.fromEntries(keys.map((key) => [key, 0]));
const report = { version: 1, mode: 'lectura_sin_publicacion', providers: {}, total: counters(), errors: [],
  provenance: { stage: 'preparacion_offline', universe: 'originales_canonicos', analyzedAt: new Date().toISOString(),
    sources: {}, complete: true },
  evidence: { signedUnits: knowledge.units.size, modelConsensus: knowledge.models.size,
    familyProfiles: Object.keys(knowledge.families).length,
    declaredManufacturerModels: knowledge.modelRules.size } };
const fingerprints = await editorialAuditFingerprints();
for (const provider of ['gam','gomariz','mercaeleva']) {
  let population;
  try {
    population = await loadEditorialAuditPopulation(root, provider, fingerprints);
  } catch (error) {
    report.errors.push({ provider, reference: null, message: error instanceof Error ? error.message : String(error) });
    continue;
  }
  const { records, prepared, provenance } = population;
  report.provenance.sources[provider] = provenance;
  const stats = counters();
  for (const [index, record] of records.entries()) {
    stats.records++;
    try {
      const result = prepared[index];
      if (result.status === 'ready') stats.ready++;
      else stats.review++;
      const facts = resolveEditorialFacts(record);
      if (facts) {
        stats.facts++;
        if (facts.loadCenterMm !== null) stats.loadCenters++;
        if (facts.turningRadiusM !== null) stats.turningRadii++;
        if (facts.cleaningWidthM !== null) stats.cleaningWidths++;
        if (facts.basketLengthM !== null) stats.baskets++;
        if (facts.drawbarPullN !== null) stats.drawbarPulls++;
      }
      if (resolveUnbrandedEditorial(record)) stats.verifiedUnbranded++;
      const base = resolveReusableEditorial(record).general;
      const derived = resolveSourceEditorialClaims(record, record, base);
      if (derived && derived !== base) {
        stats.sourceClaimEligible++;
        if (result.product.description_general?.includes(derived.slice(base?.length ?? 0).trim())) stats.sourceClaimApplied++;
      }
      const signed = resolveKnowledgeEditorial(record);
      if (signed.short && signed.short === result.product.description) stats.signedShortApplied++;
      if (signed.general && signed.general === result.product.description_general) stats.signedGeneralApplied++;
      if (signed.title && signed.title === result.product.title) stats.signedTitlesApplied++;
      if (signed.identityOverride && signed.short === result.product.description) stats.signedIdentityExceptionsApplied++;
      if (/Ubicación declarada para esta unidad|Número de serie declarado para esta unidad/u.test(result.product.description_general ?? '')) stats.unitContextApplied++;
      if (signed.modelReference && result.product.description_general?.includes(signed.modelReference)) stats.modelReferencesApplied++;
      if (!result.product.description?.trim()) stats.emptyShort++;
      if (!result.product.description_general?.trim()) stats.emptyGeneral++;
    } catch (error) {
      stats.exceptions++;
      report.errors.push({ provider, reference: record.reference,
        message: error instanceof Error ? error.message : String(error) });
    }
  }
  report.providers[provider] = stats;
  for (const key of keys) report.total[key] += stats[key];
}
report.provenance.complete = report.errors.length === 0;
const folder = resolve(root, 'reports/editorial-coverage');
mkdirSync(folder, { recursive: true });
writeFileSync(resolve(folder, 'audit.json'), JSON.stringify(report, null, 2) + '\n');
console.log(`AUDITORÍA EDITORIAL | COBERTURA SIN PUBLICACIÓN | originales canónicos ${report.total.records} · ${report.total.ready} ready por lote · ${report.total.review} revisión · ${report.total.exceptions} excepciones`);
if (report.errors.length > 0) {
  console.error(`AUDITORÍA EDITORIAL INCOMPLETA | ${report.errors.map((item) => `${item.provider}: ${item.message}`).join('; ')}`);
  process.exitCode = 1;
}
