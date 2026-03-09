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
echo -e "    ${CYAN}1${RESET}) prerelease beta  (0.1.0-beta.1 → 0.1.0-beta.2)"
echo -e "    ${CYAN}2${RESET}) patch            (0.1.0 → 0.1.1)"
echo -e "    ${CYAN}3${RESET}) minor            (0.1.0 → 0.2.0)"
echo -e "    ${CYAN}4${RESET}) mayor stable     (0.1.0 → 1.0.0)"
echo ""
read -p "  Elige [1]: " CHOICE
CHOICE=${CHOICE:-1}

case $CHOICE in
  1) BUMP_TYPE="prerelease"; BUMP_ARGS="--preid=beta" ;;
  2) BUMP_TYPE="patch";      BUMP_ARGS="" ;;
  3) BUMP_TYPE="minor";      BUMP_ARGS="" ;;
  4) BUMP_TYPE="major";      BUMP_ARGS="" ;;
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

# ─── Push ─────────────────────────────────────────────────────────────────────
echo ""
echo -e "  Pusheando main y tag ${CYAN}$TAG${RESET}..."
git push origin main
git push origin "$TAG"

# ─── Listo ────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "  ✓ Release $TAG publicado"
echo -e "  GitHub Actions está buildeando Mac y Windows."
echo -e "  Revisa el progreso en:"
echo -e "  https://github.com/CarlosUtrilla/Ecclesia/actions"
echo -e "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo ""
