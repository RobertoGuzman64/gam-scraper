import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import type { CanonicalCatalog } from "../catalog/canonical-catalog.js";
import { buildProductIdentity } from "../catalog/identity.js";
import type { ManualInterventionProposal } from "./contracts.js";
import { validateInterventionProposals } from "./proposals.js";
import { readProposedField } from "./values.js";

export type InterventionSimulation = {
  readonly providerId: string;
  readonly prefix: string;
  readonly scope: string;
  readonly catalogSha256: string;
  readonly planSha256: string;
  readonly analyzedProducts: number;
  readonly affectedProducts: number;
  readonly changes: readonly ManualInterventionProposal[];
};

const sha256 = (content: string | Buffer): string => createHash("sha256").update(content).digest("hex");

const orderedProposals = (proposals: readonly ManualInterventionProposal[]): readonly ManualInterventionProposal[] =>
  [...proposals].sort((left, right) => {
    const first = `${left.identity}\0${left.field}`;
    const second = `${right.identity}\0${right.field}`;
    return first < second ? -1 : first > second ? 1 : 0;
  });

export const simulateIntervention = (
  catalog: CanonicalCatalog,
  catalogSha256: string,
  input: unknown
): InterventionSimulation => {
  if (!/^[a-f0-9]{64}$/.test(catalogSha256)) throw new Error("Huella SHA-256 de catálogo inválida");
  const proposals = orderedProposals(validateInterventionProposals(input, catalog.providerId));
  const products = new Map(catalog.products.map((product) => [buildProductIdentity(product).key, product]));
  if (products.size !== catalog.productCount) throw new Error("El catálogo tiene identidades duplicadas");

  const conflicts: string[] = [];
  for (const proposal of proposals) {
    const product = products.get(proposal.identity);
    if (!product) {
      conflicts.push(`${proposal.identity} | identidad no encontrada`);
    } else if (!isDeepStrictEqual(readProposedField(product, proposal.field), proposal.expected)) {
      conflicts.push(`${proposal.identity} | ${proposal.field} | el valor actual no coincide con el esperado`);
    }
  }
  if (conflicts.length) {
    throw new Error(`Simulación rechazada: ${conflicts.length} conflicto(s). ${conflicts.slice(0, 5).join("; ")}${conflicts.length > 5 ? "; …" : ""}`);
  }

  const planSha256 = sha256(JSON.stringify({
    version: 1,
    providerId: catalog.providerId,
    catalogSha256,
    proposals
  }));
  return {
    providerId: catalog.providerId,
    prefix: catalog.prefix,
    scope: catalog.scope,
    catalogSha256,
    planSha256,
    analyzedProducts: catalog.productCount,
    affectedProducts: new Set(proposals.map((proposal) => proposal.identity)).size,
    changes: proposals
  };
};

