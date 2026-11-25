import type { ProductRecord, SpecsMap, SpecValue } from "../../../contracts/catalog.js";
import { isGamUnitUrl } from "../../../catalog/normalization/gam/unit-url.js";
import { fold } from "../../classification/category-utils.js";
import { hasUnconditionalEditorialClaim } from "../../editorial/claims/editorial-claim-evidence.js";
import { resolvedEditorialUnitFamilies } from "../../editorial/identity/editorial-unit-provenance.js";
import { resolveEditorialSource } from "../../editorial/core/editorial-source.js";
import { containsEditorialSourceSlugModel } from "../../editorial/source/editorial-source-url.js";
import type { TechnicalRecoveryObservation } from "../../provenance/technical-recovery-observation.js";
import { containsEditorialBrandModel, containsEditorialIdentity } from "../../editorial/identity/editorial-identity-match.js";
import { resolveEditorialFacts } from "../../editorial/core/editorial-facts.js";

export const reconcileHandlingFamilySpecs = (record: ProductRecord, specs: SpecsMap): SpecsMap => {
  const facts = resolveEditorialFacts({ ...record, specs });
  if (facts?.family !== "tractor-arrastre" || facts.loadCapacityKg === null ||
    ("Capacidad de arrastre" in specs || "Capacidad de arrastre (kg)" in specs)) return specs;
  const capacity = specs["Capacidad de carga (kg)"];
  if (capacity === undefined) return specs;
  const { ["Capacidad de carga (kg)"]: _removed, ...remaining } = specs;
  return { ...remaining, "Capacidad de arrastre": capacity };
};

const attachmentCarriage = /\bgracias al tablero de eje pasador que permite equipar distintos implementos\b/giu;
const footProtection = /\bsu protecci[oó]n para el operario incluye[^.!?;\n]{0,220}\by protectores para los pies\b/giu;
const batteryRating = /\bbater[ií]as sin necesidad de mantenimiento,\s*(\d{2})\s*V\s+(\d{2,3})\s*Ah\s*\/\s*20\s*h\s+secas\b/giu;

export const recoverSourceHandlingConfiguration = (
  original: ProductRecord, recovered: ProductRecord, specs: SpecsMap, observe?: TechnicalRecoveryObservation
): SpecsMap => {
  const text = original.longDescription;
  if (!text || text !== recovered.longDescription) return specs;
  const newOffer = original.condition === "Nuevo" && !original.serialNumber && !original.horometer && !original.year;
  if (!newOffer && original.condition !== "Segunda mano") return specs;
  const identity = resolveEditorialSource(original);
  const families = resolvedEditorialUnitFamilies(original, recovered);
  if (!identity || !families || families[0] !== families[1] ||
    !containsEditorialSourceSlugModel(new URL(original.url).pathname.split("/").filter(Boolean).at(-1) ?? "", identity.model, original.specs?.Motor)) return specs;
  const keys = [...Object.keys(original.specs ?? {}), ...Object.keys(specs)].map(fold);
  const absent = (pattern: RegExp): boolean => !keys.some((key) => pattern.test(key));
  const short = original.shortDescription ?? "";
  const singleClaim = (claim: RegExp, mentions: RegExp): boolean =>
    [...text.matchAll(mentions)].length === 1 && hasUnconditionalEditorialClaim(text, claim) && [...short.matchAll(mentions)].length === 0;
  const additions: Record<string, SpecValue> = {};
  const lowLevelPicker = families[0] === null && families[1] === null &&
    /^preparapedidos\b/iu.test(original.title ?? "") && /^preparapedidos\b/iu.test(recovered.title ?? "") &&
    new URL(original.url).pathname.split("/").some((segment) => /^preparapedidos(?:-|$)/iu.test(segment));
  if (original.condition === "Segunda mano" && (families[0] === "recogepedidos" || lowLevelPicker) &&
    original.brand && original.model && containsEditorialBrandModel(text, original.brand, original.model) &&
    absent(/motor|motorizacion|propulsion|combustible|energia|bateria/u) &&
    !/\b(?:diesel|diésel|gasolina|glp|h[ií]brid[oa])\b/iu.test(`${original.title ?? ""} ${short} ${text}`) &&
    !/\b(?:no|nunca)\s+(?:(?:est[aá]|viene|fue)\s+)?equipad[oa]\b/iu.test(text) &&
    (singleClaim(/\bequipad[oa] con un (?:potente )?motor el[eé]ctrico\b/giu, /\bmotor\b/giu) ||
      hasUnconditionalEditorialClaim(text, /\b(?:preparapedidos|recogepedidos) de bajo nivel el[eé]ctrico\b/giu))) {
    additions["Tipo motor"] = "Eléctrico";
  }
  if (original.condition === "Segunda mano" && families[0] === "recogepedidos" && original.brand && original.model &&
    containsEditorialBrandModel(original.title ?? "", original.brand, original.model) &&
    containsEditorialBrandModel(text, original.brand, original.model) &&
    absent(/posicion.*(?:conductor|conduccion|operador)|plataforma.*(?:conductor|operario|operador)|tipo.*conduccion|conduccion.*(?:pie|bordo|sentado)/u) &&
    hasUnconditionalEditorialClaim(text, /\bla plataforma de operario cuenta con acceso f[aá]cil y seguro[^.!?;\n]{0,100}subir y bajar de la m[aá]quina\b/giu) &&
    !/\b(?:a pie|sentado|sin plataforma|plataforma opcional|opci[oó]n de plataforma)\b/iu.test(`${short} ${text}`)) {
    additions["Posición de conducción"] = "Operador a bordo";
  }
  if (families[0] === "transpaleta" && original.brand && original.model &&
    containsEditorialBrandModel(original.title ?? "", original.brand, original.model)) {
    const title = fold(original.title ?? "");
    const evidence = fold(`${original.title ?? ""} ${short} ${text}`);
    const identityInDescription = containsEditorialBrandModel(text, original.brand, original.model);
    const manual = /\btranspaleta manual\b/u.test(title) && /\btranspaleta manual\b/u.test(fold(text));
    const electric = /\btranspaleta(?: elevadora)? electrica\b/u.test(title) && identityInDescription &&
      hasUnconditionalEditorialClaim(text, /\b(?:motor (?:el[eé]ctrico|AC)|tracci[oó]n el[eé]ctrica)\b/giu);
    if (absent(/motor|motorizacion|propulsion|combustible|energia|accionamiento|traccion/u)) {
      if (original.condition === "Segunda mano" && manual &&
        (identityInDescription || containsEditorialBrandModel(short, original.brand, original.model)) &&
        hasUnconditionalEditorialClaim(text, /\btranspaleta manual\b/giu) &&
        !/\b(?:electrica|electrico|bateria|diesel|gasolina|glp)\b/u.test(evidence.replace(/\bsin necesidad de alimentacion electrica\b/gu, ""))) {
        additions.Propulsión = "Manual";
      } else if (electric && !/\b(?:manual|diesel|gasolina|glp|hibrid[oa])\b/u.test(evidence)) {
        additions["Tipo motor"] = "Eléctrico";
      }
    }
    const positionAbsent = absent(/posicion.*(?:conductor|conduccion|operador)|plataforma.*(?:conductor|operario|operador)|tipo.*conduccion|conduccion.*(?:pie|bordo|sentado)/u);
    if (original.condition === "Segunda mano" && identityInDescription && positionAbsent &&
      /\ba pie\b/u.test(title) &&
      hasUnconditionalEditorialClaim(text, /\btranspaleta (?:manual|el[eé]ctrica)(?: de conductor)? a pie\b/giu) &&
      !/\b(?:conductor|operador) (?:montado|sentado|a bordo)|plataforma (?:para|del|de) (?:el )?(?:operario|operador|conductor)\b/u.test(evidence)) {
      additions["Posición de conducción"] = "Operador a pie";
    } else if (newOffer && identityInDescription && positionAbsent &&
      hasUnconditionalEditorialClaim(text, /\bincorpora una plataforma para operario a bordo\b/giu) &&
      !/\b(?:a pie|sentado|plataforma opcional)\b/u.test(evidence)) {
      additions["Posición de conducción"] = "Operador a bordo";
    }
  }
  if ((families[0] === "apilador" || families[0] === "transpaleta") && original.brand && original.model &&
    !additions["Posición de conducción"] &&
    absent(/conductor|conduccion|posicion.*(?:operario|operador)|plataforma.*(?:operario|operador)|puesto.*(?:operario|operador)/u) &&
    containsEditorialBrandModel(original.title ?? "", original.brand, original.model) &&
    (!short || containsEditorialBrandModel(short, original.brand, original.model))) {
    const { brand, model } = original;
    const description = fold(text);
    const evidence = fold(`${original.title ?? ""}. ${short}. ${text}`);
    const pedestrianClaim = families[0] === "apilador"
      ? /\bapilador(?: electrico| manual)? (?:de )?(?:(?:conductor|operari[oa]|operador) )?a pie\b/gu
      : /\btranspaleta(?: electrica| manual)? (?:de )?(?:(?:conductor|operari[oa]|operador) )?a pie\b/gu;
    const brandPattern = fold(brand).replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
    const namedModel = new RegExp(`\\b${brandPattern}\\s+([a-z0-9./-]*\\d[a-z0-9/-]*(?:\\.\\d[a-z0-9/-]*)*)`, "gu");
    const conflictingModel = [...evidence.matchAll(namedModel)].some((match) =>
      !!match[1] && !containsEditorialIdentity(model, match[1]));
    const identifiedClaim = description.slice(0, 450).split(/(?<=[.!?;])\s+|\n/u).some((clause) =>
      [...clause.matchAll(pedestrianClaim)].length > 0 && containsEditorialBrandModel(clause, brand, model));
    if (identifiedClaim && !conflictingModel && hasUnconditionalEditorialClaim(description, pedestrianClaim) &&
      !/\b(?:a bordo|sentad[oa]|montad[oa]|plataforma (?:abatible|plegable|opcional|(?:para|del|de) (?:el )?(?:operario|operador|conductor))|(?:conductor|operario|operador) (?:de pie|sobre plataforma)|(?:a pie|peatonal) (?:opcional|segun|como opcion)|(?:no|sin) (?:ser |un |una )?(?:apilador|transpaleta|conductor|operario|operador)|(?:comparacion|comparad[oa]) con)\b/u.test(evidence.replace(/\b(?:cargador|diagnostico|sistema de diagnostico) a bordo\b/gu, "")) &&
      !/\b(?:no|sin|ni|opcion|opcional|alternativ[oa]|segun)\b[^.!?;\n]{0,45}\ba pie\b/u.test(evidence)) {
      additions["Posición de conducción"] = "Operador a pie";
    }
  }
  if (newOffer && original.brand && original.model &&
    containsEditorialBrandModel(original.title ?? "", original.brand, original.model) &&
    containsEditorialBrandModel(text, original.brand, original.model)) {
    const evidence = fold(`${original.title ?? ""} ${short} ${text}`);
    const diagnosticClaim = /\bsistema de diagn[oó]stico\b/giu;
    if ((families[0] === "carretilla-elevadora" || families[0] === "carretilla-retractil" ||
      families[0] === "apilador" || families[0] === "transpaleta" || families[0] === "recogepedidos" || families[0] === "tractor-arrastre") &&
      absent(/diagnost|autodiagnost|\bvsm\b/u) && (!short || containsEditorialBrandModel(short, original.brand, original.model))) {
      const brandPattern = fold(original.brand).replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
      const namedModel = new RegExp(`\\b${brandPattern}\\s+([a-z0-9./-]*\\d[a-z0-9/-]*(?:\\.\\d[a-z0-9/-]*)*)`, "gu");
      const conflictingModel = [...evidence.matchAll(namedModel)].some((match) =>
        !!match[1] && !containsEditorialIdentity(original.model ?? "", match[1]));
      const context = `${original.title ?? ""}. ${short}. ${text}`;
      if (!conflictingModel && hasUnconditionalEditorialClaim(text, diagnosticClaim) &&
        hasUnconditionalEditorialClaim(context, diagnosticClaim) &&
        [...context.matchAll(diagnosticClaim)].every((match) => {
          const index = match.index ?? 0;
          const before = fold(context.slice(Math.max(0, index - 150), index)).split(/[.!?;\n]/u).at(-1) ?? "";
          const after = fold(context.slice(index + match[0].length, index + match[0].length + 150)).split(/[.!?;\n]/u)[0] ?? "";
          return !/\b(?:otros? modelos?|otras? maquinas?|otra variante|comparacion|comparad[oa]|a diferencia de|segun configuracion|alternativ[oa]s?)\b/u.test(`${before} ${after}`) &&
            !/\b(?:sin|ni|carece de|no (?:tiene|lleva|monta|equipa|incluye|incorpora|dispone de|cuenta con))(?:\s+(?:un|el|su))?\s*$/u.test(before) &&
            !/\b(?:desactivad[oa]|no disponible|no instalad[oa]|externo|opcional)\b/u.test(after);
        })) additions["Sistema de diagnóstico"] = true;
    }
    const seatClaim = /\basiento (?:ajustable|regulable)\b/giu;
    if ((families[0] === "carretilla-elevadora" || families[0] === "carretilla-retractil") &&
      absent(/asiento|sillin|\bseat\b/u) && (!short || containsEditorialBrandModel(short, original.brand, original.model))) {
      const brandPattern = fold(original.brand).replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
      const namedModel = new RegExp(`\\b${brandPattern}\\s+([a-z0-9./-]*\\d[a-z0-9/-]*(?:\\.\\d[a-z0-9/-]*)*)`, "gu");
      const conflictingModel = [...evidence.matchAll(namedModel)].some((match) =>
        !!match[1] && !containsEditorialIdentity(original.model ?? "", match[1]));
      const context = `${original.title ?? ""}. ${short}. ${text}`;
      if (!conflictingModel && [...context.matchAll(/\b(?:SWB|MWB|LWB)\b/giu)].every((match) =>
        containsEditorialIdentity(original.model ?? "", match[0])) &&
        hasUnconditionalEditorialClaim(text, seatClaim) && hasUnconditionalEditorialClaim(context, seatClaim) &&
        !/\b(?:sin asiento|asiento (?:es )?(?:fijo|no (?:ajustable|regulable))|no (?:tiene|lleva|monta|equipa|incluye|incorpora|dispone de|cuenta con) (?:un |el |su )?asiento)\b/u.test(evidence) &&
        [...context.matchAll(seatClaim)].every((match) => {
          const index = match.index ?? 0;
          const before = fold(context.slice(Math.max(0, index - 150), index)).split(/[.!?;\n]/u).at(-1) ?? "";
          const after = fold(context.slice(index + match[0].length, index + match[0].length + 150)).split(/[.!?;\n]/u)[0] ?? "";
          return !/\b(?:otros? modelos?|otras? maquinas?|otra variante|comparacion|comparad[oa]|a diferencia de|segun configuracion|alternativ[oa]s?|no regulable|no ajustable)\b/u.test(`${before} ${after}`);
        })) additions["Asiento regulable"] = true;
    }
    const workLights = /\bluces de trabajo\b/giu;
    if (families[0] === "carretilla-elevadora" &&
      (original.providerId === "mercaeleva" || original.providerId === "gam" && isGamUnitUrl(original)) && absent(/\b(?:luces?|faros?|focos?|iluminacion|alumbrado)\b/u) &&
      (!short || containsEditorialBrandModel(short, original.brand, original.model)) &&
      hasUnconditionalEditorialClaim(text, workLights)) {
      const context = fold(`${original.title ?? ""}. ${short}. ${text}`);
      const brandPattern = fold(original.brand).replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
      const namedModel = new RegExp(`\\b${brandPattern}\\s+([a-z0-9./-]*\\d[a-z0-9/-]*(?:\\.\\d[a-z0-9/-]*)*)`, "gu");
      const conflictingModel = [...context.matchAll(namedModel)].some((match) =>
        !!match[1] && !containsEditorialIdentity(original.model ?? "", match[1]));
      if (!conflictingModel && [...context.matchAll(/\b(?:swb|mwb|lwb)\b/gu)].every((match) =>
        containsEditorialIdentity(original.model ?? "", match[0])) &&
        hasUnconditionalEditorialClaim(context, workLights) &&
        [...context.matchAll(workLights)].every((match) => {
          const index = match.index ?? 0;
          const before = context.slice(Math.max(0, index - 180), index).split(/[.!?;\n]/u).at(-1) ?? "";
          const after = context.slice(index + match[0].length, index + match[0].length + 150).split(/[.!?;\n]/u)[0] ?? "";
          return /\b(?:equipad[oa] con|se han (?:incorporado|implementado)|incorpora|incluye|dispone de|cuenta con|de serie)\b/u.test(before) &&
            !/\b(?:no|sin|ni|carece|ausencia|opcional(?:es)?|opcion|pueden?|podrian?|configuracion|configurarse|disponibles?|alternativ[oa]s?|dependiendo|otros? modelos?|otras? maquinas?|otra variante|comparacion|comparad[oa]|a diferencia de|desactivad[oa]s?)\b/u.test(`${before} ${after}`);
        })) additions["Luces de trabajo"] = true;
    }
    const steeringClaim = /\bdirecci[oó]n el[eé]ctrica\b/giu;
    if ((families[0] === "apilador" || families[0] === "transpaleta" || families[0] === "recogepedidos" ||
      families[0] === "tractor-arrastre" || families[0] === "carretilla-elevadora" || families[0] === "carretilla-retractil") &&
      absent(/direccion|gobierno|steering/u) && (!short || containsEditorialBrandModel(short, original.brand, original.model)) &&
      !/\b(?:direccion (?:manual|hidraulica|mecanica|opcional|alternativa)|(?:no|sin|ni)\s+[^.!?;\n]{0,45}direccion electrica|direccion electrica[^.!?;\n]{0,45}\b(?:opcional|no incluida|no disponible)|(?:otros? modelos?|otra variante|comparacion con)\b[^.!?;\n]{0,70}direccion electrica)\b/u.test(evidence) &&
      !(/\bmotor (?:diesel|gasolina|glp)\b/u.test(evidence) && !absent(/bateria|voltaje|tension/u)) &&
      hasUnconditionalEditorialClaim(text, steeringClaim)) {
      const brandPattern = fold(original.brand).replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
      const namedModel = new RegExp(`\\b${brandPattern}\\s+([a-z0-9./-]*\\d[a-z0-9/-]*(?:\\.\\d[a-z0-9/-]*)*)`, "gu");
      const conflictingModel = [...evidence.matchAll(namedModel)].some((match) =>
        !!match[1] && !containsEditorialIdentity(original.model ?? "", match[1]));
      if (!conflictingModel) additions["Sistema de dirección"] = "Eléctrica";
    }
    const technologyAbsent = absent(/tecnologia.*motor|tipo.*motor.*traccion|corriente.*(?:motor|traccion)|motor.*\b(?:ca|ac|cc|dc)\b|controlador de traccion/u);
    const acTraction = families[0] === "recogepedidos" ? /\bmotor de tracci[oó]n (?:de )?(?:CA|AC|corriente alterna)\b/giu :
      families[0] === "transpaleta" ? /\bmotor de tracci[oó]n AC sin escobillas\b/giu :
        families[0] === "apilador" ? /\bmotor de tracci[oó]n AC sin mantenimiento\b/giu : null;
    if (technologyAbsent && acTraction && !/\b(?:corriente continua|motor (?:de cc|dc|diesel|gasolina|glp)|motor alternativo|motor opcional|motorizacion opcional|sin motor|no (?:tiene|incluye|monta|utiliza|dispone de) (?:un )?motor)\b/u.test(evidence) &&
      hasUnconditionalEditorialClaim(text, acTraction)) {
      additions["Tecnología del motor de tracción"] = "Corriente alterna";
    } else if (families[0] === "recogepedidos" && technologyAbsent &&
      !/\b(?:corriente continua|motor (?:de cc|dc|diesel|gasolina|glp)|motor alternativo|motor opcional|sin motor|no (?:esta )?equipad[oa])\b/u.test(evidence) &&
      hasUnconditionalEditorialClaim(text, /\bequipad[oa] con un motor de (?:CA|AC|corriente alterna)\b/giu)) {
      additions["Tecnología del motor"] = "Corriente alterna";
    }
    if (families[0] === "carretilla-elevadora" && technologyAbsent &&
      (!short || containsEditorialBrandModel(short, original.brand, original.model)) &&
      /\bcarretilla(?: elevadora)? electrica\b/u.test(fold(original.title ?? "")) &&
      ![original.specs, specs].some((values) => Object.entries(values ?? {}).some(([key, value]) =>
        /motor|motorizacion|propulsion|traccion/u.test(fold(key)) && typeof value === "string" &&
        /\b(?:corriente alterna|corriente continua|ac|ca|dc|cc|diesel|glp|gasolina)\b/u.test(fold(value)))) &&
      !/\b(?:corriente continua|motor(?:es)? (?:de )?(?:cc|dc|diesel|gasolina|glp)|motor(?:es)? alternativ[oa]s?|motor(?:es)? opcional(?:es)?|motorizacion opcional|sin motor(?:es)?|no (?:tiene|incluye|monta|utiliza|dispone de) (?:un )?motor(?:es)?)\b/u.test(evidence)) {
      const brandPattern = fold(original.brand).replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
      const namedModel = new RegExp(`\\b${brandPattern}\\s+([a-z0-9./-]*\\d[a-z0-9/-]*(?:\\.\\d[a-z0-9/-]*)*)`, "gu");
      const conflictingModel = [...evidence.matchAll(namedModel)].some((match) =>
        !!match[1] && !containsEditorialIdentity(original.model ?? "", match[1]));
      const tractionClaim = /\bmotor(?:es)? de tracci[oó]n (?:de )?(?:CA|AC|corriente alterna)\b/giu;
      const motorClaim = /\bmotor(?:es)?(?: el[eé]ctricos?)? (?:de )?(?:CA|AC|corriente alterna)\b/giu;
      const declared = (pattern: RegExp): boolean => hasUnconditionalEditorialClaim(text, pattern) &&
        [...text.matchAll(pattern)].every((match) => {
          const index = match.index ?? 0;
          const prefix = fold(text.slice(Math.max(0, index - 150), index)).split(/(?<!\d)[.!?;\n]|[.!?;\n](?!\d)/u).at(-1) ?? "";
          const suffix = fold(text.slice(index + match[0].length, index + match[0].length + 100)).split(/[.!?;\n]/u)[0] ?? "";
          return !/\b(?:no|sin|ni)(?:\s+(?:un|una|el|los|sus))?\s*$/u.test(prefix) &&
            !/\b(?:controlador|control|regulador|variador)(?: (?:de|del))?\s*$/u.test(prefix) &&
            !/\b(?:configuracion|variante|alternativ[oa]s?|otros? modelos?|comparad[oa]|comparacion)\b/u.test(`${prefix} ${suffix}`);
        });
      if (!conflictingModel && declared(tractionClaim)) {
        additions["Tecnología del motor de tracción"] = "Corriente alterna";
      } else if (!conflictingModel && declared(motorClaim)) {
        additions["Tecnología del motor"] = "Corriente alterna";
      }
    }
    if (families[0] === "apilador" && absent(/posicion.*(?:conductor|conduccion|operador)|plataforma.*(?:conductor|operario|operador)|tipo.*conduccion|conduccion.*(?:pie|bordo|sentado)/u) &&
      hasUnconditionalEditorialClaim(text, /\best[aá] dise[ñn]ad[oa] para uso por operario a pie\b/giu) &&
      !/\b(?:(?:operario|operador|conductor) (?:montado|sentado|a bordo)|plataforma (?:abatible|opcional)|no (?:esta )?disenad[oa])\b/u.test(evidence)) {
      additions["Posición de conducción"] = "Operador a pie";
    }
  }
  if (newOffer && families[0] === null && original.brand && original.model &&
    /^volteador\b/iu.test(original.title ?? "") && /^volteador\b/iu.test(recovered.title ?? "") &&
    containsEditorialBrandModel(original.title ?? "", original.brand, original.model) &&
    containsEditorialBrandModel(short, original.brand, original.model)) {
    const title = fold(original.title ?? "");
    const evidence = fold(`${short} ${text}`);
    if (/^volteador de bobinas\b/u.test(title) && absent(/liberacion.*bobina|bloqueo.*agarre|seguridad.*agarre/u) &&
      singleClaim(/\blos brazos de agarre que sujetan la bobina no se pueden abrir por equivocaci[oó]n y [eé]stas s[oó]lo pueden liberarse cuando se sit[uú]an sobre el suelo o un pal[eé](?![\p{L}\p{N}])/giu, /\bliberarse\b/giu) &&
      !/\b(?:liberacion opcional|liberacion en altura|liberacion sin restricciones)\b/u.test(evidence)) {
      additions["Condición de liberación de bobina"] = "Solo sobre el suelo o un palé";
    }
    if (/^volteador de bidones\b/u.test(title) && absent(/ajuste.*agarre|agarre.*ajust|herramientas.*agarre/u) &&
      singleClaim(/\b(?:estos|los) agarres se adaptan al tama[ñn]o de los bidones sin necesidad de herramientas\b/giu, /\bsin necesidad de herramientas\b/giu) &&
      !/\b(?:ajuste opcional|requiere herramientas|necesita herramientas)\b/u.test(evidence)) {
      additions["Ajuste de agarres"] = "Sin herramientas";
    }
    if (absent(/pantalla|interfaz.*control|panel.*tactil/u) &&
      singleClaim(/\b(?:incluyen una pantalla de gran tama[ñn]o, t[aá]ctil|presenta toda la informaci[oó]n relevante en una pantalla de gran tama[ñn]o, t[aá]ctil)\b/giu, /\bpantalla\b/giu) &&
      !/\b(?:pantalla opcional|sin pantalla|pantalla no tactil|pantalla alternativa)\b/u.test(evidence)) {
      additions["Interfaz de control"] = "Pantalla táctil";
    }
    if ((additions["Interfaz de control"] === "Pantalla táctil" || !absent(/pantalla|interfaz.*control/u)) &&
      absent(/programacion.*(?:parada|giro|volteo)|paradas.*program|control.*program/u) &&
      singleClaim(/\bgracias a ella se puede programar varias paradas, [aá]ngulo de giro, velocidad y volteo\b/giu, /\bprogramar\b/giu) &&
      !/\b(?:programacion opcional|sin programacion|programacion no disponible|no se puede programar)\b/u.test(evidence)) {
      additions["Programación de volteo"] = "Paradas, ángulo de giro y velocidad";
    }
    if (/^volteador de bidones\b/u.test(title) && absent(/bloqueo.*agarre|cierre.*(?:agarre|superior)|seguridad.*agarre/u) &&
      singleClaim(/\blos agarres son extremadamente seguros, con una placa de bloqueo y cierre superior\b/giu, /\bplaca de bloqueo\b/giu) &&
      !/\b(?:bloqueo opcional|cierre opcional|sin bloqueo|sin cierre)\b/u.test(evidence)) {
      additions["Seguridad de agarres"] = "Placa de bloqueo y cierre superior";
    }
    const heightLock = /\bla funci[oó]n de inclinaci[oó]n se desactiva cuando el centro de rotaci[oó]n se encuentra a una altura del suelo superior a (\d{2,4}) mm o inferior a (\d{2,4}) mm\b/giu;
    const limits = [...text.matchAll(heightLock)][0];
    if (limits?.[1] && limits[2] && Number(limits[2]) > 0 && Number(limits[1]) > Number(limits[2]) &&
      absent(/bloqueo.*inclinacion|altura.*centro de rotacion|limite.*inclinacion/u) &&
      singleClaim(heightLock, /\bcentro de rotaci[oó]n\b/giu) &&
      !/\b(?:bloqueo opcional|inclinacion sin restricciones|bloqueo desactivado)\b/u.test(evidence)) {
      additions["Bloqueo de inclinación por altura del centro de rotación"] = `Por debajo de ${limits[2]} mm o por encima de ${limits[1]} mm`;
    }
  }
  if (newOffer && families[0] === "apilador" && absent(/tablero|portahorquillas|portaimplementos|eje pasador/u) &&
    singleClaim(attachmentCarriage, /\b(?:tablero|portahorquillas|portaimplementos)\b/giu)) {
    additions["Tipo de tablero"] = "Eje pasador";
  }
  if (newOffer && families[0] === "transpaleta") {
    const tilt = /\b(?:la inclinaci[oó]n de hasta|las horquillas se pueden inclinar)\s+(\d{1,3})\s*[º°]/giu;
    const angle = [...text.matchAll(tilt)][0]?.[1];
    if (angle && Number(angle) > 0 && Number(angle) <= 180 && /\binclinable\b/iu.test(original.title ?? "") &&
      absent(/^(?:inclinacion|angulo de inclinacion)(?:$| |\()|angulo.*inclinacion|inclinacion.*(?:maxima|horquilla)|volteo/u) &&
      hasUnconditionalEditorialClaim(text, tilt) &&
      [...`${short} ${text}`.matchAll(/\b(\d+(?:[,.]\d+)?)\s*[º°]/gu)].every((match) => match[1] === angle)) {
      additions["Ángulo máximo de inclinación"] = `${angle}°`;
    }
    if (absent(/tipo.*bateria|tecnologia.*bateria|quimica.*bateria|^bateria$|^baterias$/u) &&
      /\bde litio\b/iu.test(original.title ?? "") &&
      hasUnconditionalEditorialClaim(text, /\blas bater[ií]as de litio tienen\b/giu) &&
      !/\b(?:plomo|gel|agm|opci[oó]n|opcional)\b/iu.test(`${short} ${text}`)) {
      additions["Tipo de batería"] = "Litio";
    }
    const chargeClaim = /\bla bater[ií]a puede sustituirse[^.!?;]{0,80}y se carga en tan solo (\d+(?:[,.]\d+)?) horas\b/giu;
    const hours = [...text.matchAll(chargeClaim)][0]?.[1];
    if (hours && Number(hours.replace(",", ".")) > 0 && absent(/tiempo.*carga|duracion.*carga/u) &&
      singleClaim(chargeClaim, /\b(?:se carga en|tiempo de carga|duraci[oó]n de carga)\b/giu)) {
      additions["Tiempo de carga anunciado"] = `${hours} h`;
    }
    if (absent(/(?:material|construccion).*(?:ejes|anclaje)|(?:ejes|anclaje).*(?:material|acero)|^ejes$|^anclaje$/u) &&
      singleClaim(/\bla transpaleta tiene el tim[oó]n, la bomba de pistones, los ejes y el anclaje inoxidables\b/giu, /\bejes\b/giu) &&
      [...text.matchAll(/\banclaje\b/giu)].length === 1 && !/\banclaje\b/iu.test(short)) {
      additions["Material de ejes y anclaje"] = "Acero inoxidable";
    }

    if (absent(/protecci[oó]n.*(?:pie|pies)|protectores?.*pie/u) && singleClaim(footProtection, /\b(?:protectores? (?:para|de) (?:los )?pies|protecci[oó]n de pies)\b/giu)) additions["Protección de pies"] = "Protectores para el operario";
    const matches = [...text.matchAll(batteryRating)];
    const first = matches[0];
    if (first?.[1] && first[2] && Number(first[1]) > 0 && Number(first[2]) > 0 &&
      singleClaim(batteryRating, /\b(?:bater[ií]as?|voltaje|tensi[oó]n)\b/giu) &&
      !/\b(?:manual|di[eé]sel|gasolina|glp)\b/iu.test(original.title ?? "") &&
      absent(/bateria|voltaje|tension|\(v\)|\(ah\)/u)) {
      additions["Tensión nominal de batería"] = `${first[1]} V`;
      additions["Capacidad de batería (20 h)"] = `${first[2]} Ah`;
    }
  }
  if (!Object.keys(additions).length) return specs;
  const result = { ...specs, ...additions };
  observe?.(specs, result, "src/preparation/technical/handling-family-specifications.ts", "longDescription");
  return result;
};
