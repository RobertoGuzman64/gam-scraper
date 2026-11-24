const nonAssertive = /\b(?:carece\s+de|falta\s+de|sin\s+bater[ií]as?|opci[oó]n|opcional(?:es)?|posibilidad\s+de|versi[oó]n(?:es)?|seg[uú]n\s+(?:la\s+)?versi[oó]n|seg[uú]n\s+(?:el\s+)?modelo|compatible\s+con|bajo\s+pedido|por\s+encargo|a\s+petici[oó]n|previa\s+solicitud|pendiente\s+de\s+confirmar|consultar\s+disponibilidad|no\s+incluid[oa]s?|no\s+disponible|no\s+instalad[oa]s?|se\s+ofrece\s+como\s+opci[oó]n|disponible\s+como\s+opci[oó]n)\b/iu;

const contextualUncertainty = /\b(?:no\s+(?:(?:se|lo|la|los|las)\s+)?(?:incluye|incorpora|monta|tiene|dispone|cuenta|entrega|suministra)|no\s+(?:est[aá](?:n)?|viene(?:n)?|se\s+encuentra(?:n)?)\s+incluid[oa]s?|se\s+(?:ofrece|suministra|instala|equipa)\s+(?:por\s+separado|a\s+petici[oó]n)|(?:puede|pueden|podr[ií]a|podr[ií]an)\s+(?:incorporar|equipar(?:se)?|incluir|disponer|montar|instalar|suministrar)|sin\s+(?:incluir|incorporar|montar|equipar|instalar|suministrar))\b/iu;

const withinClause = (text: string, match: RegExpMatchArray): string => {
  const start = match.index ?? 0;
  const previous = text.slice(Math.max(0, start - 150), start).split(/[.!?;\n]/u).at(-1) ?? "";
  const following = text.slice(start + match[0].length, start + match[0].length + 150)
    .split(/[.!?;\n]/u)[0] ?? "";
  return `${previous} ${match[0]} ${following}`;
};

export const hasUnconditionalEditorialClaim = (text: string, pattern: RegExp): boolean => {
  const matches = [...text.matchAll(pattern)];
  return matches.length > 0 && matches.every((match) => {
    const clause = withinClause(text, match);
    const prefix = text.slice(Math.max(0, (match.index ?? 0) - 70), match.index ?? 0);
    return !/(?:\bsin|\bning[uú]n[ao]s?|\bni)\s*$/iu.test(prefix) &&
      !nonAssertive.test(clause) && !contextualUncertainty.test(clause);
  });
};
