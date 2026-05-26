# Dockerfile para el backend Django
FROM python:3.11-slim

# Instalar dependencias del sistema
RUN apt-get update && apt-get install -y \
    gcc \
    postgresql-client \
    libpq-dev \
    tesseract-ocr \
    tesseract-ocr-spa \
    poppler-utils \
    libmagic1 \
    curl \
    libpango-1.0-0 \
    libpangoft2-1.0-0 \
    libcairo2 \
    libgdk-pixbuf-xlib-2.0-0 \
    libffi-dev \
    shared-mime-info \
    && rm -rf /var/lib/apt/lists/*

# Establecer directorio de trabajo
WORKDIR /app

# Instalar dependencias de Python
ARG INSTALL_DEV_DEPS=false
COPY requirements.txt requirements-dev.txt ./
RUN pip install --no-cache-dir -r requirements.txt && \
    if [ "$INSTALL_DEV_DEPS" = "true" ]; then \
        pip install --no-cache-dir -r requirements-dev.txt; \
    fi

# Copiar proyecto
COPY . .

# Crear directorios necesarios y asignar permisos
RUN mkdir -p /app/static /app/media && \
    adduser --disabled-password --gecos '' appuser && \
    chown -R appuser:appuser /app

USER appuser

EXPOSE 8000

CMD sh -c "python manage.py migrate && python -m scripts.init_db && python manage.py collectstatic --noinput && gunicorn monaysolutions.wsgi:application --bind 0.0.0.0:8000"
