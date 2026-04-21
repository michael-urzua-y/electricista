#!/bin/sh
set -e

echo "Esperando a PostgreSQL en $DB_HOST:$DB_PORT..."
until pg_isready -h "$DB_HOST" -p "${DB_PORT:-5432}" -U "$DB_USER" > /dev/null 2>&1; do
  echo "PostgreSQL no disponible aún - esperando 2 segundos..."
  sleep 2
done

echo "PostgreSQL disponible! Iniciando aplicación..."
exec "$@"
