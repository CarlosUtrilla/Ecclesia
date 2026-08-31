# pptxRenderer — Rasterizado de PPTX a PNG

Convierte cada diapositiva de un `.pptx` en un PNG, para que la importación
pueda tratarla igual que una página de PDF. Es el reemplazo del antiguo
`apps/api/src/pptxConverter.ts`, que no renderizaba nada: sacaba los `<a:t>`
con una regex y extraía las imágenes embebidas, perdiendo formas, fondos
heredados del layout/master, degradados, tipografías y colores. De ahí que las
diapositivas importadas se vieran casi en blanco.

## Motor

[`@aiden0z/pptx-renderer`](https://github.com/aiden0z/pptx-renderer) (Apache-2.0).
Lo decisivo es el orden de render que documenta su `renderSlide`:

```
1. Background (slide → layout → master inheritance)
2. Master non-placeholder shapes (behind everything)
3. Layout non-placeholder shapes
4. Slide shapes (on top)
```

Esa cadena layout→master es justo lo que faltaba. Pinta a **DOM**, no a canvas,
así que necesita un contexto Chromium: de ahí la ventana.

## Piezas

| Archivo | Qué hace |
| --- | --- |
| `pptxToPngBuffers.ts` | API pública. Misma forma que `pdfToPngBuffers()` de `apps/api/src/pdfConverter.ts`. Serializa las conversiones. |
| `pptxRenderWindow.ts` | La ventana offscreen y la captura de frames. |
| `pptxRenderScale.ts` | Escala de rasterizado. Módulo puro (sin Electron) para poder probarlo, como `ndiManager/ndiConfig.ts`. |
| `pptxRenderTypes.ts` | Contrato IPC. Lo consumen main, preload y renderer. |
| `pptxRenderAPI.ts` | Lo que el preload expone a la ventana. |
| `app/screens/pptx-render/index.tsx` | El lado renderer: carga la librería y pinta. |

## Tres cosas que no se pueden simplificar

Las tres se descubrieron produciendo PNGs corruptos de forma silenciosa. Si
alguien "limpia" el código y las quita, los fallos vuelven sin dar error.

1. **`offscreen: true` es obligatorio.** Una ventana con `show: false` normal
   nunca compone: `capturePage()` devuelve siempre el mismo frame vacío. En OSR
   el evento `paint` sí entrega frames reales sin mostrar nada.

2. **Marcador magenta entre diapositivas.** Los callbacks de
   `requestAnimationFrame` corren *antes* del commit al compositor, así que
   cuando el renderer avisa de que ya pintó, el último frame todavía lleva la
   diapositiva anterior. Capturar ahí produce un **desfase de uno**: la primera
   diapositiva sale en blanco y cada PNG contiene la diapositiva previa.
   Esperar "dos frames" tampoco basta. La solución fiable es pintar un marcador
   magenta entre diapositivas y sondear hasta que el centro deje de serlo.

3. **El marcador tiene que ser un bloque con tamaño real** (`width:100vw;
   height:100vh`). Un `position:absolute` con `inset:0` dentro de un `#stage` de
   altura 0 lo recorta el `overflow:hidden` del body y no llega a pintarse, con
   lo que el sondeo agota el tiempo y volvemos al desfase.

## Integración con el renderer

La ventana carga la ruta `/pptx-render` del propio renderer (igual que NDI carga
`/live-screen/ndi`), así vite empaqueta la librería sin líos de `require` ni de
asar. Tres detalles del entorno de la app que hay que neutralizar en esa ventana:

- **CSP:** `index.html` tiene que permitir `blob:` en `img-src` y `media-src`.
  La librería sirve los medios embebidos como blobs; sin eso las diapositivas
  salen sin imágenes ni fondos.
- **Clases de Tailwind del body:** `font-sans` sustituye la tipografía de la
  diapositiva y cambia el ajuste de línea; `bg-background` tiñe el fondo.
- **React Query Devtools:** su botón flotante se cuela en el frame capturado y
  acaba dentro del PNG. Se desactiva en esta ventana desde `app/main.tsx`.

Además, `App.tsx` corta antes de montar `MainApp` para esta ruta: la ventana no
habla con el backend ni con el servidor de medios, así que arrancar `ApiProvider`
y compañía sería gasto puro.

## Escala

`resolveRenderScale()` la deriva del ancho de la pantalla más grande conectada,
entre `PPTX_MIN_SCALE` (2) y `PPTX_MAX_SCALE` (4). Una diapositiva 16:9 son
960x540 pt, así que 2x ya da 1080p; un proyector 4K sube la escala en vez de
recibir 1080p reescalado.

`pptxRenderWindow` compensa además el `scaleFactor` de la pantalla (el OSR pinta
en píxeles físicos), igual que `ndiCaptureWindow.ts:41-43`.

## Limitaciones conocidas

- **Solo el estado final.** Un `.pptx` con animaciones por pasos se rasteriza
  con todos los objetos visibles, que es justo lo que se busca para proyectar.
  Si una diapositiva usa animaciones de salida, los objetos se superponen.
- **Tipografías del sistema.** Al pintar en Chromium, Calibri o Gill Sans MT no
  están en macOS y se sustituyen, lo que desplaza algo el texto. Le pasa igual a
  LibreOffice. Se podrían empaquetar Carlito/Caladea (métricamente compatibles).
- **Vídeos del layout/master.** Se rasteriza un fotograma fijo: los controles se
  desactivan y lo que no consigue cargar se oculta, para no proyectar el icono
  de imagen rota de Chromium.
- **Diapositivas ocultas** (`p:sld@show="0"`) se saltan, como hace PowerPoint.
