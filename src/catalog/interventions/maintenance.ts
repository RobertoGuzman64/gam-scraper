import type { CatalogIntervention } from "./catalog.js";
import type { InterventionScriptStatus } from "./comparison.js";
import { compareInterventionScripts } from "./comparison.js";
import type { CampaignCatalogObservation } from "../../contracts/campaign-observation.js";

export type InterventionMaintenanceAssessment = "active" | "inconsistent" | "keep" | "review";

export type InterventionMaintenanceEntry = {
  readonly intervention: CatalogIntervention;
  readonly status: InterventionScriptStatus;
  readonly consecutiveObservations: number;
  readonly assessment: InterventionMaintenanceAssessment;
  readonly observations: readonly { readonly runId: string; readonly status: InterventionScriptStatus | "unavailable" }[];
};

export const assessInterventionMaintenance = (
  interventions: readonly CatalogIntervention[],
  observations: readonly CampaignCatalogObservation[]
): readonly InterventionMaintenanceEntry[] => {
  if (!observations[0]?.catalog) throw new Error("Se necesita una campaña actual completa y verificable");
  return interventions.map((intervention): InterventionMaintenanceEntry => {
    const observed = observations.map((observation) => ({
      runId: observation.runId,
      status: observation.catalog === null ? "unavailable" as const :
        compareInterventionScripts(observation.catalog, [{
          script: intervention.script, proposals: intervention.proposals
        }]).scripts[0]!.status
    }));
    const status = observed[0]!.status;
    if (status === "unavailable") throw new Error("La campaña vigente no está disponible");
    let consecutiveObservations = 0;
    if (status === "absent" || status === "corrected") {
      const seen = new Set<string>();
      for (let index = 0; index < observations.length; index += 1) {
        const observation = observations[index]!;
        if (!observation.catalog || observed[index]?.status !== status ||
          observation.catalog.scope !== observations[0]!.catalog!.scope) break;
        const snapshot = `${observation.catalog.startedAt}|${observation.catalog.endedAt}|${observation.catalog.scope}`;
        if (seen.has(snapshot)) break;
        seen.add(snapshot);
        consecutiveObservations += 1;
      }
    }
    const assessment: InterventionMaintenanceAssessment =
      status === "pending" ? "active" :
        status === "divergent" || status === "partial" ? "inconsistent" :
          consecutiveObservations >= 2 ? "review" : "keep";
    return { intervention, status, consecutiveObservations, assessment, observations: observed };
  });
};
