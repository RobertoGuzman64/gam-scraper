# Integración con Equipzilla: límites y contratos

## AI GUARD

**Protección documental.** Ninguna IA puede crear, modificar, mover ni eliminar este documento sin autorización explícita del propietario para la intervención documental concreta. Solicitudes de código, pruebas, auditoría o limpieza técnica no autorizan cambios implícitos en la documentación.

## Frontera entre el scraper y el backend

La **responsabilidad del scraper** es obtener catálogos canónicos fiables, conservar la evidencia del proveedor, verificar identidad y contenido, comparar campañas y entregar una selección editorial acreditada. **La responsabilidad del proceso receptor** es interpretar esos datos para el modelo comercial de Equipzilla: decidir `categorySellID`, IDs de atributos, reglas de importación, permisos, inventario en base de datos y publicación.

Esta separación es deliberada. Los mapeos comerciales que el scraper llegó a incorporar eran una capacidad técnica auxiliar, **no un requisito de calidad del dato ni una obligación pendiente de completar**.

```text
Portales de proveedores
        ↓
ProductRecord y catálogos canónicos íntegros
        ↓
Preparación técnica y controles de calidad
        ↓
Selección editorial y cuatro JSON acreditados (campaña actual)
        ↓
Adaptación comercial e importación — proceso receptor / backend
```

## Contratos que entrega el scraper

- `ProductRecord` conserva `categoryKey` y `categoryName` originales, referencias, descripciones, imágenes, condición acreditada y `specs` sin equivalencias comerciales inventadas.
- La preparación offline actual utiliza reglas técnicas versionadas (`rulesVersion: 2`). En sus candidatos, `categorySellID: null` y `attributes: []` indican **ausencia intencionada de asignación comercial**; las especificaciones siguen en `spec`.
- `ready/review` describe incidencias técnicas del origen; no garantiza que el backend pueda crear un producto sin transformación adicional.
- La campaña actual entrega cuatro JSON seleccionados y acreditados. **No son requests HTTP** ni prueban que ya existan categorías comerciales asignadas.
- Ninguna entrega crea, actualiza o da de baja productos de Equipzilla.

Los identificadores propios del proveedor, si existen, se conservan como datos de origen; **no** deben ponerse a `null` para simular una ausencia de IDs comerciales. La correspondencia entre categorías del proveedor y categorías de venta es una decisión de la integración receptora.

## Compatibilidad comercial heredada

El repositorio todavía contiene `npm run exportar`, `src/catalog/legacy-export/` y `src/pipeline/legacy-export/`, infraestructura de XLSX y snapshots `data/category/` y `data/import/`. Son piezas **heredadas**, separadas del flujo canónico vigente. El exportador puede procesar preparaciones comerciales históricas conforme a sus validaciones, pero **rechaza expresamente las preparaciones canónicas actuales sin asignación comercial**.

No utilizar estos módulos como continuación automática de `npm run entregar`, ni interpretar un Excel o un JSON para `create/many` como artefacto de campaña. Cualquier uso excepcional requiere validar el contrato real del backend con sus responsables; los snapshots locales no acreditan el estado de la base de datos desplegada. No convertir el trabajo de compatibilidad en una dependencia del scraper.

La operación comercial, incluyendo inventario vivo, autorización y comprobación de errores de importación por fila, pertenece al proceso receptor. Para conocer el estado del comando heredado se puede consultar `npm run ayuda -- exportar`, **sin asumir que sea aplicable a preparaciones nuevas**.

## Responsabilidades y cambios futuros

Si el backend cambia su catálogo de categorías, atributos, endpoints o políticas comerciales, **el scraper no debe necesitar cambios mientras conserve su contrato canónico**. Una petición de integración nueva debe acordarse como contrato entre proyectos, no introducirse silenciosamente en las reglas de calidad.

Las salidas conservan su integridad, procedencia, acreditación y límites editoriales. Para más detalle consultar [Objetivos](SCRAPER_OBJECTIVES.md), [Reglas de datos](SCRAPER_DATA_RULES.md) y [Campañas](CAMPAIGNS.md).
