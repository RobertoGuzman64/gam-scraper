import { documentedPlatformUnitDetails } from "../../technical/mapping/documented-platform-unit-details.js";
import type { ProductRecord } from "../../../../contracts/catalog.js";
import { verifiedPlatformModelOperatingData } from "../../technical/evidence/verified-platform-model-operating-data.js";
import { resolveMercaelevaGeneralDescription } from "./general-description.js";

export const resolveMercaelevaDocumentedModelOperatingGeneral = (record: ProductRecord): string | null => {
  if (record.providerId !== "mercaeleva" || record.categoryKey !== "venta") return null;
  const documentation = verifiedPlatformModelOperatingData.find((model) =>
    record.brand === model.brand && record.model === model.model && record.condition === model.condition);
  if (!documentation || !resolveMercaelevaGeneralDescription(record)) return null;

  const technical = record.specs;
  if (!technical || technical["Estado"] !== (documentation.condition === "Nuevo" ? "Nuevo" : "Usado") ||
    (documentation.condition === "Nuevo" ? technical["Condición general"] !== undefined : technical["Condición general"] !== "Bueno") ||
    technical["Marca"] !== documentation.brand || technical["Modelo"] !== documentation.model ||
    technical["Título adicional"] !== documentation.title || technical["Altura de trabajo"] !== documentation.workHeight ||
    technical["Tipo de motor"] !== documentation.motor || !record.year || !/^(?:19|20)\d{2}$/.test(record.year) ||
    technical["Año de fabricación"] !== record.year) return null;

  const verifiedUnit = documentedPlatformUnitDetails(record, technical);
  if (!verifiedUnit) return null;
  const { publishedHours, article } = verifiedUnit;

  const platform = documentation.kind === "articulated" ? "articulada" :
    documentation.kind === "telescopic" ? "telescópica" : "de tijera";
  const use = documentation.kind === "articulated"
    ? "acceder a puntos elevados salvando obstáculos y colocar la cesta para tareas de montaje, revisión o mantenimiento"
    : documentation.kind === "telescopic"
      ? "alcanzar instalaciones elevadas a distancia mediante un brazo extensible, en trabajos de mantenimiento o construcción"
      : documentation.motor === "Diesel"
        ? "disponer de una superficie de trabajo elevada en operaciones de montaje o construcción sobre terreno compatible"
        : "elevar operarios y herramientas en vertical para instalaciones y mantenimiento sobre una superficie de apoyo adecuada";
  const status = documentation.condition === "Nuevo" ? "nueva" : "usada";
  const technicalReference = documentation.workHeight === documentation.manufacturerWorkHeight
    ? `El anuncio y la ficha de modelo indican ${documentation.workHeight} de altura de trabajo.`
    : `Mercaeleva anuncia ${documentation.workHeight} de altura de trabajo y la documentación del modelo indica ${documentation.manufacturerWorkHeight} como referencia técnica.`;
  const condition = documentation.condition === "Nuevo"
    ? ""
    : " La calificación de condición general buena procede del vendedor, no de una inspección independiente.";

  return `La plataforma ${platform} ${documentation.motor === "Diesel" ? "diésel" : "eléctrica"} ${documentation.brand} ${documentation.model} permite ${use}. ` +
    `Mercaeleva anuncia esta unidad como ${status}, fabricada en ${record.year}${publishedHours ? `, con ${publishedHours} declaradas` : ""}. ` +
    `${technicalReference} Como referencia, la documentación técnica recoge ${documentation.platformHeight} de altura de plataforma, ` +
    `${documentation.capacity} de capacidad nominal y ${documentation.distinctive}. ` +
    `Esas prestaciones corresponden al modelo o versión documentada y deben contrastarse con la placa y configuración concreta de la máquina.${condition} ` +
    `Referencia del vendedor: ${article}.`;
};
