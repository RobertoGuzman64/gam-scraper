import type { ProductRecord } from "../../../../contracts/catalog.js";
import { verifiedPlatformModelDocumentation } from "../../technical/evidence/platform-model-documentation.js";
import { verifiedArticulatedPlatformModelDocumentation } from "../../technical/evidence/articulated-platform-model-documentation.js";
import { resolveMercaelevaGeneralDescription } from "./general-description.js";

const documentedArticulatedGeneral = (record: ProductRecord): string | null => {
  if (record.providerId !== "mercaeleva" || record.condition !== "Segunda mano") return null;
  const documentation = verifiedArticulatedPlatformModelDocumentation.find((model) =>
    record.brand === model.brand && record.model === model.model);
  const technical = record.specs;
  if (!documentation) return null;
  if (!technical ||
    technical["Estado"] !== "Usado" || technical["Condición general"] !== "Bueno" ||
    technical["Título adicional"] !== `PLATAFORMA ARTICULADA ELECTRICA ${documentation.workHeight.replace(" m", " MT")}` ||
    technical["Tipo de motor"] !== "Eléctrico" || technical["Altura de trabajo"] !== documentation.workHeight ||
    !record.year || technical["Año de fabricación"] !== record.year ||
    !/^(?:19|20)\d{2}$/.test(record.year) ||
    !resolveMercaelevaGeneralDescription(record)) return null;

  const hours = technical["Horas laborales"];
  const publishedHours = typeof hours === "string" && /^(?:0|[1-9]\d*) h$/.test(hours) ? hours : null;
  if ((hours !== undefined && !publishedHours) ||
    record.horometer !== (publishedHours ? publishedHours.slice(0, -2) : null)) return null;
  const article = technical["Artículo No."];
  if (typeof article !== "string" || !/^[\p{L}\d/-]+$/u.test(article)) return null;

  const hoursSentence = publishedHours ? `, con ${publishedHours} registradas según el vendedor` : "";
  const manufacturerHeight = documentation.manufacturerWorkHeight === documentation.workHeight
    ? `La ficha del fabricante distingue los ${documentation.workHeight} de altura de trabajo de los ${documentation.platformHeight} de altura de plataforma.`
    : `El vendedor redondea la altura de trabajo a ${documentation.workHeight}; la ficha de referencia del fabricante indica ${documentation.manufacturerWorkHeight} de trabajo y ${documentation.platformHeight} de altura de plataforma.`;

  return `La plataforma articulada eléctrica ${documentation.brand} ${documentation.model} permite acceder a puntos elevados y alcanzar lateralmente zonas situadas detrás de obstáculos en trabajos de instalación, inspección y mantenimiento. La unidad anunciada es de ${record.year}${hoursSentence}; el vendedor califica su condición general como buena. ${manufacturerHeight} La documentación técnica del modelo también recoge un alcance horizontal de ${documentation.horizontalOutreach} y una capacidad nominal de plataforma de ${documentation.nominalCapacity}. Estos valores son referencias de fabricante y no acreditan por sí solos las prestaciones, equipamiento o estado de esta unidad concreta. Referencia del vendedor: ${article}.`;
};

export const resolveMercaelevaDocumentedPlatformGeneral = (record: ProductRecord): string | null => {
  if (record.providerId !== "mercaeleva" || record.condition !== "Segunda mano") return null;
  const technical = record.specs;
  const documentation = verifiedPlatformModelDocumentation.find((model) =>
    record.brand === model.brand && record.model === model.model);
  if (!documentation) return documentedArticulatedGeneral(record);
  if (!technical ||
    technical["Estado"] !== "Usado" || technical["Condición general"] !== "Bueno" ||
    technical["Título adicional"] !== `PLATAFORMA TIJERA ELECTRICA ${documentation.workHeight.replace(" m", " MT")}` ||
    technical["Tipo de motor"] !== "Eléctrico" ||
    technical["Altura de trabajo"] !== documentation.workHeight ||
    !record.year || technical["Año de fabricación"] !== record.year ||
    !/^(?:19|20)\d{2}$/.test(record.year)) return null;

  const hours = technical["Horas laborales"];
  const publishedHours = typeof hours === "string" && /^(?:0|[1-9]\d*) h$/.test(hours) ? hours : null;
  const article = technical["Artículo No."];
  if (!publishedHours || record.horometer !== publishedHours.slice(0, -2) ||
    typeof article !== "string" || !/^[\p{L}\d/-]+$/u.test(article) ||
    !resolveMercaelevaGeneralDescription(record)) return null;

  const unit = `Se ofrece una unidad de segunda mano de ${record.year}, con ${publishedHours} registradas en el anuncio y condición general calificada como buena por el vendedor.`;
  const documented = documentation.brand === "JLG"
    ? `La documentación de JLG para este modelo especifica ${documentation.platformHeight} de altura de plataforma y ${documentation.nominalCapacity} de capacidad nominal; el anuncio redondea a ${documentation.workHeight} la altura de trabajo, que no debe confundirse con la de plataforma.`
    : documentation.model === "COMPACT-10N"
      ? `La documentación técnica de la Compact 10N distingue ${documentation.platformHeight} de altura de plataforma, ${documentation.nominalCapacity} de capacidad interior y 0,81 m de anchura. Esas magnitudes ayudan a valorar la carga de trabajo y el acceso a pasos estrechos.`
      : `La documentación histórica de la Compact 12 distingue ${documentation.platformHeight} de altura de plataforma y ${documentation.nominalCapacity} de capacidad nominal. Los ${documentation.workHeight} anunciados corresponden a la altura de trabajo y no a la elevación de la plataforma.`;

  return `La plataforma de tijera eléctrica ${documentation.brand} ${documentation.model} permite acceder verticalmente a puestos de instalación, revisión y mantenimiento. ${unit} ${documented} Las cifras de fabricante corresponden al modelo de referencia y deben contrastarse con la placa y configuración de esta unidad antes de su utilización. Referencia del vendedor: ${article}.`;
};
