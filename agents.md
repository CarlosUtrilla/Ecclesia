sd# Ecclesia - Agent Router Principal

## Skills globales instaladas

Ecclesia utiliza skills globales para mejorar la calidad, performance y diseño del código, siguiendo el patrón de agents de Prowler. Estas skills se invocan automáticamente cuando la tarea lo requiere.

| Skill | Descripción breve | Uso principal |
| --- | --- | --- |
| [vercel-react-best-practices](~/.copilot/skills/vercel-react-best-practices/SKILL.md) | Guía de optimización de performance para React/Next.js mantenida por Vercel. | Refactor, performance, data fetching, bundle size |
| [web-design-guidelines](~/.copilot/skills/web-design-guidelines/SKILL.md) | Revisión de código UI para cumplimiento de guías de accesibilidad y buenas prácticas web. | Accesibilidad, revisión de UI, auditoría de diseño |
| [frontend-design](~/.agents/skills/frontend-design/SKILL.md) | Generación de interfaces frontend distintivas y de alta calidad estética. | Creación de componentes, páginas, estilos, UI memorable |
| [react-doctor](~/.agents/skills/react-doctor/SKILL.md) | Diagnóstico y corrección de problemas de salud en código React. | Seguridad, performance, arquitectura, dead code |
| [vercel-composition-patterns](~/.agents/skills/vercel-composition-patterns/SKILL.md) | Patrones de composición React escalables y modernos. | Refactor de props, librerías de componentes, arquitectura |

| [prisma-expert](~/.agents/skills/prisma-expert/SKILL.md) | Skill avanzada para gestión y optimización de Prisma ORM. | Modelado, migraciones, queries avanzadas, performance |

| [electron-architect](~/.agents/skills/electron-architect/SKILL.md) | Skill experta en arquitectura y optimización de Electron. | Arquitectura, IPC, seguridad, performance Electron |

> **IMPORTANTE:** Antes de escribir o modificar código relacionado con UI, React, performance o composición, consulta la skill correspondiente. Estas skills se invocan automáticamente según el tipo de tarea.

## Descripcion del proyecto

Ecclesia es una aplicacion de escritorio (Electron + React + TypeScript) para planificacion y presentacion de cultos religiosos. Gestiona canciones, versiculos biblicos, medios (imagenes/videos), temas de presentacion y cronogramas de servicio que se proyectan en pantallas en vivo.

**📖 Sistema de Chunks para Textos Bíblicos:** Documentación completa en [`apps/desktop/app/SISTEMA_CHUNKS_BIBLICOS.md`](apps/desktop/app/SISTEMA_CHUNKS_BIBLICOS.md) - explica cómo funciona la división inteligente de textos bíblicos largos, arquitectura de metadata objects, hidratación desde BD, navegación por chunks y preview de presentaciones.

## Estado del proyecto

### Goal
- Mantener Ecclesia funcional en Electron, con OAuth PKCE y Google Drive sync operativos; la migración a Tauri fue abandonada.

### Done
- **Prisma generate reparado** (sesión anterior): Loop infinito por auto-install de `prisma` CLI. Solución: agregar `"prisma": "6.19.3"` como devDependency de `@ecclesia/api`. Ahora `prisma generate` resuelve ambos paquetes desde `apps/api/` y no hay loop.
- **Electron binary reinstalado**: `pnpm add electron@35.7.5` creó un stub (~50KB) sin frameworks y sin `path.txt`. El `install.js` fallaba silenciosamente porque descargaba el zip pero no lo extraía correctamente (el `extract-zip` interno se colgaba sin error). Solución manual: extraer el zip cachead con `unzip` + crear `path.txt` sin trailing newline. El binary ahora pesa 245MB con frameworks completos.
- **`path.txt` sin newline**: El archivo `path.txt` contenía `Electron.app/Contents/MacOS/Electron\n`, lo que causaba `ENOENT` al spawnear (el `\n` se interpretaba como parte del path). Fijado con `printf '%s' ...`.
- **`better-sqlite3` rebuild para Electron**: `NODE_MODULE_VERSION 137` (Node v24) vs `133` (Electron 35, Node ~v22). Rebuild con `@electron/rebuild -o better-sqlite3`.
- **`@electron/rebuild`** agregado como devDependency de `@ecclesia/desktop`.
- **Dev server verificado**: Electron arranca, Prisma conecta, 10 biblias EBBL cargan con `better-sqlite3` operativo, Socket.IO conecta desde el renderer.
- **Refactor Fase 1:** `onSuccess` callbacks unificados en factory `onStageScreenConfigSuccess` en `globalStageConfig.ts`.
- **Refactor Fase 3:** Reducidas alocaciones en loops en `SongGroup.tsx` (merge O(n²)→monotónico), `useCanvaImportActions.ts` (3×filter→1 loop), `splitLongBibleVerse.ts` (redundantes `normalizeBibleText`).
- **Refactor Fase 4.2:** Outbox middleware extraído de `prisma-init.ts` → `apps/api/src/middleware/outbox.ts`. `registerOutboxMiddleware`, `setOnOutboxWriteCallback`, `setOnMediaChangeCallback` re-exportados desde `prisma-init.ts`.
- **Refactor Fase 4.3:** Creado `ipcHelpers.ts` (`onIpc`, `onIpcFromWindow`, `handleIpc`) en `apps/desktop/electron/main/`. Aplicado a 11 handlers locales de `index.ts`.
- **Nuevo sistema de sync (OpLog + Automerge CRDT):** Diseño completo en `apps/desktop/app/SISTEMA_SYNC_OPLOG.md`. Implementación core en `apps/api/src/controllers/sync-oplog/`. Integración via Prisma middleware (`apps/api/src/middleware/oplog.ts`). Scheduler nuevo (`apps/api/src/services/oplog-scheduler.service.ts`) activo en `index.ts`. Pendiente: desactivar snapshot sync legacy.
- **Integración IA para cronogramas (MVP):** Multi-proveedor configurable (OpenAI/Anthropic), extracción de referencias bíblicas desde texto libre o PDF, dialog modal con tabs (texto/PDF), inserción directa al cronograma. Backend en `apps/api/src/controllers/ai/`, frontend en `AIScheduleDialog.tsx`. Configuración de API key en Ajustes.

### In Progress
- **Salida de texto para OBS (subtítulos)**: nuevo módulo `apps/api/src/controllers/obs/` que sirve una página `/obs` (browser source) con el texto plano en vivo vía Socket.IO (`obsTextUpdate`/`obsConfigUpdate`/`requestObsText`). Overlay personalizable (color/fondo/fuente/posición/imagen) desde el menú «OBS» de la barra superior (`ObsTextOutputDialog`). Config persistida en `Setting` (`OBS_TEXT_OVERLAY_CONFIG`). Extracción de texto en `app/lib/presentationOverlayText.ts`. Ver [`obs/agents.md`](apps/api/src/controllers/obs/agents.md).
- **Importación PDF**: Backend completo — `importPdf` endpoint que convierte cada página del PDF a IMAGE via `pdfjs-dist` v3 + `@napi-rs/canvas`, almacena en `__pdf/` oculto, crea Presentation one-slide-per-page y un Media PDF con `presentationId`. **Frontend completo**: `MediaCard` muestra icono PDF + placeholder, drag-and-drop acepta `.pdf`, file picker filtro incluido. **Live redirect**: cuando un Media PDF se envía a live, resuelve su Presentation vinculada y muestra las diapositivas.
- **Fallback regeneration en `syncBlobs()`**: extendido bucle de regeneración de thumbnails para también generar fallback de videos cuando `fallbackChecksum`/`data.fallback` está vacío. Nuevos fallbacks se checksumean, suben a Drive, y persisten en el evento OpLog.
- **Roadmap IA completo**: Ver `AI_FEATURES_ROADMAP.md` en `apps/desktop/app/screens/panels/schedule/` para funcionalidades futuras (sugerencia de grupos, canciones, generación automática de cronogramas).

### Known Issues
- `invalid_client` en sync OAuth: error de configuración — faltan credenciales válidas de Google OAuth en `.env`.
- GPU process crash (`exit_code=15`) en headless/dev — normal sin display físico.
- 4 test failures pre-existentes por `react/jsx-dev-runtime` (no relacionados con cambios).

## Stack tecnologico

*   **Frontend:** React 19, TypeScript, Tailwind CSS, Shadcn UI, React Router v7, React Hook Form + Zod, TanStack React Query, TipTap, Framer Motion (LazyMotion), dnd-kit
*   **Backend:** Electron, Prisma ORM, SQLite (better-sqlite3)
*   **IA:** OpenAI / Anthropic (configurable), pdfjs-dist para extracción de texto de PDFs
*   **Package Manager:** pnpm 11 (con `minimum-release-age=1440` y `onlyBuiltDependencies` para proteger contra ataques supply chain)
*   **Build:** Vite + electron-vite
*   **Empaquetado macOS:** `dmg.artifactName` incluye `${arch}` para evitar colisiones cuando se generan arm64 y x64 en la misma ejecución.
*   **Release CI:** workflow de tags usa pnpm (`pnpm-lock.yaml`) y build macOS arm64+x64 secuencial en un solo job (sin merge `universal` para evitar fallos de `_CodeSignature`). El workflow valida `GH_TOKEN` al inicio y define `timeout-minutes` por job para cortar fallos costosos. El script `packages/scripts/release.sh` permite elegir modo `github` (push + CI) o `local` (compila mac/win sin push ni consumo de CI), e incluye preflight de `sharp` con autoreparación (`pnpm install --frozen-lockfile` + `npm rebuild sharp` + `electron-builder install-app-deps`) y preparación explícita de módulos nativos para `win32-x64` antes del empaquetado de Windows local: `sharp` (`npm install --legacy-peer-deps --os=win32 --cpu=x64 sharp`) y `@ffmpeg-installer/win32-x64` (via `npm pack`). El script también fuerza `better-sqlite3` a binario Windows x64 (PE32+) usando `prebuild-install --runtime=electron --target=<version>` (con fallback a `--runtime=node --target=22.0.0`) y verifica con `file` antes de empaquetar. En modo local, el flujo limpia `dist/` antes de compilar para no mezclar artefactos viejos con los nuevos, compila primero con `electron-vite build` en macOS, ejecuta `prisma generate` con `binaryTargets` multi-plataforma (`native`, `windows`, `darwin-arm64`, `darwin`) y luego empaqueta con `electron-builder --win`, evitando errores de optional dependencies de Rollup y de Query Engine en Windows. Al finalizar, el script restaura dependencias del host con `pnpm install --frozen-lockfile` + `@electron/rebuild -f` + `ensure_sharp_ready` para restaurar módulos nativos macOS (sin esto, el pnpm store queda con binarios Windows, rompiendo `better-sqlite3` en desarrollo) y puede subir opcionalmente `dist/` a un GitHub Release vía `gh` (con advertencia porque crear el tag remoto `v*` puede disparar el workflow de tags). En esa subida local, el script ahora empuja automáticamente el tag si no existe en remoto y solo sube archivos regulares de `dist/` (evitando fallos por carpetas como `win-unpacked`).
*   **Idioma principal del codigo:** Espanol (comentarios, nombres de variables UI), Ingles (nombres de modelos, controladores, tipos)
*   **Testing:** Vitest (`node` por defecto + `jsdom` por archivo), Testing Library para pruebas UI.

## Testing (base minima obligatoria)

> **REGLA CRÍTICA:** Toda nueva función de utilidad, hook, controller, servicio o componente con lógica no trivial DEBE incluir tests. No se acepta código sin tests cuando la lógica puede verificarse. Esto aplica tanto a código nuevo como a modificaciones significativas de código existente.

- Comandos disponibles:
  - `npm run test`
  - `npm run test:watch`
  - `npm run test:coverage`
- Configuracion central: `apps/desktop/vitest.config.ts`.
- Setup global de matchers: `tests/setup/vitest.setup.ts`.
- Para pruebas de componentes/DOM usar `// @vitest-environment jsdom` en el archivo de test.
- Priorizar cobertura de seguridad en utilidades críticas (ej. sanitización HTML) y regresiones de lógica en módulos compartidos.

### Qué testear siempre

| Tipo de código | Tests requeridos |
| --- | --- |
| Utilidades (`apps/desktop/app/lib/`, `apps/api/src/`) | Unit tests de todos los casos relevantes (happy path + edge cases + errores) |
| Hooks compartidos (`apps/desktop/app/hooks/`) | Tests con `renderHook` de comportamiento público |
| Controllers/Services del backend | Unit tests de lógica de negocio (mocking de Prisma si aplica) |
| Componentes con lógica propia | Tests de comportamiento (no de snapshot): interacciones, estados, renders condicionales |
| Schemas Zod (`schema.ts`) | Tests de validación: inputs válidos, inválidos y casos borde |
| Funciones de seguridad | Tests exhaustivos incluyendo XSS, inyección, inputs maliciosos |

### Convenciones de archivos de test

- Archivos de test junto al módulo que prueban: `utils.ts` → `utils.test.ts`
- Para tests de módulos Node/Electron (controllers, services): entorno `node` (default de vitest)
- Para tests de componentes React/DOM: `// @vitest-environment jsdom` al inicio del archivo
- Describir cada suite con `describe('NombreDelMódulo', ...)` y cada caso con `it('debería ...')`

## Auto-invoke: Consulta SIEMPRE el agent antes de actuar

Cuando vayas a realizar alguna de estas acciones, SIEMPRE consulta el agent indicado ANTES de escribir codigo:

| Accion | Agent a consultar |
| --- | --- |
| Crear o modificar un modelo en schema.prisma | [`prisma`](apps/api/prisma/agents.md) |
| Crear una migracion de base de datos | [`prisma`](apps/api/prisma/agents.md) |
| Agregar un campo a un modelo existente | [`prisma`](apps/api/prisma/agents.md) + [`api`](apps/api/agents.md) |
| Crear un nuevo controller o service | [`api`](apps/api/agents.md) |
| Agregar un nuevo metodo IPC | [`api`](apps/api/agents.md) + [`electron`](apps/desktop/electron/agents.md) |
| Modificar DTOs de entrada/salida | [`api`](apps/api/agents.md) |
| Consumir datos del backend desde React | [`contexts`](apps/desktop/app/contexts/agents.md) + [`api`](apps/api/agents.md) |
| Agregar un componente a la biblioteca (songs/media/bible) | [`library`](apps/desktop/app/screens/panels/library/agents.md) |
| Implementar drag & drop de un recurso al cronograma | [`library`](apps/desktop/app/screens/panels/library/agents.md) + [`schedule`](apps/desktop/app/screens/panels/schedule/agents.md) |
| Modificar el cronograma o sus items | [`schedule`](apps/desktop/app/screens/panels/schedule/agents.md) |
| Modificar la logica de pantallas en vivo | [`schedule`](apps/desktop/app/screens/panels/schedule/agents.md) + [`contexts`](apps/desktop/app/contexts/agents.md) |
| Crear o modificar un editor (cancion/tema/tags) | [`editors`](apps/desktop/app/screens/editors/agents.md) |
| Abrir una nueva ventana de Electron | [`electron`](apps/desktop/electron/agents.md) + [`editors`](apps/desktop/app/screens/editors/agents.md) |
| Modificar PresentationView o sus sub-componentes | [`ui`](apps/desktop/app/ui/agents.md) |
| Usar animaciones con Framer Motion | [`ui`](apps/desktop/app/ui/agents.md) |
| Agregar un componente Shadcn UI | [`ui`](apps/desktop/app/ui/agents.md) |
| Trabajar con el media server o archivos de medios | [`electron`](apps/desktop/electron/agents.md) + [`library`](apps/desktop/app/screens/panels/library/agents.md) |
| Verificar integridad de archivos de medios en disco | [`electron`](apps/desktop/electron/agents.md) + [`api`](apps/api/agents.md) |
| Modificar gestion de displays/pantallas | [`electron`](apps/desktop/electron/agents.md) + [`contexts`](apps/desktop/app/contexts/agents.md) |
| Importar o gestionar biblias | [`electron`](apps/desktop/electron/agents.md) + [`library`](apps/desktop/app/screens/panels/library/agents.md) |
| Agregar una nueva ruta en React Router | Leer `apps/desktop/app/App.tsx` + [`electron`](apps/desktop/electron/agents.md) si requiere ventana nueva |
| Crear o modificar ventana de ajustes | [`electron`](apps/desktop/electron/agents.md) + [`ui`](apps/desktop/app/ui/agents.md) |
| Modificar estilos globales o temas CSS | Leer `apps/desktop/app/assets/globals.css` + [`ui`](apps/desktop/app/ui/agents.md) |
| Agregar un nuevo evento Socket.IO | [`sockets`](apps/api/src/sockets/AGENTS.md) — definir en `SocketEventMap` + emitir desde service o registrar handler |
| Modificar la salida de texto para OBS (subtítulos) | [`obs`](apps/api/src/controllers/obs/agents.md) + [`sockets`](apps/api/src/sockets/AGENTS.md) |

## Arquitectura general

```
apps/desktop/app/main.tsx (entry point React)
  -> QueryClientProvider (React Query)
  -> HashRouter
    -> App.tsx
      -> MediaServerProvider        (top-level, inicializa servidor de medios)
        -> DisplaysProvider         (detecta pantallas conectadas)
          -> ScreenSizeProvider     (calcula tamanos de pantalla)
            -> Routes
              "/" -> ScheduleProvider (gestiona cronograma activo)
                      -> DragAndDropSchedule (drag & drop con dnd-kit)
                      -> Layout con ResizablePanels:
                          [SchedulePanel | LivePanels | LiveScreens]
                      - Tamaños del layout principal persistidos entre sesiones con `defaultLayout` + `onLayoutChanged` (localStorage) y `id` estable por panel.
                          [LibraryPanel (songs/media/bible)]
              "/song/:id"     -> SongEditor (ventana separada)
              "/theme/:id"    -> ThemesEditor (ventana separada)
              "/tagSongEditor" -> TagSongsEditor (ventana separada)
              "/settings" -> SettingsScreen (ventana separada)
              "/live-screen/:displayId" -> LiveScreen (ventana de proyeccion)
              "/stage-screen/:displayId" -> StageScreen (ventana de escenario)
              "/stage-control" -> StageControlScreen (ventana de control stage)
              "/stage-layout" -> StageLayoutScreen (ventana de layout stage)
```

## Monorepo (pnpm Workspaces)

```
/
├── apps/
│   ├── api/                   # @ecclesia/api — capa de datos
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── prisma.ts      # setPrismaClient, getPrisma, setGetBiblesResourcesPath
│   │   │   ├── routes.ts
│   │   │   ├── sockets/       # Socket.IO — SocketEventMap (único registro), handlers runtime
│   │   │   └── controllers/   # Bible, Songs, Media, Themes, AI, etc.
│   │   ├── prisma/            # Schema + migraciones (schema.prisma, migrations/)
│   │   └── package.json
│   └── desktop/               # @ecclesia/desktop — app Electron + React
│       ├── app/               # Frontend React (main, screens, UI)
│       ├── electron/          # Electron main process + preload
│       ├── tests/
│       ├── resources/
│       ├── locales/
│       ├── electron.vite.config.ts
│       ├── vitest.config.ts
│       └── package.json
├── packages/
│   ├── queries/               # @ecclesia/queries — capa de fetch/socket compartida (Api.fetch/query/socket)
│   └── scripts/               # scripts de release/build (release.sh)
├── .npmrc                     # minimum-release-age=1440 (seguridad supply chain)
├── pnpm-workspace.yaml        # Definicion de workspaces (apps/*, packages/*)
├── package.json               # pnpm workspace root
└── agents.md                  # Este archivo (router principal)
```

## Flujo de datos (IPC)

```
React Component
  -> window.api.namespace.method(args)
    -> ipcRenderer.invoke('namespace.method', args)
      -> ipcMain.handle() en main process
        -> Controller.method()
              - Todos los fetches de datos deben hacerse con `useQuery`.
              - Si se repite el uso de la misma `queryKey` en varios componentes, crear un hook en la carpeta `app/hooks/` para centralizar la lógica.

### Idioma

- **Comunicacion:** SIEMPRE responder en espanol. Nunca en ingles.
- **Codigo (identificadores):** Ingles para modelos, controllers, services, tipos, props, hooks. Ej: `SongsController`, `useThemes`, `PresentationView`.
- **UI (textos visibles):** Espanol. Ej: `"Añadir canción al cronograma"`, `"Guardar"`.
- **Comentarios:** Espanol preferido, ingles aceptable.
- **Nombres de archivo:** Ingles, camelCase para componentes (`songItem.tsx`), PascalCase para componentes grandes (`MediaCard.tsx`).

### React

- **Estado derivado de props:** NO usar `useEffect` para sincronizar. Usar render-time reset con `useRef` para trackear el valor anterior:

  ```tsx
  const prevIdRef = useRef(propId)
  if (prevIdRef.current !== propId) {
    prevIdRef.current = propId
    setLocalState(initialValue)
  }
```

**Estado local de dialogs:** Resetear en `onOpenChange`, no en `useEffect` sobre la prop:

**Formularios:** Siempre React Hook Form + Zod. Definir schema en archivo separado `schema.ts`.

**Data fetching:** Siempre React Query (`useQuery`, `useMutation`). Usar `queryKey` descriptivos. Invalidar queries despues de mutations.

**Refetch por IPC:** Escuchar eventos IPC con `window.electron.ipcRenderer.on()` dentro de `useEffect` y llamar `refetch()` de React Query.

**Context pattern:** `createContext(null)` + `Provider` component + `useX()` hook con throw si se usa fuera del provider.

**Hooks compartidos** van en `app/hooks/`. Hooks especificos de un modulo van en la carpeta del modulo (ej: `media/hooks/`).

### TypeScript

*   **DTOs:** Archivos `.dto.d.ts` (solo tipos, no runtime). Un archivo por controller.
*   **Props de componentes:** Definir como `type Props = { ... }` en el mismo archivo, antes del componente.
*   **Tipos de Prisma:** Importar directamente de `@prisma/client` cuando sean suficientes. Crear tipos extendidos solo si necesitas campos adicionales (ej: `ThemeWithMedia`).
*   **Enums:** Preferir enums de Prisma (`ScheduleItemType`, `MediaType`) sobre strings literales.

### Componentes UI

**Shadcn UI:** No modificar componentes base directamente. Si necesitas personalizar, crea un wrapper.

**Clases CSS:** Siempre usar `cn()` de `lib/utils.ts` para combinar clases Tailwind condicionalmente.

**Animaciones:** Usar `LazyMotion` + `m` de framer-motion. NUNCA importar `motion` directamente (ahorra ~30kb).

**HTML peligroso:** Solo con `sanitizeHTML()` de `lib/utils.ts` (usa DOMPurify). Necesario unicamente para contenido del editor TipTap.

**Listas renderizadas:** Keys SIEMPRE con identificador estable (`item.id`, `item.slug`). Si no hay ID natural, usar patron `{tipo}-{id}-{subIndex}`. NUNCA usar index puro.

### Accesibilidad

Todo elemento clickeable no-interactivo (`<div>`, `<span>`) DEBE tener:

Imagenes: siempre incluir `alt` (texto descriptivo o `""` para decorativas).

`<nav>` NO necesita `role="navigation"` (ya es implicito).

`<label>` debe estar asociado a un control (`htmlFor` o envolviendo el input). Si es solo texto visual, usar `<span>`.

`prefers-reduced-motion` esta manejado globalmente en `globals.css`. Las animaciones CSS y JS se desactivan automaticamente.

### Performance

*   **React Query** `**staleTime**`**:** Usar `Infinity` para datos que no cambian durante la sesion (ej: `bibleSchema`). Datos que cambian usan refetch por IPC events.
*   `**useMemo**`**/**`**useCallback**`**:** Usar para calculos costosos y funciones pasadas como props. No usar para valores simples.
*   **Virtualizacion:** Para listas largas (>100 items), usar `VirtualizedScrollArea` con `@tanstack/react-virtual`.
*   **Lazy loading:** Imagenes en grillas usan `loading="lazy"`.

### Backend (Controllers/Services)

*   Un controller por recurso, registrado en `apps/api/src/routes.ts`.
*   Services acceden a Prisma via `getPrisma()`. No usar singleton del service.
*   Metodos del controller son `async`, reciben argumentos directamente (no req/res).
*   Canal IPC: `{namespace}.{method}`. Se genera automaticamente al registrar en routes.
*   DTOs definen la forma de los datos de entrada/salida.

### Drag & Drop

*   Usar dnd-kit. Items draggables de biblioteca usan `useDraggable` con `data: { type: ScheduleItemType, accessData: resourceId }`.
*   Items del cronograma usan `useSortable` (reordenable) + `useDroppable` (para insercion).
*   Distinguir drag externo (biblioteca) de interno (reordenar) verificando `data.accessData !== undefined && !data.item`.

### Seguridad

*   NUNCA hacer `dangerouslySetInnerHTML` sin `sanitizeHTML()`.
*   NUNCA exponer secrets o keys en el codigo frontend.
*   NUNCA loguear datos sensibles del usuario.
*   Validar inputs con Zod antes de enviar al backend.
*   Los archivos de medios se sirven via servidor HTTP local (localhost), no directamente del filesystem.

### IPC / API desde el renderer

*   En componentes React (renderer), SIEMPRE usar `window.api.namespace.method()` para llamar al backend. NUNCA importar `api from '@ecclesia/api'` directamente en el renderer — ese módulo asume `window.api` internamente pero su import directo no está disponible correctamente en todas las ventanas Electron.
*   Los imports de **tipos** (`.dto.d.ts`) sí están permitidos en el renderer.

### Antes de modificar codigo

> **REGLA OBLIGATORIA — Codebase Memory MCP primero:**
> SIEMPRE usar las herramientas MCP del codebase memory (`search_graph`, `trace_path`, `get_code_snippet`, `query_graph`, `get_architecture`) ANTES de caer en `grep`, `glob`, `read` o `task` exploratoria. Las herramientas MCP ofrecen grafo de conocimiento索引索引, relaciones entre funciones, y código fuente directo — son más rápidas, más precisas y evitan duplicar búsquedas. Solo usar `grep`/`glob`/`read` como fallback cuando el MCP no devuelva resultados suficientes o para archivos no indexados (configs, Dockerfiles, scripts sueltos).

*   NUNCA proponer cambios a codigo que no se haya leido primero. Leer el archivo antes de modificarlo.
*   NUNCA asumir que una libreria esta disponible. Verificar en `package.json` o en archivos cercanos que ya se usa.
*   Cuando se cree un componente nuevo, revisar componentes existentes similares para seguir el mismo patron (framework, naming, typing).
*   Cuando se edite codigo existente, mirar los imports y el contexto para entender las convenciones locales.

### No over-engineering

*   Solo hacer cambios directamente pedidos o claramente necesarios.
*   No agregar features, refactors, docstrings, type annotations o "mejoras" mas alla de lo solicitado.
*   No agregar error handling para escenarios imposibles. Confiar en garantias internas del framework.
*   No crear helpers o abstracciones para operaciones que se usan una sola vez.
*   No disenar para requisitos hipoteticos futuros. Tres lineas similares son mejor que una abstraccion prematura.
*   No agregar feature flags ni shims de backwards-compatibility cuando se puede cambiar el codigo directamente.

### Mantenibilidad y composicion (regla permanente)

*   NUNCA dejar codigo espagueti: cuando un componente crezca o mezcle demasiadas responsabilidades, separarlo en subcomponentes/hooks/utilidades del modulo.
*   Priorizar composicion y responsabilidades claras (`orquestador` + piezas reutilizables) para que el codigo sea facil de leer, testear y extender.
*   Mantener el balance: componer para claridad real, sin crear abstracciones innecesarias de un solo uso.

### Git y mantenimiento

*   Toda modificacion DEBE actualizar los `agents.md` correspondientes.
*   No dejar codigo comentado. Si algo se elimina, eliminarlo completamente.
*   No agregar comments obvios. Solo comentar logica no evidente.
*   Si algo queda sin usar (variable, import, funcion), eliminarlo por completo. No renombrar con `_`, no re-exportar, no dejar `// removed`.

> **REGLA CRÍTICA:**  
> Siempre que edites, crees o elimines código en cualquier módulo, ACTUALIZA el `agents.md` correspondiente de esa carpeta. Así nunca se pierde el contexto ni la trazabilidad de la arquitectura y flujos.

## Estructura de archivos clave

```
/
├── agents.md                     <- ESTE ARCHIVO (router principal)
├── apps/
│   ├── api/
│   │   ├── agents.md             <- Agent de backend (controllers/services)
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── prisma.ts         <- setPrismaClient, getPrisma, injectables
│   │   │   ├── prisma-init.ts    <- initializeDatabase(), migraciones, backup
│   │   │   ├── routes.ts
│   │   │   ├── outboxPayload.ts  <- serializeOutboxPayload() BigInt-safe
│   │   │   └── controllers/      <- Bible, Songs, Media, Themes, AI, etc.
│   │   ├── prisma/
│   │   │   ├── agents.md         <- Agent de schema/modelos
│   │   │   ├── schema.prisma
│   │   │   └── migrations/
│   │   └── package.json
│   └── desktop/
│       ├── agents.md             <- Agent de Electron (main process)
│       ├── electron/
│       │   ├── main/             <- Main process, window manager, IPC managers
│       │   │   ├── prisma.ts     <- Thin wrapper llamando a @ecclesia/api
│       │   │   ├── index.ts      <- Entry point, startup orchestration
│       │   │   └── bibleManager/
│       │   │       └── bibleManager.ts  <- setGetBiblesResourcesPath() inyectado
│       │   └── preload/
│       │       └── index.ts
│       ├── app/
│       │   ├── App.tsx
│       │   ├── main.tsx
│       │   ├── contexts/
│       │   │   └── agents.md     <- Agent de contexts/hooks
│       │   ├── hooks/
│       │   ├── screens/
│       │   │   ├── editors/
│       │   │   │   └── agents.md  <- Agent de editores
│       │   │   └── panels/
│       │   │       ├── library/
│       │   │       │   └── agents.md  <- Agent de biblioteca
│       │   │       └── schedule/
│       │   │           └── agents.md  <- Agent de cronograma
│       │   └── ui/
│       │       └── agents.md     <- Agent de componentes UI
│       ├── tests/
│       ├── scripts/
│       ├── package.json
│       ├── electron.vite.config.ts
│       └── vitest.config.ts
├── .npmrc                     <- minimum-release-age=1440 (seguridad supply chain)
├── pnpm-workspace.yaml        <- Definicion de workspaces
├── package.json               <- pnpm workspace root
└── agents.md                  <- ESTE ARCHIVO (router principal)
```

## Integración ScheduleContext, Schedule y Library

* La carpeta `apps/desktop/app/screens/panels/schedule/` es el principal consumidor de ScheduleContext: gestiona, visualiza y modifica el cronograma usando el contexto y sus helpers.
* Los items de biblioteca (songs, media, bible) se agregan al cronograma por drag & drop o acciones directas (click/context menu), usando los métodos del contexto (`addItemToSchedule`, etc.).
* Ver detalles y flujos completos en los agents de cada módulo.
* Controles de emergencia en live desde teclado del operador: `F7` (activar live), `F9` (ocultar texto solo en live), `F10` (mostrar logo/fallback sin quitar item), `F11` (pantalla negra), `Escape` (limpiar item live sin cerrar ventana).
* Las diapositivas de PresentationEditor pueden persistir `backgroundColor` opcional para sobrescribir el fondo por slide sin romper el tema global ni el render de `PresentationView`.

```tsx
role="button"
tabIndex={0}
onKeyDown={(e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    handleClick()
  }
}}
```

```tsx
import { m, LazyMotion, domAnimation } from 'framer-motion'
// Usar <m.div> en vez de <motion.div>
// Envolver con <LazyMotion features={domAnimation}>
```

```tsx
const handleOpenChange = (isOpen: boolean) => {
  if (isOpen) setLocalState(propValue)
  setOpen(isOpen)
}
```