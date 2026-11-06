import { parseSeedScalar } from "./scalar.js";

export const parseUrlSpecScalar = (v: unknown): string | number | boolean => parseSeedScalar(v);
