import type { EditorialFacts } from "../../editorial/core/editorial-facts.js";

type ReviewedModelCompatibility = (Pick<EditorialFacts, "energy" | "workingHeightM" | "lengthM" | "widthM" | "loadCapacityKg"> & {
  readonly family: "plataforma-tijera" | "plataforma-articulada";
  readonly firstYear?: number;
  readonly lastYear?: number;
  readonly advertisedHeightClassM?: number;
}) | (Pick<EditorialFacts, "energy" | "workingHeightM"> & {
  readonly family: "plataforma-articulada" | "plataforma-tijera";
  readonly invariantGeometry: true;
  readonly firstYear: number;
  readonly lastYear: number;
}) | (Pick<EditorialFacts, "energy" | "loadCapacityKg"> & {
  readonly family: "carretilla-elevadora";
  readonly marketCountry: string;
  readonly invariantUsedLoadCenter?: true;
  readonly firstYear: number;
  readonly lastYear?: number;
  readonly lengthM?: number;
  readonly widthM?: number;
}) | (Pick<EditorialFacts, "energy" | "loadCapacityKg" | "lengthM"> & {
  readonly family: "carretilla-elevadora";
  readonly catalogOffer: true;
  readonly marketCountry: string;
  readonly widthsM: readonly number[];
}) | (Pick<EditorialFacts, "energy" | "loadCapacityKg"> & {
  readonly family: "carretilla-elevadora";
  readonly catalogOffer: true;
  readonly invariantLoadCenter: true;
  readonly marketCountry: string;
  readonly identityWeightKg?: number;
  readonly lengthM?: number;
  readonly voltageV?: number;
}) | {
  readonly family: "grupo-electrogeno" | "torre-iluminacion" | "fregadora" | "barredora" | "maquina-limpieza" | "compactadora" | "transpaleta" | "plataforma-articulada" | "almacen-vertical" | "martillo-miniexcavadora" | "apilador";
  readonly firstYear: number | null;
  readonly lastYear: number | null;
  readonly anchoredCatalogOffer?: true;
  readonly verifiedStructuredIdentity?: true;
  readonly familyFromSourcePath?: true;
  readonly corroboratingText?: RegExp;
  readonly sourceAnchors: Readonly<Record<string, string>>;
  readonly conflictingEvidence: RegExp;
};

type ReviewedModelReuse = {
  readonly fields: readonly string[];
} & ({
  readonly compatibility: ReviewedModelCompatibility;
  readonly fallback?: never;
} | {
  readonly compatibility: Extract<ReviewedModelCompatibility, { readonly invariantGeometry: true }>;
  readonly fallback: true;
});

export type ReviewedModelFact = {
  readonly field: string;
  readonly value: string;
  readonly support: string;
};

export type ReviewedModelDocument = {
  readonly url: string;
  readonly brand: string | null;
  readonly model: string;
  readonly reviewedOn: string;
  readonly facts: readonly ReviewedModelFact[];
  readonly reuse?: ReviewedModelReuse;
};
