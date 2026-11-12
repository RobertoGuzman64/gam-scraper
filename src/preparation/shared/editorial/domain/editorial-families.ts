export type EditorialFamily =
  | "plataforma-tijera" | "plataforma-articulada" | "plataforma-telescopica"
  | "plataforma-mastil" | "plataforma-oruga" | "camion-cesta"
  | "manipulador-telescopico" | "carretilla-elevadora" | "carretilla-retractil"
  | "transpaleta" | "apilador" | "recogepedidos" | "tractor-arrastre"
  | "dumper" | "excavadora" | "miniexcavadora" | "cargadora"
  | "compactadora" | "grupo-electrogeno" | "torre-iluminacion"
  | "compresor" | "fregadora" | "barredora" | "maquina-limpieza"
  | "almacen-vertical" | "elevador-materiales";

type FamilyDefinition = {
  readonly family: EditorialFamily;
  readonly noun: string;
  readonly pattern: RegExp;
};

const definitions: readonly FamilyDefinition[] = [
  { family: "almacen-vertical", noun: "almacén automático vertical", pattern: /\b(?:almacen[-\s]+automatico[-\s]+vertical|almacen[-\s]+vertical|vertical[-\s]+lift[-\s]+module)\b/u },
  { family: "elevador-materiales", noun: "elevador de materiales", pattern: /\b(?:elevador[-\s]+de[-\s]+materiales|elevador[-\s]+materiales|material[-\s]+lift)\b/u },
  { family: "camion-cesta", noun: "camión cesta", pattern: /\b(?:camion(?:es)?[-\s]+cesta|camion[-\s]+plataforma|camion[-\s]+con[-\s]+cesta)\b/u },
  { family: "plataforma-oruga", noun: "plataforma sobre orugas", pattern: /\b(?:plataforma[^|]*oruga|oruga[^|]*plataforma|spider[-\s]+lift)\b/u },
  { family: "manipulador-telescopico", noun: "manipulador telescópico", pattern: /\b(?:manipulador(?:es)?[-\s]+telescopico|telehandler|telescopic[-\s]+handler)\b/u },
  { family: "carretilla-retractil", noun: "carretilla retráctil", pattern: /\b(?:carretilla[^|]*retractil|retractil[^|]*carretilla|reach[-\s]+truck)\b/u },
  { family: "recogepedidos", noun: "recogepedidos", pattern: /\b(?:recogepedidos|recoge[-\s]+pedidos|order[-\s]+picker)\b/u },
  { family: "tractor-arrastre", noun: "tractor de arrastre", pattern: /\b(?:tractor(?:es)?[-\s]+de[-\s]+arrastre|tractor(?:es)?[-\s]+de[-\s]+remolque|tow[-\s]+tractor)\b/u },
  { family: "transpaleta", noun: "transpaleta", pattern: /\b(?:transpalet(?:a|as)?|transpallet|pallet[-\s]+truck)\b/u },
  { family: "apilador", noun: "apilador", pattern: /\b(?:apilador(?:a|es|as)?|stacker)\b/u },
  { family: "plataforma-mastil", noun: "plataforma de mástil vertical", pattern: /\b(?:mastil[-\s]+vertical|plataforma[-\s]+vertical|elevador[-\s]+vertical|vertical[-\s]+mast)\b/u },
  { family: "plataforma-tijera", noun: "plataforma de tijera", pattern: /\b(?:tijera|tijeras|scissor[-\s]+lift|elevador[-\s]+tijera)\b/u },
  { family: "plataforma-articulada", noun: "plataforma articulada", pattern: /\b(?:plataforma(?:s)?[-\s]+articulad[ao]s?|brazo[-\s]+articulad[ao]|articulating[-\s]+boom|articulated[-\s]+boom|boom[-\s]+lift)\b/u },
  { family: "plataforma-telescopica", noun: "plataforma telescópica", pattern: /\b(?:plataforma(?:s)?[-\s]+telescopic[ao]s?|brazo[-\s]+telescopic[ao]|telescopic[-\s]+boom)\b/u },
  { family: "carretilla-elevadora", noun: "carretilla elevadora", pattern: /\b(?:carretilla(?:s)?[-\s]+(?:elevadora|industrial)|carretilla|forklift|montacargas)\b/u },
  { family: "miniexcavadora", noun: "miniexcavadora", pattern: /\b(?:miniexcavadora|mini[-\s]+excavadora|mini[-\s]+excavator)\b/u },
  { family: "excavadora", noun: "excavadora", pattern: /\b(?:excavadora|excavator|retroexcavadora)\b/u },
  { family: "dumper", noun: "dúmper", pattern: /\b(?:dumper|dumperes|dumpero|volquete)\b/u },
  { family: "cargadora", noun: "cargadora", pattern: /\b(?:cargadora|loader|minicargadora)\b/u },
  { family: "compactadora", noun: "compactadora", pattern: /\b(?:compactador(?:a)?|rodillo[-\s]+compactador|roller[-\s]+compactor)\b/u },
  { family: "grupo-electrogeno", noun: "grupo electrógeno", pattern: /\b(?:grupo[-\s]+electrogeno|generador(?:es)?[-\s]+(?:electrico|diesel)|power[-\s]+generator)\b/u },
  { family: "torre-iluminacion", noun: "torre de iluminación", pattern: /\b(?:torre(?:s)?[-\s]+(?:de[-\s]+)?iluminacion|lighting[-\s]+tower)\b/u },
  { family: "compresor", noun: "compresor", pattern: /\b(?:compresor(?:es)?|compressor)\b/u },
  { family: "fregadora", noun: "fregadora", pattern: /\b(?:fregadora|scrubber)\b/u },
  { family: "barredora", noun: "barredora", pattern: /\b(?:barredora|sweeper)\b/u },
  { family: "maquina-limpieza", noun: "máquina de limpieza industrial", pattern: /\b(?:limpieza[-\s]+industrial|maquina[-\s]+de[-\s]+limpieza)\b/u }
];

const fold = (value: string): string => value.normalize("NFD")
  .replace(/[\u0300-\u036f]/gu, "").toLocaleLowerCase("es");

export const editorialFamilyOf = (clues: string): EditorialFamily | null => {
  const normalized = fold(clues);
  for (const { family, pattern } of definitions) {
    if (pattern.test(normalized)) {
      if (family === "plataforma-articulada" && /\b(?:telescopic[ao]|manipulador|oruga)\b/u.test(normalized)) return null;
      if (family === "plataforma-telescopica" && /\b(?:manipulador|oruga)\b/u.test(normalized)) return null;
      return family;
    }
  }
  return null;
};

export const editorialFamilyName = (family: EditorialFamily): string =>
  definitions.find((item) => item.family === family)?.noun ?? "máquina";

export const isEditorialFamily = (value: string): value is EditorialFamily =>
  definitions.some((item) => item.family === value);

const sourceHeadings: readonly { readonly family: EditorialFamily; readonly pattern: RegExp }[] = [
  { family: "plataforma-tijera", pattern: /^(?:las?\s+)?tijeras?\s+(?:electricas?|diesel|de\s+elevacion)\b/u },
  { family: "plataforma-articulada", pattern: /^(?:las?\s+)?articuladas?\s+(?:electricas?|diesel)\b/u },
  { family: "plataforma-telescopica", pattern: /^(?:los?\s+)?telescopicos?\s+(?:diesel|electricos?)\b/u },
  { family: "plataforma-mastil", pattern: /^(?:los?\s+)?mastiles?\s+verticales?\b/u },
  { family: "manipulador-telescopico", pattern: /^manipuladores?\s*[.:]/u },
  { family: "grupo-electrogeno", pattern: /^(?:contamos\s+con\s+)?grupos?\s+electrogenos?\b/u },
  { family: "compactadora", pattern: /^el\s+[a-z0-9-]+\s+es\s+un\s+rodillo\b/u }
];

export const editorialFamilyFromSourceGeneral = (general: string | null): EditorialFamily | null => {
  const heading = fold(general ?? "").trim().slice(0, 180);
  for (const candidate of sourceHeadings) {
    if (candidate.pattern.test(heading)) return candidate.family;
  }
  return editorialFamilyOf(heading);
};
