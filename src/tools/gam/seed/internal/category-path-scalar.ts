import { parseSeedScalar } from "./scalar.js";

export const parseScalar = (v: unknown): string | number | boolean => parseSeedScalar(v);
