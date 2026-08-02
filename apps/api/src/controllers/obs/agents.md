# OBS Overlay Agent

## Descripción

Salida de **texto plano hacia OBS** para usar como subtítulos superpuestos al vídeo (estilo
Holyrics). El servidor Express (puerto 7777) expone una página HTML que OBS añade como
**Browser Source**; esa página muestra en tiempo real el texto que se presenta en vivo,
omitiendo imágenes, vídeos y la cuenta atrás (TIMER).

## Archivos

```
apps/api/src/controllers/obs/
├── obsOverlay.controller.ts   ← Rutas GET /obs (HTML) y GET /obs/config (JSON)
├── obsOverlayConfig.ts        ← Tipo ObsOverlayConfig + DEFAULT_OBS_CONFIG + parseObsConfig
├── obsOverlayConfig.test.ts   ← Tests del parser (saneo/merge sobre defaults)
└── agents.md                  ← Este archivo
```

## Flujo

1. **Texto + referencia:** `liveContext` (renderer) calcula el texto plano del slide activo con
   `extractOverlayText` y la referencia bíblica (ej. "Juan 3:16") con `extractOverlayReference`
   (ambos en `app/lib/presentationOverlayText.ts`; la referencia usa `bibleSchema` para el nombre
   del libro) y emite `obsTextUpdate { text, reference }` por socket. El servidor lo relaya
   (allowlist `liveRelayEvents` en `index.ts`) a la página `/obs`. Requiere `showLiveScreen` (sin
   proyección en vivo → overlay vacío). El texto va vacío también cuando: no hay item, item
   `TIMER`, el slide es medio, o el texto está oculto/negro/logo
   (`hideTextOnLive`/`blackScreenOnLive`/`showLogoOnLive`). Al reactivarse la proyección se fuerza
   el reenvío del texto (bypass del dedup) para refrescar páginas /obs con estado obsoleto.
2. **Estilo:** la config se edita en el diálogo `ObsTextOutputDialog` (menú «OBS» de la barra
   superior), se persiste como blob JSON en `Setting` (clave pública `OBS_TEXT_OVERLAY_CONFIG`)
   y al guardar se emite `obsConfigUpdate`. La página recarga `GET /obs/config` y se re-estiliza.
3. **Late join:** al conectar, la página emite `requestObsText`; `liveContext` reenvía el texto
   actual, y `GET /obs/config` provee el estilo inicial.

## Rutas

- `GET /obs` → HTML autocontenido (CSS+JS inline, carga `/socket.io/socket.io.js`). Estructura:
  `#stage` (contenedor) › `#box` (recuadro) › `#text` + `#reference` (indicador bíblico). El texto
  se inyecta con `textContent` (nunca `innerHTML`). El `customCss` de la config se inyecta en un
  `<style id="custom-css">` que puede targetear esos ids (y definir `@keyframes`). La posición se
  controla con atributos en `#stage`/`#box` (`data-position`, `data-halign`, `data-refpos`), de modo
  que el CSS libre pueda sobreescribirla. Opciones: `transparentBackground` (recuadro sin fondo),
  `textBorder`/`textBorderColor`/`textBorderWidth` (contorno del texto vía `-webkit-text-stroke`),
  y `showReference`/`referencePosition`/`referenceColor`/`referenceFontScale` (indicador de versículo).
- `GET /obs/config` → `{ config, backgroundImageUrl, backgroundVideoUrl }`. Resuelve
  `backgroundMediaId` → `/media/<filePath>` vía `prisma.media.findUnique` y lo devuelve como
  `backgroundImageUrl` (imagen) o `backgroundVideoUrl` (vídeo, `type === 'VIDEO'`). El vídeo se
  reproduce en bucle en `#bgvideo` detrás del texto, con `#bgtint` (color de fondo) como capa de tinte.

## Convenciones

- Al añadir/quitar campos de `ObsOverlayConfig`: actualizar `DEFAULT_OBS_CONFIG`, `parseObsConfig`
  (+ su test), el mirror de tipo en `ObsTextOutputDialog.tsx`, y la aplicación de estilo en el HTML.
- Los eventos socket viven en `SocketEventMap` (`sockets/socket.service.ts`) y se relayan en
  `index.ts`. Ver `sockets/AGENTS.md`.
