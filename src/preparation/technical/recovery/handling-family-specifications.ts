import type { ProductRecord, SpecsMap } from "../../../contracts/catalog.js";
import { fold } from "../../classification/category-utils.js";
import { hasUnconditionalEditorialClaim } from "../../editorial/claims/editorial-claim-evidence.js";
import { resolvedEditorialUnitFamilies } from "../../editorial/identity/editorial-unit-provenance.js";
import { resolveEditorialSource } from "../../editorial/core/editorial-source.js";
import { containsEditorialSourceSlugModel } from "../../editorial/source/editorial-source-url.js";
import type { TechnicalRecoveryObservation } from "../../provenance/technical-recovery-observation.js";
import { containsEditorialBrandModel } from "../../editorial/identity/editorial-identity-match.js";
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
  const additions: Record<string, string> = {};
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
  if (newOffer && original.brand && original.model &&
    containsEditorialBrandModel(original.title ?? "", original.brand, original.model) &&
    containsEditorialBrandModel(text, original.brand, original.model)) {
    const evidence = fold(`${original.title ?? ""} ${short} ${text}`);
    const technologyAbsent = absent(/tecnologia.*motor|tipo.*motor.*traccion|corriente.*(?:motor|traccion)|motor.*(?:ca|ac|cc|dc)|controlador de traccion/u);
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
