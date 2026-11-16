import assert from "node:assert/strict";
import test from "node:test";
import type { ProductRecord } from "../../../../../contracts/catalog.js";
import { accreditedSourceRecord } from "../../../../../testing/domain-cases/accredited-source-samples.js";
import { loadImportCatalog } from "../../../../../infrastructure/filesystem/legacy-export/import-catalog-loader.js";
import { prepareProduct } from "../../../../../commercial/legacy-export/prepare-product.js";
import { prepareSourceProduct } from "../../../../prepare-product.js";
import { isGamVerifiedHysterSGlp } from "../../models/hyster-s-glp-evidence.js";
import { isGamVerifiedYaleGc40vxLpg } from "../../models/yale-gc40vx-lpg-evidence.js";
import { isGamVerifiedYaleGc45vxLpg } from "../../models/yale-gc45vx-lpg-evidence.js";
import { isGamVerifiedYaleGc55vxGlp } from "../../models/yale-gc55vx-glp-evidence.js";
import { reconcileSourceCategoryTitle, reconcileVerifiedSourceFuel } from "../../../../shared/technical/reconciliation/preparation-technical-stages.js";

const catalog = await loadImportCatalog();
const references = ["2072", "2073", "2311", "2312", "2313"] as const;

const byReference = (reference: string): ProductRecord =>
  accreditedSourceRecord(reference === "2072" ? "gam-verified-fuel-cases" : "gam-original", reference);

const verified = (record: ProductRecord): boolean =>
  isGamVerifiedHysterSGlp(record) || isGamVerifiedYaleGc40vxLpg(record) ||
  isGamVerifiedYaleGc45vxLpg(record) || isGamVerifiedYaleGc55vxGlp(record);

test("las cinco evidencias firmadas recuperan originales sin modificar su origen", () => {
  for (const reference of references) {
    const original = byReference(reference);
    const snapshot = JSON.stringify(original);
    const corrected = reconcileVerifiedSourceFuel(reconcileSourceCategoryTitle(original));
    assert.ok(verified(corrected), reference);
    assert.equal(reconcileVerifiedSourceFuel(corrected), corrected, reference);
    const result = prepareSourceProduct(original);
    assert.equal(result.status, "ready", reference);
    assert.deepEqual(result.issues, [], reference);
    assert.equal(result.product.spec["Motorización"], "GLP", reference);
    assert.match(result.product.title ?? "", /GLP/u, reference);
    assert.doesNotMatch(result.product.title ?? "", /diésel|eléctrica/iu, reference);
    const commercial = prepareProduct(original, catalog);
    assert.equal(commercial.status, "ready", reference);
    assert.deepEqual(commercial.issues, [], reference);
    assert.equal(commercial.product.spec["Motorización"], "GLP", reference);
    assert.equal(JSON.stringify(original), snapshot, reference);
  }
});

test("cambios de firma, identidad o procedencia no heredan reconciliaciones acreditadas", () => {
  for (const reference of references) {
    const original = byReference(reference);
    const variants: readonly ProductRecord[] = [
      { ...original, longDescription: `${original.longDescription} Variante sin corroborar.` },
      { ...original, specs: { ...original.specs, Peso: "99999 KG" } },
      { ...original, title: `${original.title} Variante` },
      { ...original, url: "https://example.invalid/identidad-diferente" },
      { ...original, providerId: "gomariz" }
    ];
    for (const variant of variants) {
      const corrected = reconcileVerifiedSourceFuel(reconcileSourceCategoryTitle(variant));
      assert.equal(corrected, variant, `${reference}:${variant.url}:${variant.title}`);
      assert.equal(verified(corrected), false, reference);
    }
    for (const variant of variants.slice(0, 4)) {
      const prepared = prepareSourceProduct(variant);
      assert.equal(prepared.status, "review", reference);
      assert.ok(prepared.issues.length > 0, reference);
    }
  }
});
