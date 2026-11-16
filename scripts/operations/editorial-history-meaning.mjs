const normalize = (value) => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/gu, '').toLowerCase();

const hoursIn = (value) => [...value.matchAll(/\b(\d{1,3}(?:[.,]\d{3})+|\d+)\s*horas?\b/gu)]
  .map((match) => Number(match[1].replace(/[.,]/gu, '')));

const modelClaims = [
  { name: 'plumin_del_texto_historico', pattern: /\bplumin\b/u },
  { name: 'ausencia_voladizo_trasero_de_modelo', pattern: /(?:evita|sin) (?:el )?voladizo trasero/u }
];

const probes = [
  {
    name: 'ano_de_unidad',
    detect: (source, record) => Boolean(record.year && /^(?:19|20)\d{2}$/u.test(record.year) &&
      source.includes(record.year) && /\b(?:ano|fabricaci[oó]n|fabricad[ao])\b/u.test(source)),
    verify: (_source, published, record) => published.includes(record.year) &&
      /\b(?:ano|fabricacion|fabricad[ao])\b/u.test(published),
    severity: 'bloqueante'
  },
  {
    name: 'horas_de_unidad',
    detect: (source, record) => {
      const raw = record.horometer?.trim();
      if (!raw || !/^\d+(?:[. ]\d{3})*\s*(?:h|horas?)?$/iu.test(raw)) return false;
      const expected = Number(raw.replace(/(?:\s*(?:h|horas?))$/iu, '').replace(/[. ]/gu, ''));
      return hoursIn(source).includes(expected);
    },
    verify: (_source, published, record) => {
      const expected = Number(record.horometer.trim().replace(/(?:\s*(?:h|horas?))$/iu, '').replace(/[. ]/gu, ''));
      return hoursIn(published).includes(expected);
    },
    severity: 'bloqueante'
  },
  {
    name: 'motorizacion_no_individualizada',
    detect: (source) => /(?:motorizacion individual no consta|motor no esta individualizado|tipo de motor no aparece individualizado|no consta motorizacion individual)/u.test(source),
    verify: (_source, _published, record, prepared, facts) =>
      facts?.energy === null && !/\b(?:diesel|electrica|electrico|gasolina|glp)\b/u.test(normalize(prepared.product.title)) &&
      !['Motor', 'Tipo motor', 'Tipo de motor', 'Motorización'].some((key) =>
        typeof record.specs?.[key] === 'string' && record.specs[key].trim()),
    severity: 'bloqueante'
  },
  {
    name: 'certificacion_ce_no_verificada',
    detect: (source) => /certificacion ce/u.test(source),
    verify: (_source, published, record) =>
      /certificacion ce/u.test(published) && /no se ha verificado documentalmente/u.test(published) &&
      /^(?:yes|si|sí)$/iu.test(String(record.specs?.['Certificación CE'] ?? '')),
    severity: 'bloqueante'
  },
  {
    name: 'horas_sin_horometro',
    detect: (source) => /cero horas[^.]*horometro/u.test(source),
    verify: (_source, published, record) => /0 horas/u.test(published) &&
      /sin una lectura de horometro estructurada/u.test(published) && !record.horometer,
    severity: 'bloqueante'
  },
  {
    name: 'pintura_no_equivale_a_revision',
    detect: (source) => /\bpintad[ao]\b/u.test(source),
    verify: (_source, published) => /pintad[ao]/u.test(published) && /no acredita una revision mecanica/u.test(published),
    severity: 'bloqueante'
  },
  {
    name: 'variante_no_acreditada',
    detect: (source) => /el texto de origen identifica la variante ([^.]+)/u.test(source),
    verify: (source, published) => {
      const variant = /el texto de origen identifica la variante ([^.]+)/u.exec(source)?.[1]?.trim();
      return Boolean(variant && published.includes(variant) && /no acredita por si sola/u.test(published));
    },
    severity: 'bloqueante'
  },
  {
    name: 'bateria_opcional_no_atribuida',
    detect: (source) => /no se atribuye a la unidad una bateria opcional/u.test(source),
    verify: (_source, published) => !/\b(?:incluye|incorpora|equipa|equipada con|con) (?:una? )?bateria opcional\b/u.test(published),
    severity: 'bloqueante'
  },

];

export const inspectArchivedFallbackMeaning = (archived, published, record, prepared, facts, modelReference) => {
  const source = normalize(archived);
  const current = normalize(published);
  const unitSignals = probes.filter((probe) => probe.detect(source, record)).map(({ name, verify, severity }) => ({
    name, severity, reproduced: Boolean(verify(source, current, record, prepared, facts))
  }));
  const trustedModel = normalize(modelReference);
  const modelSignals = modelClaims.filter(({ pattern }) => pattern.test(source)).map(({ name, pattern }) => {
    const hasModelEvidence = pattern.test(trustedModel);
    const appearsInPublished = pattern.test(current);
    return { name, severity: 'pendiente_fuente_modelo', reproduced: hasModelEvidence && appearsInPublished,
      evidence: hasModelEvidence ? 'referencia_tecnica_compartida' : 'solo_texto_historico',
      publicationWithoutEvidence: appearsInPublished && !hasModelEvidence };
  });
  const signals = [...unitSignals, ...modelSignals];
  return {
    signals,
    reproduced: signals.filter((signal) => signal.reproduced).length,
    unreproduced: signals.filter((signal) => !signal.reproduced).length,
    blocking: signals.filter((signal) => signal.severity === 'bloqueante' && !signal.reproduced).length,
    supportedModelClaims: modelSignals.filter((signal) => signal.evidence === 'referencia_tecnica_compartida').length,
    unsupportedModelClaims: modelSignals.filter((signal) => signal.evidence === 'solo_texto_historico').length,
    unverifiedModelPublications: modelSignals.filter((signal) => signal.publicationWithoutEvidence).length
  };
};
