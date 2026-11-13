import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { prepareSourceProduct } from '../../dist/preparation/prepare-product.js';
import { resolveEditorialFacts } from '../../dist/preparation/shared/editorial/domain/editorial-facts.js';
import { resolveReusableEditorial } from '../../dist/preparation/shared/editorial/domain/editorial-composition.js';
import { resolveSourceEditorialClaims } from '../../dist/preparation/shared/editorial/domain/editorial-source-claims.js';
import { resolveUnbrandedEditorial } from '../../dist/preparation/shared/editorial/domain/editorial-unbranded-equipment.js';
import { resolveKnowledgeEditorial } from '../../dist/preparation/shared/editorial/mapping/knowledge-editorial.js';
import { loadEditorialKnowledge } from '../../dist/infrastructure/filesystem/editorial/knowledge.js';

const root = process.cwd();
const knowledge = loadEditorialKnowledge();
const read = (path) => JSON.parse(readFileSync(resolve(root, path), 'utf8'));
const keys = ['records','ready','review','exceptions','facts','loadCenters','turningRadii',
  'cleaningWidths','baskets','drawbarPulls','verifiedUnbranded','sourceClaimEligible',
  'sourceClaimApplied','signedShortApplied','signedGeneralApplied','signedTitlesApplied',
  'signedIdentityExceptionsApplied','unitContextApplied','modelReferencesApplied',
  'emptyShort','emptyGeneral'];
const counters = () => Object.fromEntries(keys.map((key) => [key, 0]));
const report = { version: 1, mode: 'lectura_sin_publicacion', providers: {}, total: counters(), errors: [],
  evidence: { signedUnits: knowledge.units.size, modelConsensus: knowledge.models.size,
    familyProfiles: Object.keys(knowledge.families).length,
    declaredManufacturerModels: knowledge.modelRules.size } };
for (const provider of ['gam','gomariz','mercaeleva']) {
  const rows = read(`catalogs/providers/${provider}/original/scrape-${provider}-catalog.json`).products;
  const stats = counters();
  for (const record of rows) {
    stats.records++;
    try {
      const result = prepareSourceProduct(record);
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
const folder = resolve(root, 'reports/editorial-coverage');
mkdirSync(folder, { recursive: true });
writeFileSync(resolve(folder, 'audit.json'), JSON.stringify(report, null, 2) + '\n');
console.log(`AUDITORÍA EDITORIAL | COBERTURA SIN PUBLICACIÓN | ${report.total.records} originales · ${report.total.ready} preparados · ${report.total.review} revisión · ${report.total.exceptions} excepciones`);
if (report.total.exceptions > 0) process.exitCode = 1;
