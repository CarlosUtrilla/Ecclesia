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


echo -e "  -> Windows x64"
npm run build:ci:win -- --x64 --publish never

# ─── Listo ────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "  ✓ Release local $TAG compilado"
echo -e "  No se hizo push a origin ni se disparó CI."
echo -e "  Artefactos disponibles en dist/"
echo -e "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo ""
