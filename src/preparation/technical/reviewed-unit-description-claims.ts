import type { ProductRecord } from "../../contracts/catalog.js";

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
  },
  {
    providerId: "gam", reference: "6702", brand: "HYSTER", model: "H3.5FT",
    sourceUrl: "https://online.gamrentals.com/es/carretillas-elevadoras-glp-segunda-mano/6702-2019-hyster-h35ft",
    facts: [
      { field: "Motorización", value: "GLP", excerpt: "Equipo propulsado por GLP (Gas Licuado del Petroleo)" }
    ]
  },
  {
    providerId: "gam", reference: "6723", brand: "TOYOTA", model: "LWE180",
    sourceUrl: "https://online.gamrentals.com/es/transpaletas-elevadoras-electricas-segunda-mano/6723-2019-toyota-lwe180-",
    facts: [
      { field: "Año", value: "2019", excerpt: "Fabricada en el año 2019" }
    ]
  },
  {
    providerId: "gam", reference: "4778", brand: "XCMG", model: "XGA16H",
    sourceUrl: "https://online.gamrentals.com/es/plataforma-articulada-hibrida-xcmg/4778-plataforma-articulada-hibrida-xcmg-xga16h",
    facts: [
      { field: "Alcance horizontal (m)", value: "8,22 m", excerpt: "alcance horizontal de 8,22 metros" },
      { field: "Altura de trabajo (m)", value: "16,3 m", excerpt: "altura máxima de trabajo de 16,3 metros" },
      { field: "Tracción 4x4", value: "true", excerpt: "sistema de tracción en las cuatro ruedas" }
    ]
  },
  {
    providerId: "gam", reference: "4792", brand: "XCMG", model: "XGS58E1",
    sourceUrl: "https://online.gamrentals.com/es/plataforma-telescopica-diesel-xcmg/4792-plataforma-telescopica-diesel-xcmg-xgs58e1",
    facts: [
      { field: "Alcance horizontal (m)", value: "24,8 m", excerpt: "alcance horizontal de 24,8 metros" },
      { field: "Potencia (kW)", value: "75 kW", excerpt: "motor Cummins F3.8 de 75 kW" }
    ]
  },
  {
    providerId: "gam", reference: "2159", brand: "BRAVI", model: "Lui 460",
    sourceUrl: "https://online.gamrentals.com/es/plataformas-elevadoras-bravi/2159-plataforma-elevadora-bravi-lui-460",
    facts: [
      { field: "Sensor de inclinación", value: "true", excerpt: "sensor de inclinación incorporado" }
    ]
  },
  {
    providerId: "gam", reference: "2237", brand: "YALE", model: "MO10L",
    sourceUrl: "https://online.gamrentals.com/es/recogepedidos-yale/2237-preparapedidos-2000-k-yale-mo10l",
    facts: [
      { field: "Dirección asistida", value: "true", excerpt: "sistema de dirección asistida" }
    ]
  },
  {
    providerId: "gam", reference: "2240", brand: "YALE", model: "MO25",
    sourceUrl: "https://online.gamrentals.com/es/recogepedidos-yale/2240-preparapedidos-2000-k-yale-mo25",
    facts: [
      { field: "Dirección asistida", value: "true", excerpt: "sistema de dirección asistida" }
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
