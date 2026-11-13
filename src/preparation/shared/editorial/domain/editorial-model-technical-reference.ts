import type { EditorialFacts } from "./editorial-facts.js";
import type { EditorialKnowledge, EditorialTechnicalModelReference } from "./editorial-knowledge.js";
import { editorialIdentityKey } from "./editorial-knowledge.js";
import { editorialQuantity } from "./editorial-measurements.js";

const equivalentDocumentation = (left: EditorialTechnicalModelReference, right: EditorialTechnicalModelReference): boolean =>
  left.documentedWorkHeight === right.documentedWorkHeight &&
  left.platformHeight === right.platformHeight &&
  left.nominalCapacity === right.nominalCapacity;

export const resolveTechnicalModelReference = (
  facts: EditorialFacts,
  knowledge: EditorialKnowledge
): string | null => {
  if (facts.workingHeightM === null) return null;
  const documents = (knowledge.technicalReferences.get(editorialIdentityKey(facts.brand, facts.model)) ?? [])
    .filter((entry) => entry.family === facts.family &&
      editorialQuantity(entry.advertisedWorkHeight, "m") === facts.workingHeightM &&
      (entry.energy === null || entry.energy === facts.energy) &&
      (facts.platformHeightM === null || editorialQuantity(entry.platformHeight, "m") === null ||
        editorialQuantity(entry.platformHeight, "m") === facts.platformHeightM) &&
      (facts.loadCapacityKg === null || editorialQuantity(entry.nominalCapacity, "kg") === null ||
        editorialQuantity(entry.nominalCapacity, "kg") === facts.loadCapacityKg));
  if (documents.length === 0) return null;
  const first = documents[0];
  if (!first || documents.some((document) => !equivalentDocumentation(first, document))) return null;
  const work = first.documentedWorkHeight === first.advertisedWorkHeight
    ? `altura de trabajo de ${first.documentedWorkHeight}`
    : `altura de trabajo anunciada de ${first.advertisedWorkHeight} y altura de referencia de ${first.documentedWorkHeight}`;
  const characteristic = documents.length === 1 || documents.every((document) => document.characteristic === first.characteristic)
    ? first.characteristic : null;
  const statements = [work, `altura de plataforma de ${first.platformHeight}`, `capacidad nominal de ${first.nominalCapacity}`];
  if (characteristic) statements.push(characteristic);
  return `La documentación técnica de referencia del modelo ${first.brand} ${first.model} recoge ${statements.join(", ")}. ` +
    "Las magnitudes corresponden al modelo o versión documentada y no acreditan la configuración ni las prestaciones de esta unidad.";
};
