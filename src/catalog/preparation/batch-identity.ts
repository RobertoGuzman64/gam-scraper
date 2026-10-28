import type { ProductRecord } from "../../contracts/catalog.js";
import { buildProductIdentity } from "../identity.js";
import { findSerialNumberCollisions } from "../identity-conflicts.js";
import { describeHysterH35ftStockConflict } from "./evidence/providers/gam/hyster-h35ft-serial-evidence.js";
import { verifiedMusoshiSerialOwner, verifiedZeroMisattributedSerial } from "./evidence/providers/gam/musoshi-serial-evidence.js";
import { verifiedYaleErp35vlCrossListing, verifiedYaleErp35vlSerialOwner } from "./evidence/providers/gam/yale-erp35vl-serial-evidence.js";
import type { ImportCatalog } from "../legacy-export/contracts.js";
import type { PreparedProduct } from "./contracts.js";
import { prepareProduct } from "../legacy-export/prepare-product.js";
import { prepareSourceProduct } from "./prepare-product.js";

export const prepareImportBatch = (products: readonly ProductRecord[], catalog?: ImportCatalog): {
  readonly totals: { readonly ready: number; readonly review: number };
  readonly products: readonly PreparedProduct[];
} => {
  const warningsByIdentity = new Map<string, string[]>();
  const referenceCounts = new Map<string, number>();
  for (const product of products) {
    const reference = product.reference?.trim();
    if (!reference) continue;
    const key = `${product.providerId}:${reference.toLocaleUpperCase("es")}`;
    referenceCounts.set(key, (referenceCounts.get(key) ?? 0) + 1);
  }
  for (const collision of findSerialNumberCollisions(products)) {
    const references = collision.products.map((product) => product.reference).join(", ");
    const issue = `Número de serie ${collision.serialNumber} compartido por referencias ${references}; revisar identidad de origen`;
    if (verifiedYaleErp35vlCrossListing(collision)) continue;
    const verifiedOwner = verifiedMusoshiSerialOwner(collision) ?? verifiedYaleErp35vlSerialOwner(collision);
    const correctedSerial = verifiedZeroMisattributedSerial(collision);
    const stockConflict = describeHysterH35ftStockConflict(collision);
    for (const product of collision.products) {
      if (product === verifiedOwner || product === correctedSerial) continue;
      const key = buildProductIdentity(product).key;
      const issues = warningsByIdentity.get(key) ?? [];
      issues.push(issue);
      if (stockConflict) issues.push(stockConflict);
      warningsByIdentity.set(key, issues);
    }
  }
  const prepared = products.map((product): PreparedProduct => {
    const candidate = catalog ? prepareProduct(product, catalog) : prepareSourceProduct(product);
    const warnings = warningsByIdentity.get(buildProductIdentity(product).key) ?? [];
    const reference = product.reference?.trim();
    const count = reference ? referenceCounts.get(`${product.providerId}:${reference.toLocaleUpperCase("es")}`) ?? 0 : 0;
    const duplicateIssue = count > 1 ? [`Referencia duplicada en la extracción: ${reference}`] : [];
    const issues = [...new Set([...candidate.issues, ...warnings, ...duplicateIssue])];
    return issues.length ? { ...candidate, status: "review", issues } : candidate;
  });
  return {
    totals: {
      ready: prepared.filter((product) => product.status === "ready").length,
      review: prepared.filter((product) => product.status === "review").length
    },
    products: prepared
  };
};
