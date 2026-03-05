# Backend (Controllers / Services) Agent

> **Agent router:** [`/agents.md`](../agents.md)

## Descripcion

Capa de backend que conecta el frontend React con la base de datos SQLite via IPC de Electron. Sigue un patron Controller/Service con DTOs para tipado seguro.

## Arquitectura

```text
Frontend (React)
  -> window.api.namespace.method(args)     // api.ts wraps ipcRenderer
    -> ipcRenderer.invoke('namespace.method', args)
      -> ipcMain.handle()                  // index.ts registerRoutes()
        -> Controller.method(args)         // Instancia nueva por llamada
          -> Service (Prisma ORM)
            -> SQLite
```

## Archivos principales

```text
database/
├── index.ts           # registerRoutes() y exposeRoutes() - setup IPC
├── api.ts             # wrapApi() - wrapper frontend para IPC
├── routes.ts          # Mapa de namespaces a controllers
├── database.ts        # Inicializacion de DB
├── routeTypes.d.ts    # Tipos de rutas
├── controllers/       # Un directorio por recurso
│   ├── bible/
│   │   ├── bible.controller.ts
│   │   ├── bible.service.ts
│   │   ├── bibleManagment.service.ts
│   │   ├── bible.dto.d.ts
│   │   └── utils.ts
│   ├── media/
│   │   ├── media.controller.ts
│   │   ├── media.service.ts
│   │   └── media.dto.d.ts
│   ├── songs/
│   │   ├── songs.controller.ts
│   │   ├── songs.service.ts
│   │   └── songs.dto.d.ts
│   ├── presentations/
│   │   ├── presentations.controller.ts
│   │   ├── presentations.service.ts
│   │   └── presentations.dto.d.ts
│   ├── tagSongs/
│   │   ├── tagSongs.controller.ts
│   │   ├── tagSongs.service.ts
│   │   └── tagSongs.dto.d.ts
│   ├── themes/
│   │   ├── themes.controller.ts
│   │   ├── themes.service.ts
│   │   └── themes.dto.d.ts
│   ├── schedule/
│   │   ├── schedule.controller.ts
│   │   ├── schedule.service.ts
│   │   ├── schedule-group.service.ts
│   │   └── schedule.dto.d.ts
│   ├── settings/
│   │   ├── settings.controller.ts
│   │   ├── settings.service.ts
│   │   └── settings.dto.d.ts
│   └── selectedScreens/
│       ├── index.ts
│       ├── selectedScreens.controller.ts
│       ├── selectedScreens.service.ts
│       └── selectedScreens.dto.d.ts
├── decorators/
│   └── withRole.ts    # @WithRole('owner', 'admin') decorator
├── middleware/
│   ├── decimal.ts     # Serializacion Decimal/Date para IPC
│   └── withRole.ts    # Middleware de autorizacion por rol
└── stores/
    ├── authStore.ts   # Sesiones de usuario por frameId
    └── frameIdStore.ts
```

## Namespaces IPC registrados

Definidos en `routes.ts`:

| Namespace | Controller | Metodos principales |
| --------- | ---------- | ------------------- |
| `songs` | SongsController | `createSong`, `getSongs`, `getSongById`, `getSongsByIds`, `updateSong`, `deleteSong` |
| `themes` | ThemesController | `createTheme`, `getAllThemes`, `getThemeById`, `updateTheme`, `deleteTheme` |
| `media` | MediaController | `importMedia`, `getAllMedia`, `getMediaByIds`, `deleteMedia`, `moveMedia`, `renameMedia`, `createFolder`, `renameFolder`, `deleteFolder` |
| `tagSongs` | TagSongsController | `createTagSong`, `getAllTagSongs`, `updateTagSong`, `deleteTagSong` |
| `bible` | BibleController | `getBibleSchema`, `getVerses`, `getCompleteChapter`, `getAvailableBibles`, `importBible`, `searchTextFragment`, `getDefaultBibleSettings`, `updateDefaultBibleSettings` |
| `schedule` | ScheduleController | `createSchedule`, `getAllSchedules`, `getScheduleById`, `updateSchedule`, `deleteSchedule`, `getActualSchedule`, `addItemToSchedule`, `getAllGroupTemplates`, `createGroupTemplate`, `updateGroupTemplate`, `deleteGroupTemplate`, `getGroupTemplateById` |
| `presentations` | PresentationsController | `createPresentation`, `getPresentations`, `getPresentationsByIds`, `getPresentationById`, `updatePresentation`, `deletePresentation` |
| `setttings` | SettingsController | `getSettings`, `updateSettings` |
| `selectedScreens` | SelectedScreensController | `getSelectedScreens`, `updateSelectedScreens` |
| `fonts` | FontsController | `addFont`, `getAllFonts`, `deleteFont` |

**Nota:** El namespace `setttings` tiene un typo historico (3 t's). No cambiar sin actualizar todos los puntos de referencia.

## Patron de un Controller/Service

### Controller (recibe la llamada IPC)

```typescript
// database/controllers/songs/songs.controller.ts
export default class SongsController {
  private songsService = new SongsService()

  async createSong(data: CreateSongDTO) {
    return await this.songsService.createSong(data)
  }

  async getSongs(params: GetSongsDTO) {
    return await this.songsService.getSongs(params)
  }
}
```

### Service (logica de negocio con Prisma)

```typescript
// database/controllers/songs/songs.service.ts
export default class SongsService {
  async createSong(data: CreateSongDTO) {
    return await prisma.song.create({
      data: { ... },
      include: { lyrics: { include: { tagSongs: true } } }
    })
  }
}
```

### DTO (tipos de datos)

```typescript
// database/controllers/songs/songs.dto.d.ts
export interface CreateSongDTO {
  title: string
  author?: string
  lyrics: { content: string; tagSongsId?: number }[]
}
```

## Convenciones

- **Un Controller por recurso**, instanciado en cada llamada IPC (no singleton).
- **Services usan Prisma** directamente (import del cliente global).
- **DTOs** se definen como archivos `.dto.d.ts` (solo tipos, no runtime).
- **Metodos del controller** son `async` y reciben los argumentos directamente (no `req/res`).
- El canal IPC es `{namespace}.{method}` (ej: `songs.createSong`).
- **No usar middleware HTTP** - todo es IPC directo.
- La configuración global de presentación bíblica se inicializa con `positionStyle = 10` (separación desde borde) y se normaliza si viene sin valor para mantener comportamiento visual consistente.
- El módulo `presentations` serializa `slides` como JSON string en Prisma para MVP y lo normaliza a objeto en service antes de devolver al renderer.
- `presentations.slides` ahora soporta estructura mixta por diapositiva con `items[]` (schedule-like): cada item define `type`, `accessData`, `layer`, `customStyle` y `animationSettings` para render por capas y animación por elemento.
- Cada slide de `presentations.slides` también soporta `videoLiveBehavior` (`auto` | `manual`) para controlar si videos de la diapositiva inician automáticamente al entrar en live o quedan en espera de play manual.
- Cada slide de `presentations.slides` también puede incluir `themeId` opcional (`number | null`) para aplicar un tema global de presentación en runtime.
- `schedule.updateSchedule` usa `dateFrom` y `dateTo` (no `date`) para mantener consistencia con el modelo Prisma y el estado del formulario en frontend.

## Serializacion IPC

En `middleware/decimal.ts`:

- `Decimal` de Prisma se serializa como `{ __decimal__: string }` y se restaura al deserializar.
- `Date` se serializa como `{ __date__: ISO string }` y se restaura automaticamente.
- Esto previene corrupcion de datos al cruzar la frontera entre procesos.

## Control de acceso

- Decorator `@WithRole('owner', 'admin')` en metodos del controller.
- Middleware verifica el rol del usuario usando `authStore` basado en el `frameId` de Electron.
- Sesion se limpia automaticamente cuando la ventana se destruye.

## Como agregar un nuevo controller

1. Crear directorio en `controllers/nuevoRecurso/`
2. Crear `nuevoRecurso.controller.ts`, `nuevoRecurso.service.ts`, `nuevoRecurso.dto.d.ts`
3. Registrar en `routes.ts`: `nuevoRecurso: NuevoRecursoController`
4. El namespace queda disponible automaticamente como `window.api.nuevoRecurso.metodo()`
5. Actualizar este agent y `/prisma/agents.md` si se creo un nuevo modelo

## Agents relacionados

- Schema de datos -> `/prisma/agents.md`
- Setup de IPC en main process -> `/electron/agents.md`
- Consumo desde frontend -> `/app/contexts/agents.md`
