# Despliegue de Monay Solutions

Esta guia deja el sistema corriendo en el VPS con Docker, Caddy y certificados HTTPS automaticos.

## 1. Cloudflare

Los registros que ya tienes apuntan al VPS `186.64.122.196`. Dejaria asi:

| Nombre | Tipo | Contenido | Proxy |
| --- | --- | --- | --- |
| `monaysolutions.cl` | A | `186.64.122.196` | Proxied despues de validar HTTPS |
| `www` | CNAME | `monaysolutions.cl` | Proxied despues de validar HTTPS |
| `app` | A | `186.64.122.196` | Proxied despues de validar HTTPS |
| `api` | A | `186.64.122.196` | Proxied despues de validar HTTPS |
| `vps` | A | `186.64.122.196` | DNS only |

Primero puede quedar en **DNS only** para que Caddy emita el certificado. Cuando `https://app.monaysolutions.cl` y `https://api.monaysolutions.cl` ya respondan bien, cambia los registros web a **Proxied** y en Cloudflare usa **SSL/TLS: Full (strict)**.

`vps.monaysolutions.cl` debe quedar **DNS only** porque Cloudflare no proxya SSH en el plan gratuito.

## 2. Preparar el VPS

Entra por SSH usando el puerto que muestra Bluehost. En tu captura aparece el puerto `55546`.

```bash
ssh root@186.64.122.196 -p 55546
```

Actualiza el servidor e instala herramientas base:

```bash
apt update
apt upgrade -y
apt install -y ca-certificates curl git ufw
```

Instala Docker:

```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
docker compose version
```

Configura firewall sin cerrar tu SSH:

```bash
ufw allow 55546/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
ufw status
```

## 3. Subir el proyecto

Clona el repositorio en el servidor:

```bash
mkdir -p /opt/monaysolutions
cd /opt/monaysolutions
git clone TU_REPOSITORIO_GIT .
```

Crea el archivo real de produccion:

```bash
cp .env.production.example .env.production
openssl rand -base64 48
```

Edita `.env.production` y cambia al menos:

- `SECRET_KEY`
- `DB_PASSWORD`
- `ACME_EMAIL`
- `MISTRAL_API_KEY`
- variables SMTP si usaras envio real de correos

No subas `.env.production` al repositorio.

## 4. Levantar produccion

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
docker compose --env-file .env.production -f docker-compose.prod.yml ps
```

Crear el administrador:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml exec backend python manage.py createsuperuser
```

Si quieres cargar datos iniciales de demo/test en un ambiente no productivo:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml exec backend python -m scripts.init_db
```

Para produccion real, mejor crear clientes y usuarios desde admin o mediante un comando dedicado para onboarding.

## 5. Verificar

Abre:

- `https://app.monaysolutions.cl`
- `https://api.monaysolutions.cl/admin/`

Revisa logs si algo falla:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f backend
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f caddy
```

## 6. Actualizaciones

Cuando haya cambios nuevos:

```bash
cd /opt/monaysolutions
git pull
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
docker compose --env-file .env.production -f docker-compose.prod.yml ps
```

## 7. Backups

Respaldo de base de datos:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' > backup.sql
```

Respalda tambien los volumenes `media_volume` y `postgres_data` desde el VPS o con snapshots del proveedor.
