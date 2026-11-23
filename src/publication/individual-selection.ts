import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createAccreditationDraft, selectAccreditedPublishable, sha256 } from "../catalog/editorial/campaign-accreditation.js";
import type { AccreditedSource, CampaignAccreditation } from "../catalog/editorial/campaign-accreditation.js";
import type { PublishableSelection } from "../catalog/editorial/select-publishable.js";
import type { OfflinePreparation } from "../preparation/offline-document.js";
import { validateManainRecordSelection, validateOfflinePreparation } from "../preparation/workflow/validation/offline.js";

export type IndividualSelectionContext = {
  readonly providerId: string;
  readonly preparation: OfflinePreparation;
  readonly sources: readonly AccreditedSource[];
  readonly runId: string;
  readonly draft: CampaignAccreditation;
};

export const readIndividualSelection = async (
  providerId: string,
  catalogFile: string,
  preparationFile: string
): Promise<IndividualSelectionContext> => {
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(providerId)) throw new Error(`Identificador de proveedor inválido: ${providerId}`);
  const validated = providerId === "manain"
    ? await validateManainRecordSelection(catalogFile, preparationFile)
    : await validateOfflinePreparation(providerId, preparationFile, catalogFile);
  if (validated.preparation.source.intervention !== undefined) {
    throw new Error("La publicación individual de catálogos intervenidos requiere una acreditación de procedencia específica");
  }
  const preparationSha256 = sha256(await readFile(resolve(preparationFile), "utf8"));
  const sources: readonly AccreditedSource[] = [{
    providerId,
    catalogSha256: validated.catalog.catalogSha256,
    preparationSha256,
    productCount: validated.catalog.productCount
  }];
  const runId = `individual-${providerId}-${sha256(JSON.stringify(sources)).slice(0,32)}`;
  const draft = createAccreditationDraft([validated.preparation], sources, runId);
  return { providerId, preparation: validated.preparation, sources, runId, draft };
};

export const selectIndividualPublishable = (
  context: IndividualSelectionContext,
  accreditationText: string
): PublishableSelection => {
  const source = context.preparation.source;
  if (source.record !== undefined && (context.providerId !== "manain" || source.providerId !== "manain" ||
    source.record.quality !== "partial" || source.prefix !== "manain-record" ||
    source.scope !== source.catalogSha256.slice(0, 16) || source.intervention !== undefined ||
    context.sources.length !== 1 || context.sources[0]?.providerId !== "manain" ||
    context.sources[0]?.catalogSha256 !== source.catalogSha256 ||
    context.sources[0]?.productCount !== source.productCount)) {
    throw new Error("La procedencia parcial no está admitida por el circuito individual");
  }
  if (context.providerId === "manain" && source.record?.quality !== "partial") {
    throw new Error("La publicación individual de Manain exige el registro parcial verificado");
  }
  return selectAccreditedPublishable(
    [context.preparation], context.sources, context.runId, JSON.parse(accreditationText), sha256(accreditationText)
  );
};
