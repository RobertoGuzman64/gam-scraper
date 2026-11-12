import type { ImportCandidate } from "../legacy-export/contracts.js";
import { decideCommercialCategory } from "../projection/category-decision.js";
import { inspectTechnicalSpecifications } from "../validation/technical-specifications.js";
import { commercialToken, projectCommercialPresentation } from "../projection/presentation-projection.js";
import type { CommercialMetadata } from "../projection/presentation-projection.js";
import type { CommercialBaselineInput } from "./commercial-baseline.js";
import { commercialUnitTitleSuffixes } from "../projection/unit-disambiguation.js";
import { prepareCommercialEditorialInputs } from "../projection/editorial-inputs.js";
import { inspectCommercialEditorialQuality, type CommercialEditorialSignal } from "../validation/editorial-quality.js";

type ContentSignal =
  "imagen-principal-fuera-de-galeria" | "titulo-vacio" | CommercialEditorialSignal;

type PresentationDecision = {
  readonly reference: string | null;
  readonly sourceUrl: string;
  readonly categorySellID: number | null;
  readonly status: "proposed" | "pending" | "excluded";
  readonly title: string | null;
  readonly shortPreview: string | null;
  readonly generalPreview: string | null;
  readonly images: number;
  readonly specifications: number;
  readonly metadata: CommercialMetadata | null;
  readonly titleChanged: boolean;
  readonly descriptionTitleChanged: boolean;
  readonly signals: readonly ContentSignal[];
};

export type CommercialPresentationAudit = {
  readonly eligible: number;
  readonly excluded: number;
  readonly categorized: number;
  readonly pendingCategory: number;
  readonly withTitle: number;
  readonly withShort: number;
  readonly withGeneral: number;
  readonly withImage: number;
  readonly withMetadata: number;
  readonly metadataWithCategory: number;
  readonly metadataWithBrand: number;
  readonly metadataWithModel: number;
  readonly titlesNormalized: number;
  readonly descriptionTitlesNormalized: number;
  readonly changedShort: number;
  readonly changedGeneral: number;
  readonly lostImages: number;
  readonly lostSpecifications: number;
  readonly signals: readonly { readonly reason: ContentSignal; readonly affected: number; readonly examples: readonly string[] }[];
  readonly decisions: readonly PresentationDecision[];
};

const preview = (value: string | null): string | null => value === null ? null : value.slice(0, 180);
const distinctContent = (published: ImportCandidate, projected: Pick<ImportCandidate, "images" | "spec">): {
  readonly images: number; readonly specifications: number;
} => {
  const invalidKeys = new Set(inspectTechnicalSpecifications(published.spec).map(({ key }) => key));
  return {
  images: published.images.filter((value) => !projected.images.includes(value)).length,
  specifications: Object.keys(published.spec).filter((key) => !(key in projected.spec) && !invalidKeys.has(key)).length
  };
};

export const analyzeCommercialPresentation = (entries: readonly CommercialBaselineInput[]): CommercialPresentationAudit => {
  const decisions: PresentationDecision[] = [];
  const normalized = prepareCommercialEditorialInputs(entries);
  const titleSuffixes = commercialUnitTitleSuffixes(normalized);
  const signals = new Map<ContentSignal, { affected: number; examples: string[] }>();
  let excluded = 0;
  let categorized = 0;
  let pendingCategory = 0;
  let withTitle = 0;
  let withShort = 0;
  let withGeneral = 0;
  let withImage = 0;
  let metadataWithCategory = 0;
  let metadataWithBrand = 0;
  let metadataWithModel = 0;
  let titlesNormalized = 0;
  let descriptionTitlesNormalized = 0;
  let changedShort = 0;
  let changedGeneral = 0;
  let lostImages = 0;
  let lostSpecifications = 0;
  const addSignal = (reason: ContentSignal, url: string): void => {
    const group = signals.get(reason) ?? { affected: 0, examples: [] };
    group.affected += 1;
    if (group.examples.length < 5) group.examples.push(url);
    signals.set(reason, group);
  };
  for (const [index, { source, published, mapped }] of entries.entries()) {
    const decision = decideCommercialCategory(source, mapped.product.categorySellID);
    if (decision.status === "excluded") {
      excluded += 1;
      decisions.push({ reference: published.reference, sourceUrl: published.sourceUrl, categorySellID: null,
        status: "excluded", title: null, shortPreview: null, generalPreview: null, images: 0,
        specifications: 0, metadata: null, titleChanged: false, descriptionTitleChanged: false, signals: [] });
      continue;
    }
    if (decision.status === "proposed") categorized += 1;
    else pendingCategory += 1;
    const categoryName = decision.status === "proposed" ? mapped.product.category : null;
    const preparedPublished = normalized[index]?.published;
    if (!preparedPublished) throw new Error(`Origen editorial no preparado: ${published.sourceUrl}`);
    const presentation = projectCommercialPresentation(source, preparedPublished, categoryName,
      titleSuffixes.get(published.sourceUrl) ?? "");
    const ownSignals: ContentSignal[] = [];
    const mark = (reason: ContentSignal): void => { ownSignals.push(reason); addSignal(reason, published.sourceUrl); };
    if (!presentation.title) mark("titulo-vacio");
    if (presentation.image && !presentation.images.includes(presentation.image)) mark("imagen-principal-fuera-de-galeria");
    for (const issue of inspectCommercialEditorialQuality(presentation)) mark(issue.reason);
    if (presentation.title) withTitle += 1;
    if (presentation.description?.trim()) withShort += 1;
    if (presentation.description_general?.trim()) withGeneral += 1;
    if (presentation.image) withImage += 1;
    if (categoryName && presentation.metadata.tags.includes(commercialToken(categoryName))) metadataWithCategory += 1;
    if (source.brand && presentation.metadata.tags.includes(commercialToken(source.brand))) metadataWithBrand += 1;
    if (source.model && presentation.metadata.keywords.includes(commercialToken(source.model))) metadataWithModel += 1;
    const titleChanged = presentation.title !== published.title;
    if (titleChanged) titlesNormalized += 1;
    const descriptionTitleChanged = presentation.description_title !== published.description_title;
    if (descriptionTitleChanged) descriptionTitlesNormalized += 1;
    if (presentation.description !== published.description) changedShort += 1;
    if (presentation.description_general !== published.description_general) changedGeneral += 1;
    const lost = distinctContent(published, presentation);
    lostImages += lost.images;
    lostSpecifications += lost.specifications;
    decisions.push({ reference: published.reference, sourceUrl: published.sourceUrl,
      categorySellID: decision.categorySellID, status: decision.status,
      title: presentation.title, shortPreview: preview(presentation.description),
      generalPreview: preview(presentation.description_general), images: presentation.images.length,
      specifications: Object.keys(presentation.spec).length, metadata: presentation.metadata,
      titleChanged, descriptionTitleChanged, signals: ownSignals });
  }
  return {
    eligible: categorized + pendingCategory, excluded, categorized, pendingCategory,
    withTitle, withShort, withGeneral, withImage, withMetadata: categorized + pendingCategory,
    metadataWithCategory, metadataWithBrand, metadataWithModel,
    titlesNormalized, descriptionTitlesNormalized, changedShort, changedGeneral, lostImages, lostSpecifications,
    signals: [...signals].map(([reason, stats]) => ({ reason, ...stats }))
      .sort((a, b) => b.affected - a.affected || a.reason.localeCompare(b.reason, "es")),
    decisions: decisions.sort((a, b) => a.sourceUrl.localeCompare(b.sourceUrl, "es"))
  };
};
