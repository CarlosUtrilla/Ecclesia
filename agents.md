# Ecclesia - Agent Router Principal

## Skills globales instaladas

Ecclesia utiliza skills globales para mejorar la calidad, performance y diseño del código, siguiendo el patrón de agents de Prowler. Estas skills se invocan automáticamente cuando la tarea lo requiere.

| Skill | Descripción breve | Uso principal |
|-------|-------------------|---------------|
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

## Stack tecnologico

- **Frontend:** React 19, TypeScript, Tailwind CSS, Shadcn UI, React Router v7, React Hook Form + Zod, TanStack React Query, TipTap, Framer Motion (LazyMotion), dnd-kit
- **Backend:** Electron, Prisma ORM, SQLite (better-sqlite3)
- **Build:** Vite + electron-vite
- **Idioma principal del codigo:** Espanol (comentarios, nombres de variables UI), Ingles (nombres de modelos, controladores, tipos)

## Auto-invoke: Consulta SIEMPRE el agent antes de actuar

Cuando vayas a realizar alguna de estas acciones, SIEMPRE consulta el agent indicado ANTES de escribir codigo:

| Accion | Agent a consultar |
|--------|-------------------|
| Crear o modificar un modelo en schema.prisma | [`prisma`](prisma/agents.md) |
| Crear una migracion de base de datos | [`prisma`](prisma/agents.md) |
| Agregar un campo a un modelo existente | [`prisma`](prisma/agents.md) + [`database`](database/agents.md) |
| Crear un nuevo controller o service | [`database`](database/agents.md) |
| Agregar un nuevo metodo IPC | [`database`](database/agents.md) + [`electron`](electron/agents.md) |
| Modificar DTOs de entrada/salida | [`database`](database/agents.md) |
| Crear o modificar un context/provider | [`contexts`](app/contexts/agents.md) |
| Crear un nuevo hook compartido | [`contexts`](app/contexts/agents.md) |
| Consumir datos del backend desde React | [`contexts`](app/contexts/agents.md) + [`database`](database/agents.md) |
| Agregar un componente a la biblioteca (songs/media/bible) | [`library`](app/screens/panels/library/agents.md) |
| Implementar drag & drop de un recurso al cronograma | [`library`](app/screens/panels/library/agents.md) + [`schedule`](app/screens/panels/schedule/agents.md) |
| Modificar el cronograma o sus items | [`schedule`](app/screens/panels/schedule/agents.md) |
| Modificar la logica de pantallas en vivo | [`schedule`](app/screens/panels/schedule/agents.md) + [`contexts`](app/contexts/agents.md) |
| Crear o modificar un editor (cancion/tema/tags) | [`editors`](app/screens/editors/agents.md) |
| Abrir una nueva ventana de Electron | [`electron`](electron/agents.md) + [`editors`](app/screens/editors/agents.md) |
| Modificar PresentationView o sus sub-componentes | [`ui`](app/ui/agents.md) |
| Usar animaciones con Framer Motion | [`ui`](app/ui/agents.md) |
| Agregar un componente Shadcn UI | [`ui`](app/ui/agents.md) |
| Trabajar con el media server o archivos de medios | [`electron`](electron/agents.md) + [`library`](app/screens/panels/library/agents.md) |
| Modificar gestion de displays/pantallas | [`electron`](electron/agents.md) + [`contexts`](app/contexts/agents.md) |
| Importar o gestionar biblias | [`electron`](electron/agents.md) + [`library`](app/screens/panels/library/agents.md) |
| Agregar una nueva ruta en React Router | Leer `app/App.tsx` + [`electron`](electron/agents.md) si requiere ventana nueva |
| Modificar estilos globales o temas CSS | Leer `app/assets/globals.css` + [`ui`](app/ui/agents.md) |

## Arquitectura general

```
app/main.tsx (entry point React)
  -> QueryClientProvider (React Query)
  -> HashRouter
    -> App.tsx
      -> MediaServerProvider        (top-level, inicializa servidor de medios)
        -> DisplaysProvider         (detecta pantallas conectadas)
          -> ScreenSizeProvider     (calcula tamanos de pantalla)
            -> Routes
              "/" -> ScheduleProvider (gestiona cronograma activo)
                      -> LiveProvider (sincroniza pantallas en vivo)
                      -> DragAndDropSchedule (drag & drop con dnd-kit)
                      -> Layout con ResizablePanels:
                          [SchedulePanel | LivePanels | LiveScreens]
                          [LibraryPanel (songs/media/bible)]
              "/song/:id"     -> SongEditor (ventana separada)
              "/theme/:id"    -> ThemesEditor (ventana separada)
              "/tagSongEditor" -> TagSongsEditor (ventana separada)
              "/live-screen/:displayId" -> LiveScreen (ventana de proyeccion)
```

## Flujo de datos (IPC)

```
React Component
  -> window.api.namespace.method(args)
    -> ipcRenderer.invoke('namespace.method', args)
      -> ipcMain.handle() en main process
        -> Controller.method()
          -> Service (Prisma ORM)
            -> SQLite (prisma/dev.db)
```

## Convenciones globales del proyecto

### Idioma

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

- **Estado local de dialogs:** Resetear en `onOpenChange`, no en `useEffect` sobre la prop:

  ```tsx
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) setLocalState(propValue)
    setOpen(isOpen)
  }
  ```

- **Formularios:** Siempre React Hook Form + Zod. Definir schema en archivo separado `schema.ts`.
- **Data fetching:** Siempre React Query (`useQuery`, `useMutation`). Usar `queryKey` descriptivos. Invalidar queries despues de mutations.
- **Refetch por IPC:** Escuchar eventos IPC con `window.electron.ipcRenderer.on()` dentro de `useEffect` y llamar `refetch()` de React Query.
- **Context pattern:** `createContext(null)` + `Provider` component + `useX()` hook con throw si se usa fuera del provider.
- **Hooks compartidos** van en `app/hooks/`. Hooks especificos de un modulo van en la carpeta del modulo (ej: `media/hooks/`).

### TypeScript

- **DTOs:** Archivos `.dto.d.ts` (solo tipos, no runtime). Un archivo por controller.
- **Props de componentes:** Definir como `type Props = { ... }` en el mismo archivo, antes del componente.
- **Tipos de Prisma:** Importar directamente de `@prisma/client` cuando sean suficientes. Crear tipos extendidos solo si necesitas campos adicionales (ej: `ThemeWithMedia`).
- **Enums:** Preferir enums de Prisma (`ScheduleItemType`, `MediaType`) sobre strings literales.

### Componentes UI

- **Shadcn UI:** No modificar componentes base directamente. Si necesitas personalizar, crea un wrapper.
- **Clases CSS:** Siempre usar `cn()` de `lib/utils.ts` para combinar clases Tailwind condicionalmente.
- **Animaciones:** Usar `LazyMotion` + `m` de framer-motion. NUNCA importar `motion` directamente (ahorra ~30kb).

  ```tsx
  import { m, LazyMotion, domAnimation } from 'framer-motion'
  // Usar <m.div> en vez de <motion.div>
  // Envolver con <LazyMotion features={domAnimation}>
  ```

- **HTML peligroso:** Solo con `sanitizeHTML()` de `lib/utils.ts` (usa DOMPurify). Necesario unicamente para contenido del editor TipTap.
- **Listas renderizadas:** Keys SIEMPRE con identificador estable (`item.id`, `item.slug`). Si no hay ID natural, usar patron `{tipo}-{id}-{subIndex}`. NUNCA usar index puro.

### Accesibilidad

- Todo elemento clickeable no-interactivo (`<div>`, `<span>`) DEBE tener:

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

- Imagenes: siempre incluir `alt` (texto descriptivo o `""` para decorativas).
- `<nav>` NO necesita `role="navigation"` (ya es implicito).
- `<label>` debe estar asociado a un control (`htmlFor` o envolviendo el input). Si es solo texto visual, usar `<span>`.
- `prefers-reduced-motion` esta manejado globalmente en `globals.css`. Las animaciones CSS y JS se desactivan automaticamente.

### Performance

- **React Query `staleTime`:** Usar `Infinity` para datos que no cambian durante la sesion (ej: `bibleSchema`). Datos que cambian usan refetch por IPC events.
- **`useMemo`/`useCallback`:** Usar para calculos costosos y funciones pasadas como props. No usar para valores simples.
- **Virtualizacion:** Para listas largas (>100 items), usar `VirtualizedScrollArea` con `@tanstack/react-virtual`.
- **Lazy loading:** Imagenes en grillas usan `loading="lazy"`.

### Backend (Controllers/Services)

- Un controller por recurso, registrado en `database/routes.ts`.
- Services acceden a Prisma via `getPrisma()`. No usar singleton del service.
- Metodos del controller son `async`, reciben argumentos directamente (no req/res).
- Canal IPC: `{namespace}.{method}`. Se genera automaticamente al registrar en routes.
- DTOs definen la forma de los datos de entrada/salida.
- Agregar `@WithRole()` solo en metodos que requieran autorizacion.

### Drag & Drop

- Usar dnd-kit. Items draggables de biblioteca usan `useDraggable` con `data: { type: ScheduleItemType, accessData: resourceId }`.
- Items del cronograma usan `useSortable` (reordenable) + `useDroppable` (para insercion).
- Distinguir drag externo (biblioteca) de interno (reordenar) verificando `data.accessData !== undefined && !data.item`.

### Seguridad

- NUNCA hacer `dangerouslySetInnerHTML` sin `sanitizeHTML()`.
- NUNCA exponer secrets o keys en el codigo frontend.
- NUNCA loguear datos sensibles del usuario.
- Validar inputs con Zod antes de enviar al backend.
- Los archivos de medios se sirven via servidor HTTP local (localhost), no directamente del filesystem.

### Antes de modificar codigo

- NUNCA proponer cambios a codigo que no se haya leido primero. Leer el archivo antes de modificarlo.
- NUNCA asumir que una libreria esta disponible. Verificar en `package.json` o en archivos cercanos que ya se usa.
- Cuando se cree un componente nuevo, revisar componentes existentes similares para seguir el mismo patron (framework, naming, typing).
- Cuando se edite codigo existente, mirar los imports y el contexto para entender las convenciones locales.

### No over-engineering

- Solo hacer cambios directamente pedidos o claramente necesarios.
- No agregar features, refactors, docstrings, type annotations o "mejoras" mas alla de lo solicitado.
- No agregar error handling para escenarios imposibles. Confiar en garantias internas del framework.
- No crear helpers o abstracciones para operaciones que se usan una sola vez.
- No disenar para requisitos hipoteticos futuros. Tres lineas similares son mejor que una abstraccion prematura.
- No agregar feature flags ni shims de backwards-compatibility cuando se puede cambiar el codigo directamente.

### Git y mantenimiento

- Toda modificacion DEBE actualizar los `agents.md` correspondientes.
- No dejar codigo comentado. Si algo se elimina, eliminarlo completamente.
- No agregar comments obvios. Solo comentar logica no evidente.
- Si algo queda sin usar (variable, import, funcion), eliminarlo por completo. No renombrar con `_`, no re-exportar, no dejar `// removed`.

> **REGLA CRÍTICA:**
> Siempre que edites, crees o elimines código en cualquier módulo, ACTUALIZA el `agents.md` correspondiente de esa carpeta. Así nunca se pierde el contexto ni la trazabilidad de la arquitectura y flujos.

## Estructura de archivos clave

```
/
├── agents.md                     <- ESTE ARCHIVO (router principal)
├── prisma/
│   ├── agents.md                 <- Agent de schema/modelos
│   └── schema.prisma
├── database/
│   ├── agents.md                 <- Agent de backend
│   ├── routes.ts
│   ├── index.ts
│   └── controllers/
├── electron/
│   ├── agents.md                 <- Agent de Electron
│   └── main/
├── app/
│   ├── App.tsx
│   ├── main.tsx
│   ├── contexts/
│   │   └── agents.md             <- Agent de contexts/hooks
│   ├── hooks/
│   ├── screens/
│   │   ├── editors/
│   │   │   └── agents.md         <- Agent de editores
│   │   └── panels/
│   │       ├── library/
│   │       │   └── agents.md     <- Agent de biblioteca
│   │       └── schedule/
│   │           └── agents.md     <- Agent de cronograma
│   └── ui/
│       └── agents.md             <- Agent de componentes UI
```

## Integración ScheduleContext, Schedule y Library

- La carpeta `app/screens/panels/schedule/` es el principal consumidor de ScheduleContext: gestiona, visualiza y modifica el cronograma usando el contexto y sus helpers.
- Los items de biblioteca (songs, media, bible) se agregan al cronograma por drag & drop o acciones directas (click/context menu), usando los métodos del contexto (`addItemToSchedule`, etc.).
- Ver detalles y flujos completos en los agents de cada módulo.
