import { resolveAccreditedPublication } from "../infrastructure/filesystem/catalog/accredited-publication.js";
import { publicationApprovalSha } from "../infrastructure/filesystem/catalog/publication-identity.js";
import { deliverIndividualArchive } from "./individual-archive.js";
import type { IndividualArchiveResult } from "./individual-archive.js";
import { deliverIndividualProvider } from "./individual-delivery.js";
import type { IndividualEditorialOptions } from "./individual-editorial.js";
import { selectActivePublication } from "./active-publication.js";
import type { PublicationActivation } from "./active-publication.js";
import { PublicationAcceptanceError } from "./publication-acceptance.js";

export type IndividualClosureMode = "publish" | "candidate" | "verify" | "simulation";

export type IndividualClosureResult = {
  readonly delivery: IndividualArchiveResult;
  readonly activation: "activated" | "unchanged" | "blocked" | "not_requested";
  readonly selection: PublicationActivation | null;
  readonly blockers: readonly string[];
};

export const completeIndividualDelivery = async (
  options: IndividualEditorialOptions, desktopDirectory: string | null,
  mode: IndividualClosureMode = "publish"
): Promise<IndividualClosureResult> => {
  const deliveryMode = mode === "candidate" ? "publish" : mode;
  const delivery = desktopDirectory === null
    ? { ...await deliverIndividualProvider(options, deliveryMode), zipFile: null }
    : await deliverIndividualArchive(options, desktopDirectory, deliveryMode);
  if (mode !== "publish") {
    return { delivery, activation: "not_requested", selection: null, blockers: [] };
  }
  const approvalSha = await publicationApprovalSha(delivery.publicationDirectory);
  try {
    try {
      await resolveAccreditedPublication(options.rootDirectory, options.providerId);
    } catch (error) {
      if (error instanceof Error && error.message.startsWith(`Varias publicaciones de ${options.providerId} `)) {
        throw new PublicationAcceptanceError(["No existe una selección inicial inequívoca; utiliza la selección expresa de recuperación"]);
      }
      throw error;
    }
    const selection = await selectActivePublication(options.rootDirectory, options.providerId, approvalSha, true);
    return { delivery, activation: selection.status === "activated" ? "activated" : "unchanged", selection, blockers: [] };
  } catch (error) {
    if (!(error instanceof PublicationAcceptanceError)) throw error;
    return { delivery, activation: "blocked", selection: null, blockers: error.blockers };
  }
};
