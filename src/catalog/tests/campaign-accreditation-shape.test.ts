import assert from "node:assert/strict";
import { test } from "node:test";
import { isCampaignAccreditation } from "../editorial/campaign-accreditation.js";

const draft = () => ({
  version: 1,
  runId: "run-1",
  approved: false,
  approvalReason: null,
  sources: [],
  exclusions: [{
    providerId: "provider", reference: "reference", sourceUrl: "https://example.test/item",
    status: "review", issues: ["review"], decision: null, reason: null, evidenceUrls: []
  }]
});

test("La estructura compartida acepta las formas usadas por campaña y publicación individual", () => {
  assert.equal(isCampaignAccreditation(draft()), true);
  assert.equal(isCampaignAccreditation({ ...draft(), approved: true, approvalReason: "aprobación acreditada" }), true);
});

test("La estructura compartida rechaza formas ajenas al contrato sin leer catálogos", () => {
  const base = draft();
  for (const candidate of [
    null, [], "draft", { ...base, version: 2 }, { ...base, approved: "true" },
    { ...base, runId: null }, { ...base, approvalReason: 7 },
    { ...base, sources: {} }, { ...base, exclusions: {} },
    { ...base, exclusions: [{ ...base.exclusions[0], decision: "aprobar" }] },
    { ...base, exclusions: [{ ...base.exclusions[0], evidenceUrls: [5] }] },
    { ...base, exclusions: [{ ...base.exclusions[0], issues: "review" }] },
    { ...base, exclusions: [{ ...base.exclusions[0], sourceUrl: null }] }
  ]) {
    assert.equal(isCampaignAccreditation(candidate), false);
  }
});
