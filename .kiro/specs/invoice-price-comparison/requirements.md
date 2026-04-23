# Documento de Requisitos — Comparación de Precios entre Facturas

## Introducción

Esta funcionalidad permite al usuario comparar automáticamente los precios de productos entre facturas del mismo proveedor a lo largo del tiempo. Cuando se sube una nueva factura, el sistema detecta facturas anteriores del mismo proveedor, identifica productos en común y muestra si los precios subieron o bajaron. Además, el usuario puede comparar manualmente dos facturas específicas y ver comparaciones agrupadas por el mes actual.

## Glosario

- **Sistema_Comparación**: Módulo backend (Django/DRF) responsable de calcular y devolver las comparaciones de precios entre facturas del mismo proveedor.
- **Factura**: Registro en el modelo `Invoice` que contiene ítems (`InvoiceItem`) con precios unitarios, asociado a un proveedor y una fecha de emisión.
- **Ítem_Factura**: Registro en el modelo `InvoiceItem` que representa un producto dentro de una factura, con descripción, cantidad, precio unitario y precio total.
- **Producto**: Registro en el modelo `Product` que identifica un material de forma única en el sistema.
- **Proveedor**: Registro en el modelo `Provider` que representa a un proveedor de materiales.
- **Factura_Anterior**: La factura completada más reciente del mismo proveedor, anterior a la factura actual, perteneciente al mismo usuario.
- **Producto_Común**: Un producto que aparece como `InvoiceItem` vinculado al mismo `Product` en dos facturas distintas del mismo proveedor.
- **Variación_Precio**: Diferencia porcentual entre el precio unitario de un producto en dos facturas, calculada como `((precio_nuevo - precio_anterior) / precio_anterior) * 100`.
- **Vista_Comparación**: Página frontend (React) que muestra los resultados de comparación de precios entre facturas.
- **Comparación_Automática**: Comparación generada automáticamente al procesar una factura, contra la factura anterior del mismo proveedor.
- **Comparación_Manual**: Comparación solicitada por el usuario entre dos facturas específicas del mismo proveedor.

## Requisitos

### Requisito 1: Comparación automática con factura anterior del mismo proveedor

**Historia de Usuario:** Como electricista, quiero que al subir una factura el sistema compare automáticamente los precios con la factura anterior del mismo proveedor, para saber si los precios subieron o bajaron sin esfuerzo manual.

#### Criterios de Aceptación

1. WHEN una Factura con estado "completed" es procesada, THE Sistema_Comparación SHALL identificar la Factura_Anterior del mismo Proveedor y del mismo usuario.
2. WHEN la Factura_Anterior existe, THE Sistema_Comparación SHALL identificar todos los Producto_Común entre la factura actual y la Factura_Anterior.
3. WHEN existen Producto_Común entre ambas facturas, THE Sistema_Comparación SHALL calcular la Variación_Precio para cada Producto_Común usando los precios unitarios.
4. IF no existe una Factura_Anterior para el mismo Proveedor, THEN THE Sistema_Comparación SHALL retornar un resultado vacío indicando que no hay factura previa para comparar.
5. IF no existen Producto_Común entre las dos facturas, THEN THE Sistema_Comparación SHALL retornar un resultado vacío indicando que no hay productos en común.

### Requisito 2: Endpoint API para comparación automática

**Historia de Usuario:** Como desarrollador frontend, quiero un endpoint que devuelva la comparación automática de una factura con su factura anterior, para poder mostrar los resultados en la interfaz.

#### Criterios de Aceptación

1. THE Sistema_Comparación SHALL exponer un endpoint GET en `/api/facturas/{id}/comparar-anterior/` que retorne la comparación de la factura indicada con su Factura_Anterior.
2. WHEN el endpoint es consultado, THE Sistema_Comparación SHALL retornar para cada Producto_Común: nombre del producto, precio unitario anterior, precio unitario actual, diferencia absoluta y Variación_Precio.
3. WHEN el endpoint es consultado, THE Sistema_Comparación SHALL incluir metadatos de ambas facturas: número de factura, fecha de emisión y nombre del proveedor.
4. THE Sistema_Comparación SHALL restringir el acceso al endpoint a usuarios autenticados que sean propietarios de la factura o usuarios staff.

### Requisito 3: Comparación manual entre dos facturas específicas

**Historia de Usuario:** Como electricista, quiero poder seleccionar dos facturas específicas del mismo proveedor y comparar sus precios, para analizar la evolución de precios en un período que yo elija.

#### Criterios de Aceptación

1. THE Sistema_Comparación SHALL exponer un endpoint GET en `/api/facturas/comparar-manual/` que acepte los parámetros `factura_base` y `factura_comparar` como IDs de factura.
2. WHEN ambas facturas pertenecen al mismo Proveedor y al mismo usuario, THE Sistema_Comparación SHALL retornar la comparación de Producto_Común con precios unitarios, diferencia absoluta y Variación_Precio.
3. IF las dos facturas pertenecen a proveedores distintos, THEN THE Sistema_Comparación SHALL retornar un error 400 con el mensaje "Las facturas deben pertenecer al mismo proveedor".
4. IF alguna de las facturas no existe o no pertenece al usuario autenticado, THEN THE Sistema_Comparación SHALL retornar un error 404.
5. IF alguna de las facturas no tiene estado "completed", THEN THE Sistema_Comparación SHALL retornar un error 400 con el mensaje "Ambas facturas deben estar completadas".

### Requisito 4: Comparación con facturas del mes actual

**Historia de Usuario:** Como electricista, quiero ver un resumen de cómo han variado los precios de un proveedor durante el mes actual, para tener una visión general de la tendencia de precios reciente.

#### Criterios de Aceptación

1. THE Sistema_Comparación SHALL exponer un endpoint GET en `/api/facturas/comparar-mes/` que acepte el parámetro `proveedor_id` y opcionalmente `year` y `month`.
2. WHEN el endpoint es consultado sin parámetros de fecha, THE Sistema_Comparación SHALL usar el mes y año actuales como período de comparación.
3. WHEN existen múltiples facturas del mismo Proveedor en el período indicado, THE Sistema_Comparación SHALL retornar para cada Producto_Común: nombre del producto, precio mínimo, precio máximo, precio promedio y Variación_Precio entre la primera y última factura del período.
4. WHEN el endpoint es consultado, THE Sistema_Comparación SHALL incluir la lista de facturas del período con su fecha de emisión y número de factura.
5. IF no existen facturas del Proveedor en el período indicado, THEN THE Sistema_Comparación SHALL retornar un resultado vacío con un mensaje indicando que no hay facturas en el período.

### Requisito 5: Visualización de comparación automática post-subida

**Historia de Usuario:** Como electricista, quiero ver los resultados de la comparación automática después de subir una factura, para saber inmediatamente si los precios cambiaron.

#### Criterios de Aceptación

1. WHEN una Factura es procesada exitosamente y existe una Factura_Anterior, THE Vista_Comparación SHALL mostrar una notificación indicando que hay una comparación disponible.
2. WHEN el usuario accede a la comparación automática, THE Vista_Comparación SHALL mostrar una tabla con los Producto_Común, el precio anterior, el precio actual y la Variación_Precio.
3. WHEN la Variación_Precio es positiva (subida), THE Vista_Comparación SHALL mostrar el valor en color rojo con un ícono de flecha hacia arriba.
4. WHEN la Variación_Precio es negativa (bajada), THE Vista_Comparación SHALL mostrar el valor en color verde con un ícono de flecha hacia abajo.
5. WHEN la Variación_Precio es cero, THE Vista_Comparación SHALL mostrar el valor en color gris con la indicación "Sin cambio".

### Requisito 6: Página de comparación manual entre facturas

**Historia de Usuario:** Como electricista, quiero una interfaz donde pueda seleccionar dos facturas del mismo proveedor y ver la comparación lado a lado, para analizar cambios de precio en períodos específicos.

#### Criterios de Aceptación

1. THE Vista_Comparación SHALL incluir una sección de "Comparación Manual" con un selector de proveedor y dos selectores de factura.
2. WHEN el usuario selecciona un Proveedor, THE Vista_Comparación SHALL cargar las facturas completadas de ese Proveedor en ambos selectores de factura, ordenadas por fecha de emisión descendente.
3. WHEN el usuario selecciona dos facturas y presiona "Comparar", THE Vista_Comparación SHALL mostrar una tabla con los Producto_Común, precios de cada factura y la Variación_Precio.
4. WHILE la comparación se está cargando, THE Vista_Comparación SHALL mostrar un indicador de carga.
5. IF no existen Producto_Común entre las facturas seleccionadas, THEN THE Vista_Comparación SHALL mostrar un mensaje indicando que no hay productos en común entre las facturas.

### Requisito 7: Visualización de comparación mensual

**Historia de Usuario:** Como electricista, quiero ver un resumen mensual de la evolución de precios por proveedor, para identificar tendencias de precios a lo largo del mes.

#### Criterios de Aceptación

1. THE Vista_Comparación SHALL incluir una sección de "Resumen Mensual" con un selector de proveedor y un selector de período (mes/año).
2. WHEN el usuario selecciona un Proveedor y un período, THE Vista_Comparación SHALL mostrar una tabla con cada Producto_Común, su precio mínimo, máximo, promedio y la Variación_Precio entre la primera y última factura del período.
3. WHEN existen datos de comparación mensual, THE Vista_Comparación SHALL mostrar la cantidad de facturas del proveedor en el período seleccionado.
4. IF no existen facturas del Proveedor en el período seleccionado, THEN THE Vista_Comparación SHALL mostrar un mensaje indicando que no hay facturas para ese proveedor en el período.

### Requisito 8: Indicadores de variación de precio en detalle de factura

**Historia de Usuario:** Como electricista, quiero ver indicadores de variación de precio directamente en el detalle de cada factura, para tener contexto inmediato sobre cambios de precio al revisar una factura.

#### Criterios de Aceptación

1. WHEN el usuario abre el detalle de una Factura que tiene Factura_Anterior, THE Vista_Comparación SHALL mostrar junto a cada Ítem_Factura un indicador de Variación_Precio respecto a la Factura_Anterior.
2. WHEN un Ítem_Factura no tiene equivalente en la Factura_Anterior, THE Vista_Comparación SHALL mostrar la etiqueta "Nuevo" junto al ítem.
3. THE Sistema_Comparación SHALL incluir los datos de variación de precio en el endpoint de detalle de factura (`/api/facturas/{id}/`) cuando exista una Factura_Anterior.
