# Motor editorial compartido — arquitectura y evolución

## AI GUARD

**Protección documental.** No crear, cambiar ni retirar este documento salvo autorización explícita del propietario para actualizar documentación. Toda descripción debe contrastarse con el código productivo vigente; un informe de continuidad o una fase histórica no sustituye esta referencia.

**Frontera obligatoria.** No crear narradores por proveedor, modelo o referencia, ni atribuir a otra unidad prestaciones no acreditadas. Las reglas de redacción viven en el dominio y los mappers editoriales compartidos; los adaptadores interpretan el origen. Un guard en verde no demuestra cobertura funcional universal.

## Alcance y estado

Esta es la referencia **vigente** sobre el funcionamiento del motor editorial. La migración de los **narradores históricos detectados** al motor compartido está cerrada en el alcance de los guards: no quedan narradores de proveedor conectados y el guard de arquitectura editorial informa cero infracciones. Ello **no** demuestra que todas las 82 capacidades del inventario RE estén acreditadas ni que no existan oportunidades de mejora funcional.

Conservar y acreditar **todo el conocimiento útil del motor anterior** es un objetivo distinto de retirar sus narradores. La equivalencia histórica completa todavía no está demostrada; antes de enriquecer capacidades nuevas debe contrastarse el conocimiento antiguo con las reglas y evidencias actuales. Las mejoras funcionales se justifican mediante evidencia y comportamiento nuevo, no por una cuota de archivos o pruebas.

## Flujo productivo actual

```text
ProductRecord de origen
  └─ src/preparation/prepare-product.ts
       ├─ identidad, condición y reconciliaciones técnicas de origen
       ├─ recuperación documental y especificaciones técnicas
       ├─ captura de evidencia editorial de fuente
       │    mapping/source-editorial-evidence.ts
       ├─ resolvePreparedEditorial(...)
       │    mapping/prepared-editorial.ts
       │    ├─ mapping/prepared-editorial-source.ts
       │    │    ├─ dominio y evidencia compartidos
       │    │    └─ mapping/knowledge-editorial.ts
       │    └─ mapping/prepared-editorial-title.ts
       ├─ normalizePreparedEditorialPresentation(...)
       │    mapping/prepared-editorial-presentation.ts
       └─ PreparedProduct: ready o review, con issues y producto preparado
             └─ src/commercial/projection/presentation-projection.ts
                proyecta la presentación y metadatos; no reescribe las descripciones
```

`prepareSourceProduct` prepara sin catálogo de importación; `prepareWithCatalog` incorpora las validaciones y mapeos dependientes de `ImportCatalog`. No confundir `ready/review` técnico con aprobación editorial o comercial, ni alterar ese estado para salvar una ficha insuficientemente acreditada.

La composición y la presentación posterior pertenecen al circuito compartido de `src/preparation/shared/editorial/`. La presentación ya preparada pasa a la proyección comercial: no implementar un segundo redactor en `commercial/`, en los auditores, en `prepare-product.ts` ni en scripts de publicación.

## Propietarios y fronteras

| Ubicación                                      | Responsabilidad real                                                                                           | Lo que no debe hacer                                                        |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `shared/editorial/domain/`                     | Reglas reutilizables de identidad, familia, medidas, afirmaciones, coherencia, procedencia y composición       | Ramificar por una referencia concreta o inferir equipamiento de otra unidad |
| `shared/editorial/mapping/`                    | Captura y composición de evidencia, conocimiento, precedencias de títulos, corta y general, presentación final | Duplicar reglas ya existentes en un proveedor o inventar fuentes            |
| `shared/editorial/evidence/`                   | Aplicación de evidencia editorial acreditada y verificaciones asociadas                                        | Sustituir por código narrativo una fuente o autorización                    |
| `{gam,gomariz,mercaeleva}/editorial/`          | Interpretación y autenticidad de señales propias de cada origen; evidencia legítimamente particular            | Decidir la redacción final mediante narradores independientes               |
| `data/editorial/knowledge/`                    | Índices declarativos de conocimiento firmado y documentado                                                     | Transformar hechos particulares en hechos de todas las unidades del modelo  |
| `data/editorial/evidence/`                     | Evidencias de procedencia e históricos preservados                                                             | Actuar como código de reglas por referencia                                 |
| `shared/technical/` y adaptadores `technical/` | Reconstrucción y reconciliación de hechos técnicos, con prioridades explícitas                                 | Usar texto comercial para acreditar características no corroboradas         |
| `commercial/projection/`                       | Transferencia, proyección y metadatos compatibles con el contrato comercial                                    | Redactar de nuevo título, descripción corta o general                       |

Las implementaciones editoriales activas por origen incluyen `gam/editorial/source/domain-source.ts`, `gomariz/editorial/mapping/domain-source.ts` y `mercaeleva/editorial/mapping/domain-source.ts`. Existe además evidencia de origen en `mercaeleva/editorial/evidence/`. Su presencia **no** implica un motor de redacción separado por proveedor.

## Evidencia y precedencias

El motor debe comprobar autenticidad de fuente, identidad de marca/modelo, familia, condición, variante, concepto de medida, unidad y atribución al origen antes de enriquecer una salida. `ProductRecord` es el contrato existente de entrada: usarlo y respetar los tipos actuales; no inventar nuevas estructuras editoriales para eludir precondiciones.

Distinguir siempre:

- **Hecho de unidad:** estado, año, horas, serie, batería, extras, medidas o equipamiento concretos. No se propaga a unidades de igual modelo.
- **Referencia técnica de modelo:** puede aportar prestaciones generales documentadas solo bajo la compatibilidad y procedencia definidas por el motor; nunca acredita por sí sola un extra instalado.
- **Texto original de fuente:** es evidencia atribuida y solo se transforma cuando la identidad, los conceptos y las negaciones permiten hacerlo.
- **Texto o título firmado:** puede conservar contenido acreditado y precedencias específicas; su existencia no autoriza crear una regla general a partir de una referencia irrepetible.

`prepared-editorial-source.ts` integra la evidencia de origen, composición reutilizable, conocimiento, extractos y recuperación bajo condiciones explícitas. El título se decide mediante `prepared-editorial-title.ts` y la prioridad de título verificado. `prepared-editorial-presentation.ts` normaliza identidad, motor, combustible, altura y capacidad cuando están corroborados; no debe destruir detalles acreditados de títulos o cortas anteriores. La composición posterior respeta firma y autenticidad de fuente. Antes de alterar una precedencia hay que contrastar **título, corta, general, especificaciones, estado y origen** en los productos afectados y no afectados.

## Conocimiento declarativo y regeneración

Los índices vigentes residen en `data/editorial/knowledge/`:

- `verified-units.json`: evidencia editorial por unidad identificada.
- `model-consensus.json` y `model-technical-references.json`: conocimiento de modelo condicionado.
- `family-guidance.json`: indicaciones documentadas de familia.
- `manufacturer-models.json`: coincidencias de fabricante y modelo.

El mecanismo existente de verificación es:

```powershell
node scripts/operations/rebuild-editorial-knowledge.mjs --check
```

Para actualizar conocimiento debe utilizarse el proceso ya implementado (`npm run editorial:actualizar-conocimiento`) **solo cuando esté autorizada** esa intervención y se satisfagan sus dependencias. No editar índices ni firmar evidencia inventada para convertir `review` en `ready`. Los originales, manifest, identidad y huellas constituyen la prueba de procedencia; las publicaciones previamente acreditadas son inmutables.

## Cómo mejorar el motor a partir de ahora

1. Identificar una **responsabilidad funcional común** con defecto o información acreditada actualmente desaprovechada; distinguirla de la ausencia legítima de evidencia.
2. Localizar el propietario actual en dominio, mapping, adaptador o índices; comprobar condiciones y consumidores existentes antes de añadir módulos.
3. Centralizar la regla en el dominio o mapper compartido. Adaptar la semántica particular únicamente donde nace el dato. Evitar `switch` por referencia, narradores por modelo y correcciones en la proyección comercial.
4. Demostrar aplicación a **otra máquina nueva compatible** usando las mismas precondiciones, y rechazo ante variante incompatible, proveedor distinto, modelo parecido, negación, magnitud no equivalente, procedencia insuficiente o unidad distinta, según la regla.
5. Mantener la salida anterior donde no existe evidencia nueva; comprobar muestras positivas/negativas y diferencias reales de catálogo cuando puedan cambiar publicaciones.
6. Verificar guards, pruebas pertinentes, contrato comercial y el build/test oficial cuando exista entorno completo. Un fallo por dependencias ausentes queda **no acreditado**, no se convierte en PASS.

Los casos complejos —fuente contradictoria, semántica de altura ambigua, identidad cruzada o equipamiento que no puede acreditarse— se investigan por evidencia. No son por defecto deuda arquitectónica ni una invitación a completar textos mediante analogías.

## Qué se ha cerrado y qué no

- **Cerrado en el alcance medido:** narradores históricos detectados fuera del recorrido productivo; autoridad editorial compartida; fronteras comerciales y arquitectónicas vigiladas; guard arquitectónico de tests sin infracciones.
- **Pendiente de acreditar:** equivalencia de todas las reglas, condiciones y evidencias útiles del motor histórico con su aprovechamiento actual. La matriz original de 82 capacidades no certifica por sí sola la transferencia completa.
- **Posterior como evolución funcional:** ampliar o mejorar capacidades cuando existan brechas concretas reproducibles, después de preservar y acreditar el conocimiento anterior.
- **No acreditado en el último corte disponible:** `npm run build` y `npm test` oficiales completos, por dependencias de scraping/tipos ausentes en el entorno anterior. Una prueba focal o guard PASS no los sustituye.

## Auditorías de lectura sin publicación

Los comandos siguientes miden comportamientos actuales y producen **informes**, no acreditaciones ni cambios de catálogo. Requieren build y originales disponibles:

```powershell
npm run editorial:auditar-reutilizacion
npm run editorial:auditar-cobertura
```

El primero escribe `reports/editorial-knowledge/audit.json` y el segundo `reports/editorial-coverage/audit.json`. Ninguno sustituye una comparación funcional con el conocimiento histórico ni declara completas las 82 capacidades.

Consultar [Arquitectura](ARCHITECTURE.md), [Tests y guards](TEST_ARCHITECTURE.md), [Mejora acreditada](CATALOG_IMPROVEMENT.md), [Reglas de datos](SCRAPER_DATA_RULES.md) y [Validación](VALIDATION.md).
