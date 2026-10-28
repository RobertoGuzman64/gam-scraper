import type { SpecValue } from "../../contracts/catalog.js";

type AttributeType = "NUMBER" | "DECIMAL" | "TEXT" | "SELECT" | "BOOLEAN" | "DATE" | "MULTISELECT";
type Category = { readonly id: number; readonly parentId: number | null; readonly name: string; readonly slug: string; readonly active?: boolean };
type Attribute = { readonly id: number; readonly name: string; readonly type: AttributeType; readonly required: boolean; readonly unit_option: string };
type Relation = { readonly categoryID: number; readonly attributeID: number; readonly actived?: boolean };

export type ImportCatalog = {
  readonly categories: readonly Category[];
  readonly attributes: readonly Attribute[];
  readonly relations: readonly Relation[];
};

export type ImportCandidate = {
  readonly providerId: string;
  readonly sourceUrl: string;
  readonly reference: string | null;
  readonly title: string | null;
  readonly categorySellID: number | null;
  readonly category: string | null;
  readonly condition: "Nuevo" | "Segunda_Mano" | null;
  readonly price: number | null;
  readonly description_title: string | null;
  readonly description: string | null;
  readonly description_general: string | null;
  readonly image: string | null;
  readonly images: readonly string[];
  readonly spec: Readonly<Record<string, SpecValue>>;
  readonly attributes: readonly { readonly attributeID: number; readonly value: string | number | boolean }[];
};
