const machineryFamilies: Readonly<Record<string, "feminine" | "masculine">> = {
  "Plataforma de tijera": "feminine",
  "Plataforma articulada": "feminine",
  "Plataforma telescópica": "feminine",
  "Manipulador telescópico": "masculine",
  "Carretilla industrial": "feminine",
  "Carretilla retráctil": "feminine",
  "Rodillo compactador": "masculine",
  "Dúmper": "masculine"
};

export const presentCommercialMotorization = (
  title: string | null, published: { readonly spec: Readonly<Record<string, unknown>> }
): string | null => {
  if (!title) return title;
  const motor = published.spec["Motor"];
  if (motor !== "Eléctrico" && motor !== "Diésel") return title;
  if (/\b(?:el[eé]ctric[ao]s?|di[eé]sel|gasolina|h[ií]brid[ao]s?)\b/iu.test(title)) return title;
  const family = Object.entries(machineryFamilies).find(([prefix]) =>
    title.toLocaleLowerCase("es").startsWith(`${prefix.toLocaleLowerCase("es")} `));
  if (!family) return title;
  const [prefix, gender] = family;
  const adjective = motor === "Diésel" ? "diésel" : gender === "feminine" ? "eléctrica" : "eléctrico";
  return `${title.slice(0, prefix.length)} ${adjective}${title.slice(prefix.length)}`;
};
