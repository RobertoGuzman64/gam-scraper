import type { ProductRecord } from "../../contracts/catalog.js";
import type { PreparedProduct } from "../preparation/contracts.js";

export type GapGroupBy = "categoria" | "marca" | "modelo";
export type GapEvidence = "directa_del_campo" | "texto_relacionado" | "especificaciones_sin_vinculo_acreditado" | "sin_evidencia_observable" | "desconocida";
export type GapField = { readonly kind: "attribute"; readonly attributeID: number; readonly name: string } |
{ readonly kind: "spec"; readonly key: string; readonly name: string } |
{ readonly kind: "description" | "description_general"; readonly name: string };
export type GapObservation = {
  readonly field: GapField;
  readonly applicable: number;
  readonly present: number;
  readonly missing: number;
  readonly coveragePercent: number;
  readonly coverage: "completa" | "desigual" | "sistematica";
  readonly missingIdentities: readonly string[];
  readonly directEvidence: number;
  readonly relatedText: number;
  readonly originalSpecKeys: readonly { readonly key: string; readonly count: number }[];
};
export type GapGroup = {
  readonly providerId: string;
  readonly categorySellID: number | null;
  readonly category: string | null;
  readonly sourceCategoryKey: string | null;
  readonly comparable: boolean;
  readonly brand: string | null;
  readonly model: string | null;
  readonly identities: readonly string[];
  readonly observations: readonly GapObservation[];
};
export type GapCase = {
  readonly identity: string;
  readonly providerId: string;
  readonly reference: string | null;
  readonly url: string;
  readonly brand: string | null;
  readonly model: string | null;
  readonly categoryKey: string;
  readonly categorySellID: number | null;
  readonly status: PreparedProduct["status"];
  readonly original: {
    readonly shortDescription: string | null;
    readonly longDescription: string | null;
    readonly specs: ProductRecord["specs"];
  };
  readonly prepared: {
    readonly description: string | null;
    readonly description_general: string | null;
    readonly attributes: PreparedProduct["product"]["attributes"];
  };
  readonly gaps: readonly { readonly field: GapField; readonly evidence: GapEvidence }[];
};
export type GapUniverse = {
  readonly total: number;
  readonly providers: readonly { readonly providerId: string; readonly originals: number }[];
  readonly ready: number;
  readonly review: number;
  readonly withoutCategory: number;
  readonly note: string;
};
export type GapAnalysis = {
  readonly universe: GapUniverse;
  readonly groupBy: GapGroupBy;
  readonly groups: readonly GapGroup[];
  readonly cases: readonly GapCase[];
};
export type GapInput = {
  readonly source: ProductRecord;
  readonly prepared: PreparedProduct;
};
export type GapOptions = { readonly groupBy: GapGroupBy };

export type InternalItem = GapInput & { readonly identity: string };
export type InternalGroup = {
  readonly providerId: string; readonly categorySellID: number | null; readonly category: string | null;
  readonly sourceCategoryKey: string | null; readonly brand: string | null; readonly model: string | null; readonly items: InternalItem[]
};
