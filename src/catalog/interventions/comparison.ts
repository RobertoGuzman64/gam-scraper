import { isDeepStrictEqual } from "node:util";
import type { CanonicalCatalog } from "../canonical-catalog.js";
import { buildProductIdentity } from "../identity.js";
import type { ManualInterventionProposal } from "./contracts.js";
import { validateInterventionProposals } from "./proposals.js";
import { readProposedField } from "./values.js";

export type InterventionFieldStatus = "pending" | "corrected" | "absent" | "divergent";
export type InterventionScriptStatus = "pending" | "corrected" | "absent" | "partial" | "divergent";

export type ComparedField = {
  readonly proposal: ManualInterventionProposal;
  readonly status: InterventionFieldStatus;
  readonly actual?: ManualInterventionProposal["expected"];
};

export type ComparedScript = {
  readonly script: string;
  readonly status: InterventionScriptStatus;
  readonly fields: readonly ComparedField[];
};

export type InterventionComparison = {
  readonly scripts: readonly ComparedScript[];
  readonly pending: readonly ManualInterventionProposal[];
  readonly blocked: boolean;
};

export const compareInterventionScripts = (
  catalog: CanonicalCatalog,
  selections: readonly { readonly script: string; readonly proposals: readonly ManualInterventionProposal[] }[]
): InterventionComparison => {
  const selected = validateInterventionProposals(selections.flatMap((selection) => selection.proposals), catalog.providerId);
  const products = new Map(catalog.products.map((product) => [buildProductIdentity(product).key, product]));
  if (products.size !== catalog.productCount) throw new Error("El catálogo tiene identidades duplicadas");
  const scripts = selections.map((selection): ComparedScript => {
    const fields = selection.proposals.map((proposal): ComparedField => {
      const product = products.get(proposal.identity);
      if (!product) return { proposal, status: "absent" };
      const actual = readProposedField(product, proposal.field);
      const status: InterventionFieldStatus = isDeepStrictEqual(actual, proposal.expected) ? "pending" :
        isDeepStrictEqual(actual, proposal.next) ? "corrected" : "divergent";
      return actual === undefined ? { proposal, status } : { proposal, actual, status };
    });
    const statuses = new Set(fields.map((field) => field.status));
    const status: InterventionScriptStatus = statuses.has("divergent") ? "divergent" :
      statuses.has("pending") && statuses.size > 1 ? "partial" :
        statuses.has("pending") ? "pending" :
          statuses.size === 1 && statuses.has("corrected") ? "corrected" :
            statuses.size === 1 && statuses.has("absent") ? "absent" : "partial";
    return { script: selection.script, status, fields };
  });
  if (selected.length !== scripts.reduce((count, script) => count + script.fields.length, 0)) {
    throw new Error("Selección de intervenciones incoherente");
  }
  return {
    scripts,
    pending: scripts.filter((script) => script.status === "pending")
      .flatMap((script) => script.fields.map((field) => field.proposal)),
    blocked: scripts.some((script) => script.status === "divergent" || script.status === "partial")
  };
};
