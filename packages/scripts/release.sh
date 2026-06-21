#!/bin/bash
set -e

# ─── Colores ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; RESET='\033[0m'

CURRENT=$(node -p "require('./package.json').version")

echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "  Ecclesia Release Script (Tauri)"
echo -e "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo ""
echo -e "  Rama actual:    ${CYAN}$(git branch --show-current)${RESET}"
echo -e "  Versión actual: ${CYAN}$CURRENT${RESET}"
echo -e "  Último commit:  $(git log --oneline -1)"
echo ""

# ─── Elegir modo ───────────────────────────────────────────────────────────────
echo -e "  Modo de release:"
echo -e "    ${CYAN}1${RESET}) github (push + tag, dispara GitHub Actions)"
echo -e "    ${CYAN}2${RESET}) local  (build local, sin push ni CI)"
echo ""
read -p "  Elige [1]: " RELEASE_MODE_CHOICE
RELEASE_MODE_CHOICE=${RELEASE_MODE_CHOICE:-1}

case $RELEASE_MODE_CHOICE in
  1) RELEASE_MODE="github" ;;
  2) RELEASE_MODE="local" ;;
  *) echo -e "${RED}✗ Modo inválido.${RESET}"; exit 1 ;;
esac

# ─── Verificar cambios sin commitear ────────────────────────────────────────────
if [ -n "$(git status --porcelain)" ]; then
  echo -e "${YELLOW}⚠ Cambios sin commitear:${RESET}"
  git status --short
  echo ""
  read -p "¿Continuar? (s/N): " CONFIRM
  [[ "$CONFIRM" != "s" && "$CONFIRM" != "S" ]] && exit 1
fi

# ─── Elegir tipo de bump ───────────────────────────────────────────────────────
echo -e "  Tipo de release:"
echo -e "    ${CYAN}1${RESET}) patch   (0.14.2 → 0.14.3)"
echo -e "    ${CYAN}2${RESET}) minor   (0.14.2 → 0.15.0)"
echo -e "    ${CYAN}3${RESET}) major   (0.14.2 → 1.0.0)"
echo ""
read -p "  Elige [1]: " CHOICE
CHOICE=${CHOICE:-1}

case $CHOICE in
  1) BUMP_TYPE="patch" ;;
  2) BUMP_TYPE="minor" ;;
  3) BUMP_TYPE="major" ;;
  *) echo -e "${RED}✗ Opción inválida.${RESET}"; exit 1 ;;
esac

# ─── Bumpear versión ───────────────────────────────────────────────────────────
echo ""
echo -e "  Bumeando versión (${BUMP_TYPE})..."
npm version $BUMP_TYPE --no-git-tag-version > /dev/null

NEW=$(node -p "require('./package.json').version")
echo -e "  ${GREEN}$CURRENT → $NEW${RESET}"

# Sincronizar versión en package.json files
for pkg in package.json apps/desktop/package.json apps/tauri/package.json; do
  echo -e "  Sincronizando ${CYAN}$pkg${RESET}..."
  node -e "const p=require('./$pkg');p.version='$NEW';require('fs').writeFileSync('$pkg',JSON.stringify(p,null,2)+'\n')"
done

# Sincronizar en tauri.conf.json
node -e "
  const conf = require('./apps/tauri/src-tauri/tauri.conf.json');
  conf.version = '$NEW';
  require('fs').writeFileSync('./apps/tauri/src-tauri/tauri.conf.json', JSON.stringify(conf, null, 2) + '\n');
"
echo -e "  ${GREEN}Sincronizado tauri.conf.json${RESET}"

# Commit y tag
git add package.json apps/desktop/package.json apps/tauri/package.json apps/tauri/src-tauri/tauri.conf.json
git commit -m "chore: release v$NEW"

TAG="v$NEW"
if git tag | grep -q "^$TAG$"; then
  echo -e "  ${YELLOW}⚠ Tag $TAG ya existe, reemplazando...${RESET}"
  git tag -d "$TAG" > /dev/null
fi
git tag "$TAG"

# ─── Publicar ──────────────────────────────────────────────────────────────────
echo ""

if [ "$RELEASE_MODE" = "github" ]; then
  echo -e "  Pusheando main y tag ${CYAN}$TAG${RESET}..."
  git push origin main
  git push origin "$TAG"

  echo ""
  echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo -e "  ✓ Release $TAG publicado"
  echo -e "  GitHub Actions está buildeando Mac y Windows."
  echo -e "  https://github.com/CarlosUtrilla/Ecclesia/actions"
  echo -e "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
  echo ""
  exit 0
fi

# ─── Build local ───────────────────────────────────────────────────────────────
echo -e "  Ejecutando build local (Tauri)..."
echo ""

echo -e "  -> Build del sidecar API"
pnpm --filter @ecclesia/api build:sidecar
echo -e "  ${GREEN}✓ Sidecar compilado${RESET}"

# Clave privada para firma de updates (opcional)
if [[ -z "$TAURI_SIGNING_PRIVATE_KEY" ]]; then
  echo -e "  ${YELLOW}⚠ TAURI_SIGNING_PRIVATE_KEY no definida. Updates no se firmarán.${RESET}"
  echo -e "  ${YELLOW}  Define la variable de entorno para firmar actualizaciones.${RESET}"
fi

ensure_target() {
  local target=$1
  if ! rustup target list --installed | grep -q "$target"; then
    echo -e "  ${YELLOW}⚠ Target $target no instalado. Instalando...${RESET}"
    rustup target add "$target"
  fi
}

echo ""
echo -e "  ── Compilando ──"
echo ""

case "$(uname -s)" in
  Darwin)
    # macOS
    case "$(uname -m)" in
      arm64)
        ensure_target aarch64-apple-darwin
        pnpm --filter @ecclesia/tauri tauri build --target aarch64-apple-darwin
        ;;
      x86_64)
        ensure_target x86_64-apple-darwin
        pnpm --filter @ecclesia/tauri tauri build --target x86_64-apple-darwin
        ;;
    esac
    echo -e "  ${GREEN}✓ macOS compilado${RESET}"

    # Windows cross-compile desde macOS
    echo ""
    echo -e "  ── Cross-compilando Windows x64 ──"
    if ! command -v x86_64-w64-mingw32-gcc &>/dev/null; then
      echo -e "  ${YELLOW}⚠ mingw-w64 no instalado. Instálalo con:${RESET}"
      echo -e "    ${CYAN}brew install mingw-w64${RESET}"
      echo ""
      read -p "  ¿Instalar mingw-w64 ahora? (s/N): " INSTALL_MINGW
      if [[ "$INSTALL_MINGW" == "s" || "$INSTALL_MINGW" == "S" ]]; then
        brew install mingw-w64
      else
        echo -e "  ${YELLOW}⚠ Saltando Windows. Corre 'brew install mingw-w64' primero.${RESET}"
        break_build_win=true
      fi
    fi

    if [[ "$break_build_win" != "true" ]]; then
      ensure_target x86_64-pc-windows-gnu

      # NSIS para el instalador Windows
      if ! command -v makensis &>/dev/null; then
        echo -e "  ${YELLOW}⚠ makensis no instalado. Instalando...${RESET}"
        brew install makensis 2>/dev/null || {
          echo -e "  ${YELLOW}⚠ No se pudo instalar makensis. Compilando sin instalador.${RESET}"
        }
      fi

      mkdir -p apps/tauri/src-tauri/.cargo
      cat > apps/tauri/src-tauri/.cargo/config.toml << 'CARGOEOF'
[target.x86_64-pc-windows-gnu]
linker = "x86_64-w64-mingw32-gcc"
CARGOEOF

      pnpm --filter @ecclesia/tauri tauri build --target x86_64-pc-windows-gnu || {
        echo -e "  ${RED}✗ Falló cross-compilación Windows.${RESET}"
        echo -e "  Compila en Windows nativo o usa CI."
      }
      echo -e "  ${GREEN}✓ Windows cross-compilado${RESET}"
    fi
    ;;
  MINGW*|MSYS*|CYGWIN*)
    ensure_target x86_64-pc-windows-msvc
    pnpm --filter @ecclesia/tauri tauri build --target x86_64-pc-windows-msvc
    echo -e "  ${GREEN}✓ Windows compilado${RESET}"
    ;;
  Linux)
    ensure_target x86_64-unknown-linux-gnu
    pnpm --filter @ecclesia/tauri tauri build --target x86_64-unknown-linux-gnu
    echo -e "  ${GREEN}✓ Linux compilado${RESET}"
    ;;
  *)
    echo -e "${RED}✗ SO no soportado para build local.${RESET}"
    exit 1
    ;;
esac

echo ""
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "  ✓ Release local $TAG compilado"
echo -e "  Artefactos en apps/tauri/src-tauri/target/release/bundle/"
echo -e "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo ""

# ─── Subir a GitHub Release ───────────────────────────────────────────────────
read -p "  ¿Subir artefactos a GitHub Release? (s/N): " UPLOAD

if [[ "$UPLOAD" == "s" || "$UPLOAD" == "S" ]]; then
  if ! command -v gh >/dev/null 2>&1; then
    echo -e "${RED}✗ GitHub CLI (gh) no instalado. 'brew install gh'${RESET}"
    exit 1
  fi

  if ! gh auth status >/dev/null 2>&1; then
    echo -e "${RED}✗ gh no autenticado. 'gh auth login'${RESET}"
    exit 1
  fi

  # Buscar artefactos en el bundle de Tauri
  BUNDLE_DIR="apps/tauri/src-tauri/target/release/bundle"
  RELEASE_FILES=()

  # macOS .dmg
  for dmg in "$BUNDLE_DIR"/dmg/*.dmg; do
    [[ -f "$dmg" ]] && RELEASE_FILES+=("$dmg")
  done

  # Windows .exe/.msi
  for exe in "$BUNDLE_DIR"/nsis/*.exe; do
    [[ -f "$exe" ]] && RELEASE_FILES+=("$exe")
  done

  # Update manifests (latest.json)
  for manifest in "$BUNDLE_DIR"/**/latest.json; do
    [[ -f "$manifest" ]] && RELEASE_FILES+=("$manifest")
  done

  if [[ ${#RELEASE_FILES[@]} -eq 0 ]]; then
    echo -e "${RED}✗ No se encontraron artefactos en $BUNDLE_DIR${RESET}"
    exit 1
  fi

  echo -e "  Artefactos a subir:"
  for f in "${RELEASE_FILES[@]}"; do
    echo -e "    ${CYAN}$(basename "$f")${RESET}"
  done

  if ! git ls-remote --tags origin "$TAG" 2>/dev/null | grep -q "$TAG"; then
    echo -e "  ${YELLOW}Pusheando tag $TAG...${RESET}"
    git push origin "$TAG"
  fi

  if gh release view "$TAG" >/dev/null 2>&1; then
    gh release upload "$TAG" "${RELEASE_FILES[@]}" --clobber
  else
    gh release create "$TAG" "${RELEASE_FILES[@]}" --title "$TAG" --notes "Release $TAG"
  fi

  echo -e "  ${GREEN}✓ Artefactos subidos a GitHub Release${RESET}"
fi
echo ""
