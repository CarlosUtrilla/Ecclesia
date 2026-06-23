#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TAURI_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT="$(dirname "$TAURI_DIR")"
API_DIR="$PROJECT/api"
STAGING="$TAURI_DIR/src-tauri/sidecar-deps"

echo "[Bundle] Preparando dependencias del sidecar..."
echo "[Bundle] API: $API_DIR"

# Limpiar staging
rm -rf "$STAGING"
mkdir -p "$STAGING/node_modules"

# Build sidecar
echo "[Bundle] Compilando sidecar..."
(cd "$API_DIR" && node scripts/build-sidecar.mjs)

# Copiar sidecar.js
cp "$API_DIR/dist/sidecar.js" "$STAGING/"

# Función para copiar un módulo resolviendo symlinks
copy_mod() {
  local src="$1"
  local rel="$2"
  local dest="$STAGING/$rel"

  if [ -L "$src" ]; then
    local real=$(readlink -f "$src" 2>/dev/null || readlink "$src" 2>/dev/null)
    if [ -d "$real" ]; then
      mkdir -p "$(dirname "$dest")"
      cp -RL "$real" "$dest"
    fi
  elif [ -d "$src" ]; then
    mkdir -p "$(dirname "$dest")"
    cp -RL "$src" "$dest"
  fi
}

NM="$API_DIR/node_modules"

echo "[Bundle] Copiando better-sqlite3..."
copy_mod "$NM/better-sqlite3" "node_modules/better-sqlite3"
echo "[Bundle] Copiando sharp..."
copy_mod "$NM/sharp" "node_modules/sharp"
echo "[Bundle] Copiando @prisma..."
copy_mod "$NM/@prisma" "node_modules/@prisma"
echo "[Bundle] Copiando @ffmpeg-installer..."
copy_mod "$NM/@ffmpeg-installer" "node_modules/@ffmpeg-installer"

# Copiar Prisma schema y migraciones
echo "[Bundle] Copiando Prisma schema y migraciones..."
mkdir -p "$STAGING/prisma"
cp "$API_DIR/prisma/schema.prisma" "$STAGING/prisma/"
cp -r "$API_DIR/prisma/migrations" "$STAGING/prisma/"

# Copiar archivos de biblias
echo "[Bundle] Copiando archivos de biblias..."
DESKTOP="$PROJECT/desktop"
if [ -d "$DESKTOP/resources/bibles" ]; then
  mkdir -p "$STAGING/bibles"
  cp -r "$DESKTOP/resources/bibles/"*.ebbl "$STAGING/bibles/" 2>/dev/null || true
  echo "  Biblias copiadas: $(ls "$STAGING/bibles" 2>/dev/null | wc -l) archivos"
fi

# Copiar .env para credenciales
echo "[Bundle] Copiando .env..."
ROOT_ENV="$PROJECT/../.env"
if [ -f "$ROOT_ENV" ]; then
  cp "$ROOT_ENV" "$STAGING/"
  echo "  .env copiado"
fi

# Generar empty-prod.db fresca
echo "[Bundle] Generando empty-prod.db..."
rm -f "$STAGING/prisma/empty-prod.db" "$STAGING/prisma/empty-prod.db-journal"
(cd "$STAGING/prisma" && npx prisma migrate deploy --schema="$STAGING/prisma/schema.prisma" 2>&1 | tail -3) || {
  echo "[Bundle] ⚠ prisma migrate deploy falló, generando DB vacía manual..."
  sqlite3 "$STAGING/prisma/empty-prod.db" "CREATE TABLE IF NOT EXISTS _prisma_migrations (id TEXT PRIMARY KEY, checksum TEXT, finished_at TEXT, migration_name TEXT, logs TEXT, rolled_back_at TEXT, started_at TEXT, applied_steps_count INTEGER);" 2>/dev/null || true
}
# Renombrar el dev.db generado a empty-prod.db
if [ -f "$STAGING/prisma/dev.db" ]; then
  mv "$STAGING/prisma/dev.db" "$STAGING/prisma/empty-prod.db"
fi

echo "[Bundle] ✓ Dependencias preparadas en $STAGING"
