import type { ProductRecord, SpecsMap } from "../../../../contracts/catalog.js";
import { hasGamAssertedSourceSafetyControl, type GamSourceSafetyControl } from "../../technical/evidence/operations-and-safety/source-safety-controls-evidence.js";

type EditorialCapability = Readonly<{
  key: GamSourceSafetyControl;
  mention: RegExp;
  sentence: string;
}>;

const editorialCapabilities: readonly EditorialCapability[] = [
  {
    key: "Frenado automático",
    mention: /\bfren(?:os?|ado)\s+autom[aá]tic[oa]s?\b/iu,
    sentence: "El proveedor indica que este equipo dispone de frenado automático."
  },
  {
    key: "Controles proporcionales",
    mention: /\b(?:controles?|mandos?)\s+proporcionales?\b/iu,
    sentence: "El proveedor confirma controles proporcionales para las maniobras del equipo."
  },
  {
    key: "Dirección asistida",
    mention: /\b(?:direcci[oó]n\s+asistida|servodirecci[oó]n)\b/iu,
    sentence: "La ficha del proveedor confirma que dispone de dirección asistida."
  },
  {
    key: "Detección de obstáculos",
    mention: /\b(?:detecci[oó]n|sensores?)\s+de\s+obst[aá]culos\b/iu,
    sentence: "El proveedor declara un sistema de detección de obstáculos."
  },
  {
    key: "Control de estabilidad",
    mention: /\bcontrol\s+de\s+estabilidad\b/iu,
    sentence: "La ficha del proveedor señala que dispone de control de estabilidad."
  },
  {
    key: "Parada de emergencia",
    mention: /\b(?:parada|paro)\s+de\s+emergencia\b/iu,
    sentence: "El proveedor declara un dispositivo de parada de emergencia."
  }
];

export const includeGamSourceSafetyControlsInGeneral = (
  record: ProductRecord, general: string | null, specs: SpecsMap
): string | null => {
  if (!general?.trim()) return general;
  const additions = editorialCapabilities.filter(({ key, mention }) =>
    specs[key] === true && !mention.test(general) &&
    hasGamAssertedSourceSafetyControl(record, key)
  );
  if (additions.length === 0) return general;
  const text = general.trim();
  return `${text}${/[.!?]$/u.test(text) ? "" : "."} ${additions.map(({ sentence }) => sentence).join(" ")}`;
};
