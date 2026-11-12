import { buildProductIdentity } from "../identity.js";
import { resolveEditorialFacts } from "../../preparation/shared/editorial/domain/editorial-facts.js";
import { resolveEditorialSource } from "../../preparation/shared/editorial/domain/editorial-source.js";
import { resolveReusableEditorial } from "../../preparation/shared/editorial/domain/editorial-composition.js";
import type { GapInput } from "./content-gaps-types.js";

type ReuseField = "description" | "description_general";
type ReuseCause = "origen_no_validado" | "familia_o_evidencia_no_compatible" |
  "capacidad_disponible_sin_aplicar" | "preparacion_en_revision" | "sin_composicion_de_familia";
type ReuseCount = "aplicada" | "precedencia_de_texto_existente" | "texto_existente_sin_candidata" | ReuseCause;

type ReuseCase = {
  readonly identity: string;
  readonly providerId: string;
  readonly reference: string | null;
  readonly url: string;
  readonly field: ReuseField;
  readonly family: NonNullable<ReturnType<typeof resolveEditorialFacts>>["family"] | null;
  readonly cause: ReuseCause;
};

type ReuseReport = {
  readonly analyzed: number;
  readonly totals: Readonly<Record<ReuseCount, number>>;
  readonly cases: readonly ReuseCase[];
  readonly note: string;
};

const fields = ["description", "description_general"] as const;
const initialCounts = (): Record<ReuseCount, number> => ({
  aplicada: 0,
  precedencia_de_texto_existente: 0,
  texto_existente_sin_candidata: 0,
  origen_no_validado: 0,
  familia_o_evidencia_no_compatible: 0,
  capacidad_disponible_sin_aplicar: 0,
  preparacion_en_revision: 0,
  sin_composicion_de_familia: 0
});

export const analyzeEditorialReuse = (inputs: readonly GapInput[]): ReuseReport => {
  const cases: ReuseCase[] = [];
  const totals = initialCounts();
  const identities = new Set<string>();
  const ordered = [...inputs].sort((a, b) => {
    const left = buildProductIdentity(a.source).key;
    const right = buildProductIdentity(b.source).key;
    return left < right ? -1 : left > right ? 1 : 0;
  });
  for (const { source, prepared } of ordered) {
    const identity = buildProductIdentity(source).key;
    if (identities.has(identity)) throw new Error(`Identidad duplicada en auditor de reutilización editorial: ${identity}`);
    identities.add(identity);
    if (source.providerId !== prepared.product.providerId ||
      (source.reference?.trim() || null) !== prepared.product.reference || source.url !== prepared.product.sourceUrl) {
      throw new Error(`Preparación discordante en auditor de reutilización editorial: ${identity}`);
    }
    const eligibleSource = resolveEditorialSource(source);
    const facts = eligibleSource === null ? null : resolveEditorialFacts(source);
    const candidate = facts === null ? null : resolveReusableEditorial(source);
    for (const field of fields) {
      const output = prepared.product[field]?.trim() || null;
      const generated = candidate === null ? null :
        (field === "description" ? candidate.short : candidate.general)?.trim() || null;
      if (output !== null) {
        if (generated !== null && output === generated) totals.aplicada++;
        else if (generated !== null) totals.precedencia_de_texto_existente++;
        else totals.texto_existente_sin_candidata++;
        continue;
      }
      const cause: ReuseCause = eligibleSource === null ? "origen_no_validado" :
        facts === null ? "familia_o_evidencia_no_compatible" :
          generated === null ? "sin_composicion_de_familia" :
            prepared.status === "ready" ? "capacidad_disponible_sin_aplicar" : "preparacion_en_revision";
      totals[cause]++;
      cases.push({ identity, providerId: source.providerId, reference: source.reference, url: source.url,
        field, family: facts?.family ?? null, cause });
    }
  }
  return {
    analyzed: ordered.length,
    totals,
    cases,
    note: "Diagnóstico de preparación, no aviso ni autorización de publicación. Una candidata disponible con campo vacío requiere investigar su precedencia y validaciones; una fuente rechazada o familia incompatible no demuestra por sí sola bloqueo artificial. Las candidatas compartidas acreditadas prevalecen sobre texto previo de fuente; el auditor distingue composición efectiva, conservación de origen y rechazo por evidencia insuficiente."
  };
};

export type { ReuseReport, ReuseCase, ReuseCause };
