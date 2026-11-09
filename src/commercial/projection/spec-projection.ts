import type { SpecsMap } from "../../contracts/catalog.js";
import { inspectTechnicalSpecifications } from "../validation/technical-specifications.js";

export const projectPresentableSpecifications = (spec: SpecsMap): SpecsMap => {
  const invalid = new Set(inspectTechnicalSpecifications(spec).map(({ key }) => key));
  return Object.fromEntries(Object.entries(spec).filter(([key]) => !invalid.has(key)));
};

