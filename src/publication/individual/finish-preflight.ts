import { dirname, resolve } from "node:path";
import { readActiveCatalogIndex } from "../../infrastructure/filesystem/catalog/publications/active-selection.js";
import { resolveAccreditedPublication, readAccreditedPublication } from "../../infrastructure/filesystem/catalog/publications/accredited-publication.js";
import { publicationApprovalSha } from "../../infrastructure/filesystem/catalog/publications/publication-identity.js";
import { readPortableOriginalArtifacts } from "../../infrastructure/filesystem/catalog/originals/portable-original.js";
import { readVerifiedManainRecordSource } from "../../infrastructure/filesystem/catalog/originals/manain-record-source.js";
import { requireIndividualPreparationContext } from "../../preparation/workflow/individual-context.js";
import type { IndividualCatalogProvider } from "../../preparation/workflow/individual-context.js";
import type { ImportCandidate } from "../../commercial/legacy-export/contracts.js";
import type { ProductRecord } from "../../contracts/catalog.js";
import type { OfflinePreparation } from "../../preparation/documents/offline-document.js";
import type { CampaignAccreditation } from "../../catalog/editorial/campaign-accreditation.js";
import type { PublicationDifference } from "../publication-contracts.js";
import { sha256 } from "../../catalog/editorial/campaign-accreditation.js";
import { preflightIndividualAccreditations } from "./individual-accreditation.js";
import { planAutomaticIndividualAccreditation } from "./automatic-individual-accreditation.js";
import { readIndividualEditorialState } from "./individual-editorial.js";
import { readIndividualSelection, selectIndividualPublishable } from "./individual-selection.js";
import { differenceBetween } from "../active-publication.js";
import { readIndividualActiveSha } from "./individual-finish.js";
import { evaluateIndividualPublicationDifference } from "../publication-acceptance.js";
import { classifyFinishAbsences } from "./finish-preflight-diagnostics.js";
import type { FinishAbsentReference } from "./finish-preflight-diagnostics.js";

export type FinishPreflightBlocker = {
  readonly reference: string | null;
  readonly step: "origen" | "preparacion" | "acreditacion" | "seleccion" | "vigente" | "aceptacion";
  readonly reason: string;
};

export type FinishPreflightProvider = {
  readonly providerId: IndividualCatalogProvider;
  readonly original: { readonly sha256: string; readonly count: number } | null;
  readonly preparation: { readonly preparedAt: string; readonly ready: number; readonly review: number } | null;
  readonly published: { readonly approvalSha256: string; readonly count: number } | null;
  readonly candidate: { readonly approvalSha256: string; readonly count: number } | null;
  readonly difference: PublicationDifference | null;
  readonly absences: readonly FinishAbsentReference[];
  readonly blockers: readonly FinishPreflightBlocker[];
  readonly evaluable: boolean;
};

export type FinishPreflightReport = {
  readonly version: 1;
  readonly mode: "simulation";
  readonly complete: boolean;
  readonly providers: readonly FinishPreflightProvider[];
};

const reasonOf = (error: unknown): string => error instanceof Error ? error.message : String(error);

const inspectProvider = async (
  workspace: string, providerId: IndividualCatalogProvider, globalIssue: string | null
): Promise<FinishPreflightProvider> => {
  const blockers: FinishPreflightBlocker[] = [];
  const block = (step: FinishPreflightBlocker["step"], reason: string, reference: string | null = null): void => {
    blockers.push({ reference, step, reason });
  };
  let original: { readonly sha256: string; readonly count: number } | null = null;
  let originalProducts: readonly ProductRecord[] | null = null;
  let previous: readonly ImportCandidate[] = [];
  let published: FinishPreflightProvider["published"] = null;
  let preparation: OfflinePreparation | null = null;
  let candidate: FinishPreflightProvider["candidate"] = null;
  let selected: readonly ImportCandidate[] | null = null;
  let approval: CampaignAccreditation | null = null;
  let difference: PublicationDifference | null = null;
  if (globalIssue) block("vigente", globalIssue);
  try {
    if (providerId === "manain") {
      const verified = await readVerifiedManainRecordSource(workspace);
      original = { sha256: verified.recordSha256, count: verified.originalProducts.length };
      originalProducts = verified.originalProducts;
    } else {
      const { catalog, files } = await readPortableOriginalArtifacts(workspace, providerId);
      const raw = files.find((item) => item.name.endsWith("-catalog.json"));
      if (!raw) throw new Error("Catálogo portátil sin fuente verificable");
      original = { sha256: sha256(raw.content), count: catalog.productCount };
      originalProducts = catalog.products;
    }
  } catch (error) { block("origen", reasonOf(error)); }
  try {
    const file = await resolveAccreditedPublication(workspace, providerId);
    if (file) {
      const active = await readAccreditedPublication(file);
      previous = active.products;
      published = { approvalSha256: await publicationApprovalSha(dirname(file)), count: active.products.length };
    }
  } catch (error) { block("vigente", reasonOf(error)); }
  let context;
  if (original) {
    try {
      const current = await requireIndividualPreparationContext(workspace, providerId);
      preparation = current.preparation;
    } catch (error) { block("preparacion", reasonOf(error)); }
    if (preparation) {
      try {
        const contexts = await preflightIndividualAccreditations(workspace, [providerId]);
        context = contexts[0];
        if (!context) block("acreditacion", "Preflight de acreditación sin proveedor");
      } catch (error) { block("acreditacion", reasonOf(error)); }
    }
  }
  if (context) {
    if (!context.existing?.inspection.approved) {
      for (const entry of context.expected.exclusions) {
        try {
          planAutomaticIndividualAccreditation({ ...context, expected: { ...context.expected, exclusions: [entry] } });
        } catch (error) { block("acreditacion", reasonOf(error), entry.reference); }
      }
    } else if (context.existing.inspection.issues.length) {
      for (const issue of context.existing.inspection.issues) block("acreditacion", issue.message, issue.reference);
    }
    if (!blockers.some((item) => item.step === "acreditacion")) {
      try {
        const planned = planAutomaticIndividualAccreditation(context);
        const selectionContext = await readIndividualSelection(providerId, context.options.catalogFile, context.options.preparationFile);
        if (planned.runId !== selectionContext.runId) throw new Error("La preparación cambió durante el preflight");
        const raw = context.existing?.inspection.approved
          ? (await readIndividualEditorialState(context.options)).raw
          : JSON.stringify(planned, null, 2);
        const result = selectIndividualPublishable(selectionContext, raw);
        approval = context.existing?.inspection.approved ? context.existing.accreditation : planned;
        selected = result.products;
        candidate = { approvalSha256: sha256(raw), count: result.totals.publishable };
        difference = differenceBetween(published?.approvalSha256 ?? null, candidate.approvalSha256, previous, result.products);
        const acceptance = evaluateIndividualPublicationDifference(providerId, difference, previous, result.products, approval, originalProducts ?? undefined);
        for (const message of acceptance.blockers) block("aceptacion", message);
        try {
          const active = await readIndividualActiveSha(workspace, providerId, candidate.approvalSha256);
          if (active !== (published?.approvalSha256 ?? null)) {
            block("vigente", "El índice activo y la publicación acreditada no coinciden");
          }
        } catch (error) { block("vigente", reasonOf(error)); }
      } catch (error) { block("seleccion", reasonOf(error)); }
    }
  }
  if (original) {
    try {
      const currentHash = providerId === "manain"
        ? (await readVerifiedManainRecordSource(workspace)).recordSha256
        : sha256((await readPortableOriginalArtifacts(workspace, providerId)).files.find((item) =>
          item.name.endsWith("-catalog.json"))?.content ?? "");
      if (currentHash !== original.sha256) {
        block("origen", "El original cambió durante el diagnóstico; repetir con fuentes estables");
      }
    } catch (error) { block("origen", reasonOf(error)); }
  }
  const absences = classifyFinishAbsences(previous, originalProducts, preparation, selected, approval);
  return {
    providerId, original, preparation: preparation ? {
      preparedAt: preparation.preparedAt, ready: preparation.totals.ready, review: preparation.totals.review
    } : null,
    published, candidate, difference, absences, blockers,
    evaluable: blockers.length === 0 && candidate !== null && difference !== null
  };
};

export const inspectIndividualFinishPreflight = async (
  workspace: string, providers: readonly IndividualCatalogProvider[]
): Promise<FinishPreflightReport> => {
  const root = resolve(workspace);
  let globalIssue: string | null = null;
  try {
    const global = await readActiveCatalogIndex(root);
    if (global && Object.values(global.providers).some((item) => item.runId !== undefined)) {
      globalIssue = "Campaña global vigente: FINISH individual no puede sustituirla parcialmente";
    }
  } catch (error) { globalIssue = reasonOf(error); }
  const results: FinishPreflightProvider[] = [];
  for (const providerId of providers) results.push(await inspectProvider(root, providerId, globalIssue));
  return { version: 1, mode: "simulation", complete: results.length === providers.length && results.every((item) => item.evaluable), providers: results };
};
