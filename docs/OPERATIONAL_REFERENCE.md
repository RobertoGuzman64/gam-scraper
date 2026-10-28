# Referencia operativa: compatibilidad histórica, consulta y traslado

`data/reference/` es un **almacén legado opcional**, no la referencia que debe actualizarse después de cada entrega. La comparación normal obtiene su base de los originales de la última campaña entregada íntegra y conservada, verificados por `runId`; si no existe, puede usar la referencia legada íntegra. `npm run huecos` sigue la misma prioridad y admite catálogos canónicos explícitos con `--catalogo`.

El formato legado conserva `gam.json`, `gomariz.json`, `mercaeleva.json`, opcionalmente `manain.json`, `manifest.json` y `differences.json`, con huellas verificables. Acepta referencias históricas de **tres proveedores** sin exigir Manain en sus originales. Una nueva campaña global y su ZIP, en cambio, requieren los cuatro proveedores. Las referencias heredadas no incluyen selección editorial ni forman parte del ZIP público. La rotación global no elimina `data/reference/`.

## Comandos de compatibilidad

```text
npm run referencia
npm run referencia -- --actualizar
npm run referencia -- --recuperar
npm run referencia -- --exportar <carpeta-nueva>
npm run referencia -- --importar <carpeta-existente>
npm run referencia -- --importar <carpeta-existente> --sustituir
```

- Sin argumentos: **solo lectura** del almacén legado. Comprueba huellas SHA-256, manifest, diferencias y catálogos; no exige una campaña activa. Una referencia ausente es normal; una inválida produce error y una recuperable se señala sin repararla.
- `--actualizar`: mecanismo **legado opcional** desde una campaña acreditada y entregada. No es un paso de la operación normal ni requisito para comparar el siguiente lote.
- `--recuperar`: repara explícitamente una transacción de referencia interrumpida si existe respaldo íntegro. Una transacción inválida o recuperable puede bloquear la rotación; no borrarla para desbloquear el ciclo.
- `--exportar`: crea una carpeta nueva con los archivos verificados (seis en el formato de cuatro proveedores o cinco en el histórico de tres), sin sobrescribir el destino. Guardar fuera del repositorio y solo para operadores autorizados.
- `--importar`: valida la copia y la instala transaccionalmente; no sustituye una referencia presente salvo con `--sustituir`. Si hay transacciones incompatibles o datos corruptos, bloquea el reemplazo sin borrados.

`node scripts/migrate-storage.mjs` es una migración de **rutas heredadas** (`data/referencia/`, `diferencias.json`), no un paso de instalación nueva ni de la rotación. Ejecutarla solo al actualizar una instalación antigua que use esos nombres y tras verificar que no haya campañas o transacciones abiertas. Para una copia externa antigua admite `--transfer <carpeta-externa>`; las importaciones ordinarias usan el formato de nombres vigente.

Las operaciones de exportación/importación trasladan **solo la referencia legada**, no las campañas, sus catálogos originales retenidos, selecciones ni recibos de entrega. No son un mecanismo de copia de seguridad integral del ciclo actual y no envían archivos por red. Para operar una campaña normal no hace falta utilizar estos comandos.

## Política de Git

La referencia es **operativa, local y no versionada por defecto**. `.gitignore` excluye `data/reference/` y las carpetas/archivos de transacción `.reference-*` bajo `data/`. Los snapshots comerciales heredados `data/category/` y `data/import/` permanecen versionables, pero no condicionan la preparación canónica actual. No se generan históricos paralelos en el repositorio.

`.gitignore` **no desindexa archivos ya rastreados**. Para comprobar el repositorio local ejecutar `git ls-files -- data/reference/`. Si aparecen archivos de referencia, el propietario debe decidir y aplicar una sola retirada del índice con `git rm -r --cached -- data/reference/`, revisar `git status` y registrar ese cambio; `--cached` conserva los archivos de trabajo. No ejecutar retirada automática del índice durante la instalación, consulta ni actualización de la referencia. El archivo ZIP de origen no incluye `.git`, por lo que no acredita el estado real del índice del usuario.

Una instalación nueva sin referencia ni entrega retenida puede iniciar un lote y compararlo como inventario inicial. Las campañas entregadas conservan sus originales mientras estén retenidas, sin actualización ni limpieza manual ordinaria. La exportación/importación legada no sustituye un respaldo integral de las campañas y sus acreditaciones.
