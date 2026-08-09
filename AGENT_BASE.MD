# AGENT_BASE.MD — Plantilla base para inicializar cualquier proyecto

> **Propósito:** Copia este archivo como `AGENTS.md` (o `agents.md`) en la raíz de un proyecto
> nuevo y rellena los `{{PLACEHOLDER}}`. Captura las reglas, convenciones y patrones que han
> demostrado funcionar en proyectos previos (patrón Ecclesia: Electron + React + pnpm monorepo)
> y la estructura de agents por módulo para que el contexto nunca se pierda.
>
> **Uso rápido:**
> 1. `cp AGENT_BASE.MD <proyecto>/AGENTS.md`
> 2. Rellena `{{NOMBRE_DEL_PROYECTO}}`, `{{DESCRIPCION}}`, `{{STACK}}`, `{{ARQUITECTURA}}` y las
>    tablas `{{PLACEHOLDER}}`.
> 3. Borra las secciones que no apliquen (ej. la parte de Electron/IPC en un proyecto web puro).
> 4. Por cada carpeta con responsabilidad propia, crea un `agents.md` hijo siguiendo la
>    sección «Plantilla de agents por módulo».
> 5. Cada vez que edites código, actualiza el `agents.md` del módulo afectado.

---

## Skills globales instaladas

Este proyecto usa skills globales para mejorar la calidad, performance y diseño del código.
Se invocan automáticamente según el tipo de tarea.

| Skill | Descripción breve | Uso principal |
| --- | --- | --- |
| `{{SKILL_1}}` | {{Descripción breve}} | {{Cuándo invocarla}} |
| `{{SKILL_2}}` | {{Descripción breve}} | {{Cuándo invocarla}} |

> **IMPORTANTE:** Antes de escribir o modificar código de UI, React, performance, ORM, etc.,
> consulta la skill correspondiente. Estas skills se invocan automáticamente según el tipo de
> tarea.

## Descripción del proyecto

{{NOMBRE_DEL_PROYECTO}} es una {{TIPO_DE_APP: app de escritorio (Electron + React) / web app /
servicio backend}} para {{PROPOSITO}}. {{CONTEXTO_ADICIONAL}}.

## Estado del proyecto

### Goal

- {{OBJETIVO_PRINCIPAL}}

### Done

- {{LOGRO_REALIZADO}} (detalle y decisión tomada).
- {{LOGRO_REALIZADO}}.

### In Progress

- {{TAREA_EN_CURSO}}: {{detalle y estado}}.

### Known Issues

- {{ISSUE_CONOCIDO}}: {{detalle, trabajo-around si existe}}.

## Stack tecnológico

*   **Frontend:** {{LIB_UI}} + TypeScript, {{CSS}}, {{UI_COMPONENTS}}, {{ROUTER}},
    {{FORMS + VALIDACION}}, {{DATA_FETCHING}}, {{ESTADO}}, {{ANIMACIONES}}, {{DRAG_DROP}}
*   **Backend:** {{PLATAFORMA}} + {{ORM}} + {{BD}}
*   **Package Manager:** {{PNPM/YARN/NPM}} {{VERSION}} (con {{PROTECCIONES_SUPPLY_CHAIN}})
*   **Build:** {{BUILD_TOOL}}
*   **Testing:** {{VITEST/JEST}} ({{ENV_DEFAULT}} por defecto + {{ENV_EXTRA}} por archivo),
    {{LIB_TESTING}}
*   **Empaquetado/distribución:** {{EMPACADOR}}, {{CI_WORKFLOW}} (validación de tokens al
    inicio, `timeout-minutes` por job, builds por plataforma)

## Testing (base mínima obligatoria)

> **REGLA CRÍTICA:** Toda nueva función de utilidad, hook, controller, servicio o componente
> con lógica no trivial DEBE incluir tests. No se acepta código sin tests cuando la lógica
> puede verificarse. Esto aplica tanto a código nuevo como a modificaciones significativas de
> código existente.

- Comandos disponibles:
  - `npm run test`
  - `npm run test:watch`
  - `npm run test:coverage`
- Configuración central: {{RUTA_CONFIG_VITEST}}.
- Setup global de matchers: {{RUTA_SETUP}}.
- Para pruebas de componentes/DOM usar `// @vitest-environment jsdom` en el archivo de test.
- Priorizar cobertura de seguridad en utilidades críticas (ej. sanitización HTML) y regresiones
  de lógica en módulos compartidos.

### Qué testear siempre

| Tipo de código | Tests requeridos |
| --- | --- |
| Utilidades (`lib/`, `src/`) | Unit tests de todos los casos relevantes (happy path + edge cases + errores) |
| Hooks compartidos (`hooks/`) | Tests con `renderHook` de comportamiento público |
| Controllers/Services del backend | Unit tests de lógica de negocio (mocking del ORM si aplica) |
| Componentes con lógica propia | Tests de comportamiento (no de snapshot): interacciones, estados, renders condicionales |
| Schemas Zod (`schema.ts`) | Tests de validación: inputs válidos, inválidos y casos borde |
| Funciones de seguridad | Tests exhaustivos incluyendo XSS, inyección, inputs maliciosos |

### Convenciones de archivos de test

- Archivos de test junto al módulo que prueban: `utils.ts` → `utils.test.ts`
- Para tests de módulos Node/backend: entorno `node` (default)
- Para tests de componentes React/DOM: `// @vitest-environment jsdom` al inicio del archivo
- Describir cada suite con `describe('NombreDelMódulo', ...)` y cada caso con `it('debería ...')`

## Auto-invoke: Consulta SIEMPRE el agent antes de actuar

Cuando vayas a realizar alguna de estas acciones, SIEMPRE consulta el agent indicado ANTES de
escribir código:

| Acción | Agent a consultar |
| --- | --- |
| {{ACCION_1}} | [`{{AGENT}}`]({{RUTA}}) |
| {{ACCION_2}} | [`{{AGENT}}`]({{RUTA}}) + [`{{AGENT_2}}`]({{RUTA}}) |

*(Los agent hijos viven junto a su carpeta como `agents.md`; consulta la sección «Plantilla de
agents por módulo».)*

## Arquitectura general

```
{{PUNTO_ENTRADA_FRONTEND}} (entry point)
  -> {{DATA_PROVIDER}} (React Query / estado global)
  -> {{ROUTER}}
    -> {{APP_ROOT}}
      -> {{PROVIDER_1}}          (top-level, {{RESPONSABILIDAD}})
        -> {{PROVIDER_2}}        ({{RESPONSABILIDAD}})
          -> {{PROVIDER_3}}      ({{RESPONSABILIDAD}})
            -> Routes
              "/"        -> {{VISTA_PRINCIPAL}} ({{RESPONSABILIDAD}})
              "/{{ruta}}" -> {{VISTA_2}} ({{RESPONSABILIDAD}})
```

## Monorepo (pnpm Workspaces)

```
/
├── apps/
│   ├── {{API}}/               # {{NOMBRE_PAQUETE_API}} — capa de datos
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── {{dbClient}}.ts  # set{{Client}}, get{{Client}}, injectables
│   │   │   ├── routes.ts
│   │   │   ├── sockets/       # Socket.IO — SocketEventMap (único registro), handlers runtime
│   │   │   └── controllers/   # {{Controller1}}, {{Controller2}}, etc.
│   │   ├── prisma/            # Schema + migraciones (schema.prisma, migrations/)
│   │   └── package.json
│   └── {{DESKTOP}}/               # {{NOMBRE_PAQUETE_DESKTOP}} — frontend
│       ├── app/               # Frontend React (main, screens, UI)
│       ├── electron/          # Electron main process + preload  (si aplica)
│       ├── tests/
│       ├── {{config}}.ts
│       └── package.json
├── packages/
│   ├── {{QUERIES}}/               # capa de fetch/socket compartida
│   └── {{SCRIPTS}}/               # scripts de release/build
├── .npmrc                     # {{PROTECCION_SUPPLY_CHAIN}}
├── pnpm-workspace.yaml        # Definición de workspaces (apps/*, packages/*)
├── package.json               # pnpm workspace root
└── {{AGENTS}}                 # Este archivo (router principal)
```

## Flujo de datos ({{IPC / API}})

```
{{React Component}}
  -> {{window.api.namespace.method(args) / api.namespace.method(args)}}
    -> {{ipcRenderer.invoke('namespace.method', args) / POST /api/{namespace}/{method}}}
      -> {{ipcMain.handle() / route handler}} en main process
        -> Controller.method()
          -> Service.method()
            -> Prisma / {{DB}}
```

- Todos los fetches de datos deben hacerse con `useQuery`.
- Si se repite el uso de la misma `queryKey` en varios componentes, crear un hook en la carpeta
  `app/hooks/` para centralizar la lógica.
- El canal del backend se llama `{namespace}.{method}` y se genera automáticamente al registrar
  el controller en `routes.ts`.

## Idioma

- **Comunicación:** SIEMPRE responder en español. Nunca en inglés.
- **Código (identificadores):** Inglés para modelos, controllers, services, tipos, props, hooks.
  Ej: `SongsController`, `useThemes`, `PresentationView`.
- **UI (textos visibles):** Español. Ej: `"Añadir canción al cronograma"`, `"Guardar"`.
- **Comentarios:** Español preferido, inglés aceptable.
- **Nombres de archivo:** Inglés, camelCase para componentes (`songItem.tsx`), PascalCase para
  componentes grandes (`MediaCard.tsx`).

## Convenciones de código

### React

- **Estado derivado de props:** NO usar `useEffect` para sincronizar. Usar render-time reset con
  `useRef` para trackear el valor anterior:

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
- **Data fetching:** Siempre React Query (`useQuery`, `useMutation`). Usar `queryKey`
  descriptivos. Invalidar queries después de mutations.
- **Refetch por IPC/events:** Escuchar eventos IPC con `window.electron.ipcRenderer.on()`
  dentro de `useEffect` y llamar `refetch()` de React Query.
- **Context pattern:** `createContext(null)` + `Provider` component + `useX()` hook con throw si
  se usa fuera del provider.
- **Hooks compartidos** van en `app/hooks/`. Hooks específicos de un módulo van en la carpeta
  del módulo (ej: `media/hooks/`).

### TypeScript

- **DTOs:** Archivos `.dto.d.ts` (solo tipos, no runtime). Un archivo por controller.
- **Props de componentes:** Definir como `type Props = { ... }` en el mismo archivo, antes del
  componente.
- **Tipos del ORM:** Importar directamente del cliente generado cuando sean suficientes. Crear
  tipos extendidos solo si necesitas campos adicionales.
- **Enums:** Preferir enums del schema/DB sobre strings literales.

### Componentes UI

- **Biblioteca base:** No modificar componentes base directamente. Si necesitas personalizar,
  crea un wrapper.
- **Clases CSS:** Siempre usar `cn()` de `lib/utils.ts` para combinar clases condicionalmente.
- **Animaciones:** Usar `LazyMotion` + `m` de framer-motion. NUNCA importar `motion`
  directamente (ahorra ~30kb).
- **HTML peligroso:** Solo con `sanitizeHTML()` de `lib/utils.ts` (usa DOMPurify). Necesario
  únicamente para contenido de editor rico.
- **Listas renderizadas:** Keys SIEMPRE con identificador estable (`item.id`, `item.slug`). Si
  no hay ID natural, usar patrón `{tipo}-{id}-{subIndex}`. NUNCA usar index puro.

### Accesibilidad

Todo elemento clickeable no-interactivo (`<div>`, `<span>`) DEBE tener:

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

- Imágenes: siempre incluir `alt` (texto descriptivo o `""` para decorativas).
- `<nav>` NO necesita `role="navigation"` (ya es implícito).
- `<label>` debe estar asociado a un control (`htmlFor` o envolviendo el input). Si es solo
  texto visual, usar `<span>`.
- `prefers-reduced-motion` está manejado globalmente. Las animaciones CSS y JS se desactivan
  automáticamente.

### Performance

- **React Query `staleTime`:** Usar `Infinity` para datos que no cambian durante la sesión.
  Datos que cambian usan refetch por eventos.
- **`useMemo`/`useCallback`:** Usar para cálculos costosos y funciones pasadas como props. No
  usar para valores simples.
- **Virtualización:** Para listas largas (>100 items), usar un componente virtualizado con
  `@tanstack/react-virtual`.
- **Lazy loading:** Imágenes en grillas usan `loading="lazy"`.
- **Tamaños en pantallas de proyección en vivo:** Todo lo que se muestra en pantallas
  proyectadas/overlays DEBE dimensionarse proporcional al tamaño real del contenedor, NUNCA con
  `px`/`rem` fijos. Usar un helper compartido `scaleLivePx(basePx, containerHeightPx)` (o el
  ratio `containerHeightPx / BASE_HEIGHT`) para derivar cualquier px absoluto. Para dimensiones
  de layout   preferir porcentajes (`%`).

### Backend (Controllers/Services)

- Un controller por recurso, registrado en `{{ruta_routes}}`.
- Services acceden al DB vía `get{{Client}}()`. No usar singleton del service.
- Métodos del controller son `async`, reciben argumentos directamente (no req/res).
- Canal IPC: `{namespace}.{method}`. Se genera automáticamente al registrar en routes.
- DTOs definen la forma de los datos de entrada/salida.

### Drag & Drop

- Usar dnd-kit. Items draggables de biblioteca usan `useDraggable` con
  `data: { type: {{ItemType}}, accessData: resourceId }`.
- Items de una lista reordenable usan `useSortable` (reordenable) + `useDroppable` (para
  inserción).
- Distinguir drag externo (biblioteca) de interno (reordenar) verificando
  `data.accessData !== undefined && !data.item`.

### Seguridad

- NUNCA hacer `dangerouslySetInnerHTML` sin `sanitizeHTML()`.
- NUNCA exponer secrets o keys en el código frontend.
- NUNCA loguear datos sensibles del usuario.
- Validar inputs con Zod antes de enviar al backend.
- Los archivos de medios se sirven vía servidor HTTP local (localhost), no directamente del
  filesystem.

### IPC / API desde el renderer

- En componentes React (renderer), SIEMPRE usar `window.api.namespace.method()` para llamar al
  backend. NUNCA importar el paquete API directamente en el renderer — ese módulo asume
  `window.api` internamente pero su import directo no está disponible correctamente en todas las
  ventanas.
- Los imports de **tipos** (`.dto.d.ts`) sí están permitidos en el renderer.

### Mantenibilidad y composición (regla permanente)

- NUNCA dejar código espagueti: cuando un componente crezca o mezcle demasiadas
  responsabilidades, separarlo en subcomponentes/hooks/utilidades del módulo.
- Priorizar composición y responsabilidades claras (`orquestador` + piezas reutilizables) para
  que el código sea fácil de leer, testear y extender.
- Mantener el balance: componer para claridad real, sin crear abstracciones innecesarias de un
  solo uso.

### No over-engineering

- Solo hacer cambios directamente pedidos o claramente necesarios.
- No agregar features, refactors, docstrings, type annotations o "mejoras" más allá de lo
  solicitado.
- No agregar error handling para escenarios imposibles. Confiar en garantías internas del
  framework.
- No crear helpers o abstracciones para operaciones que se usan una sola vez.
- No diseñar para requisitos hipotéticos futuros. Tres líneas similares son mejor que una
  abstracción prematura.
- No agregar feature flags ni shims de backwards-compatibility cuando se puede cambiar el
  código directamente.

### Git y mantenimiento

- Toda modificación DEBE actualizar los `agents.md` correspondientes.
- No dejar código comentado. Si algo se elimina, eliminarlo completamente.
- No agregar comments obvios. Solo comentar lógica no evidente.
- Si algo queda sin usar (variable, import, función), eliminarlo por completo. No renombrar con
  `_`, no re-exportar, no dejar `// removed`.

> **REGLA CRÍTICA:**
> Siempre que edites, crees o elimines código en cualquier módulo, ACTUALIZA el `agents.md`
> correspondiente de esa carpeta. Así nunca se pierde el contexto ni la trazabilidad de la
> arquitectura y flujos.

## Antes de modificar código

> **REGLA OBLIGATORIA — {Codebase Memory / MCP} primero:**
> SIEMPRE usar las herramientas MCP de conocimiento del codebase (`search_graph`, `trace_path`,
> `get_code_snippet`, `query_graph`, `get_architecture`) ANTES de caer en `grep`, `glob`, `read`
> o `task` exploratoria. Solo usar `grep`/`glob`/`read` como fallback cuando el MCP no devuelva
> resultados suficientes o para archivos no indexados (configs, Dockerfiles, scripts sueltos).

- NUNCA proponer cambios a código que no se haya leído primero. Leer el archivo antes de
  modificarlo.
- NUNCA asumir que una librería está disponible. Verificar en `package.json` o en archivos
  cercanos que ya se usa.
- Cuando se cree un componente nuevo, revisar componentes existentes similares para seguir el
  mismo patrón (framework, naming, typing).
- Cuando se edite código existente, mirar los imports y el contexto para entender las
  convenciones locales.

## Estructura de archivos clave

```
/
├── {{AGENTS}}                     <- ESTE ARCHIVO (router principal)
├── apps/
│   ├── api/
│   │   ├── {{AGENTS}}.md          <- Agent de backend (controllers/services)
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── prisma.ts         <- set{{Client}}, get{{Client}}, injectables
│   │   │   ├── routes.ts
│   │   │   └── controllers/      <- Controller1, Controller2, etc.
│   │   ├── prisma/
│   │   │   ├── {{AGENTS}}.md     <- Agent de schema/modelos
│   │   │   ├── schema.prisma
│   │   │   └── migrations/
│   │   └── package.json
│   └── desktop/
│       ├── {{AGENTS}}.md         <- Agent de app shell / main process
│       ├── app/
│       │   ├── App.tsx
│       │   ├── main.tsx
│       │   ├── contexts/
│       │   │   └── {{AGENTS}}.md <- Agent de contexts/hooks
│       │   ├── hooks/
│       │   ├── screens/
│       │   │   ├── editors/
│       │   │   │   └── {{AGENTS}}.md  <- Agent de editores
│       │   │   └── panels/
│       │   │       ├── library/
│       │   │       │   └── {{AGENTS}}.md  <- Agent de biblioteca
│       │   │       └── schedule/
│       │   │           └── {{AGENTS}}.md  <- Agent de cronograma/panel principal
│       │   └── ui/
│       │       └── {{AGENTS}}.md     <- Agent de componentes UI
│       ├── tests/
│       ├── package.json
│       └── {{config}}.ts
├── .npmrc                     <- {{PROTECCION_SUPPLY_CHAIN}}
├── pnpm-workspace.yaml        <- Definición de workspaces
├── package.json               <- pnpm workspace root
└── {{AGENTS}}                 <- ESTE ARCHIVO (router principal)
```

## Plantilla de agents por módulo

Cada carpeta con responsabilidad propia debe tener su propio `agents.md` hijo, siguiendo esta
estructura. Así el contexto se mantiene cerca del código y el router raíz solo referencia.

```markdown
# {{Nombre del módulo}} — Agent de {{responsabilidad}}

## Descripción

{{Para qué sirve este módulo y qué abstrae.}}

## Archivos

| Archivo | Descripción |
| --- | --- |
| {{ruta/archivo.ts}} | {{qué contiene}} |
| {{ruta/archivo.ts}} | {{qué contiene}} |

## Arquitectura y flujo

{{Cómo se integra: quién lo consume, qué consume, eventos que emite/escucha, canal IPC/API.}}
{{Diagrama si es útil.}}

## Convenciones

- {{reglas específicas del módulo}}
- {{patrones a seguir dentro de la carpeta}}

## Agents relacionados

- [`{{agente}`](../{{ruta}}/agents.md) — {{relación}}

## Cambios recientes

| Fecha | Cambio | Solución implementada | Archivos | Validación |
| --- | --- | --- | --- | --- |
| {{YYYY-MM-DD}} | {{qué se hizo}} | {{por qué / decisión}} | {{archivos tocados}} | {{cómo se verificó}} |

*(Mantener esta tabla al día en cada PR/cambio.)*
```

## Patrones transversales (referencia)

### Controller / Service / DTO

```typescript
// dto.d.ts — solo tipos
export type FooInput = { id: string; name: string }

// foo.controller.ts
export class FooController {
  async getFoo(input: FooInput) {
    return FooService.getFoo(input)
  }
}

// foo.service.ts
export class FooService {
  static async getFoo(input: FooInput) {
    return getClient().foo.findMany({ where: { id: input.id } })
  }
}
```

### Cómo agregar un nuevo controller

1. Crear `src/controllers/fooController.ts` (y su `.dto.d.ts`).
2. Registrar en `src/routes.ts` (genera `{namespace}.{method}` automáticamente).
3. Crear el service correspondiente accediendo al DB vía `get{{Client}}()`.
4. Si expone eventos en vivo, registrar el handler en `sockets/`.
5. Crear/actualizar `agents.md` del módulo.
6. Añadir tests del controller/service.

