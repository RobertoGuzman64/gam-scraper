import type { SpecScalar } from "../../../contracts/catalog.js";
import type { ImportCatalog } from "../../legacy-export/contracts.js";

export type Attribute = Pick<ImportCatalog["attributes"][number], "name" | "type" | "unit_option">;
export type Candidate = { readonly key: string; readonly value: SpecScalar };
export type AliasOutcome = "accepted" | "contradiction" | "rejected";
export type AttributeValue = string | number | boolean;
export type AttributeResolution =
  | { readonly status: "resolved"; readonly value: AttributeValue }
  | { readonly status: "not_observed" | "contradiction" | "invalid" | "rejected"; readonly value: null };
