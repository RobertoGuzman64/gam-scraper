import type { ProductRecord } from "../../../../contracts/catalog.js";
import type { EditorialFamily } from "./editorial-families.js";
import { resolveEditorialFacts } from "./editorial-facts.js";
import { hasUnconditionalEditorialClaim } from "./editorial-claim-evidence.js";
import { verifiedEditorialUnitPair } from "./editorial-unit-provenance.js";
import { verifiedEditorialIdentity } from "./editorial-source-contract.js";

type DocumentedApplication = Readonly<{
  families: readonly EditorialFamily[];
  declaration: RegExp;
  mention: RegExp;
  statement: string;
}>;

const applications: readonly DocumentedApplication[] = [
  {
    families: ["tractor-arrastre"],
    declaration: /\balimentaci[oó]n\s+de\s+l[ií]nea\b/giu,
    mention: /\balimentaci[oó]n\s+de\s+l[ií]nea\b/iu,
    statement: "El proveedor describe la alimentación de líneas de producción como aplicación de estos tractores de arrastre; la adecuación de la operación depende de la carga remolcada y del recorrido."
  },
  {
    families: ["apilador", "carretilla-elevadora", "carretilla-retractil"],
    declaration: /\b(?:muelles?\s+(?:de\s+)?(?:carga|log[ií]sticos?)|plataformas?\s+(?:de\s+)?carga)\b/giu,
    mention: /\b(?:muelles?\s+(?:de\s+)?(?:carga|log[ií]sticos?)|plataformas?\s+(?:de\s+)?carga)\b/iu,
    statement: "La fuente cita operaciones en muelles o plataformas de carga como ámbito de utilización; corresponde comprobar la compatibilidad del equipo con las condiciones del acceso."
  },
  {
    families: ["transpaleta", "apilador"],
    declaration: /\b(?:carga\s+y\s+descarga\s+(?:de\s+)?(?:camiones|veh[ií]culos|furgonetas)|cargar\s+y\s+descargar\s+camiones)\b/giu,
    mention: /\b(?:carga\s+y\s+descarga\s+(?:de\s+)?(?:camiones|veh[ií]culos|furgonetas)|cargar\s+y\s+descargar\s+camiones)\b/iu,
    statement: "El anuncio señala la carga y descarga de vehículos entre sus aplicaciones; deben verificarse las dimensiones, el recorrido y la capacidad aplicable."
  },
  {
    families: ["transpaleta", "apilador"],
    declaration: /\b(?:pal[eé]s?\s+(?:con\s+)?(?:laterales\s+abiertos|abiertos\s+y\s+cerrados|cerrados\s+y\s+abiertos))\b/giu,
    mention: /\bpal[eé]s?\s+(?:con\s+)?(?:laterales\s+abiertos|abiertos\s+y\s+cerrados|cerrados\s+y\s+abiertos)\b/iu,
    statement: "El proveedor menciona la manipulación de palés abiertos o con laterales abiertos; la compatibilidad depende de las horquillas y dimensiones de la unidad."
  },
  {
    families: ["apilador", "recogepedidos"],
    declaration: /\b(?:reposici[oó]n\s+(?:de\s+)?(?:stock|existencias|mercanc[ií]as)|labores\s+de\s+reposici[oó]n)\b/giu,
    mention: /\breposici[oó]n\s+(?:de\s+)?(?:stock|existencias|mercanc[ií]as)\b/iu,
    statement: "La descripción de origen incluye la reposición de existencias entre sus usos; es necesario contrastar las alturas de servicio y las condiciones del almacén."
  },
  {
    families: ["recogepedidos", "carretilla-elevadora", "carretilla-retractil", "apilador"],
    declaration: /\b(?:pasillos?\s+(?:muy\s+)?estrechos?|almacenes?\s+(?:de\s+)?gran\s+altura)\b/giu,
    mention: /\b(?:pasillos?\s+(?:muy\s+)?estrechos?|almacenes?\s+(?:de\s+)?gran\s+altura)\b/iu,
    statement: "El proveedor sitúa este tipo de máquina en operaciones de almacenaje con pasillos estrechos o en altura; las maniobras y dimensiones deben verificarse para la configuración concreta."
  },
  {
    families: ["barredora", "fregadora", "maquina-limpieza"],
    declaration: /\bsuelos?\s+duros?\s+y\s+alfombras?\b/giu,
    mention: /\bsuelos?\s+duros?\s+y\s+alfombras?\b/iu,
    statement: "El anuncio menciona suelos duros y alfombras como superficies de limpieza; la elección del cepillo y la idoneidad deben contrastarse con la configuración anunciada."
  },
  {
    families: ["barredora", "fregadora", "maquina-limpieza"],
    declaration: /\b(?:grandes\s+superficies\s+(?:interiores|industriales|comerciales)|[aá]reas\s+industriales\s+y\s+comerciales)\b/giu,
    mention: /\b(?:grandes\s+superficies\s+(?:interiores|industriales|comerciales)|[aá]reas\s+industriales\s+y\s+comerciales)\b/iu,
    statement: "El texto del proveedor presenta la limpieza de superficies industriales o comerciales extensas como ámbito de uso; el rendimiento depende del pavimento y del equipo."
  },
  {
    families: ["apilador", "carretilla-elevadora", "carretilla-retractil"],
    declaration: /\b(?:log[ií]stica\s+y\s+distribuci[oó]n\s+de\s+alimentos?|industria\s+alimentaria)\b/giu,
    mention: /\b(?:distribuci[oó]n\s+de\s+alimentos?|industria\s+alimentaria)\b/iu,
    statement: "La fuente menciona la logística y distribución de alimentos entre los usos de esta clase de máquina; deben comprobarse las exigencias de higiene y la configuración disponible."
  },
  {
    families: ["carretilla-elevadora", "carretilla-retractil"],
    declaration: /\b(?:patios\s+de\s+almacenamiento|industria\s+pesada|trabajos?\s+en\s+exterior)\b/giu,
    mention: /\b(?:patios\s+de\s+almacenamiento|industria\s+pesada|trabajos?\s+en\s+exterior)\b/iu,
    statement: "El proveedor cita operaciones industriales o en patios exteriores como posibles ámbitos de utilización; la elección del equipo depende del terreno y las cargas reales."
  },
  {
    families: ["apilador"],
    declaration: /\b(?:estanter[ií]as?\s+de\s+nivel\s+medio\s+alto|almacenamiento\s+de\s+productos\s+en\s+estanter[ií]as)\b/giu,
    mention: /\b(?:estanter[ií]as?\s+de\s+nivel\s+medio\s+alto|almacenamiento\s+de\s+productos\s+en\s+estanter[ií]as)\b/iu,
    statement: "El fabricante propone el almacenamiento en estanterías de nivel medio como ámbito de trabajo; debe verificarse la altura de elevación y la carga admisible."
  },
  {
    families: ["recogepedidos"],
    declaration: /\b(?:controlador\s+MOSFET|tecnolog[ií]a\s+MOSFET)\b/giu,
    mention: /\b(?:controlador\s+MOSFET|tecnolog[ií]a\s+MOSFET)\b/iu,
    statement: "La descripción del modelo menciona un controlador MOSFET para la gestión de la tracción o hidráulica; corresponde comprobar los controles de la unidad concreta."
  },
  {
    families: ["tractor-arrastre"],
    declaration: /\b(?:aplicaciones\s+industriales\s+exigentes|operaciones\s+industriales\s+exigentes)\b/giu,
    mention: /\b(?:aplicaciones\s+industriales\s+exigentes|operaciones\s+industriales\s+exigentes)\b/iu,
    statement: "La fuente cita aplicaciones industriales exigentes para el arrastre de cargas; las condiciones de tracción y circulación deben comprobarse en el entorno de uso."
  },
  {
    families: ["cargadora"],
    declaration: /\b(?:construcci[oó]n\s+y\s+la\s+agricultura|construcci[oó]n\s+y\s+agricultura)\b/giu,
    mention: /\b(?:construcci[oó]n\s+y\s+(?:la\s+)?agricultura|agricultura\s+y\s+construcci[oó]n)\b/iu,
    statement: "El anuncio menciona trabajos de construcción y agricultura entre las aplicaciones de la cargadora; esto no acredita implementos específicos ni capacidades distintas."
  },
  {
    families: ["grupo-electrogeno"],
    declaration: /\b(?:respaldo\s+de\s+emergencia|eventos\s+al\s+aire\s+libre)\b/giu,
    mention: /\b(?:respaldo\s+de\s+emergencia|eventos\s+al\s+aire\s+libre)\b/iu,
    statement: "El proveedor cita el suministro para respaldo de emergencia o eventos como posibles aplicaciones; la potencia y el régimen de servicio deben dimensionarse para cada instalación."
  },
  {
    families: ["recogepedidos"],
    declaration: /\b(?:centros?\s+de\s+distribuci[oó]n|gesti[oó]n\s+de\s+almacenes)\b/giu,
    mention: /\b(?:centros?\s+de\s+distribuci[oó]n|gesti[oó]n\s+de\s+almacenes)\b/iu,
    statement: "El proveedor incluye centros de distribución y gestión de almacén entre sus ámbitos de trabajo, sujetos a las condiciones de uso de cada instalación."
  }
];

export const resolveSourcedApplications = (
  source: ProductRecord, prepared: ProductRecord, general: string
): string | null => {
  if (!verifiedEditorialIdentity(source) || !verifiedEditorialIdentity(prepared) ||
    !verifiedEditorialUnitPair(source, prepared) ||
    !source.longDescription?.trim()) return null;
  const original = resolveEditorialFacts(source);
  const reconciled = resolveEditorialFacts(prepared);
  if (!original || !reconciled || original.family !== reconciled.family) return null;
  const matches = applications.filter((application) =>
    application.families.includes(original.family) && !application.mention.test(general) &&
    hasUnconditionalEditorialClaim(source.longDescription ?? "", application.declaration)
  );
  return matches.length ? matches.map((application) => application.statement).join(" ") : null;
};
