import { CAMPAIGN_PROVIDERS } from '../../dist/contracts/campaign-providers.js';
export { readEditorialAuditSource, loadEditorialAuditPopulation, editorialAuditFingerprints } from '../../dist/infrastructure/filesystem/preparation/editorial-audit-population.js';

export const editorialAuditCoverage = (providers) => {
  const expected = [...CAMPAIGN_PROVIDERS];
  const selected = [...expected];
  const processed = selected.filter((provider) => providers[provider]?.exceptions === 0);
  const unavailable = selected.filter((provider) => !Object.hasOwn(providers, provider));
  const incomplete = selected.filter((provider) => Object.hasOwn(providers, provider) && !processed.includes(provider));
  return { expected, selected, processed, unavailable, incomplete };
};
