# OBS Overlay Agent

## Descripción

Salida de **texto plano hacia OBS** para usar como subtítulos superpuestos al vídeo (estilo
Holyrics). El servidor Express (puerto 7777) expone una página HTML que OBS añade como
**Browser Source**; esa página muestra en tiempo real el texto que se presenta en vivo,
omitiendo imágenes, vídeos y la cuenta atrás (TIMER).

**Múltiples subtítulos:** se pueden crear varios subtítulos, cada uno con su **slug/ruta**
(`/obs/subtitle/<slug>`, autogenerado `text-1`, `text-2`… o personalizado), su **filtro por
tipo de contenido** (Biblia/Canción/Presentación; vacío = todos) y su **estilo** propio. Así
se puede tener un estilo para versículos y otro para canciones. La lista se persiste como blob
JSON en `Setting` bajo la clave pública `OBS_SUBTITLES`. `/obs` queda como paraguas: el vídeo
del live-screen (futuro) irá bajo `/obs/video/...`.

## Archivos

```
apps/api/src/controllers/obs/
├── obsOverlay.controller.ts   ← Rutas /obs/subtitle/:slug (HTML) y :slug/config (JSON); carga lista + migración
├── obsOverlayConfig.ts        ← ObsOverlayConfig (estilo) + ObsSubtitle (slug/name/types) + parseObsConfig/parseObsSubtitles
├── obsOverlayConfig.test.ts   ← Tests de parseObsConfig, parseObsSubtitles y sanitizeSlug
└── agents.md                  ← Este archivo
```

## Flujo

1. **Texto + referencia + tipo:** `liveContext` (renderer) calcula el texto plano del slide activo
   con `extractOverlayText` y la referencia bíblica con `extractOverlayReference` (ambos en
   `app/lib/presentationOverlayText.ts`) y emite `obsTextUpdate { text, reference, contentType }`
   por socket (`contentType` = `itemOnLive.type`: SONG/BIBLE/PRESENTATION). El servidor lo relaya
   (allowlist `liveRelayEvents` en `index.ts`). Requiere `showLiveScreen` (sin proyección → vacío).
   Vacío también con `TIMER`, slide medio, u oculto/negro/logo (F9/F10/F11). Al reactivarse la
   proyección se fuerza el reenvío (bypass del dedup).
2. **Filtro por subtítulo:** cada página `/obs/subtitle/<slug>` sabe su `types` (del config) y solo
   muestra el texto si `contentType` coincide (o si `types` está vacío = todos).
3. **Estilo/lista:** el diálogo `ObsTextOutputDialog` (menú «OBS») gestiona la **lista** de
   subtítulos (añadir/renombrar/ruta/tipos/eliminar + estilo por pestañas). Al guardar persiste el
   array en `Setting` (`OBS_SUBTITLES`) y emite `obsConfigUpdate`; cada página recarga su
   `/obs/subtitle/<slug>/config`. Migración: si `OBS_SUBTITLES` está vacío pero existe el antiguo
   `OBS_TEXT_OVERLAY_CONFIG`, se expone como `text-1`.
4. **Late join:** al conectar, la página emite `requestObsText`; `liveContext` reenvía el estado.

## Rutas

- `GET /obs/socket.io.js` → cliente de Socket.IO servido por nosotros (el `serveClient` nativo
  falla al empaquetar; se lee el fichero del paquete `socket.io` y se envía como texto).
- `GET /obs/subtitle/:slug` → HTML autocontenido (CSS+JS inline). La página lee su `slug` de la URL
  y pide su config. Estructura: `#stage` › `#box` › `#bgvideo`+`#bgtint`+`#text`+`#reference`. El
  texto se inyecta con `textContent` (nunca `innerHTML`).
  **Cascada de estilos (sin `!important`):** el `<style>` estructural (layout fijo) va primero;
  luego `<style id="base-css">` con las reglas del editor por id (`buildBaseCss`: posición, fuente,
  colores, fondo, borde, etc. en unidades `vh`); y por último `<style id="custom-css">` con el CSS
  del usuario. Como base y custom usan la misma especificidad (id) y custom va después, el CSS del
  usuario **gana por cascada sin `!important`** y puede sobrescribir cualquier estilo del editor.
  Opciones: `transparentBackground`, `textBorder*` (contorno vía `-webkit-text-stroke`), indicador de
  versículo (`showReference`/`referencePosition`/`referenceColor`/`referenceFontScale`), y separación
  del borde `offsetY` (margen desde arriba/abajo si `position` es top/bottom) / `offsetX` (desde
  izquierda/derecha si `horizontalAlign` es left/right), en `vh`/`vw` (o `cqh`/`cqw` en el preview).
- `GET /obs/subtitle/:slug/config` → `{ config: ObsSubtitle, types, backgroundImageUrl, backgroundVideoUrl }`.
  Resuelve `backgroundMediaId` → `/media/<filePath>`; imagen vs vídeo (`type === 'VIDEO'`, se
  reproduce en bucle en `#bgvideo` con `#bgtint` de color encima). 404 si el slug no existe.

## Convenciones

- Al añadir/quitar campos de `ObsOverlayConfig`: actualizar `DEFAULT_OBS_CONFIG`, `parseObsConfig`
  (+ su test), el mirror de tipo en `ObsTextOutputDialog.tsx`, y **las 2 generadoras de CSS base**
  que deben producir lo mismo: `buildBaseCss` (página `/obs`, unidades `vh`, en el HTML servido) y
  `buildGeneratedCss` (renderer: panel «CSS de la configuración» en `vh` y preview del diálogo en
  `cqh`). El preview NO usa estilos inline dinámicos: inyecta `buildGeneratedCss(unit:'cqh')` como
  hoja base y luego el `customCss`, replicando la cascada de la página.
- `ObsSubtitle = ObsOverlayConfig + { slug, name, types }`. `parseObsSubtitles` sanea la lista
  (slug único vía `sanitizeSlug`, tipos válidos). El diálogo mantiene su propio mirror del tipo.
- Los eventos socket viven en `SocketEventMap` (`sockets/socket.service.ts`) y se relayan en
  `index.ts`. Ver `sockets/AGENTS.md`.
