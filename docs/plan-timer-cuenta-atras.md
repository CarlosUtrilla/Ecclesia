# Plan: Cuenta atrás de servicio como tipo de contenido `TIMER`

> Documento de plan para retomar en una sesión nueva (con el MCP `codebase-memory-mcp` activo).
> Feature: cronómetro de cuenta atrás para la iglesia, mostrado en la pantalla live con un círculo (progress radial) cuyo arco se vacía al acabar el tiempo.

## Context
Se quiere un **cronómetro de cuenta atrás para la iglesia** (distinto de los timers de *stage*) para mostrarlo en la **pantalla live** e indicar en cuánto empieza el servicio, con un **círculo cuyo arco se vacía** conforme se acaba el tiempo.

Requisitos refinados por el usuario:
1. El timer NO es un overlay aparte: es **un tipo de contenido más** renderizado por `PresentationView`, como los renders de video/imagen/texto bíblico/texto. Así usa **uno de los temas** existentes como fondo (reutilizando el pipeline de temas).
2. Tiene un **controlador en el panel `items-on-live`** (como canciones/biblia/media) que muestra: tiempo restante, **mensaje final editable ahí mismo**, **texto del timer editable**, y botones **+30s / −30s / custom**.
3. Se puede **añadir al schedule** y **presentar en vivo** desde un **diálogo de configuración** (dos acciones: *Añadir al schedule* / *Presentar en vivo*).
4. El diálogo se abre desde una **barra de menú superior incrustada** (shadcn Menubar, no nativa) que además absorbe opciones existentes (Importar/Exportar).

Comportamiento al llegar a 0: mostrar el **mensaje final** y luego **auto-ocultar** (limpiar el item live).

Resultado: el timer es un item de schedule de tipo `TIMER`, fluye por el mismo pipeline `schedule → contentScreen → live`, se renderiza con un círculo tipo progress radial sobre el tema elegido, y se opera desde `items-on-live`.

---

## Arquitectura confirmada (exploración)
- **Tipos de item = enum Prisma** `ScheduleItemType {BIBLE,SONG,MEDIA,PRESENTATION,GROUP}` en `apps/api/prisma/schema.prisma:200`, reexportado por `apps/api/src/index.ts:157` (`export * from '@prisma/client'`). `ScheduleItem.accessData` es un único `String` (los refs bíblicos ya codifican datos ahí).
- **Union de render** `PresentationRenderableResourceType = ScheduleItemType | 'TEXT' | 'SHAPE'` en `apps/desktop/app/ui/PresentationView/types.d.ts:7`; añadir `TIMER` al enum Prisma lo vuelve válido automáticamente. Item de contenido = `PresentationViewItems` (mismo archivo, ~L57-87).
- **Dispatch de render (standalone)**: `apps/desktop/app/ui/PresentationView/components/ResourceContent.tsx` — `if resourceType==='PRESENTATION'` / `'BIBLE'` / fallthrough `AnimatedText` (L91/122/157). Aquí se añade la rama `TIMER` **antes** del fallthrough. (El fondo/tema lo pintan las capas de `PresentationBody.tsx`/`usePresentationBackground` detrás del render, así que un tipo no-media hereda el tema seleccionado gratis — como `BIBLE`/`SONG`.)
- **Añadir al schedule**: `addItemToSchedule({type, accessData})` en `apps/desktop/app/contexts/ScheduleContext/index.tsx:155`; hay una **whitelist** que descarta tipos no listados (L157) → añadir `'TIMER'`.
- **Presentar en vivo**: `showItemOnLiveScreen(item, index?)` en `apps/desktop/app/contexts/ScheduleContext/utils/liveContext.tsx:628`. Para recursos aún no en schedule se construye un `ScheduleItem` efímero con `generateUniqueId()` (de `@/lib/utils`), `order:-1`, `scheduleId:-1`, `deletedAt:null` (patrón en `panels/library/presentations/index.tsx:91` y `media/MediaCard.tsx:64`).
- **Resolución de contenido**: `getScheduleItemContentScreen(item)` en `utils/indexDataItems.tsx` construye `{title, content: PresentationViewItems[]}`; también `getScheduleItemIcon` (~L102) y `getScheduleItemLabel` (~L136).
- **Dispatch de controladores** en `apps/desktop/app/screens/panels/items-on-live/index.tsx` `renderContent()` (~L113-143) por `itemOnLive.type`; hay también una etiqueta legible por tipo (~L157-166). Patrón de controlador sin props que lee de contexto: `RenderSongLyrics.tsx` / `RenderMedia.tsx`.
- **Tema aplicado**: `utils/resolveAppliedLiveTheme.ts` — hoy `PRESENTATION→BlankTheme`, resto `selectedTheme`. Reutilizable para aplicar un tema elegido por el timer.
- **Re-broadcast en cambios**: mutar `setItemOnLive({...itemOnLive, accessData})` dispara el efecto que recomputa `contentScreen` y reenvía por `updateLiveScreenContent` (patrón ya usado por el cambio de versión bíblica). **No hace falta un canal IPC nuevo**: el `endsAt` es absoluto y viaja en el `contentScreen`, así que el render live cuenta solo con un `setInterval` local.
- **Utilidades de tiempo** reutilizables: `apps/desktop/app/lib/time.ts` (`formatRemaining`, `resolveRemainingMs`).

---

## Modelo de datos del timer
`accessData` = JSON string (nuevo helper `apps/desktop/app/lib/timerAccessData.ts` con `encodeTimerAccessData`/`parseTimerAccessData`, al estilo de `presentationBibleBadge.ts`):
```jsonc
{ "v":1, "mode":"duration"|"clock", "durationSec":900, "startClock":"11:00",
  "title":"El servicio comienza en", "endMessage":"El servicio va a comenzar",
  "themeId": 12, "autoHide": true, "endsAt": null }
```
- El **schedule** guarda solo la config (duración/clock/textos/tema). `endsAt` es **estado efímero de la ejecución en vivo**, no se persiste en el item de schedule.
- **Arranque del reloj**: cuando un `TIMER` se pone en vivo sin `endsAt`, el controlador `RenderTimerControls` calcula `endsAt = Date.now() + durationSec*1000` (o la próxima ocurrencia de `startClock`) y lo escribe con `setItemOnLive({...itemOnLive, accessData: encode({...cfg, endsAt})})`. A partir de ahí `endsAt` es fijo (re-resolves estables) y `+30/−30/custom` solo mutan `endsAt`. Cada nueva presentación reinicia (el item guardado sigue sin `endsAt`).

---

## Parte A — Tipo `TIMER` end-to-end
1. **Prisma**: añadir `TIMER` a `enum ScheduleItemType` (`apps/api/prisma/schema.prisma:200`) y migrar: `pnpm --filter @ecclesia/api prisma migrate dev -n add_timer_schedule_item_type` (regenera el cliente; el tipo fluye por el reexport). *(SQLite dev.db — usar el skill prisma-cli si hace falta.)*
2. **Whitelist**: añadir `'TIMER'` en `addItemToSchedule` (`ScheduleContext/index.tsx:157`).
3. **Resolver** (`utils/indexDataItems.tsx`):
   - `getScheduleItemIcon`: icono `Timer`/`TimerReset` (lucide) para `TIMER`.
   - `getScheduleItemLabel`: label "Temporizador" (o el `title` del timer).
   - `getScheduleItemContentScreen`: para `TIMER` devolver `{ title, content: [{ id, resourceType:'TIMER', text:'', timer: parseTimerAccessData(accessData) }] }`.
4. **Tipos** (`PresentationView/types.d.ts`): añadir `'TIMER'` a la union (L7 — o confiar en el enum Prisma) y un campo opcional `timer?: { durationSec; endsAt: number|null; title; endMessage; autoHide? }` a `PresentationViewItems` (~L57-87).

## Parte B — Render del círculo (pantalla live)
1. **`ResourceContent.tsx`**: añadir rama `if (currentItem.resourceType === 'TIMER') return <TimerRender item={currentItem} theme={theme} isPreview={!isLive} .../>` antes del `AnimatedText` final (~L156). El fondo del tema ya se pinta detrás.
2. **Nuevo `apps/desktop/app/ui/PresentationView/components/TimerRender.tsx`** (fondo transparente):
   - `CountdownRing` SVG: dos `<circle>` (track + arco), `strokeDasharray = 2πr`, `strokeDashoffset = C*(1 - remaining/total)`, `transform: rotate(-90deg)`, `stroke-linecap: round`, color `var(--primary)` (o color del tema). El arco **se vacía** al acabar.
   - Centro: `formatRemaining(remainingMs)` grande + `title` encima. `setInterval(1000)` local; `remainingMs = item.timer.endsAt - now` (usa `resolveRemainingMs`). Si `endsAt==null` muestra `durationSec` estático ("sin iniciar").
   - En `remaining<=0`: muestra `endMessage`. El auto-ocultar lo dispara el controlador (Parte C), no el render.

## Parte C — Controlador en `items-on-live`
1. **Dispatch** (`items-on-live/index.tsx`): `case 'TIMER': return <RenderTimerControls data={content} />` en `renderContent()` (~L126) + rama de etiqueta "Temporizador" (~L157).
2. **Nuevo `.../items-on-live/components/RenderTimerControls.tsx`** (lee `useSchedule()` + `useLive()`, patrón `RenderMedia`):
   - Arranca el reloj (escribe `endsAt` si falta, ver Modelo de datos).
   - Muestra el **tiempo restante** en vivo (setInterval local sobre `endsAt`).
   - **Texto del timer** y **mensaje final** editables inline (inputs); al cambiar → `setItemOnLive({...itemOnLive, accessData: encode(nuevaCfg)})` (re-broadcast automático).
   - Botones **+30s / −30s / custom** → mutan `endsAt` en accessData y re-broadcast.
   - **Auto-ocultar**: si `autoHide`, al pasar `endsAt` (+ unos segundos para leer el mensaje) llama a la acción de limpiar item en vivo existente (handler de `Escape` / `setItemOnLive(null)` en `liveContext`).

## Parte D — Tema de fondo del timer
- El timer respeta el **tema seleccionado global** por el pipeline normal (gratis). Además, para "elegir un tema para el timer": guardar `themeId` en accessData y extender `resolveAppliedLiveTheme(item, selectedTheme, themes)` para que, si `item.type==='TIMER'` y hay `themeId`, devuelva ese tema (buscándolo en `useThemes()`; pasar la lista desde `liveContext`). El diálogo usa el selector de temas existente.

## Parte E — Barra de menú superior + diálogo de configuración
1. **Menubar shadcn**: `pnpm --filter @ecclesia/desktop add @radix-ui/react-menubar` y crear `apps/desktop/app/ui/menubar.tsx` (wrapper shadcn Radix, clonando estilo de `dropdown-menu.tsx`). *(El usuario enlazó la variante Base UI; se usa Radix por consistencia con el resto del repo, visualmente idéntica.)*
2. **`apps/desktop/app/screens/components/AppMenubar.tsx`**: menú **Archivo/Datos** con Importar/Exportar (mover lógica de `panels/library/ImportExportButton.tsx`: `ExportDialog`, `SongImporter`, `handleImportThemes/Bible`), y menú **Servicio → "Cuenta atrás…"** que abre el diálogo. Montar en `main-route.tsx` dentro de `ScheduleProvider` como barra fija (`h-9`, borde inferior) con el `ResizablePanelGroup` en `flex-1 min-h-0`. Quitar `<ImportExportButton/>` del header de `panels/library/index.tsx`.
3. **`apps/desktop/app/screens/components/ChurchCountdownDialog.tsx`** (`@/ui/dialog/input/label/button` + selector de tema existente): campos **modo** (duración min/seg **o** hora `HH:MM`), **título**, **mensaje final**, **tema**, **auto-ocultar**. Dos acciones:
   - **Añadir al schedule** → `addItemToSchedule({ type:'TIMER', accessData: encodeTimerAccessData(cfg) })`.
   - **Presentar en vivo** → `showItemOnLiveScreen({ id: generateUniqueId(), type:'TIMER', accessData: encodeTimerAccessData({...cfg, endsAt: computeEndsAt(cfg)}), order:-1, scheduleId:-1, updatedAt:new Date(), deletedAt:null }, 0)`.

---

## Archivos clave
- **Nuevos**: `apps/desktop/app/ui/menubar.tsx`, `apps/desktop/app/screens/components/AppMenubar.tsx`, `apps/desktop/app/screens/components/ChurchCountdownDialog.tsx`, `apps/desktop/app/ui/PresentationView/components/TimerRender.tsx`, `apps/desktop/app/screens/panels/items-on-live/components/RenderTimerControls.tsx`, `apps/desktop/app/lib/timerAccessData.ts`.
- **Modificados**: `apps/api/prisma/schema.prisma` (+migración), `ScheduleContext/index.tsx` (whitelist), `ScheduleContext/utils/indexDataItems.tsx` (icon/label/contentScreen), `ScheduleContext/utils/resolveAppliedLiveTheme.ts` (tema por timer), `PresentationView/types.d.ts` (union + campo `timer`), `PresentationView/components/ResourceContent.tsx` (rama TIMER), `panels/items-on-live/index.tsx` (dispatch + label), `main-route.tsx` (menubar), `panels/library/index.tsx` (quitar botón).
- **Reutilizados**: `apps/desktop/app/lib/time.ts`, `ExportDialog.tsx`, `songs/songImporter.tsx`, `generateUniqueId` (`@/lib/utils`), selector de temas existente.
- **Dependencia nueva**: `@radix-ui/react-menubar`.

## Verificación
1. `pnpm --filter @ecclesia/api prisma migrate dev` OK y cliente regenerado; typecheck del workspace.
2. `pnpm --filter @ecclesia/desktop dev`. Barra superior visible; Importar/Exportar funciona desde ahí y ya no está en la biblioteca.
3. **Presentar en vivo**: menú *Servicio → Cuenta atrás…*, poner p. ej. 1 min + tema, "Presentar en vivo"; con 2ª pantalla (F7) ver el **círculo que se vacía** sobre el tema elegido y el tiempo `MM:SS` bajando.
4. **Controlador**: en `items-on-live` editar el texto y el mensaje final (se reflejan en vivo), probar **+30s/−30s/custom** (el reloj salta al instante).
5. **Fin**: al llegar a 0 aparece el mensaje final y, con auto-ocultar, la pantalla live se limpia a los pocos segundos.
6. **Schedule**: "Añadir al schedule", guardar, recargar, y presentar desde el cronograma (doble-click) reinicia la cuenta atrás.
7. Tests existentes: `pnpm --filter @ecclesia/desktop test liveContext` y los de `items-on-live` no rompen.

---

## Notas para la nueva sesión
- Con `codebase-memory-mcp` activo, verificar primero los números de línea citados (pueden variar) usando las herramientas del MCP antes de editar.
- Empezar por la **Parte A** (Prisma + tipos) porque desbloquea el resto; luego B (render), C (controlador), D (tema), E (menú/diálogo).
- El plan interno original también quedó en `/Users/carlos/.claude/plans/stateful-giggling-trinket.md`.
