import { buildProductIdentity } from "../../catalog/identity.js";
import type { PanelProviderId } from "../evidence/types.js";

export const productIdentity = (providerId: PanelProviderId, reference: string | null, url: string): string =>
  buildProductIdentity({ providerId, reference, serialNumber: null, url }).key;
