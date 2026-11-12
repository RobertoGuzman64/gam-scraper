export const platformMeasurements = (
  height: string, lateralReach: string | null, loadCapacity: string | null
): string => `altura de trabajo de ${height} m` +
  (lateralReach === null ? "" : `, alcance lateral de ${lateralReach} m`) +
  (loadCapacity === null ? "" : ` y capacidad de ${loadCapacity} kg`);
