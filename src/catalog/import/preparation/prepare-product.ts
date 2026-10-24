import type { ProductRecord } from "../../../contracts/catalog.js";
import { distinguishDescriptions } from "../../normalization/descriptions.js";
import { validateCreateManyCandidate, validateImportCandidate } from "./import-validation.js";
import { resolveCategory } from "../mapping/category-mapping.js";
import { imageUrls, normalizePrice } from "./product-fields.js";
import { productAttributes } from "./product-attributes.js";
import { sourceAttributeQualityIssues } from "../mapping/source-attribute-quality.js";
import { sourceCategoryQualityIssue } from "../mapping/source-category-quality.js";
import { resolveCommercialCondition } from "./condition.js";
import { resolveMercaelevaShortDescription } from "../mapping/providers/mercaeleva/descriptions.js";
import { gamElevationSourceIdentityConflict } from "../mapping/providers/gam/elevation-identity.js";
import { reconcileGamElevationEditorialIdentity } from "../mapping/providers/gam/elevation-editorial.js";
import { reconcileGamOutdatedSourceTitle } from "../mapping/providers/gam/editorial-titles.js";
import { reconcileGamBtsEditorialSummary } from "../mapping/providers/gam/bts-editorial.js";
import { reconcileGamForkliftFuelEditorial } from "../mapping/providers/gam/forklift-fuel-editorial.js";
import { reconcileGamHandlingHeightEditorial } from "../mapping/providers/gam/handling-height-editorial.js";
import { reconcileGamHandlingCapacityEditorial } from "../mapping/providers/gam/handling-capacity-editorial.js";
import { reconcileGamOrderPickerEditorial } from "../mapping/providers/gam/orderpicker-editorial.js";
import { reconcileGamVerifiedHandlingEditorial } from "../mapping/providers/gam/handling-verified-editorial.js";
import { reconcileGamUsedLiftEditorial } from "../mapping/providers/gam/used-lift-editorial.js";
import { reconcileGamVerifiedXga43kEditorial } from "../mapping/providers/gam/xga43k-editorial.js";
import { reconcileGamVerifiedGenie5390Editorial } from "../mapping/providers/gam/genie-5390-editorial.js";
import { reconcileGamVerifiedXcmg1523Model } from "../mapping/providers/gam/xcmg-1523-model-evidence.js";
import { reconcileGamVerifiedXcmg1823Model } from "../mapping/providers/gam/xcmg-1823-model-evidence.js";
import { reconcileGamVerifiedXcmg0810Crawler } from "../mapping/providers/gam/xcmg-0810-crawler-evidence.js";
import { reconcileGamVerifiedXcmg0807acwLithium } from "../mapping/providers/gam/xcmg-0807acw-lithium-evidence.js";
import { reconcileGamVerifiedXcmg12kDiesel } from "../mapping/providers/gam/xcmg-12k-diesel-evidence.js";
import { reconcileGamVerifiedHysterSGlp } from "../mapping/providers/gam/hyster-s-glp-evidence.js";
import { reconcileGamVerifiedHysterH18xdDiesel } from "../mapping/providers/gam/hyster-h18xd-diesel-evidence.js";
import { reconcileGamVerifiedSnorkelS4732e } from "../mapping/providers/gam/snorkel-s4732e-evidence.js";
import { reconcileGamVerifiedYaleGc60vx } from "../mapping/providers/gam/yale-gc60vx-evidence.js";
import { reconcileGamVerifiedYaleGc55vxGlp } from "../mapping/providers/gam/yale-gc55vx-glp-evidence.js";
import { reconcileGamVerifiedYaleGc40vxLpg } from "../mapping/providers/gam/yale-gc40vx-lpg-evidence.js";
import { reconcileGamVerifiedYaleGc45vxLpg } from "../mapping/providers/gam/yale-gc45vx-lpg-evidence.js";
import { reconcileGamVerifiedZeroSerial } from "../mapping/providers/gam/musoshi-serial-evidence.js";
import { reconcileMercaelevaVerifiedUnicarriersCapacity } from "../mapping/providers/mercaeleva/unicarriers-used-capacity-evidence.js";
import { reconcileMercaelevaVerifiedLindeE16pMast } from "../mapping/providers/mercaeleva/linde-e16p-duplex-evidence.js";
import { describeMercaelevaE48pPublicationConflict } from "../mapping/providers/mercaeleva/linde-e48p-publication-evidence.js";
import type { ImportCandidate, ImportCatalog, PreparedProduct } from "./contracts.js";

export const prepareProduct = (record: ProductRecord, catalog: ImportCatalog): PreparedProduct => {
  const publicationConflict = describeMercaelevaE48pPublicationConflict(record);
  record = reconcileGamVerifiedZeroSerial(record);
  const originalSpecs = record.specs;
  record = reconcileGamVerifiedGenie5390Editorial(reconcileGamOrderPickerEditorial(reconcileGamHandlingHeightEditorial(reconcileGamForkliftFuelEditorial(reconcileGamBtsEditorialSummary(reconcileGamElevationEditorialIdentity(reconcileGamOutdatedSourceTitle(record)))))));
  record = reconcileGamVerifiedXcmg12kDiesel(reconcileGamVerifiedXcmg0807acwLithium(reconcileGamVerifiedXcmg0810Crawler(reconcileGamVerifiedXcmg1823Model(reconcileGamVerifiedXcmg1523Model(reconcileGamUsedLiftEditorial(reconcileGamVerifiedHandlingEditorial(reconcileGamHandlingCapacityEditorial(reconcileGamVerifiedXga43kEditorial(record)))))))));
  record = reconcileGamVerifiedHysterSGlp(record);
  record = reconcileGamVerifiedHysterH18xdDiesel(record);
  record = reconcileGamVerifiedSnorkelS4732e(record);
  record = reconcileGamVerifiedYaleGc60vx(record);
  record = reconcileGamVerifiedYaleGc55vxGlp(record);
  record = reconcileGamVerifiedYaleGc40vxLpg(record);
  record = reconcileGamVerifiedYaleGc45vxLpg(record);
  record = reconcileMercaelevaVerifiedUnicarriersCapacity(record);
  record = reconcileMercaelevaVerifiedLindeE16pMast(record);
  const issues: string[] = [];
  const { condition, contradictory: contradictoryCondition } = resolveCommercialCondition(record);
  const category = resolveCategory(record, catalog.categories, condition);
  const images = imageUrls(record);
  const price = normalizePrice(record.price);
  const reference = record.reference?.trim() || null;
  const title = record.title?.trim() || null;
  const descriptionEvidence = resolveMercaelevaShortDescription(record);
  const descriptions = distinguishDescriptions(record.shortDescription ?? descriptionEvidence.description, record.longDescription);
  if (descriptionEvidence.heightConflict) issues.push("Descripción comercial contradictoria: altura de trabajo");
  if (gamElevationSourceIdentityConflict(record)) issues.push("Identidad GAM contradictoria entre título, resumen y ficha técnica");
  const attributeResult = productAttributes(record, category, catalog);

  if (contradictoryCondition) issues.push("Condición comercial contradictoria entre la ficha y el origen");
  if (publicationConflict !== null) issues.push(publicationConflict);
  if (!reference) issues.push("Referencia ausente");
  if (!category) {
    const sourceIssue = sourceCategoryQualityIssue(record);
    if (sourceIssue) issues.push(sourceIssue);
  }
  if (price === null && /\d/.test(record.price ?? "")) issues.push("Precio publicado inválido");
  issues.push(...(category ? attributeResult.qualityIssues : sourceAttributeQualityIssues(record, catalog)));

  const product: ImportCandidate = {
    providerId: record.providerId,
    sourceUrl: record.url,
    reference,
    title,
    categorySellID: category?.id ?? null,
    category: category?.name ?? null,
    condition,
    price,
    description_title: title,
    description: descriptions.short,
    description_general: descriptions.long,
    image: images[0] ?? null,
    images,
    spec: originalSpecs ?? {},
    attributes: attributeResult.attributes
  };
  return {
    status: issues.length ? "review" : "ready",
    issues,
    importIssues: {
      excel: validateImportCandidate(product, catalog),
      createMany: validateCreateManyCandidate(product, catalog)
    },
    product
  };
};
