import type { SpecScalar } from "../../../contracts/catalog.js";
import type { ImportCatalog } from "../preparation/contracts.js";

export type Attribute = ImportCatalog["attributes"][number];
export type Candidate = { readonly key: string; readonly value: SpecScalar };
