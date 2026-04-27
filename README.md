# Electricista Pro — Dashboard de Gestión de Materiales

Dashboard full-stack para que un electricista gestione sus compras de materiales: sube facturas (PDF/imágenes), extrae ítems automáticamente con OCR + IA, compara precios entre proveedores y calcula márgenes de ganancia.

![Python](https://img.shields.io/badge/Python-3.11-blue)
![Django](https://img.shields.io/badge/Django-4.2-green)
![React](https://img.shields.io/badge/React-18-61dafb)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.3-38bdf8)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-336791)

---

## Características

- **Autenticación JWT** — Login seguro con tokens de acceso y refresco (SimpleJWT)
- **Subida de facturas** — Soporta PDF e imágenes (JPG, PNG)
- **OCR + IA** — Extrae texto con Tesseract/PyMuPDF y parsea con Mistral AI (`mistral-large-latest`)
- **Fuzzy matching de productos** — Evita duplicados usando similitud de texto (thefuzz, umbral 92%)
- **Historial de precios** — Registra cada precio por producto y proveedor automáticamente
- **Comparación de precios** — 4 modos: automática, manual, resumen mensual y entre proveedores
- **Márgenes de ganancia** — Configurable por factura y por ítem individual
- **Dashboard interactivo** — Gráficos de gasto mensual y distribución por proveedor (Recharts)
- **Procesamiento asíncrono** — Celery + Redis para no bloquear al usuario al subir facturas
- **Caché de proveedores** — Redis cache con invalidación automática
- **Zona horaria Chile** — `America/Santiago`, moneda CLP

---

## Arquitectura

```
electricista/                  ← raíz del proyecto Django
├── electricista/              ← configuración del proyecto
│   ├── settings.py            ← config DB, JWT, Celery, Redis, CORS
│   ├── urls.py                ← router principal + endpoints JWT
│   ├── celery.py              ← configuración de Celery
│   └── wsgi.py / asgi.py
│
├── products/                  ← app de productos y proveedores
│   ├── models.py              ← Provider, Product, PriceHistory, PriceAlert
│   ├── views.py               ← ProviderViewSet, ProductViewSet, ComparacionViewSet
│   └── serializers.py
│
├── invoices/                  ← app de facturas
│   ├── models.py              ← Invoice, InvoiceItem
│   ├── views.py               ← FacturaViewSet (CRUD + 4 endpoints de comparación)
│   ├── services.py            ← process_invoice() — orquesta OCR → IA → DB
│   ├── ocr.py                 ← OCRProcessor (PyMuPDF → Tesseract → PyPDF2)
│   ├── ai_parser.py           ← InvoiceAIParser (Mistral API + parser básico regex)
│   ├── comparison.py          ← lógica pura de comparación de precios
│   ├── tasks.py               ← tarea Celery: process_invoice_task
│   └── signals.py
│
├── api_views.py               ← CurrentUserView, DailyTotalsView
│
├── frontend/                  ← SPA React + Vite
│   └── src/
│       ├── pages/             ← Dashboard, Invoices, Products, Providers,
│       │                         PriceComparison, Profile, Login
│       ├── components/        ← ComparisonTable, PriceVariationBadge,
│       │                         InvoiceSearchInput, Pagination
│       ├── contexts/          ← AuthContext (JWT + localStorage)
│       ├── services/          ← api.js (axios + interceptores)
│       └── layouts/           ← Layout principal con sidebar
│
├── scripts/                   ← scripts de inicialización y utilidades
├── docker-compose.yml         ← postgres, redis, backend, celery, frontend
├── Dockerfile                 ← imagen Python 3.11 + Tesseract + poppler
└── requirements.txt
```

---

## Stack tecnológico

### Backend
| Tecnología | Versión | Uso |
|---|---|---|
| Django | 4.2 | Framework web |
| Django REST Framework | 3.14 | API REST |
| SimpleJWT | 5.3 | Autenticación JWT |
| PostgreSQL | 15 | Base de datos principal |
| Redis | 7 | Broker Celery + caché |
| Celery | 5.3 | Procesamiento asíncrono de facturas |
| PyMuPDF (fitz) | 1.23 | Extracción de texto nativo en PDFs |
| Tesseract OCR | — | OCR para PDFs escaneados e imágenes |
| Mistral AI | mistral-large-latest | Parseo inteligente de facturas |
| thefuzz | 0.20 | Fuzzy matching de nombres de productos |
| django-redis | 5.4 | Caché de proveedores |
| whitenoise | 6.6 | Servir archivos estáticos en producción |
| gunicorn | 21.2 | Servidor WSGI en producción |

### Frontend
| Tecnología | Versión | Uso |
|---|---|---|
| React | 18 | UI library |
| Vite | 5 | Build tool y dev server |
| TailwindCSS | 3.3 | Estilos utilitarios |
| Recharts | 2.10 | Gráficos de barras interactivos |
| Axios | 1.6 | Cliente HTTP con interceptores JWT |
| React Router | 6.20 | Navegación SPA |
| Heroicons | 2.0 | Iconografía |
| date-fns | 2.30 | Formateo de fechas en español |

---

## Modelos de datos

### `products` app
- **Provider** — nombre, sitio web, categoría, logo, activo/inactivo
- **Product** — nombre, marca, modelo, categoría, unidad, proveedor FK
- **PriceHistory** — precio por producto + proveedor + fecha (se crea automáticamente al procesar facturas)
- **PriceAlert** — alerta de subida/bajada de precio con variación porcentual

### `invoices` app
- **Invoice** — archivo, proveedor, fecha emisión, total, subtotal, IVA, estado (`pending → processing → completed/failed`), margen general, texto OCR
- **InvoiceItem** — descripción, cantidad, precio unitario, precio total, margen individual, precio de venta calculado, variación respecto a factura anterior

---

## API REST

### Autenticación
```
POST /api/token/           → obtener access + refresh token
POST /api/token/refresh/   → refrescar access token
POST /api/token/verify/    → verificar token
GET  /api/users/me/        → datos del usuario autenticado
```

### Proveedores
```
GET    /api/proveedores/              → listar (con caché Redis)
POST   /api/proveedores/              → crear
GET    /api/proveedores/{id}/         → detalle
PATCH  /api/proveedores/{id}/         → actualizar
DELETE /api/proveedores/{id}/         → eliminar
POST   /api/proveedores/{id}/toggle_active/  → activar/desactivar
```

### Productos
```
GET  /api/productos/                        → listar (filtros: provider, category)
GET  /api/productos/{id}/price_history/     → historial de precios
GET  /api/productos/{id}/alerts/            → alertas de precio
```

### Facturas
```
GET    /api/facturas/                          → listar (filtros: provider, status)
POST   /api/facturas/                          → subir factura (multipart/form-data)
GET    /api/facturas/{id}/                     → detalle con ítems y variaciones
PATCH  /api/facturas/{id}/update-item/         → actualizar margen de un ítem
GET    /api/facturas/stats/                    → estadísticas del usuario
GET    /api/facturas/diarios/?year=&month=     → totales diarios del mes
```

### Comparación de precios
```
GET /api/facturas/{id}/comparar-anterior/      → vs factura anterior del mismo proveedor
GET /api/facturas/comparar-manual/?factura_base=&factura_comparar=  → comparación manual
GET /api/facturas/comparar-mes/?proveedor_id=&year=&month=          → resumen mensual
GET /api/facturas/comparar-proveedores/        → mismo producto entre distintos proveedores
```

### Comparación de tabla de precios
```
GET /api/comparacion/   → tabla de productos con precio más barato/caro por proveedor
```

---

## Flujo de procesamiento de facturas

```
Usuario sube archivo (PDF/JPG/PNG)
        ↓
Invoice guardada en estado "pending"
        ↓
Celery task: process_invoice_task(invoice_id)
        ↓
OCRProcessor.extract_text()
  ├── PDF con texto nativo → PyMuPDF (fitz)
  ├── PDF escaneado        → pdf2image + Tesseract (spa)
  └── Imagen              → Tesseract (spa)
        ↓
InvoiceAIParser.parse(ocr_text)
  ├── Mistral API (mistral-large-latest, temperature=0)
  └── Fallback: parser regex columnar para facturas chilenas
        ↓
_process_items(): por cada ítem parseado
  ├── _find_matching_product(): búsqueda exacta → fuzzy (umbral 92%)
  ├── Si no existe → Product.objects.create()
  ├── InvoiceItem.objects.create()
  └── PriceHistory.objects.create()
        ↓
Invoice.total_amount calculado, status = "completed"
```

---

## Instalación

### Opción 1: Docker (recomendado)

```bash
# 1. Clonar el repositorio
git clone <repo-url>
cd electricista

# 2. Configurar variables de entorno
cp .env.example .env
# Editar .env y agregar MISTRAL_API_KEY y SECRET_KEY

# 3. Levantar todos los servicios
docker-compose up -d

# 4. Crear superusuario (opcional)
docker-compose exec backend python manage.py createsuperuser

# 5. Acceder
#    Frontend:   http://localhost:5173
#    Backend API: http://localhost:8000/api/
#    Admin Django: http://localhost:8000/admin/
```

Los servicios que levanta Docker:
- `postgres` — PostgreSQL 15 en puerto 5433
- `redis` — Redis 7 en puerto 6379
- `backend` — Django + Gunicorn en puerto 8000 (ejecuta migraciones y `scripts/init_db.py` al iniciar)
- `celery` — Worker Celery para procesamiento de facturas
- `frontend` — Node 18 + Vite en puerto 5173

### Opción 2: Instalación manual

```bash
# Backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Instalar Tesseract con soporte español
# macOS:  brew install tesseract tesseract-lang
# Ubuntu: apt install tesseract-ocr tesseract-ocr-spa poppler-utils

# Configurar .env (ver sección Variables de entorno)
cp .env.example .env

# Migraciones y datos iniciales
python manage.py migrate
python -m scripts.init_db
python manage.py createsuperuser
python manage.py collectstatic

# Iniciar backend
python manage.py runserver

# En otra terminal: worker Celery
celery -A electricista worker -l INFO

# Frontend
cd frontend
npm install
npm run dev
```

---

## Variables de entorno

```env
# Django
SECRET_KEY=tu-clave-secreta-larga-y-aleatoria
DEBUG=True

# Base de datos PostgreSQL
DB_NAME=electricista
DB_USER=postgres
DB_PASSWORD=postgres
DB_HOST=localhost
DB_PORT=5432

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Mistral AI (requerido para parseo de facturas)
# Obtener en: https://console.mistral.ai
MISTRAL_API_KEY=sk-...

# CORS (frontend URL)
CORS_ALLOWED_ORIGINS=http://localhost:5173

# Hosts permitidos
ALLOWED_HOSTS=localhost,127.0.0.1
```

---

## Uso del dashboard

### Subir una factura
1. Ir a **Facturas** → **Subir Factura**
2. Seleccionar archivo PDF o imagen
3. Completar fecha de emisión y proveedor (obligatorios)
4. Opcionalmente ingresar número de factura y margen de ganancia general
5. El sistema procesa en segundo plano: OCR → IA → ítems → historial de precios
6. La tabla se actualiza automáticamente con polling cada 3 segundos mientras hay facturas en proceso

### Ver detalle de factura
- Click en el ícono de ojo en la tabla de facturas
- Muestra todos los ítems con precio unitario, total, margen editable y precio de venta
- La columna **Variación** compara cada producto con la factura anterior del mismo proveedor
- El margen de cada ítem es editable directamente en la tabla

### Comparación de precios
La sección **Comparación de Precios** tiene 4 pestañas:
- **Comparación Automática** — selecciona una factura y compara automáticamente con la anterior del mismo proveedor
- **Comparación Manual** — elige dos facturas específicas del mismo proveedor para comparar
- **Resumen Mensual** — estadísticas de precios (mín, máx, promedio, variación) por proveedor y mes
- **Entre Proveedores** — productos que aparecen en facturas de 2+ proveedores, con el más barato destacado

### Dashboard
- Selector de período (mes/año) con validación de períodos con datos
- Gráfico de gasto mensual (click en una barra abre detalle diario)
- Gráfico de distribución por proveedor
- Configuración de actualización automática (5s, 10s, 30s, 1min o manual)

---

## Testing

```bash
# Backend
python manage.py test

# Frontend (lint)
cd frontend
npm run lint
```

---

## Futuras mejoras

- [ ] Notificaciones push/email cuando el precio sube más del umbral configurado
- [ ] Importación masiva de facturas desde CSV
- [ ] Reportes PDF de gastos mensuales
- [ ] Reconocimiento de productos con visión IA (GPT-4 Vision)
- [ ] App móvil (React Native)
- [ ] Multi-usuario con roles (admin, operador, solo lectura)
- [ ] Integración con SII (Servicio de Impuestos Internos de Chile)

---

## Autor

**Michael Urzúa** — Electricista + Desarrollador Full Stack  
Proyecto nacido de una necesidad real: controlar los precios de materiales y calcular márgenes de ganancia directamente desde las facturas de compra.

---

## Licencia

MIT License — libre uso y modificación.
