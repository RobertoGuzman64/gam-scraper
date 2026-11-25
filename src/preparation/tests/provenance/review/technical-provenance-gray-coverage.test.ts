import assert from "node:assert/strict";
import { test } from "node:test";
import { readPortableOriginal } from "../../../../infrastructure/filesystem/catalog/originals/portable-original.js";
import { technicalDocumentClaimSha256 } from "../../../../contracts/technical-provenance.js";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import type { TechnicalDocumentVerification, TechnicalSpecEvidence } from "../../../../contracts/technical-provenance.js";
import { prepareSourceProduct } from "../../../prepare-product.js";
import { classifyPublishedTechnicalSpec } from "../../../provenance/technical-spec-classification.js";
import { reviewedModelDocumentClaims } from "../../../technical/evidence/reviewed-model-claims.js";

const accredited = [
  { provider: "gam", reference: "222", model: "Self Maxi", fields: ["Conducción con timón vertical"] },
  { provider: "gam", reference: "223", model: "Self Maxi S", fields: ["Conducción con timón vertical"] },
  { provider: "gam", reference: "216", model: "RL 500", fields: ["Recorrido de elevación"] },
  { provider: "gam", reference: "236", model: "Panther Silent", fields: ["Sistema de elevación"] },
  { provider: "gam", reference: "242", model: "Panther Inox Plus", fields: ["Timón y componentes de elevación"] },
  { provider: "gam", reference: "4819", model: "XT4018KH", fields: ["Tracción"] },
  { provider: "mercaeleva", reference: "M879-4639", model: "EDP-2000", fields: ["Capacidad nominal de carga", "Tensión del sistema de batería"] }
] as const;

const excluded = [
  { provider: "mercaeleva", reference: "M879-4639", field: "Centro de carga (mm)", value: "600 mm" },
] as const;

test("fase 34: ocho specs nuevas con modelo, documento y valor acreditados por el motor", async () => {
  const [gam, mercaeleva] = await Promise.all([
    readPortableOriginal(process.cwd(), "gam"),
    readPortableOriginal(process.cwd(), "mercaeleva")
  ]);
  const originals: Readonly<Record<string, readonly ProductRecord[]>> = {
    gam: gam.products,
    mercaeleva: mercaeleva.products
  };
  const claims = reviewedModelDocumentClaims();
  let verified = 0;
  for (const item of accredited) {
    const original = originals[item.provider]?.find((product) => product.reference === item.reference);
    assert.ok(original);
    assert.equal(original.model, item.model);
    const result = prepareSourceProduct(original);
    assert.ok(result.technicalProvenance);
    for (const field of item.fields) {
      const entry: TechnicalSpecEvidence | undefined = result.technicalProvenance.entries.find((candidate) => candidate.field === field);
      assert.ok(entry);
      assert.equal(entry.scope, "model-document");
      if (entry.scope !== "model-document") continue;
      const verification = entry.verification;
      assert.ok(verification);
      assert.ok(claims.some((claim) => claim.document.url === entry.document.url &&
        claim.document.brand === original.brand && claim.document.model === original.model &&
        claim.field === field && claim.value === entry.value &&
        claim.verification.claimSha256 === verification.claimSha256));
      assert.equal(classifyPublishedTechnicalSpec(original, result.technicalProvenance, field, entry.value), "reused");
      assert.equal(classifyPublishedTechnicalSpec({ ...original, model: "modelo distinto" },
        result.technicalProvenance, field, entry.value), "pending");
      assert.equal(classifyPublishedTechnicalSpec(original, result.technicalProvenance, field, `${entry.value} alterado`), "pending");
      assert.equal(classifyPublishedTechnicalSpec(original, { ...result.technicalProvenance,
        entries: result.technicalProvenance.entries.map((evidence) => evidence.field !== field ? evidence :
          { ...entry, document: { ...entry.document, url: "https://ejemplo-invalido.test/prueba" } })
      }, field, entry.value), "pending");
      const forgedSupport = "dato simulado con hash formalmente correcto";
      const forged: TechnicalDocumentVerification = { ...verification, support: forgedSupport,
        claimSha256: technicalDocumentClaimSha256(entry.document, field, entry.value,
          verification.reviewedOn, forgedSupport) };
      assert.equal(classifyPublishedTechnicalSpec(original, { ...result.technicalProvenance,
        entries: result.technicalProvenance.entries.map((evidence) => evidence.field !== field ? evidence :
          { ...entry, verification: forged })
      }, field, entry.value), "pending");
      verified++;
    }
  }
  assert.equal(verified, 8);
});

test("fase 34: los valores sin prueba exacta siguen pendientes incluso con fuente documental", async () => {
  const [gam, mercaeleva] = await Promise.all([
    readPortableOriginal(process.cwd(), "gam"),
    readPortableOriginal(process.cwd(), "mercaeleva")
  ]);
  const originals: Readonly<Record<string, readonly ProductRecord[]>> = {
    gam: gam.products,
    mercaeleva: mercaeleva.products
  };
  for (const item of excluded) {
    const original = originals[item.provider]?.find((product) => product.reference === item.reference);
    assert.ok(original);
    const result = prepareSourceProduct(original);
    assert.ok(result.technicalProvenance);
    const entry: TechnicalSpecEvidence | undefined = result.technicalProvenance.entries.find((candidate) => candidate.field === item.field);
    assert.equal(entry, undefined);
    assert.equal(result.product.spec[item.field], undefined);
    assert.equal(classifyPublishedTechnicalSpec(original, result.technicalProvenance, item.field, item.value), "pending");
  }
});
