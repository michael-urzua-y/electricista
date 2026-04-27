# Plan de Implementación: Comparación de Precios entre Facturas

## Visión General

Implementación incremental de la funcionalidad de comparación de precios entre facturas. Se comienza con la lógica de negocio pura en el backend (`comparison.py`), luego los serializers y endpoints API, y finalmente la interfaz frontend. Cada paso construye sobre el anterior para mantener el código integrado en todo momento.

## Tareas

- [x] 1. Crear módulo de servicio de comparación (`invoices/comparison.py`)
  - [x] 1.1 Implementar la función `calcular_variacion`
    - Crear el archivo `invoices/comparison.py`
    - Implementar la función que recibe `precio_anterior` (Decimal) y `precio_actual` (Decimal) y retorna un dict con `diferencia` y `variacion_porcentual`
    - Manejar el caso de `precio_anterior == 0` retornando `variacion_porcentual` como `None`
    - _Requisitos: 1.3_

  - [ ]* 1.2 Escribir test de propiedad para `calcular_variacion`
    - **Propiedad 3: Cálculo de variación de precio**
    - Usar Hypothesis con `@given` para generar pares de precios positivos
    - Verificar que `diferencia == precio_actual - precio_anterior` y `variacion_porcentual == ((precio_actual - precio_anterior) / precio_anterior) * 100`
    - **Valida: Requisito 1.3**

  - [x] 1.3 Implementar la función `obtener_factura_anterior`
    - Recibe una instancia de `Invoice` y retorna la factura completada más reciente del mismo proveedor y usuario con `issue_date` estrictamente anterior
    - Retorna `None` si no existe factura anterior
    - _Requisitos: 1.1, 1.4_

  - [ ]* 1.4 Escribir test de propiedad para `obtener_factura_anterior`
    - **Propiedad 1: Selección correcta de factura anterior**
    - Usar Hypothesis con `@given` para generar conjuntos de facturas con fechas y proveedores variados
    - Verificar que la factura retornada es la más reciente con fecha estrictamente anterior, mismo proveedor y mismo usuario
    - **Valida: Requisitos 1.1, 1.4**

  - [x] 1.5 Implementar la función `calcular_comparacion`
    - Recibe `factura_actual` y `factura_base` (ambas instancias de `Invoice`)
    - Identifica productos comunes por `product_id` (no nulo) entre los ítems de ambas facturas
    - Para cada producto común, calcula la variación usando `calcular_variacion`
    - Retorna dict con metadatos de ambas facturas y lista de `productos_comunes`
    - _Requisitos: 1.2, 1.3, 1.5, 2.2, 2.3_

  - [ ]* 1.6 Escribir test de propiedad para `calcular_comparacion`
    - **Propiedad 2: Identificación de productos comunes**
    - Verificar que el conjunto de productos retornado es exactamente la intersección de `product_id` no nulos de ambas facturas
    - **Valida: Requisitos 1.2, 1.5**

  - [x] 1.7 Implementar la función `comparar_mes`
    - Recibe `proveedor_id`, `user`, `year` y `month`
    - Obtiene todas las facturas completadas del proveedor y usuario en el período
    - Para cada producto que aparece en al menos dos facturas: calcula precio mínimo, máximo, promedio y variación porcentual entre primera y última factura del período
    - _Requisitos: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [ ]* 1.8 Escribir test de propiedad para `comparar_mes`
    - **Propiedad 8: Correctitud de agregación mensual**
    - Verificar que los precios mínimo, máximo y promedio son correctos para cada producto, y que la variación se calcula entre primera y última factura del período
    - **Valida: Requisitos 4.3, 4.4**

  - [x] 1.9 Implementar la función `comparar_entre_proveedores`
    - Recibe `user` y compara precios del mismo producto entre distintos proveedores
    - Para cada producto que aparece en facturas de 2+ proveedores, muestra el precio más reciente de cada proveedor
    - Identifica cuál es el proveedor más barato y calcula la variación respecto al más barato
    - Retorna dict con lista de productos y sus precios por proveedor

- [x] 2. Checkpoint — Verificar lógica de negocio
  - Asegurar que todos los tests pasan, preguntar al usuario si surgen dudas.

- [x] 3. Crear serializers y endpoints API de comparación
  - [x] 3.1 Crear serializers de comparación (`invoices/comparison_serializers.py`)
    - Implementar `ProductoComparacionSerializer` con campos: `producto_id`, `producto_nombre`, `precio_anterior`, `precio_actual`, `diferencia`, `variacion_porcentual`
    - Implementar `ComparacionAutomaticaSerializer` con campos: `factura_actual`, `factura_anterior`, `productos_comunes`, `mensaje`
    - Implementar `ComparacionMensualProductoSerializer` con campos: `producto_id`, `producto_nombre`, `precio_minimo`, `precio_maximo`, `precio_promedio`, `variacion_porcentual`
    - Implementar `ComparacionMensualSerializer` con campos: `proveedor`, `periodo`, `facturas`, `productos`, `mensaje`
    - _Requisitos: 2.2, 2.3, 4.3, 4.4_

  - [x] 3.2 Agregar endpoint `comparar_anterior` en `FacturaViewSet`
    - Agregar `@action(detail=True, methods=['get'], url_path='comparar-anterior')` en `invoices/views.py`
    - Verificar que el usuario es propietario de la factura o es staff (retornar 404 si no)
    - Llamar a `obtener_factura_anterior` y `calcular_comparacion` del servicio
    - Retornar respuesta serializada con `ComparacionAutomaticaSerializer`
    - _Requisitos: 2.1, 2.2, 2.3, 2.4_

  - [x] 3.3 Agregar endpoint `comparar_manual` en `FacturaViewSet`
    - Agregar `@action(detail=False, methods=['get'], url_path='comparar-manual')` en `invoices/views.py`
    - Validar parámetros `factura_base` y `factura_comparar` (retornar 400 si faltan)
    - Validar que ambas facturas pertenecen al usuario o el usuario es staff (retornar 404 si no)
    - Validar que ambas facturas tienen estado "completed" (retornar 400 si no)
    - Validar que ambas facturas pertenecen al mismo proveedor (retornar 400 si no)
    - Llamar a `calcular_comparacion` y retornar respuesta serializada
    - _Requisitos: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 3.4 Agregar endpoint `comparar_mes` en `FacturaViewSet`
    - Agregar `@action(detail=False, methods=['get'], url_path='comparar-mes')` en `invoices/views.py`
    - Validar parámetro `proveedor_id` (retornar 400 si falta)
    - Validar que el proveedor existe (retornar 404 si no)
    - Usar mes/año actuales si no se proporcionan `year` y `month`
    - Llamar a `comparar_mes` del servicio y retornar respuesta serializada
    - _Requisitos: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [x] 3.5 Agregar endpoint `comparar_proveedores` en `FacturaViewSet`
    - Agregar `@action(detail=False, methods=['get'], url_path='comparar-proveedores')` en `invoices/views.py`
    - Llamar a `comparar_entre_proveedores` del servicio
    - Retornar respuesta con lista de productos y sus precios por proveedor

  - [ ]* 3.6 Escribir tests de propiedad para control de acceso y validaciones de endpoints
    - **Propiedad 5: Control de acceso a comparaciones**
    - **Propiedad 6: Validación de mismo proveedor en comparación manual**
    - **Propiedad 7: Validación de estado completado en comparación manual**
    - Usar `APIClient` de DRF con Hypothesis para generar escenarios de acceso
    - **Valida: Requisitos 2.4, 3.3, 3.5**

- [x] 4. Enriquecer endpoint de detalle de factura con variaciones de precio
  - [x] 4.1 Modificar `InvoiceDetailSerializer` para incluir datos de variación
    - Agregar campo `variaciones` al serializer de detalle que, para cada ítem con `product_id`, incluya la variación respecto a la factura anterior
    - Marcar ítems sin equivalente en la factura anterior con la etiqueta "nuevo"
    - Usar las funciones de `comparison.py` para calcular las variaciones
    - _Requisitos: 8.1, 8.2, 8.3_

  - [ ]* 4.2 Escribir test de propiedad para enriquecimiento del detalle
    - **Propiedad 10: Enriquecimiento del detalle de factura con variaciones**
    - Verificar que cada ítem con producto equivalente en la factura anterior tiene datos de variación, y los ítems sin equivalente tienen etiqueta "nuevo"
    - **Valida: Requisitos 8.1, 8.2, 8.3**

- [x] 5. Checkpoint — Verificar API completa
  - Asegurar que todos los tests pasan, preguntar al usuario si surgen dudas.

- [x] 6. Implementar componentes frontend compartidos
  - [x] 6.1 Crear componente `PriceVariationBadge.jsx`
    - Crear `frontend/src/components/PriceVariationBadge.jsx`
    - Renderizar badge rojo con flecha arriba (↑) si la variación es positiva
    - Renderizar badge verde con flecha abajo (↓) si la variación es negativa
    - Renderizar badge gris con texto "Sin cambio" si la variación es cero o nula
    - Usar clases de Tailwind CSS consistentes con el diseño existente
    - _Requisitos: 5.3, 5.4, 5.5_

  - [x] 6.2 Crear componente `ComparisonTable.jsx`
    - Crear `frontend/src/components/ComparisonTable.jsx`
    - Tabla reutilizable que recibe una lista de `productos_comunes` y muestra: nombre del producto, precio anterior, precio actual, diferencia y badge de variación
    - Formatear precios en CLP usando `Intl.NumberFormat`
    - Mostrar mensaje cuando la lista de productos comunes está vacía
    - _Requisitos: 5.2, 6.3_

  - [ ]* 6.3 Escribir tests unitarios para `PriceVariationBadge`
    - Verificar renderizado correcto para valores positivos, negativos, cero y null
    - **Valida: Requisitos 5.3, 5.4, 5.5**

- [x] 7. Refactorizar página `PriceComparison.jsx` con tabs y secciones
  - [x] 7.1 Implementar estructura de tabs en `PriceComparison.jsx`
    - Reestructurar la página existente con cuatro tabs: "Comparación Automática", "Comparación Manual", "Resumen Mensual", "Entre Proveedores"
    - Mantener la funcionalidad de comparación entre proveedores como cuarto tab
    - _Requisitos: 5.1, 6.1, 7.1_

  - [x] 7.2 Implementar tab de Comparación Automática
    - Agregar selector de factura (facturas completadas del usuario, ordenadas por fecha descendente)
    - Al seleccionar una factura, llamar a `GET /api/facturas/{id}/comparar-anterior/`
    - Mostrar resultado usando `ComparisonTable` y `PriceVariationBadge`
    - Manejar caso sin factura anterior (mostrar mensaje informativo)
    - Mostrar spinner mientras se carga la comparación
    - _Requisitos: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [x] 7.3 Implementar tab de Comparación Manual
    - Agregar selector de proveedor que carga facturas completadas del proveedor seleccionado
    - Agregar dos selectores de factura (base y a comparar) ordenados por fecha descendente
    - Botón "Comparar" que llama a `GET /api/facturas/comparar-manual/?factura_base={id}&factura_comparar={id}`
    - Mostrar resultado usando `ComparisonTable`
    - Manejar errores 400 mostrando mensaje del backend en alert inline
    - Mostrar spinner mientras se carga
    - _Requisitos: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [x] 7.4 Implementar tab de Resumen Mensual
    - Agregar selector de proveedor y selector de período (mes/año)
    - Al seleccionar, llamar a `GET /api/facturas/comparar-mes/?proveedor_id={id}&year={y}&month={m}`
    - Mostrar tabla con precio mínimo, máximo, promedio y variación por producto
    - Mostrar cantidad de facturas del período
    - Manejar caso sin facturas en el período (mostrar mensaje informativo)
    - _Requisitos: 7.1, 7.2, 7.3, 7.4_

  - [x] 7.5 Implementar tab de Entre Proveedores
    - Mostrar comparación de precios del mismo producto entre distintos proveedores
    - Llamar a `GET /api/facturas/comparar-proveedores/`
    - Mostrar el proveedor más barato para cada producto
    - Mostrar variación de precio respecto al más barato
    - Incluir información de factura y fecha para cada proveedor

- [x] 8. Agregar indicadores de variación en detalle de factura (`Invoices.jsx`)
  - [x] 8.1 Modificar el modal de detalle de factura en `Invoices.jsx`
    - Agregar columna "Variación" en la tabla de ítems que muestre `PriceVariationBadge` cuando existan datos de variación
    - Mostrar etiqueta "Nuevo" para ítems sin equivalente en la factura anterior
    - Consumir los datos de variación del endpoint de detalle enriquecido
    - Agregar tooltip explicativo del sistema de variaciones
    - _Requisitos: 8.1, 8.2, 8.3_

- [x] 9. Checkpoint final — Verificar integración completa
  - Asegurar que todos los tests pasan, preguntar al usuario si surgen dudas.

## Notas

- Las tareas marcadas con `*` son opcionales y pueden omitirse para un MVP más rápido
- Cada tarea referencia los requisitos específicos para trazabilidad
- Los checkpoints aseguran validación incremental
- Los tests de propiedades validan las propiedades de correctitud universales definidas en el diseño
- Los tests unitarios validan ejemplos específicos y casos borde
- Se requiere agregar `hypothesis` a `requirements.txt` para los tests de propiedades
