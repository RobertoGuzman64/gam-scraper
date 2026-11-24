import type { ProductRecord } from "../../contracts/catalog.js";
import { editorialHasImplausibleWeight } from "../editorial/core/editorial-facts.js";
import { gomarizSemanticQualityIssues } from "../gomariz/source-quality.js";
import { mercaelevaSemanticQualityIssues } from "../mercaeleva/source-quality.js";

export const sourceSemanticQualityIssues = (record: ProductRecord): readonly string[] => [
  ...(record.providerId === "gomariz" ? gomarizSemanticQualityIssues(record) :
    record.providerId === "mercaeleva" ? mercaelevaSemanticQualityIssues(record) : []),
  ...(editorialHasImplausibleWeight(record) ?
    ["Peso técnicamente inverosímil para la familia del equipo: requiere verificación documental"] : [])
];
