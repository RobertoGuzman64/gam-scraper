# Publicaciones técnicas independientes

## AI GUARD

**Protección documental.** No crear, modificar, mover ni eliminar esta guía sin autorización expresa del propietario para esta intervención documental. Cambios de scraping, preparación, auditoría o comercialización no implican permiso documental.

**Regla de alcance.** Una publicación técnica registra un corte verificable con `ready` y `review`; nunca debe modificar ni autorizar la publicación individual acreditada o su exportación comercial. Conservar las huellas, la procedencia y el estado real de la fuente.

## Finalidad y frontera comercial

`publicacion:tecnica` activa un **snapshot técnico independiente** destinado a comparación y mejora del catálogo. Conserva `PreparedProduct`, `status`, `issues`, identidades y huellas; no transforma `review` en `ready` ni constituye una acreditación editorial o comercial. No sustituye `catalogo:publicar`, `acreditar:proveedor`, FINISH ni la campaña global.

- **GAM, Gomariz y Mercaeleva**: entrada desde original canónico completo y preparación offline **compatible con las huellas vigentes**.
- **Manain**: entrada desde `manain-record.json`, CSV parcial y censo contrastados. El corte se identifica como `partial`; no es legítimo declararlo `complete` ni incorporarlo como publicación comercial individual mediante este comando.
- **Exportación comercial**: sigue leyendo las publicaciones individuales acreditadas bajo `publications/`, no `technical/`. El original comercial históricamente acreditado se verifica contra su versión correspondiente; una exportación nueva con identidades ausentes del original vigente debe bloquearse hasta reconciliar las bajas.

**Estado acreditado el 11 de noviembre de 2026, no cifra contractual permanente:** Gomariz mantiene 547 fichas (535 `ready`, 12 `review`) con origen `complete`; Manain, 384 (383 `ready`, 1 `review`) con registro `partial`. Las otras tres publicaciones individuales comerciales permanecen en su circuito propio. Las cifras cambian legítimamente al evolucionar las fuentes.

## Operación: simulación, activación y lectura

La simulación es el comportamiento predeterminado y **no escribe**:

```powershell
npm run publicacion:tecnica -- gomariz --preparacion "storage/prepared/gomariz/<preparation-validada>.json"
npm run publicacion:tecnica -- manain --csv "storage/scraped/manain/scrape-manain-partial-all.csv" --censo "storage/diagnostics/manain/<censo-acreditado>.json"
```

Las rutas entre `<...>` son marcadores explicativos, no archivos que el script genere. No elegir una preparación solo por fecha: contrastar origen, huella de reglas y validación previa.

Tras verificar la simulación, la activación **solo del índice técnico** exige `--activar` en el mismo comando y fuente. Puede comprobarse sin escrituras:

```powershell
npm run publicacion:tecnica -- gomariz --ver
npm run publicacion:tecnica -- gomariz --listar
npm run publicacion:tecnica -- manain --ver
npm run publicacion:tecnica -- manain --listar
npm run publicacion:tecnica -- gomariz --comparar <sha256-de-version-verificada>
npm run estado
```

`--comparar` necesita una huella SHA-256 completa (64 caracteres) de una versión existente; los listados son de versiones verificables, **no** de los directorios por orden de nombre. `--json` ofrece salidas estructuradas; `--ver`, `--listar` y `--comparar` son consultas. El comando acepta las variantes `--preparation`/`--compare` que puede propagar el despachador, pero las formas públicas documentadas son `--preparacion`/`--comparar`.

## Versionado, retención e integridad

```text
catalogs/providers/<proveedor>/technical/
  active.json
  versions/<sha256>/
    snapshot.json
    manifest.json
```

Cada versión se identifica por el SHA-256 del snapshot y exige manifest correspondiente, identidades consistentes y archivos regulares. El índice activo registra la versión actual y, en las activaciones nuevas, `previousSha256`. La implementación de `src/infrastructure/filesystem/catalog/technical-publication.ts` conserva como máximo **la activa y la inmediatamente anterior** al rotar; no deduce cronología de nombres hash. La retirada solo actúa tras validar índices, versiones y rutas; rechaza elementos inesperados, corrupción o enlaces simbólicos. La activación idempotente no crea versiones adicionales.

Los archivos `.active.lock`, `.active-*.tmp` y `versions/.pending-*` son temporales de transacción; no son publicaciones definitivas. Se comprueban y limpian en el ciclo protegido de activación, no mediante un borrado genérico. `.gitignore` evita rastrear esos temporales, **no** el índice activo ni las versiones finales. Las simulaciones no activan versiones ni ejecutan retención destructiva.

No editar manualmente JSON, hashes ni índices para corregir diferencias. Si falla la validación, preservar las publicaciones vigentes y reparar el productor, la procedencia o la transacción responsable.

## Auditoría técnica y revisión editorial

```powershell
npm run huecos -- --tecnicas --detalle
npm run huecos -- --tecnicas --json
```

`--tecnicas` examina los snapshots técnicos activos, **incluidos** los `review` y sus incidencias. Es un modo de consulta exclusivo: no combinarlo con `--finales`, `--comparar`, `--specs`, `--titulos`, `--catalogo` o `--publicacion`. Las señales de longitud, repetición editorial, densidad y semántica son **orientativas**, no defectos acreditados ni permisos para rellenar valores. Si una familia presenta textos ausentes de forma masiva, contrastar primero el mapper y la proyección técnica antes de iniciar una campaña de correcciones.

El circuito comercial conserva su propia auditoría y exportación. Un corte técnico correcto **no acredita stock actual, exclusiones comerciales, decisiones editoriales ni importación en el backend**.

## Gomariz: exclusiones por disponibilidad

El extractor descubre anuncios desde `/venta/` y reconoce la señal explícita **«Sin existencias»** en la ficha individual. Estas URLs se registran en `storage/scraped/gomariz/scrape-gomariz-errors.json` como `exclusions` (URL y motivo), mientras el resumen publica `excludedProductUrls`. No se contabilizan como fallos de scraping ni se reintroducen en el original vigente. «Sin existencias» acredita indisponibilidad en el momento de consulta, no necesariamente venta definitiva.

En el corte del 11 de noviembre de 2026 se descubrieron 633 URLs, se incluyeron 547 y se justificaron 86 exclusiones sin errores de extracción. Once identidades de la publicación comercial histórica dejaron de estar presentes en el original vigente. **La auditoría histórica debe poder verificar el origen anterior; la exportación comercial de esas once identidades no debe reaparecer como válida sin reconciliación.** Esta comprobación es independiente de la retención técnica.

## Validación de cambios

```powershell
npm run contrato:comercial
npm run test:guard
npm test
npm run build
npm run estado
npm run publicacion:tecnica -- gomariz --ver
npm run publicacion:tecnica -- manain --ver
```

`npm test` incluye el guard de rendimiento, el guard del contrato comercial v2, la compilación requerida y las suites; `npm run exportar:comercial` también ejecuta el guard por el despachador. Un resultado verde no sustituye la validación de datos y procedencia. No generar nuevas versiones de un catálogo para validar un cambio documental.

Consultar también [Arquitectura](ARCHITECTURE.md), [Publicación individual](INDIVIDUAL_PUBLICATION.md), [Comercialización](COMERCIALIZACION.md), [Auditor de huecos](CATALOG_CONTENT_GAPS.md) y [Mantenimiento](MAINTENANCE.md).
