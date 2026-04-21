# Electricista Pro - Dashboard de Gestión de Materiales

Dashboard moderno y responsivo para que un electricista gestione sus compras de materiales, suba facturas (PDF/imágenes) y compare precios entre proveedores.

![Electricista Pro](https://img.shields.io/badge/Electricista-Pro-blue)

---

## 📋 Características

- **Autenticación segura**: JWT tokens con Django REST Framework
- **Subida de facturas**: Soporta PDF e imágenes (JPG, PNG)
- **OCR + IA**: Extrae automáticamente productos, precios y totales
- **Comparación de precios**: Visualiza precios por proveedor
- **Dashboard moderno**: React + Vite + TailwindCSS con gráficos interactivos
- **Base de datos**: PostgreSQL

---

## 🏗️ Arquitectura

```
electricista/
├── backend/          # Django REST API
│   ├── products/     # Productos, Proveedores, Historial precios
│   └── invoices/     # Facturas, Ítems, OCR
├── frontend/         # React + Vite + Tailwind
├── docker-compose.yml
├── Dockerfile
└── requirements.txt
```

---

## 🚀 Instalación Rápida

### Opción 1: Docker (Recomendado)

```bash
# 1. Clonar/copiar proyecto
cd electricista

# 2. Configurar variables de entorno
cp .env.example .env
# Editar .env y agregar tu API key de Mistral

# 3. Levantar todos los servicios
docker-compose up -d

# 4. Ejecutar migraciones y crear superusuario
docker-compose exec backend python manage.py migrate
docker-compose exec backend python manage.py createsuperuser

# 5. Acceder
# - Frontend: http://localhost:5173
# - Backend API: http://localhost:8000/api/
# - Admin Django: http://localhost:8000/admin/
```

### Opción 2: Instalación Manual

```bash
# Backend
cd electricista
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Configurar base de datos PostgreSQL
# Editar settings.py o variables de entorno

# Migraciones
python manage.py migrate
python manage.py createsuperuser
python manage.py collectstatic

# Ejecutar servidor
python manage.py runserver

# Frontend (en terminal separada)
cd frontend
npm install
npm run dev
```

---

## ⚙️ Configuración

### Variables de Entorno

```bash
# .env
SECRET_KEY=tu-clave-secreta-generada
DEBUG=True
DB_NAME=electricista
DB_USER=postgres
DB_PASSWORD=postgres
DB_HOST=localhost
DB_PORT=5432

# APIs
MISTRAL_API_KEY=sk-...  # Obtener en https://console.mistral.ai
```

### API Keys Requeridas

1. **Mistral AI** (gratis): Para el parseo de facturas
   - Regístrate en https://console.mistral.ai
   - Crea una API Key
   - Agrégalo en `.env`

---

## 📱 Uso del Dashboard

### Login
- Usuario demo: `demo` / `demo123` (o crear con createsuperuser)
- Acceso al admin: http://localhost:8000/admin/

### Subir Factura

1. Ir a **Facturas** → **Subir Factura**
2. Seleccionar archivo (PDF, JPG, PNG)
3. Ingresar fecha de emisión
4. El sistema procesará:
   - Extraer texto con OCR
   - Parsear con IA usando Mistral
   - Identificar productos, precios y totales
   - Guardar en base de datos

### Gráficos

- **Dashboard Principal**: Gasto mensual, distribución por proveedor
- **Comparación de Precios**: Historial y alertas de subidas/bajadas
- **Filtros**: Ver solo subidas, bajadas o todos

---

## 🔧 APIs Disponibles

### Autenticación
- `POST /api/token/` - Obtener JWT token
- `POST /api/token/refresh/` - Refrescar token
- `POST /api/token/verify/` - Verificar token

### Facturas
- `GET /api/facturas/` - Listar facturas del usuario
- `POST /api/facturas/` - Subir factura
- `GET /api/facturas/{id}/` - Detalle con ítems
- `GET /api/facturas/stats/` - Estadísticas

### Productos
- `GET /api/productos/` - Listar productos
- `POST /api/productos/` - Crear producto
- `PUT /api/productos/{id}/` - Actualizar
- `GET /api/productos/{id}/price_history/` - Historial precios

---

## 🛠️ Tecnologías Utilizadas

### Backend
- **Django 4.2** - Framework web
- **Django REST Framework** - API REST
- **PostgreSQL** - Base de datos
- **Tesseract OCR** - Extracción de texto
- **Mistral AI** - Parseo inteligente de facturas

### Frontend
- **React 18** - UI library
- **Vite** - Build tool
- **TailwindCSS** - Estilos
- **Recharts** - Gráficos
- **Axios** - HTTP client
- **React Router** - Navegación

---

## 📁 Estructura de Archivos

```
electricista/
├── electricista/          # Configuración Django
│   ├── settings.py
│   └── urls.py
├── products/              # Gestión de productos y proveedores
│   ├── models.py
│   ├── views.py
│   ├── serializers.py
│   └── admin.py
├── invoices/              # Gestión de facturas y OCR
│   ├── models.py
│   ├── views.py
│   ├── serializers.py
│   ├── ocr.py            # OCR processor
│   ├── ai_parser.py      # Mistral parser
│   └── signals.py        # Auto-trigger
├── frontend/
│   ├── src/
│   │   ├── pages/        # Dashboard, Invoices, Products, etc.
│   │   ├── components/   # Componentes reutilizables
│   │   ├── contexts/     # AuthContext
│   │   ├── services/     # API client
│   │   └── layouts/      # MainLayout
│   └── package.json
├── docker-compose.yml
├── Dockerfile
├── requirements.txt
└── README.md
```

---

## 🧪 Testing

```bash
# Backend tests
python manage.py test

# Frontend tests (pendientes)
npm test
```

---

## 📦 Dependencias

Ver `requirements.txt` y `frontend/package.json` para lista completa.

** Principales **:
- Django 4.2
- DRF 3.14
- React 18
- TailwindCSS 3.3
- Celery 5.3
- PostgreSQL + Redis

---

## 📝 Notas de Implementación

### OCR
- Usa **Tesseract** con language pack `spa` (español)
- Para PDFs, convierte páginas a imágenes con `pdf2image`
- Fallback: PyPDF2 extrae texto nativo

### Parseo de Facturas
- Envía texto OCR a **Mistral AI** (modelo `mistral-small`)
- Prompt estructurado extrae: proveedor, fecha, número, ítems, totales
- Fallback: Parser básico con regex si API falla

### Scraping
- Selectores CSS por sitio
- Headers con User-Agent real
- Timeout y retry configurados
- Solo sitios chilenos de retail

### Alerta de Precios
- Se genera cuando variación ≥ 10%
- Registra historial de precios por proveedor
- Notificación en dashboard con color (rojo/verde)

---

## 🔮 Futuras Mejoras

- [ ] Reconocimiento de productos con vision AI (GPT-4 Vision)
- [ ] Notificaciones push/email de alertas
- [ ] Importación masiva desde CSV
- [ ] Reportes PDF de gastos
- [ ] Integración con bancos (estados de cuenta)
- [ ] App móvil (React Native)
- [ ] Multi-idioma (español/inglés)
- [ ] API pública para integraciones

---

## 👨‍💻 Autor

**Michael Urzúa**
- Electricista + Desarrollador Full Stack
- Este proyecto nace de una necesidad real: gestionar materiales y controlar precios

---

## 📄 Licencia

MIT License - Libre uso y modificación.

---

## ⚡ ¿Preguntas?

Revisa la documentación o crea un issue en el repositorio.

¡Gracias por usar Electricista Pro!
