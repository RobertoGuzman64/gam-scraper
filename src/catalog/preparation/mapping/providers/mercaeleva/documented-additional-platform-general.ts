import { documentedPlatformUnitDetails } from "./documented-platform-unit-details.js";
import type { ProductRecord } from "../../../../../contracts/catalog.js";
import { verifiedAdditionalPlatformModelDocumentation } from "../../../evidence/providers/mercaeleva/additional-platform-model-documentation.js";
import { resolveMercaelevaGeneralDescription } from "./general-description.js";

export const resolveMercaelevaDocumentedAdditionalPlatformGeneral = (record: ProductRecord): string | null => {
  if (record.providerId !== "mercaeleva" || record.condition !== "Segunda mano") return null;
  const documentation = verifiedAdditionalPlatformModelDocumentation.find((model) =>
    record.brand === model.brand && record.model === model.model);
  if (!documentation) return null;

  const technical = record.specs;
  if (!technical || technical["Estado"] !== "Usado" || technical["Condición general"] !== "Bueno" ||
    technical["Título adicional"] !== documentation.title ||
    technical["Altura de trabajo"] !== documentation.workHeight ||
    technical["Tipo de motor"] !== (documentation.kind === "scissor-electric" ? "Eléctrico" : "Diesel") ||
    !record.year || !/^(?:19|20)\d{2}$/.test(record.year) ||
    technical["Año de fabricación"] !== record.year ||
    !resolveMercaelevaGeneralDescription(record)) return null;

  const verifiedUnit = documentedPlatformUnitDetails(record, technical);
  if (!verifiedUnit) return null;
  const { publishedHours, article } = verifiedUnit;

  const family = documentation.kind === "articulated" ? "articulada diésel" :
    documentation.kind === "scissor-diesel" ? "de tijera diésel" : "de tijera eléctrica";
  const use = documentation.kind === "articulated"
    ? "combinar altura y alcance lateral para acceder a instalaciones elevadas y trabajar sobre obstáculos"
    : documentation.kind === "scissor-diesel"
      ? "elevar personal y material en trabajos de montaje y mantenimiento en superficies de obra"
      : "realizar operaciones de instalación y mantenimiento en altura donde importa la maniobrabilidad";
  const unit = `Mercaeleva anuncia esta unidad de ${record.year}${publishedHours ? `, con ${publishedHours} consignadas` : ""}, y califica su condición general como buena.`;
  const rounded = documentation.manufacturerWorkHeight === documentation.workHeight
    ? `La altura de trabajo anunciada es de ${documentation.workHeight}.`
    : `El anuncio redondea la altura de trabajo a ${documentation.workHeight}; la ficha técnica de referencia indica ${documentation.manufacturerWorkHeight}.`;
  const technicalDescription = documentation.kind === "articulated"
    ? `La documentación del modelo distingue ${documentation.platformHeight} de altura de plataforma, ${documentation.horizontalOutreach} de alcance horizontal y ${documentation.nominalCapacity} de capacidad nominal.`
    : documentation.kind === "scissor-diesel"
      ? `La documentación del modelo distingue ${documentation.platformHeight} de altura de plataforma, ${documentation.nominalCapacity} de capacidad nominal y una extensión de plataforma de ${documentation.extension}.`
      : `La ficha técnica histórica distingue ${documentation.platformHeight} de altura de plataforma, ${documentation.nominalCapacity} de capacidad nominal y ${documentation.transportWidth} de anchura de transporte.`;

  return `La plataforma ${family} ${documentation.brand} ${documentation.model} permite ${use}. ${unit} ${rounded} ${technicalDescription} Estas magnitudes son referencias de fabricante y no acreditan la configuración ni las prestaciones de esta unidad sin contrastar su placa y versión. Referencia del vendedor: ${article}.`;
};
