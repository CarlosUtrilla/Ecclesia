#!/bin/bash
set -e

# ─── Colores ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; RESET='\033[0m'

# ─── Versión actual ────────────────────────────────────────────────────────────
CURRENT=$(node -p "require('./package.json').version")

echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "  Ecclesia Release Script"
echo -e "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo ""
echo -e "  Rama actual:    ${CYAN}$(git branch --show-current)${RESET}"
echo -e "  Versión actual: ${CYAN}$CURRENT${RESET}"
echo -e "  Último commit:  $(git log --oneline -1)"
echo ""

# ─── Elegir modo de release ───────────────────────────────────────────────────
echo -e "  Modo de release:"
echo -e "    ${CYAN}1${RESET}) github (push de main + tag v*, dispara GitHub Actions)"
echo -e "    ${CYAN}2${RESET}) local  (build local mac/win, sin push ni tag remoto)"
echo ""
read -p "  Elige modo [1]: " RELEASE_MODE_CHOICE
RELEASE_MODE_CHOICE=${RELEASE_MODE_CHOICE:-1}

case $RELEASE_MODE_CHOICE in
  1) RELEASE_MODE="github" ;;
  2) RELEASE_MODE="local" ;;
  *)
    echo -e "${RED}✗ Modo inválido.${RESET}"
    exit 1
    ;;
esac

ensure_native_modules() {
  echo -e "  Reconstruyendo módulos nativos para Electron host..."
  (cd apps/desktop && npx @electron/rebuild -f) > /dev/null 2>&1 && \
    echo -e "  ${GREEN}✓ Módulos nativos reconstruidos${RESET}" || \
    echo -e "  ${YELLOW}⚠ falló @electron/rebuild, se usará install-app-deps${RESET}"
}

ensure_sharp_ready() {
  echo -e "  Verificando módulo nativo ${CYAN}sharp${RESET}..."

  if (cd apps/desktop && node -e "require('sharp')" >/dev/null 2>&1); then
    echo -e "  ${GREEN}✓ sharp cargado correctamente${RESET}"
    return
  fi

  echo -e "  ${YELLOW}⚠ sharp no pudo cargarse. Intentando reparación automática...${RESET}"

  cd apps/desktop && pnpm install --frozen-lockfile && pnpm rebuild sharp && cd "$OLDPWD"

  if (cd apps/desktop && node -e "require('sharp')" >/dev/null 2>&1); then
    echo -e "  ${GREEN}✓ sharp reparado correctamente${RESET}"
    return
  fi

  echo -e "${RED}✗ No se pudo cargar sharp.${RESET}"
  echo -e "${YELLOW}  Prueba manualmente desde apps/desktop/:${RESET} pnpm install --frozen-lockfile && pnpm rebuild sharp"
  exit 1
}

prepare_windows_sharp() {
  echo -e "  Preparando ${CYAN}sharp${RESET} para runtime ${CYAN}win32-x64${RESET}..."

  local tmp_dir
  tmp_dir=$(mktemp -d)

  (cd "$tmp_dir" \
    && npm init -y > /dev/null 2>&1 \
    && npm install --no-save --include=optional --os=win32 --cpu=x64 --legacy-peer-deps sharp) > /dev/null 2>&1

  local win_pkg="$tmp_dir/node_modules/@img/sharp-win32-x64"
  if [ -d "$win_pkg" ]; then
    mkdir -p apps/desktop/node_modules/@img
    cp -r "$win_pkg" apps/desktop/node_modules/@img/
    echo -e "  ${GREEN}✓ Binario Windows x64 de sharp instalado${RESET}"

    # Populate the root pnpm store so electron-builder's install-app-deps can resolve it
    local sharp_version
    sharp_version=$(node -p "require('./apps/desktop/node_modules/sharp/package.json').version" 2>/dev/null || echo "0.34.5")
    local pnpm_store_dir="node_modules/.pnpm/@img+sharp-win32-x64@${sharp_version}"
    if [ ! -d "$pnpm_store_dir/node_modules/@img/sharp-win32-x64" ]; then
      mkdir -p "$pnpm_store_dir/node_modules/@img"
      cp -r "$win_pkg" "$pnpm_store_dir/node_modules/@img/"
      echo -e "  ${GREEN}✓ Binario Windows x64 de sharp instalado en pnpm store${RESET}"
    fi
  else
    echo -e "  ${YELLOW}⚠ No se encontró binario Windows x64 de sharp${RESET}"
  fi

  rm -rf "$tmp_dir"

  npx electron-builder install-app-deps --platform=win32 --arch=x64

  # Verificar que better-sqlite3 quedó como PE32+ (Windows)
  local bsqlite3="apps/desktop/node_modules/better-sqlite3/build/Release/better_sqlite3.node"
  if [ -f "$bsqlite3" ]; then
    local bsqlite3_type
    bsqlite3_type=$(file "$bsqlite3")
    if echo "$bsqlite3_type" | grep -q "PE32+"; then
      echo -e "  ${GREEN}✓ better-sqlite3 compilado para Windows x64${RESET}"
    else
      echo -e "  ${YELLOW}⚠ better-sqlite3 no es PE32+, forzando rebuild con runtime electron...${RESET}"
      local electron_ver
      electron_ver=$(node -p "require('./apps/desktop/node_modules/electron/package.json').version" 2>/dev/null || echo "35.0.0")
      (cd apps/desktop && node -e "
        const { execSync } = require('child_process');
        const pkgDir = require('path').dirname(require.resolve('better-sqlite3/package.json'));
        console.log('  -> prebuild-install --runtime=electron --target=$electron_ver --platform=win32 --arch=x64');
        execSync('npx prebuild-install --runtime=electron --target=$electron_ver --platform=win32 --arch=x64', {
          cwd: pkgDir,
          stdio: 'inherit',
          timeout: 120000
        });
      ") 2>&1 || {
        echo -e "  ${YELLOW}⚠ falló prebuild electron, intentando con --runtime=node --target=22.0.0...${RESET}"
        (cd apps/desktop && node -e "
          const { execSync } = require('child_process');
          const pkgDir = require('path').dirname(require.resolve('better-sqlite3/package.json'));
          execSync('npx prebuild-install --runtime=node --target=22.0.0 --platform=win32 --arch=x64', {
            cwd: pkgDir,
            stdio: 'inherit',
            timeout: 120000
          });
        ") 2>&1 || true
      }
      bsqlite3_type=$(file "$bsqlite3" 2>/dev/null)
      echo "$bsqlite3_type" | grep -q "PE32+" && \
        echo -e "  ${GREEN}✓ better-sqlite3 forzado a Windows x64${RESET}" || \
        echo -e "  ${YELLOW}⚠ better-sqlite3 podría no ser Windows${RESET}"
    fi
  else
    echo -e "  ${YELLOW}⚠ No se encontró better-sqlite3.node${RESET}"
  fi

  echo -e "  ${GREEN}✓ Módulos nativos preparados para win32-x64${RESET}"
}

ensure_prisma_client_targets() {
  echo -e "  Generando Prisma Client con binary targets multi-plataforma..."
  npx prisma generate --schema apps/api/prisma/schema.prisma
  echo -e "  ${GREEN}✓ Prisma Client generado${RESET}"

  echo -e "  Copiando .prisma/client a ${CYAN}apps/desktop/node_modules/${RESET}..."
  rm -rf apps/desktop/node_modules/.prisma
  cp -r node_modules/.prisma apps/desktop/node_modules/.prisma
  echo -e "  ${GREEN}✓ .prisma/client copiado a apps/desktop${RESET}"

  echo -e "  Reemplazando symlink de @prisma/client con copia real..."
  if [ ! -e apps/desktop/node_modules/@prisma/client ]; then
    echo -e "  ${YELLOW}⚠ Symlink faltante, reinstalando...${RESET}"
    pnpm install --frozen-lockfile > /dev/null 2>&1
  fi
  (cd apps/desktop/node_modules/@prisma \
    && client_target="$(readlink client)" \
    && rm -rf client \
    && cp -r "$client_target" ./client)
  echo -e "  ${GREEN}✓ @prisma/client copiado como directorio real${RESET}"
}

clean_dist_dir() {
  echo -e "  Limpiando ${CYAN}apps/desktop/dist/${RESET} para evitar artefactos antiguos..."
  rm -rf apps/desktop/dist
  mkdir -p apps/desktop/dist
  echo -e "  ${GREEN}✓ apps/desktop/dist/ limpio${RESET}"
}

ensure_gh_ready() {
  if ! command -v gh >/dev/null 2>&1; then
    echo -e "${RED}✗ GitHub CLI (gh) no está instalado.${RESET}"
    echo -e "${YELLOW}  Instálalo con:${RESET} brew install gh"
    exit 1
  fi

  if ! gh auth status >/dev/null 2>&1; then
    echo -e "${RED}✗ GitHub CLI no está autenticado.${RESET}"
    echo -e "${YELLOW}  Ejecuta:${RESET} gh auth login"
    exit 1
  fi
}

publish_local_release() {
  ensure_gh_ready

  local release_files=()
  while IFS= read -r file; do
    release_files+=("$file")
  done < <(find apps/desktop/dist -maxdepth 1 -type f)

  if [ ${#release_files[@]} -eq 0 ]; then
    echo -e "${RED}✗ No se encontraron artefactos en apps/desktop/dist/.${RESET}"
    exit 1
  fi

  if ! git ls-remote --tags origin "$TAG" | grep -q "$TAG"; then
    echo -e "  ${YELLOW}⚠ Tag ${CYAN}$TAG${RESET}${YELLOW} no existe en remoto. Pusheando tag...${RESET}"
    git push origin "$TAG"
  fi

  echo ""
  echo -e "${YELLOW}⚠ Subir un release con tag ${TAG} puede crear el tag remoto y disparar el workflow de tags (${RESET}${YELLOW}v*${RESET}${YELLOW}) en GitHub.${RESET}"
  read -p "  ¿Continuar con subida a GitHub Release? (s/N): " CONFIRM_RELEASE_UPLOAD
  if [[ "$CONFIRM_RELEASE_UPLOAD" != "s" && "$CONFIRM_RELEASE_UPLOAD" != "S" ]]; then
    echo -e "  ${YELLOW}Subida a GitHub omitida.${RESET}"
    return
  fi

  if gh release view "$TAG" >/dev/null 2>&1; then
    echo -e "  -> Subiendo artefactos a release existente ${CYAN}$TAG${RESET}"
    gh release upload "$TAG" "${release_files[@]}" --clobber
  else
    echo -e "  -> Creando release ${CYAN}$TAG${RESET} y subiendo artefactos"
    gh release create "$TAG" "${release_files[@]}" --title "$TAG" --notes "Release compilado localmente"
  fi

  echo -e "  ${GREEN}✓ Artefactos subidos a GitHub Release${RESET}"
}

# ─── Verificar rama main ───────────────────────────────────────────────────────
BRANCH=$(git branch --show-current)
if [ "$BRANCH" != "main" ]; then
  echo -e "${RED}✗ Debes estar en la rama 'main' para hacer un release.${RESET}"
  exit 1
fi

# ─── Verificar que no hay cambios sin commitear ────────────────────────────────
if [ -n "$(git status --porcelain)" ]; then
  echo -e "${YELLOW}⚠ Tienes cambios sin commitear:${RESET}"
  git status --short
  echo ""
  read -p "¿Continuar de todas formas? (s/N): " CONFIRM
  if [[ "$CONFIRM" != "s" && "$CONFIRM" != "S" ]]; then
    echo -e "${RED}Cancelado.${RESET}"
    exit 1
  fi
fi

# ─── Elegir tipo de release ────────────────────────────────────────────────────
echo -e "  Tipo de release:"
echo -e "    ${CYAN}1${RESET}) patch            (0.1.0 → 0.1.1)"
echo -e "    ${CYAN}2${RESET}) minor            (0.1.0 → 0.2.0)"
echo -e "    ${CYAN}3${RESET}) mayor stable     (0.1.0 → 1.0.0)"
echo ""
read -p "  Elige [1]: " CHOICE
CHOICE=${CHOICE:-1}

case $CHOICE in
  1) BUMP_TYPE="patch"; BUMP_ARGS="" ;;
  2) BUMP_TYPE="minor"; BUMP_ARGS="" ;;
  3) BUMP_TYPE="major"; BUMP_ARGS="" ;;
  *)
    echo -e "${RED}✗ Opción inválida.${RESET}"
    exit 1
    ;;
esac

# ─── Bumear versión ────────────────────────────────────────────────────────────
echo ""
echo -e "  Bumeando versión (${BUMP_TYPE})..."
npm version $BUMP_TYPE $BUMP_ARGS --no-git-tag-version > /dev/null

NEW=$(node -p "require('./package.json').version")
echo -e "  ${GREEN}$CURRENT → $NEW${RESET}"

echo -e "  Sincronizando versión en ${CYAN}apps/desktop/package.json${RESET}..."
node -e "const p=require('./apps/desktop/package.json');p.version='$NEW';require('fs').writeFileSync('apps/desktop/package.json',JSON.stringify(p,null,2)+'\n')"

# ─── Commitear el bump de versión ─────────────────────────────────────────────
git add package.json apps/desktop/package.json
git commit -m "chore: release v$NEW"

# ─── Crear tag ────────────────────────────────────────────────────────────────
TAG="v$NEW"

# Si el tag ya existe localmente, borrarlo
if git tag | grep -q "^$TAG$"; then
  echo -e "  ${YELLOW}⚠ Tag $TAG ya existe localmente, reemplazando...${RESET}"
  git tag -d "$TAG" > /dev/null
fi

git tag "$TAG"

# ─── Publicar según modo ──────────────────────────────────────────────────────
echo ""

if [ "$RELEASE_MODE" = "github" ]; then
  echo -e "  Pusheando main y tag ${CYAN}$TAG${RESET}..."
  git push origin main
  git push origin "$TAG"

  echo ""
  echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo -e "  ✓ Release $TAG publicado"
  echo -e "  GitHub Actions está buildeando Mac y Windows."
  echo -e "  Revisa el progreso en:"
  echo -e "  https://github.com/CarlosUtrilla/Ecclesia/actions"
  echo -e "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
  echo ""
  exit 0
fi

echo -e "  Ejecutando build local (sin publicar en GitHub Actions)..."

ensure_native_modules
ensure_sharp_ready
ensure_prisma_client_targets
clean_dist_dir

echo -e "  -> Build base (electron-vite) en host macOS"
pnpm build:ci

prepare_windows_sharp

echo -e "  -> Empaquetando Windows x64"

# Los symlinks de workspace packages (@ecclesia/api, @ecclesia/queries)
# están como devDependencies (ya no se incluyen en producción),
# pero el tree walker aún puede seguirlos si existen. Se eliminan
# como safety net para evitar que electron-builder tropiece.
rm -rf apps/desktop/node_modules/@ecclesia

cd apps/desktop && npx electron-builder --win --x64 --publish never && cd "$OLDPWD"

echo -e "  -> Restaurando dependencias del host (macOS)"
pnpm install --frozen-lockfile
ensure_native_modules
ensure_sharp_ready

echo ""
read -p "  ¿Compilar también para macOS ARM64? (s/N): " SHOULD_BUILD_MACOS_ARM64
if [[ "$SHOULD_BUILD_MACOS_ARM64" == "s" || "$SHOULD_BUILD_MACOS_ARM64" == "S" ]]; then
  echo -e "  -> Reconstruyendo módulos nativos para macOS ARM64..."
  (cd apps/desktop && npx electron-builder install-app-deps --platform=darwin --arch=arm64 2>&1 | tail -3)
  echo -e "  ${GREEN}✓ Módulos nativos preparados para macOS ARM64${RESET}"

  echo -e "  -> Eliminando symlinks de workspace para electron-builder..."
  rm -rf apps/desktop/node_modules/@ecclesia

  echo -e "  -> Empaquetando macOS ARM64"
  cd apps/desktop && npx electron-builder --config electron-builder.yml --mac --arm64 --publish never && cd "$OLDPWD"
  echo -e "  ${GREEN}✓ macOS ARM64 compilado${RESET}"
fi

echo ""
read -p "  ¿Subir artefactos de apps/desktop/dist/ a GitHub Release con gh? (s/N): " SHOULD_UPLOAD_RELEASE
if [[ "$SHOULD_UPLOAD_RELEASE" == "s" || "$SHOULD_UPLOAD_RELEASE" == "S" ]]; then
  publish_local_release
fi

# ─── Listo ────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "  ✓ Release local $TAG compilado"
echo -e "  No se hizo push a origin ni se disparó CI."
echo -e "  Artefactos disponibles en apps/desktop/dist/"
echo -e "  Dependencias del host restauradas para continuar con desarrollo local."
echo -e "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo ""
