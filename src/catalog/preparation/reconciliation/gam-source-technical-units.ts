import type { ProductRecord, SpecsMap } from "../../../contracts/catalog.js";

const normalizedPlatformHeight = (value: string): string | null => {
  const match = /^([\d.,/\s-]+?)\s*m{2,4}\s+metros$/iu.exec(value);
  if (!match?.[1]) return null;
  const measurements = match[1].split("/").map((part) => part.trim());
  if (measurements.length === 0 || measurements.length > 3 ||
    measurements.some((part) => part !== "-" && !/^\d{1,5}(?:[.,]\d{1,2})?$/u.test(part)) ||
    measurements.every((part) => part === "-") ||
    (measurements.length === 1 && /^\d[.,]\d{1,2}$/u.test(measurements[0] ?? ""))) return null;
  return `${measurements.join(" / ")} mm`;
};

const isUnverifiedYalePlatformHeight = (record: ProductRecord, value: string): boolean =>
  record.brand?.toUpperCase() === "YALE" && record.model === "MS20XD" &&
  record.specs?.Modelo === "MS20XD" && value === "4.8mm metros" &&
  record.url.startsWith("https://online.gamrentals.com/es/apiladores-yale/1714-") &&
  record.title?.includes("Yale MS20XD") === true;

const isVerifiedYaleOrderPickerPlatform = (record: ProductRecord, value: string): boolean => {
  if (record.condition !== "Nuevo" || record.brand?.toUpperCase() !== "YALE" ||
    !record.model || !["MO20", "MO20P", "MO25"].includes(record.model) ||
    record.specs?.Modelo !== record.model || value !== "-/980 metros" ||
    !record.title?.toUpperCase().includes(`YALE ${record.model}`)) return false;
  try {
    const url = new URL(record.url);
    const parts = url.pathname.split("/").filter(Boolean);
    return url.hostname === "online.gamrentals.com" && parts[0] === "es" &&
      (parts[1] === "recogepedidos-yale" || parts[1] === "yale");
  } catch {
    return false;
  }
};

const mislabeledTrailerCaddyVoltage = (record: ProductRecord, specs: SpecsMap): "Potencia Motor (CV)" | "Potencia Motor (KW)" | null => {
  if (record.condition !== "Nuevo" || record.categoryKey !== "marcas-nuevas" ||
    !record.title?.startsWith("Arrastrador a Pie TrailerCaddy ") ||
    !record.model || specs.Modelo !== record.model) return null;
  let path: string[];
  try {
    const url = new URL(record.url);
    if (url.hostname !== "online.gamrentals.com") return null;
    path = url.pathname.split("/").filter(Boolean);
  } catch { return null; }
  if (path.length !== 3 || path[0] !== "es" || path[1] !== "bts" ||
    !path[2]?.startsWith(`${record.reference}-`)) return null;
  const cases = [
    { model: "15k 48v br", voltage: "48", batteries: /^4 baterías 12v v\/ah$/i, key: "Potencia Motor (CV)" },
    { model: "6k 36v br", voltage: "36", batteries: /^3 x 12 v - 80 a v\/ah$/i, key: "Potencia Motor (KW)" }
  ] as const;
  const matched = cases.find((entry) => record.model?.toLowerCase() === entry.model &&
    record.title?.toLowerCase().includes(entry.model) &&
    specs[entry.key] === entry.voltage && typeof specs.Baterías === "string" &&
    entry.batteries.test(specs.Baterías));
  return matched?.key ?? null;
};

export const reconcileGamSourceTechnicalUnits = (record: ProductRecord): ProductRecord => {
  if (record.providerId !== "gam" || !record.specs) return record;
  const specs: Record<string, SpecsMap[string]> = { ...record.specs };
  let changed = false;
  const mislabeledPower = mislabeledTrailerCaddyVoltage(record, specs);
  if (mislabeledPower !== null) {
    delete specs[mislabeledPower];
    changed = true;
  }

  const platform = specs["Altura Plataforma"];
  if (typeof platform === "string") {
    if (isUnverifiedYalePlatformHeight(record, platform)) {
      delete specs["Altura Plataforma"];
      changed = true;
    } else if (isVerifiedYaleOrderPickerPlatform(record, platform)) {
      specs["Altura Plataforma"] = "- / 980 mm";
      changed = true;
    } else {
      const normalized = normalizedPlatformHeight(platform);
      if (normalized !== null) {
        specs["Altura Plataforma"] = normalized;
        changed = true;
      }
    }
  }

  const reach = specs["Alcance Lateral"];
  if (typeof reach === "string" && /^\d{1,2}(?:[.,]\d{1,2})?\s+m\s+metros$/iu.test(reach)) {
    specs["Alcance Lateral"] = reach.replace(/\s+metros$/iu, "");
    changed = true;
  }

  const battery = specs["Capacidad de la batería"];
  const unverifiedBattery = typeof battery === "string"
    ? /^(\d{2,3})V\s*\/\s*\d{2,4}h\(V\/Ah\)$/iu.exec(battery) : null;
  if (unverifiedBattery?.[1]) {
    const voltage = `${unverifiedBattery[1]} V`;
    const existingVoltage = specs["Voltaje batería (V)"];
    if (existingVoltage === undefined || existingVoltage === voltage) {
      delete specs["Capacidad de la batería"];
      if (existingVoltage === undefined) specs["Voltaje batería (V)"] = voltage;
      changed = true;
    }
  } else if (typeof battery === "string") {
    const duplicatedBatteryUnit = /^(\d{2,3}V\s*\/\s*\d{2,4}Ah\(V\/Ah\))\(V\/Ah\)$/iu.exec(battery);
    if (duplicatedBatteryUnit?.[1]) {
      specs["Capacidad de la batería"] = duplicatedBatteryUnit[1];
      changed = true;
    }
  }

  const width = specs["Ancho promedio"];
  const displacedBattery = typeof width === "string"
    ? /^(\d{2,3})V\s*\/\s*(\d{2,4})-(\d{2,4})Ah\(V\/Ah\)$/iu.exec(width) : null;
  if (displacedBattery?.[1] && displacedBattery[2] && displacedBattery[3]) {
    const voltage = `${displacedBattery[1]} V`;
    const capacity = `${displacedBattery[2]}-${displacedBattery[3]} Ah`;
    const existingVoltage = specs["Voltaje batería (V)"];
    const existingCapacity = specs["Capacidad de la batería (Ah)"];
    if ((existingVoltage === undefined || existingVoltage === voltage) &&
      (existingCapacity === undefined || existingCapacity === capacity)) {
      delete specs["Ancho promedio"];
      specs["Voltaje batería (V)"] = voltage;
      specs["Capacidad de la batería (Ah)"] = capacity;
      changed = true;
    }
  }

  return changed ? { ...record, specs } : record;
};
