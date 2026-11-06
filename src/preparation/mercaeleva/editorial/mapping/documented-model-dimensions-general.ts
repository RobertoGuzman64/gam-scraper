import { documentedPlatformUnitDetails } from "../../technical/mapping/documented-platform-unit-details.js";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { verifiedPlatformModelDimensions } from "../../technical/evidence/verified-platform-model-dimensions.js";
import { resolveMercaelevaGeneralDescription } from "./general-description.js";

export const resolveMercaelevaDocumentedModelDimensionsGeneral = (record: ProductRecord): string | null => {
  if (record.providerId !== "mercaeleva" || record.condition !== "Segunda mano") return null;
  const documentation = verifiedPlatformModelDimensions.find((model) =>
    record.brand === model.brand && record.model === model.model);
  if (!documentation) return null;

  const technical = record.specs;
  if (!technical || technical["Estado"] !== "Usado" || technical["Condición general"] !== "Bueno" ||
    technical["Título adicional"] !== documentation.title ||
    technical["Altura de trabajo"] !== documentation.workHeight ||
    technical["Tipo de motor"] !== documentation.motor ||
    !record.year || !/^(?:19|20)\d{2}$/.test(record.year) ||
    technical["Año de fabricación"] !== record.year ||
    !resolveMercaelevaGeneralDescription(record)) return null;

  const verifiedUnit = documentedPlatformUnitDetails(record, technical);
  if (!verifiedUnit) return null;
  const { publishedHours, article } = verifiedUnit;

  const family = documentation.kind === "articulated" ? "articulada" : "de tijera";
  const use = documentation.kind === "articulated"
    ? "posicionar la cesta en zonas elevadas con obstáculos, combinando elevación y desplazamiento lateral"
    : documentation.motor === "Diesel"
      ? "elevar operarios y material en trabajos de montaje y mantenimiento sobre superficies de obra"
      : "elevar personal y herramientas para instalaciones, revisiones y mantenimiento en altura";
  const dimension = documentation.kind === "articulated"
    ? `un alcance horizontal de ${documentation.additionalDimension}`
    : `una extensión de plataforma de ${documentation.additionalDimension}`;
  const heights = documentation.workHeight === documentation.manufacturerWorkHeight
    ? `Los ${documentation.workHeight} anunciados corresponden a altura de trabajo, no a la altura de la plataforma.`
    : `El vendedor indica ${documentation.workHeight} de altura de trabajo; la documentación del modelo da ${documentation.manufacturerWorkHeight} como valor de referencia.`;

  return `La plataforma ${family} ${documentation.motor === "Diesel" ? "diésel" : "eléctrica"} ${documentation.brand} ${documentation.model} está concebida para ${use}. ` +
    `Mercaeleva ofrece esta unidad de ${record.year}${publishedHours ? `, con ${publishedHours} declaradas` : ""} y condición general calificada como buena por el vendedor. ` +
    `${heights} La documentación técnica del modelo distingue ${documentation.platformHeight} de altura de plataforma, ` +
    `${documentation.nominalCapacity} de capacidad nominal y ${dimension}, datos útiles para valorar el espacio y la carga de trabajo. ` +
    `Son cifras del modelo de referencia: la configuración, prestaciones y estado de esta unidad deben comprobarse individualmente. ` +
    `Referencia del vendedor: ${article}.`;
};
