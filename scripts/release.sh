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

ensure_sharp_ready() {
  echo -e "  Verificando módulo nativo ${CYAN}sharp${RESET}..."

  if node -e "require('sharp')" >/dev/null 2>&1; then
    echo -e "  ${GREEN}✓ sharp cargado correctamente${RESET}"
    return
  fi

  echo -e "  ${YELLOW}⚠ sharp no pudo cargarse. Intentando reparación automática...${RESET}"

  yarn install --frozen-lockfile
  npm rebuild sharp
  npx electron-builder install-app-deps

  if node -e "require('sharp')" >/dev/null 2>&1; then
    echo -e "  ${GREEN}✓ sharp reparado correctamente${RESET}"
    return
  fi

  echo -e "${RED}✗ No se pudo cargar sharp después de la reparación automática.${RESET}"
  echo -e "${YELLOW}  Ejecuta manualmente:${RESET} yarn install --frozen-lockfile && npm rebuild sharp && npx electron-builder install-app-deps"
  exit 1
}

prepare_windows_sharp() {
  echo -e "  Preparando ${CYAN}sharp${RESET} para runtime ${CYAN}win32-x64${RESET}..."

  npm install --no-save --include=optional --os=win32 --cpu=x64 --legacy-peer-deps sharp
  npx electron-builder install-app-deps --platform=win32 --arch=x64

  echo -e "  ${GREEN}✓ sharp preparado para win32-x64${RESET}"
}

ensure_prisma_client_targets() {
  echo -e "  Generando Prisma Client con binary targets multi-plataforma..."
  npx prisma generate --schema prisma/schema.prisma
  echo -e "  ${GREEN}✓ Prisma Client generado${RESET}"
}

clean_dist_dir() {
  echo -e "  Limpiando ${CYAN}dist/${RESET} para evitar artefactos antiguos..."
  rm -rf dist
  mkdir -p dist
  echo -e "  ${GREEN}✓ dist/ limpio${RESET}"
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

  if ! ls dist/* >/dev/null 2>&1; then
    echo -e "${RED}✗ No se encontraron artefactos en dist/.${RESET}"
    exit 1
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
    gh release upload "$TAG" dist/* --clobber
  else
    echo -e "  -> Creando release ${CYAN}$TAG${RESET} y subiendo artefactos"
    gh release create "$TAG" dist/* --title "$TAG" --notes "Release compilado localmente"
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

# ─── Commitear el bump de versión ─────────────────────────────────────────────
git add package.json
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

ensure_sharp_ready
ensure_prisma_client_targets
clean_dist_dir

echo -e "  -> Build base (electron-vite) en host macOS"
npm run build:ci

prepare_windows_sharp

echo -e "  -> Empaquetando Windows x64"
npx electron-builder --win --x64 --publish never

echo -e "  -> Restaurando dependencias del host (macOS)"
yarn install --frozen-lockfile

echo ""
read -p "  ¿Subir artefactos de dist/ a GitHub Release con gh? (s/N): " SHOULD_UPLOAD_RELEASE
if [[ "$SHOULD_UPLOAD_RELEASE" == "s" || "$SHOULD_UPLOAD_RELEASE" == "S" ]]; then
  publish_local_release
fi

# ─── Listo ────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "  ✓ Release local $TAG compilado"
echo -e "  No se hizo push a origin ni se disparó CI."
echo -e "  Artefactos disponibles en dist/"
echo -e "  Dependencias del host restauradas para continuar con desarrollo local."
echo -e "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo ""
