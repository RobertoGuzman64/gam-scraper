# 05 · Método, resultados y límites de esta Fase 1

## Material leído

- Auditoría F0: `eqz-f0-fe5885.zip`, documentos 00–08, `INVENTARIO-EDITORIAL-POR-ARCHIVO.csv`, `BASE-INPUTS-SHA256.json`, muestras y línea base.
- Auditoría complementaria: `eqz-ag-d619422.zip`, documentos 00–06, catálogo K01–K16, matriz semántica de 135 rutas, evidencias y negativos.
- Código **actual recibido**: `gam-scraper-develop.zip`, árbol de `src/preparation/`, entrada `prepare-product.ts`, repositorios editoriales por proveedor, validadores y diagnósticos de catálogo, catálogos originales de GAM/Gomariz/Mercaeleva, pruebas existentes.

## Diferencias respecto a las matrices anteriores

| Medida | Auditoría complementaria anterior | Revisión sobre ZIP actual |
|---|---:|---:|
| Módulos productivos dentro de `*/editorial/**` | 130 | **140** |
| Puentes fuera del árbol editorial incluidos en matriz de 135 | 5 | Se analizan por separado, no han desaparecido |
| Módulos editoriales productivos nuevos | — | **10** |
| Módulos editoriales productivos suprimidos respecto a anterior | — | **0** |
| Fuentes canónicas GAM/Gomariz/Mercaeleva | 983 / 547 / 221 | **Mismas huellas** |
| Módulos de producción accesibles por imports desde `prepare-product.ts` | No se calculó aquí | **343** |
| Módulos editoriales accesibles por esa entrada | — | **140/140** |
| Declaraciones exportadas encontradas en esos 140 | — | **173** |
| Declaraciones locales sintácticas encontradas | — | **1.336**; incluye utilidades y datos |
| Líneas con `if`, `switch`, `case` o `??` | — | **1.025**; índice, no reglas semánticas |
| Claves de mapas evidenciales detectadas | — | **777 entradas, 720 claves distintas** |
| Módulos externos marcados por referencias a textos | — | **212**; 48 clasificados como «frontera activa o potencial» |

Las **10 rutas añadidas** son: `shared/editorial/domain/{editorial-composition,editorial-facts,editorial-source-contract,editorial-source,platform-measurements,source-measurement}.ts`, `gam/editorial/source/domain-source.ts`, `gomariz/editorial/mapping/{domain-source,source-family}.ts` y `mercaeleva/editorial/mapping/domain-source.ts`. Los cinco caminos de la matriz anterior fuera de `editorial/` siguen presentes: `prepare-product.ts`, `prepare.ts`, `workflow/prepare.ts`, `infrastructure/filesystem/preparation/preparation-inputs.ts`, `gam/identity/mapping/crossed-identity-editorial.ts`.

## Reproducibilidad de recuentos

- Inventario: todos los `*.ts` **no** `*.test.ts` situados en `src/preparation/{gam,gomariz,mercaeleva,shared}/editorial/**`.
- Exportaciones: declaraciones `export const/function/type/interface/class/...` con ruta y línea; algunas reexportaciones `export { ... }` están presentes solo como texto del fichero, no incluidas en el recuento 173. Por ello, **el CSV de símbolos no se presenta como AST exhaustivo**.
- Condiciones: búsqueda conservadora de líneas `if`, `switch`, `case` y `??` con número de línea; las ternarias sin esos tokens y las decisiones implícitas de tablas pueden no quedar registradas, pero su archivo y reglas funcionales sí quedan bajo revisión obligatoria.
- Evidencias: claves literales de mapas con sangría de dos espacios en módulos con contenido evidencial; **no** detecta todas las estructuras de arrays, claves no literales, objetos anidados o registros guardados mediante otra sintaxis. Es índice de localización y estimación de volumen, **no enumeración canónica de unidades**.
- Relaciones: imports/reexports con `from` y rutas relativas `.js` reconstruidos como `.ts`, desde `src/preparation/prepare-product.ts`. No modela imports dinámicos, ejecución a través de CLI ajena, loaders, reflexión ni dependencias fuera de `src`; no emplear el alcance estático como único criterio de borrado.
- Fronteras: escaneo estático de campos de texto (`shortDescription`, `longDescription`, `description_general`, `description`, `title`) fuera del árbol editorial, incluyendo captura, tests auxiliares, diagnósticos y contratos; **no todos son mutadores ni reglas de negocio**. La clausura de 343 rutas completa la red de inspección.

## Huellas de los originales comprobadas en este ZIP

| Proveedor | Registros | SHA-256 del original canónico |
|---|---:|---|
| GAM | 983 | `855865e4a99f709cd9b10b68e77d594841b8cbd8c64b4fc9eb851cb397162483` |
| Gomariz | 547 | `87e2fc58e39f9f00d7226e623ead5a154f933c3880b8503de2dc1a2375c3901b` |
| Mercaeleva | 221 | `83e0265743ba1ec0b6ebb1c1bc8bbb9cd3b26eba77d208d659d35e7a62bba792` |

Coinciden con `EQUIPZILLA-FASE-0/BASE-INPUTS-SHA256.json`. El ZIP de código, por el contrario, **no** tiene la huella `453b...` mencionada por la auditoría complementaria antigua: se usó **la copia actual**. Ningún fichero de esas fuentes se modificó.

## Qué se pudo comprobar en ejecución

Se intentó `node tests-performance-guard.mjs && node tests-commercial-contract-guard.mjs` sobre el código recibido. El primero falló **antes de empezar**: `Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'typescript'`. No existe `node_modules` instalado en la copia extraída. No se ejecutaron la segunda comprobación, `npm test`, `npm run build` ni preparación masiva del catálogo. **No afirmar PASS ni cierre de pruebas**. Esta es una **auditoría estructural**, no una certificación de equivalencia de salidas.

## Términos de entrega

- La matriz semántica de 82 capacidades y el inventario de 140 archivos hacen explícito qué debe compartirse **por defecto**; cada regla detallada y dato evidencial queda localizable para su descomposición en Fase 2.
- La Fase 2 debe recorrer las 777 claves indexadas y **también** las otras declaraciones de evidencia que el índice literal no capture. Una transferencia automática uno-a-uno de textos firmados violaría el propósito de reutilización.
- Ninguna estimación de precisión, cobertura de máquinas o mejora editorial en el ZIP actual se ofrece sin ejecutar y comparar la preparación real.
- No se modificó código, publicación, intervención manual, contrato comercial, referencia ni original; este paquete contiene **solo auditoría**.
