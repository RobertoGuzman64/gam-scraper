import type { ProductRecord, SpecValue } from "../../../../contracts/catalog.js";
import { editorialFamilyOf } from "../../core/editorial-families.js";
import type { EditorialFamily } from "../../core/editorial-families.js";
import { editorialMetricOf, editorialQuantity, formatEditorialQuantity } from "../../measurements/editorial-measurements.js";
import { resolvedEditorialUnitFamilies } from "../../identity/editorial-unit-provenance.js";

const equalSpec = (source: ProductRecord, prepared: ProductRecord, key: string): string | null => {
  const raw = source.specs?.[key];
  return typeof raw === "string" && raw.trim() && raw === prepared.specs?.[key] ? raw.trim() : null;
};

const metres = (source: ProductRecord, prepared: ProductRecord, key: string, min: number, max: number): string | null => {
  if (!equalSpec(source, prepared, key)) return null;
  const value = editorialMetricOf(source.specs, [key]);
  return value !== null && value >= min && value <= max && value === editorialMetricOf(prepared.specs, [key]) ?
    `${formatEditorialQuantity(value)} m` : null;
};

const quantity = (source: ProductRecord, prepared: ProductRecord, key: string,
  unit: "mm" | "kW", min: number, max: number): string | null => {
  const raw = equalSpec(source, prepared, key);
  const value = editorialQuantity(raw ?? undefined, unit);
  return value !== null && value >= min && value <= max ? `${formatEditorialQuantity(value)} ${unit}` : null;
};

const watts = (source: ProductRecord, prepared: ProductRecord): string | null => {
  const raw = equalSpec(source, prepared, "Potencia absorbida");
  const match = raw && /^(\d{3,5})\s*W$/iu.exec(raw);
  const value = match?.[1] ? Number(match[1]) : null;
  return value !== null && value >= 100 && value <= 10000 ? `${formatEditorialQuantity(value)} W` : null;
};

const forkDimensions = (source: ProductRecord, prepared: ProductRecord): string | null => {
  const raw = equalSpec(source, prepared, "Horquillas");
  const match = raw && /^(\d{3,4})\s*[x×]\s*(\d{3,4})\s*mm$/iu.exec(raw);
  if (!match?.[1] || !match[2]) return null;
  const first = Number(match[1]);
  const second = Number(match[2]);
  return first >= 300 && first <= 2500 && second >= 300 && second <= 2500 ?
    `${formatEditorialQuantity(first)} × ${formatEditorialQuantity(second)} mm` : null;
};

const hammerCompatibility = (source: ProductRecord, prepared: ProductRecord): string | null => {
  const machine = equalSpec(source, prepared, "Maquina");
  const attachment = equalSpec(source, prepared, "Enganche");
  if (!machine || !attachment || !/^mini\s*excavadora\b[\p{L}\p{N} .-]{3,75}$/iu.test(machine) ||
    !/^[\p{L}\p{N} .-]{2,32}$/u.test(attachment)) return null;
  return `La tabla del proveedor relaciona este implemento con «${machine}» e indica el enganche «${attachment}». ` +
    "Son datos declarados en el anuncio: la adecuación de la máquina portadora, el tipo de acoplamiento " +
    "y el montaje deben verificarse antes de utilizar el implemento.";
};

const equipmentDetails = (source: ProductRecord, prepared: ProductRecord, family: EditorialFamily): readonly string[] => {
  const details: string[] = [];
  const add = (label: string, value: string | null): void => {
    if (value !== null) details.push(`${label} de ${value}`);
  };
  if (family === "plataforma-unipersonal") {
    add("altura replegada", metres(source, prepared, "Altura replegada", 0.5, 5));
    add("longitud de plataforma", metres(source, prepared, "Longitud plataforma", 0.4, 5));
    add("anchura de plataforma", metres(source, prepared, "Ancho plataforma", 0.3, 3));
  }
  if (["cargadora", "equipo-corte-disco", "radial-electrica", "martillo-electrico", "hidrolimpiadora"].includes(family)) {
    add("altura exterior", metres(source, prepared, "Alto", 0.1, 8));
  }
  if (family === "miniexcavadora") add("altura exterior", metres(source, prepared, "Altura", 0.5, 8));
  if (["radial-electrica", "martillo-electrico", "hidrolimpiadora"].includes(family) &&
    source.specs?.Motor === "Eléctrico" && prepared.specs?.Motor === "Eléctrico") {
    add("potencia eléctrica absorbida", watts(source, prepared));
  }
  if (family === "compactadora") {
    add("anchura de bandeja", quantity(source, prepared, "Ancho bandeja", "mm", 100, 2500));
    add("longitud de bandeja", quantity(source, prepared, "Largo bandeja", "mm", 100, 2500));
    add("potencia indicada", quantity(source, prepared, "Potencia", "kW", 0.1, 30));
  }
  if (family === "bomba-sumergible") {
    add("potencia indicada", quantity(source, prepared, "Potencia", "kW", 0.1, 100));
    add("altura máxima de elevación", metres(source, prepared, "Altura elevacion max", 0.5, 200));
  }
  if (family === "hidrolimpiadora") {
    const pressure = equalSpec(source, prepared, "Presion max.");
    const pressureMatch = pressure && /^(\d{2,3})\s*bar$/iu.exec(pressure);
    const bar = pressureMatch?.[1] ? Number(pressureMatch[1]) : null;
    if (bar !== null && bar >= 30 && bar <= 500) add("presión máxima indicada", `${bar} bar`);
    const flow = equalSpec(source, prepared, "Caudal nominal");
    const flowMatch = flow && /^(\d{1,3}(?:[.,]\d{1,2})?)\s*l\/min$/iu.exec(flow);
    const litres = flowMatch?.[1] ? Number(flowMatch[1].replace(",", ".")) : null;
    if (litres !== null && litres >= 0.5 && litres <= 100) add("caudal nominal indicado", `${formatEditorialQuantity(litres)} l/min`);
  }
  if (family === "dumper") {
    add("altura total", metres(source, prepared, "Altura total", 0.5, 8));
    const traction = equalSpec(source, prepared, "Tracción");
    if (traction && /^4[x×]4(?:\s+hidrost[aá]tic[ao])?$/iu.test(traction)) {
      details.push(`tracción declarada ${traction}`);
    }
  }
  if (family === "transpaleta") add("dimensiones de horquillas declaradas", forkDimensions(source, prepared));
  return details;
};

const declaredBoolean = (value: SpecValue | undefined): boolean | null => {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return null;
  if (/^(?:s[ií]|yes)$/iu.test(value.trim())) return true;
  if (/^no$/iu.test(value.trim())) return false;
  return null;
};

const affirmativeSpecs = (record: ProductRecord, keys: readonly string[]): boolean => {
  const values = keys.flatMap((key) => {
    const value = record.specs?.[key];
    return value === undefined ? [] : [declaredBoolean(value)];
  });
  return values.length > 0 && values.every((value) => value === true);
};

const wheelTraction = (record: ProductRecord): "4×2" | "4×4" | null => {
  const value = record.specs?.Tracción;
  const fourWheel = record.specs?.["Tracción 4x4"];
  const fourWheelDeclared = declaredBoolean(fourWheel);
  if (fourWheel !== undefined && fourWheelDeclared === null) return null;
  if (value === undefined) return fourWheelDeclared === true ? "4×4" : null;
  if (typeof value !== "string") return null;
  const match = /^4\s*[x×]\s*([24])$/iu.exec(value.trim());
  if (!match?.[1]) return null;
  const allWheels = match[1] === "4";
  return fourWheelDeclared !== null && fourWheelDeclared !== allWheels ? null : allWheels ? "4×4" : "4×2";
};

const matchingMetric = (source: ProductRecord, prepared: ProductRecord, keys: readonly string[]): number | null => {
  const original = editorialMetricOf(source.specs, keys);
  return original !== null && original === editorialMetricOf(prepared.specs, keys) ? original : null;
};

export const resolvePlatformOperationalDetails = (
  source: ProductRecord, prepared: ProductRecord, family: EditorialFamily
): readonly string[] => {
  if (!["plataforma-tijera", "plataforma-articulada", "plataforma-telescopica", "plataforma-mastil",
      "plataforma-unipersonal", "plataforma-oruga", "camion-cesta"].includes(family)) return [];
  const families = resolvedEditorialUnitFamilies(source, prepared);
  if (families?.[0] !== family || families[1] !== family) return [];
  const originalText = [source.title, source.shortDescription, source.longDescription,
    prepared.title, prepared.shortDescription, prepared.longDescription].join(" ");
  const details: string[] = [];
  const addMetric = (keys: readonly string[], label: string, mention: RegExp, min: number, max: number): void => {
    const value = matchingMetric(source, prepared, keys);
    if (value !== null && value >= min && value <= max && !mention.test(originalText)) {
      details.push(`${label} de ${formatEditorialQuantity(value)} m`);
    }
  };
  const addFeature = (keys: readonly string[], label: string, mention: RegExp): void => {
    if (affirmativeSpecs(source, keys) && affirmativeSpecs(prepared, keys) && !mention.test(originalText)) details.push(label);
  };
  if (family !== "plataforma-oruga" && family !== "camion-cesta") {
    const traction = wheelTraction(source);
    if (traction !== null && traction === wheelTraction(prepared) &&
      !/\b(?:tracci[oó]n|4\s*[x×]\s*[24]|[24]wd)\b/iu.test(originalText)) {
      details.push(`tracción ${traction} declarada`);
    }
  }
  const work = matchingMetric(source, prepared, ["Altura trabajo", "Altura de trabajo", "Altura de trabajo (m)"]);
  if (family === "plataforma-tijera") {
    const retracted = matchingMetric(source, prepared, ["Altura replegada", "Altura almacenaje"]);
    if (retracted !== null && work !== null && work >= 3 && work <= 60 && retracted <= Math.min(work, 30)) {
      addMetric(["Altura barandilla bajada", "Altura con barandillas bajadas"],
        "altura con barandillas bajadas", /\bbarandillas?\b/iu, 0.5, retracted);
    }
  }
  if (family === "plataforma-tijera" || family === "plataforma-unipersonal") {
    const length = matchingMetric(source, prepared, ["Longitud plataforma", "Longitud de plataforma"]);
    if (length !== null && length >= 0.5 && length <= 12) {
      addMetric(["Longitud extensión", "Extensión de plataforma"], "extensión de plataforma",
        /\bextensi[oó]n\b|\bplataforma\s+extensible\b/iu, 0.1, Math.min(length, 5));
    }
  }
  if (family === "plataforma-articulada" || family === "plataforma-telescopica") {
    const overall = matchingMetric(source, prepared, ["Longitud total", "Longitud", "Largo"]);
    if (overall !== null && overall >= 1 && overall <= 25) {
      addMetric(["Longitud transporte", "Longitud de transporte"], "longitud de transporte declarada",
        /\b(?:transporte|transportada|transportado)\b/iu, 1, overall - 0.01);
    }
  }
  if (family === "camion-cesta" && work !== null && work >= 3 && work <= 60) {
    const hasFields = (keys: readonly string[]): boolean => keys.some((key) =>
      source.specs?.[key] !== undefined || prepared.specs?.[key] !== undefined);
    if (!hasFields(["Altura", "Altura total", "Altura exterior", "Altura almacenaje", "Altura replegada"])) {
      addMetric(["Altura transporte", "Altura de transporte"], "altura de transporte declarada",
        /\b(?:altura|alto)\s+(?:de\s+|en\s+)?(?:transporte|almacenaje|replegad[oa]|total|exterior)\b/iu, 1.5, Math.min(5, work - 0.1));
    }
    if (!hasFields(["Dimensiones Cesta", "Dimensiones de cesta", "Dimensiones de la cesta", "Cesta",
        "Longitud plataforma", "Longitud de plataforma", "Ancho plataforma", "Anchura de plataforma"]) &&
      !/\b(?:dimensiones|medidas|longitud|largo|ancho|anchura)\s+(?:de\s+)?(?:la\s+)?(?:cesta|plataforma)\b|\b(?:cesta|plataforma)\s+de\s+\d/iu.test(originalText)) {
      const length = matchingMetric(source, prepared, ["Longitud cesta", "Longitud de cesta", "Longitud de la cesta"]);
      const width = matchingMetric(source, prepared, ["Ancho cesta", "Anchura de cesta", "Anchura de la cesta"]);
      if (length !== null && width !== null && length >= 0.5 && length <= 5 && width >= 0.4 && width <= 3) {
        details.push(`dimensiones de cesta declaradas de ${formatEditorialQuantity(length)} × ${formatEditorialQuantity(width)} m`);
      }
    }
  }
  if (family === "plataforma-articulada" || family === "camion-cesta") {
    if (work !== null && work >= 3 && work <= 60) {
      addMetric(["Altura articulacion", "Altura de articulación"], "altura de articulación",
        /\baltura\s+(?:de\s+)?articulaci[oó]n\b/iu, 0.5, work);
    }
  }
  if (family === "plataforma-articulada" || family === "plataforma-telescopica" || family === "camion-cesta") {
    addFeature(["Trabajo negativo", "Trabajo en negativo"], "trabajo en negativo declarado", /\bnegativ[oa]\b/iu);
    addFeature(["Barra antiatrapamiento"], "barra antiatrapamiento declarada", /\banti[ -]?atrapamiento\b/iu);
  }
  if (["plataforma-tijera", "plataforma-articulada", "plataforma-telescopica", "plataforma-oruga", "camion-cesta"].includes(family)) {
    addFeature(["Estabilizadores"], "estabilizadores declarados", /\bestabilizador(?:es)?\b/iu);
  }
  return details;
};

const declaredConfiguration = (
  source: ProductRecord, prepared: ProductRecord, keys: readonly string[],
  parse: (value: string) => string | null
): string | null => {
  const values = keys.flatMap((key) => {
    if (source.specs?.[key] === undefined && prepared.specs?.[key] === undefined) return [];
    const raw = equalSpec(source, prepared, key);
    return [raw === null ? null : parse(raw.normalize("NFD").replace(/[\u0300-\u036f]/gu, "").toLocaleLowerCase("es"))];
  });
  const first = values[0];
  return first && values.every((value) => value === first) ? first : null;
};

const hydraulicControls = (value: string): string | null => {
  if (/^(?:mini[ -]?palancas|minilevers)$/u.test(value)) return "minipalancas";
  if (value === "palancas" || value === "joystick") return value;
  if (value === "electricos") return "eléctrico";
  return null;
};

const wheelType = (value: string): string | null => {
  if (/^super[ -]?elasticas$/u.test(value)) return "superelásticas";
  if (value === "macizas") return "macizas";
  return null;
};

export const resolveHandlingOperationalDetails = (
  source: ProductRecord, prepared: ProductRecord, family: EditorialFamily
): readonly string[] => {
  const mastFamily = ["carretilla-elevadora", "carretilla-retractil", "apilador"].includes(family);
  if (!mastFamily && family !== "transpaleta" && family !== "manipulador-telescopico") return [];
  const families = resolvedEditorialUnitFamilies(source, prepared);
  if (families?.[0] !== family || families[1] !== family) return [];
  const text = [source.title, source.shortDescription, source.longDescription,
    prepared.title, prepared.shortDescription, prepared.longDescription].join(" ");
  const details: string[] = [];
  const addMetric = (keys: readonly string[], label: string, min: number, max: number): void => {
    const value = matchingMetric(source, prepared, keys);
    if (value !== null && value >= min && value <= max) details.push(`${label} de ${formatEditorialQuantity(value * 1000)} mm`);
  };
  if (mastFamily && !/m[aá]stil\s+(?:replegado|recogido|cerrado)|altura\s+(?:de\s+)?replegado/iu.test(text)) {
    const mastKeys = ["Altura mástil replegado", "Altura de mástil replegado"];
    const explicitMast = mastKeys.some((key) => source.specs?.[key] !== undefined && prepared.specs?.[key] !== undefined);
    addMetric([...mastKeys, "Altura max. replegada"],
      explicitMast ? "altura de mástil replegado declarada" : "altura máxima replegada declarada", 0.8, 6);
  }
  if (!/\b(?:horquillas?|tenedores?)\b/iu.test(text)) {
    const keys = ["Largo horquillas", "Longitud de horquillas", "Longitud de tenedor"];
    const combinedKeys = ["Dimensiones Horquillas", "Dimensiones de horquillas", "Horquillas"];
    const hasFields = (fields: readonly string[]): boolean => fields.some((key) => source.specs?.[key] !== undefined || prepared.specs?.[key] !== undefined);
    if (hasFields(keys) && !hasFields(combinedKeys)) {
      const length = matchingMetric(source, prepared, keys);
      if (length !== null && length >= 0.4 && length <= 4) {
        details.push(`longitud de horquillas declarada de ${formatEditorialQuantity(length * 1000)} mm`);
        addMetric(["Ancho horquillas", "Anchura de horquillas"], "anchura de horquillas declarada", 0.05, 0.4);
        addMetric(["Grosor horquillas", "Grosor de horquillas"], "grosor de horquillas declarado", 0.01, 0.15);
      }
    } else if (!hasFields(keys) && !hasFields(["Ancho horquillas", "Anchura de horquillas", "Grosor horquillas", "Grosor de horquillas"])) {
      const present = combinedKeys.filter((key) => source.specs?.[key] !== undefined || prepared.specs?.[key] !== undefined);
      const raw = present.length === 1 && present[0] !== undefined ? equalSpec(source, prepared, present[0]) : null;
      const triple = raw ? /^(\d{3,4})\s*[x×]\s*(\d{2,3})\s*[x×]\s*(\d{2,3})\s*mm$/iu.exec(raw) : null;
      const values = triple?.slice(1).map(Number);
      if (values && values[0] !== undefined && values[1] !== undefined && values[2] !== undefined &&
        values[0] >= 400 && values[0] <= 4000 && values[1] >= 50 && values[1] <= 400 &&
        values[2] >= 10 && values[2] <= 150 && values[2] <= values[1]) {
        details.push(`dimensiones de horquillas declaradas de ${values.map(formatEditorialQuantity).join(" × ")} mm`);
      }
    }
  }
  if (mastFamily && !/\bdesplaza(?:dor|miento)\s+lateral\b/iu.test(text) &&
    affirmativeSpecs(source, ["Desplazador lateral", "Desplazamiento lateral"]) &&
    affirmativeSpecs(prepared, ["Desplazador lateral", "Desplazamiento lateral"])) details.push("desplazador lateral declarado");
  if (mastFamily && !/\belevaci[oó]n libre\b/iu.test(text) &&
    affirmativeSpecs(source, ["Elevación libre"]) && affirmativeSpecs(prepared, ["Elevación libre"])) details.push("elevación libre declarada");
  if (mastFamily && source.condition === "Segunda mano") {
    if (!/\b(?:mandos?|controles?|palancas?|minipalancas?|minilevers|joystick|hidr[aá]ulic[oa]s?)\b/iu.test(text)) {
      const controls = declaredConfiguration(source, prepared,
        ["Controles Hidraúlicos", "Controles hidráulicos", "Mandos hidráulicos"], hydraulicControls);
      if (controls !== null) details.push(`mandos hidráulicos declarados de tipo ${controls}`);
    }
    if (!/\b(?:ruedas?|neum[aá]ticos?|bandajes?|maciz[oa]s?|super[ -]?el[aá]stic[oa]s?|triciclos?)\b/iu.test(text)) {
      const wheels = declaredConfiguration(source, prepared, ["Ruedas", "Tipo de ruedas", "Tipo de neumáticos"], wheelType);
      if (wheels !== null) details.push(`ruedas ${wheels} declaradas`);
    }
  }
  return details;
};

export const resolveTransportOperationalDetails = (
  source: ProductRecord, prepared: ProductRecord, family: EditorialFamily, heightAlreadyIncluded: boolean
): readonly string[] => {
  const handling = ["carretilla-elevadora", "carretilla-retractil", "apilador", "manipulador-telescopico"].includes(family);
  const exterior = ["excavadora", "miniexcavadora", "cargadora", "compactadora", "grupo-electrogeno"].includes(family);
  if (!handling && !exterior) return [];
  const families = resolvedEditorialUnitFamilies(source, prepared);
  if (families?.[0] !== family || families[1] !== family) return [];
  const text = [source.title, source.shortDescription, source.longDescription,
    prepared.title, prepared.shortDescription, prepared.longDescription].join(" ");
  const details: string[] = [];
  if (exterior && !heightAlreadyIncluded && !/\b(?:altura|alto)\b/iu.test(text)) {
    const keys = ["Altura", "Alto", "Altura total", "Altura exterior"];
    const height = matchingMetric(source, prepared, keys);
    const competing = ["Altura almacenaje", "Altura replegada", "Altura de trabajo", "Altura trabajo",
      ...(family === "compactadora" ? ["Ancho bandeja", "Largo bandeja", "Potencia"] : [])];
    if (height !== null && height >= 0.3 && height <= 8 &&
      !competing.some((key) => source.specs?.[key] !== undefined || prepared.specs?.[key] !== undefined)) {
      details.push(`altura exterior declarada de ${formatEditorialQuantity(height)} m`);
    }
  }
  if (family === "manipulador-telescopico" && !heightAlreadyIncluded &&
    !/\b(?:altura\s+(?:total|exterior|del equipo|de transporte|de almacenaje|replegada)|alto)\b/iu.test(text)) {
    const competing = ["Altura", "Alto", "Altura exterior", "Altura almacenaje", "Altura replegada", "Altura transporte", "Altura de transporte"];
    const height = matchingMetric(source, prepared, ["Altura total"]);
    if (height !== null && height >= 1 && height <= 5 &&
      !competing.some((key) => source.specs?.[key] !== undefined || prepared.specs?.[key] !== undefined)) {
      details.push(`altura total declarada de ${formatEditorialQuantity(height)} m`);
    }
  }
  if (handling && !/\b(?:longitud|largo)\b/iu.test(text)) {
    const forkKeys = ["Longitud sin horquillas", "Largo sin horquillas"];
    const boardKeys = ["Longitud al tablero", "Largo al tablero"];
    const keys = family === "manipulador-telescopico" ? boardKeys : forkKeys;
    const competing = family === "manipulador-telescopico" ? forkKeys : boardKeys;
    const generic = ["Longitud", "Longitud total", "Largo"];
    const length = matchingMetric(source, prepared, keys);
    const hasGeneric = generic.some((key) => source.specs?.[key] !== undefined || prepared.specs?.[key] !== undefined);
    const overall = matchingMetric(source, prepared, generic);
    if (length !== null && length >= 0.5 && length <= 15 &&
      !competing.some((key) => source.specs?.[key] !== undefined || prepared.specs?.[key] !== undefined) &&
      (!hasGeneric || overall !== null && overall > length)) {
      details.push(`${family === "manipulador-telescopico" ? "longitud al tablero" : "longitud sin horquillas"} declarada de ${formatEditorialQuantity(length)} m`);
    }
  }
  return details;
};

export const resolveEquipmentConfigurationDetails = (
  source: ProductRecord, prepared: ProductRecord, family: EditorialFamily
): readonly string[] => {
  if (!["grupo-electrogeno", "excavadora", "miniexcavadora", "dumper"].includes(family)) return [];
  const families = resolvedEditorialUnitFamilies(source, prepared);
  if (families?.[0] !== family || families[1] !== family) return [];
  const text = [source.title, source.shortDescription, source.longDescription,
    prepared.title, prepared.shortDescription, prepared.longDescription].join(" ");
  const details: string[] = [];
  if (family === "dumper") {
    const configurations = [
      { key: "Giratorio", label: "tolva giratoria declarada", mention: /\b(?:giratori[oa]s?|giro\s+de\s+(?:la\s+)?tolva|tolva\s+(?:es\s+)?fija)\b/iu },
      { key: "Autocargable", label: "configuración autocargable declarada", mention: /\b(?:autocarg\p{L}*|auto[ -]carg\p{L}*|carga\s+autom[aá]tica|carga\s+manual)\b/iu },
      { key: "Descarga altura", label: "descarga en altura declarada", mention: /\b(?:descarga\s+(?:en\s+)?altura|descarga\s+elevada|altura\s+de\s+descarga|descarga\s+a\s+nivel\s+del\s+suelo)\b/iu }
    ] as const;
    for (const configuration of configurations) {
      if (declaredBoolean(source.specs?.[configuration.key]) === true &&
        declaredBoolean(prepared.specs?.[configuration.key]) === true && !configuration.mention.test(text)) {
        details.push(configuration.label);
      }
    }
  } else if (family === "grupo-electrogeno") {
    const competingVoltageKeys = ["Voltaje", "Voltaje de la batería"];
    if (!/\b(?:voltios?|voltaje|tensi[oó]n|bater[ií]as?)\b|\b\d+\s*v\b/iu.test(text) &&
      competingVoltageKeys.every((key) => source.specs?.[key] === undefined && prepared.specs?.[key] === undefined)) {
      const raw = equalSpec(source, prepared, "Voltios");
      const voltage = editorialQuantity(raw ?? undefined, "V");
      const paired = raw && /^(\d{3})\s*\/\s*(\d{3})\s*V$/iu.exec(raw);
      if (voltage !== null && Number.isInteger(voltage) && voltage >= 100 && voltage <= 690) {
        details.push(`tensión eléctrica declarada de ${voltage} V`);
      } else if (paired?.[1] && paired[2]) {
        const first = Number(paired[1]);
        const second = Number(paired[2]);
        if (first >= 100 && first <= 690 && second >= 100 && second <= 690 && first !== second) {
          details.push(`tensiones eléctricas declaradas de ${first}/${second} V`);
        }
      }
    }
    if (!/\bpolos?\b/iu.test(text)) {
      const poles = equalSpec(source, prepared, "Polos");
      if (poles !== null && /^(?:2|4|6|8|10|12)$/u.test(poles)) {
        details.push(`${poles} polos declarados`);
      }
    }
    if (!/\bdep[oó]sitos?\b/iu.test(text)) {
      const keys = ["Capacidad depósito", "Capacidad del depósito", "Capacidad de depósito"];
      const values = keys.flatMap((key) => {
        if (source.specs?.[key] === undefined && prepared.specs?.[key] === undefined) return [];
        const raw = equalSpec(source, prepared, key);
        const match = raw && /^(\d{1,4}(?:[.,]\d{1,2})?)\s*(?:l|litros?)$/iu.exec(raw);
        return [match?.[1] ? Number(match[1].replace(",", ".")) : null];
      });
      const capacity = values[0];
      if (capacity !== undefined && capacity !== null && capacity >= 1 && capacity <= 10000 &&
        values.every((value) => value === capacity)) {
        details.push(`capacidad de depósito declarada de ${formatEditorialQuantity(capacity)} l`);
      }
    }
  } else if (!/\b(?:cazos?|cucharas?|cucharones?|implementos?)\b/iu.test(text)) {
    const keys = ["Cazo 1 limpieza", "Cazo 2", "Cazo 3"];
    const present = keys.filter((key) => source.specs?.[key] !== undefined || prepared.specs?.[key] !== undefined);
    const values = present.map((key) => {
      const raw = equalSpec(source, prepared, key);
      const value = editorialQuantity(raw ?? undefined, "mm");
      return value !== null && value >= 100 && value <= 3000 ? value : null;
    });
    if (present.length > 0 && values.every((value): value is number => value !== null)) {
      const sizes = [...new Set(values)].sort((left, right) => left - right);
      const formatted = sizes.map(formatEditorialQuantity);
      const listed = formatted.length === 1 ? formatted[0] :
        `${formatted.slice(0, -1).join(", ")} y ${formatted[formatted.length - 1]}`;
      details.push(`medidas de cazos declaradas de ${listed} mm`);
    }
  }
  return details;
};

export const resolveSourcedEquipmentDetails = (
  source: ProductRecord, prepared: ProductRecord, general: string | null, authenticatedOrigin: boolean
): string | null => {
  if (!authenticatedOrigin || !general?.trim() || source.longDescription?.trim() || source.shortDescription?.trim() ||
    /La tabla técnica de esta misma referencia especifica|La tabla del proveedor relaciona este implemento/iu.test(general)) return null;
  const families = resolvedEditorialUnitFamilies(source, prepared);
  if (!families || !families[0] || families[0] !== families[1]) return null;
  const family = editorialFamilyOf(general) ??
    (families[0] === "plataforma-unipersonal" && /\bplataforma unipersonal\b/iu.test(general) ?
      "plataforma-unipersonal" : null);
  if (family !== families[0]) return null;
  if (family === "martillo-miniexcavadora") {
    const compatibility = hammerCompatibility(source, prepared);
    return compatibility;
  }
  const details = equipmentDetails(source, prepared, family).filter((detail) =>
    !(/^altura exterior\b/u.test(detail) && /\baltura exterior declarada\b/iu.test(general)));
  if (details.length === 0) return null;
  const listed = details.length === 1 ? details[0] :
    `${details.slice(0, -1).join(", ")} y ${details[details.length - 1]}`;
  return `La tabla técnica de esta misma referencia especifica ${listed}. ` +
    "Son valores declarados por el proveedor que deben contrastarse con la unidad anunciada.";
};
