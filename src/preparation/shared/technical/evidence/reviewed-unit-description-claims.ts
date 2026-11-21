import type { ProductRecord } from "../../../../contracts/catalog.js";

type ReviewedUnitDescriptionFact = {
  readonly field: string;
  readonly value: string;
  readonly excerpt: string;
};

type ReviewedUnitDescriptionClaim = {
  readonly providerId: ProductRecord["providerId"];
  readonly reference: string;
  readonly sourceUrl: string;
  readonly brand: ProductRecord["brand"];
  readonly model: ProductRecord["model"];
  readonly facts: readonly ReviewedUnitDescriptionFact[];
};

const reviewed: readonly ReviewedUnitDescriptionClaim[] = [
  {
    providerId: "gam", reference: "243", brand: "LOGITRANS", model: "HLI",
    sourceUrl: "https://online.gamrentals.com/es/transpaletas-logitrans/243-transpaleta-de-tijera-inoxidable-1500-kg-logitrans-hli",
    facts: [
      { field: "Ruedas de carga", value: "Tándem", excerpt: "ruedas de carga tándem" },
      { field: "Timón y bomba de pistones", value: "Acero inoxidable",
        excerpt: "La transpaleta tiene el timón, la bomba de pistones, los ejes y el anclaje inoxidables." }
    ]
  },
  {
    providerId: "gam", reference: "244", brand: "LOGITRANS", model: "HLI Plus",
    sourceUrl: "https://online.gamrentals.com/es/transpaletas-logitrans/244-transpaleta-de-tijera-inoxidable-1500-kg-logitrans-hli-plus",
    facts: [
      { field: "Timón y bomba de pistones", value: "Acero inoxidable",
        excerpt: "La transpaleta tiene el timón, la bomba de pistones, los ejes y el anclaje inoxidables." },
      { field: "Restantes componentes exteriores", value: "Recubrimiento cromado",
        excerpt: "El resto de piezas cuentan con recubrimiento cromado." }
    ]
  },
  {
    providerId: "gam", reference: "6806", brand: null, model: "P1.6",
    sourceUrl: "https://online.gamrentals.com/es/furgonetas-electricas-de-ocasion/6806-musoshi-pop-up-mini",
    facts: [
      { field: "Batería anunciada", value: "Litio extraíble", excerpt: "su batería de litio es extraíble" }
    ]
  },
  {
    providerId: "gam", reference: "4814", brand: "XCMG", model: "XT3207KH",
    sourceUrl: "https://online.gamrentals.com/es/xcmg-manipulacion/4814-manipulador-telescopico-xcmg-xt3207k",
    facts: [
      { field: "Tracción", value: "4×4", excerpt: "su sistema de tracción en las cuatro ruedas" }
    ]
  },
  {
    providerId: "gam", reference: "4817", brand: "XCMG", model: "XT4014KH",
    sourceUrl: "https://online.gamrentals.com/es/xcmg-manipulacion/4817-manipulador-telescopico-xcmg-xt4014k",
    facts: [
      { field: "Potencia nominal del motor", value: "74 kW", excerpt: "Equipado con un motor diésel de 74 kW (99 HP), el XT4014KH" }
    ]
  }
];

export const reviewedUnitDescriptionEvidence = (
  original: ProductRecord, field: string, value: string
): { readonly scope: "unit"; readonly sourceField: "longDescription"; readonly sourceValue: string } | null => {
  const description = original.longDescription;
  if (!description) return null;
  const matching = reviewed.filter((claim) => claim.providerId === original.providerId &&
    claim.reference === original.reference && claim.sourceUrl === original.url &&
    claim.brand === original.brand && claim.model === original.model).flatMap((claim) =>
    claim.facts.filter((fact) => fact.field === field && fact.value === value &&
      description.includes(fact.excerpt)));
  if (matching.length > 1) throw new Error("Evidencia original duplicada");
  return matching.length === 1 ? { scope: "unit", sourceField: "longDescription", sourceValue: description } : null;
};
