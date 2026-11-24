import type { ProductRecord } from "../../contracts/catalog.js";
import type { ClassificationProvider } from "./classification-provider-types.js";
import { gamClassificationProvider } from "../gam/classification/provider.js";
import { gomarizClassificationProvider } from "../gomariz/classification/provider.js";
import { mercaelevaClassificationProvider } from "../mercaeleva/classification/provider.js";
import { manainClassificationProvider } from "../manain/provider.js";

const providers: ReadonlyMap<string, ClassificationProvider> = new Map([
  ["gam", gamClassificationProvider],
  ["gomariz", gomarizClassificationProvider],
  ["mercaeleva", mercaelevaClassificationProvider],
  ["manain", manainClassificationProvider]
]);

export const classificationProvider = (record: ProductRecord): ClassificationProvider | null =>
  providers.get(record.providerId) ?? null;
