# Diagnóstico de Problemas con Videos en Windows

## Problema Reportado

Videos que no se reproducen en Windows después de ser sincronizados o importados, incluso después de eliminar y reimportar el archivo.

## Causas Potenciales

### 1. **Locks de Archivos en Windows** 🔒

Windows bloquea archivos más agresivamente que macOS. Si el navegador está accediendo al archivo mientras se descarga/mueve, puede quedar en un estado inconsistente.

**Síntomas:**
- El archivo aparece en la lista de medios
- No se reproduce al intentar visualizarlo
- El tamaño del archivo parece correcto
- Puede haber errores en la consola del navegador

**Solución Implementada:**
- Retry logic con 3 intentos en `downloadAndVerifyBlobChecksum()`
- Espera progresiva entre intentos (500ms, 1000ms, 1500ms)
- Detección específica de errores de Windows (`EBUSY`, `EPERM`, `EACCES`)

### 2. **Permisos de Archivos** 🛡️

Archivos descargados pueden tener permisos incorrectos que bloquean la lectura del servidor HTTP.

**Síntomas:**
- Error 403 (Permission denied) en el servidor de medios
- El archivo existe pero no se puede leer

**Solución Implementada:**
- `fs.chmod(destination, 0o644)` después de mover el archivo (rw-r--r--)
- Aplicado tanto en sincronización como en importación directa
- Validación de permisos con `fs.accessSync()` antes de servir

### 3. **Codecs de Video No Soportados** 🎬

Algunos formatos de video no son nativamente soportados en navegadores Windows.

**Formatos con posibles problemas:**
- `.mov` (QuickTime) - requiere codecs H.264/AAC
- `.avi` con codecs propietarios
- Videos con codecs no estándar

**Recomendaciones:**
- Preferir `.mp4` con codec H.264 + AAC
- Evitar `.mov` si es posible, o convertir a `.mp4`
- Usar `.webm` como alternativa multiplataforma

### 4. **Rutas de Archivos** 📁

Diferencias en separadores de rutas entre Windows (`\`) y macOS/Linux (`/`).

**Solución Implementada:**
- `path.normalize()` en servidor de medios
- Uso consistente de `path.join()` en todo el código

## Mejoras Implementadas

### Servidor de Medios (`mediaServer.ts`)

```typescript
// ✅ Normalización de rutas para Windows
const filePath = path.normalize(path.join(userDataPath, 'media', urlPath.slice(1)))

// ✅ Validación de permisos antes de servir
fs.accessSync(filePath, fs.constants.R_OK)

// ✅ Logging detallado de errores
log.error(`[mediaServer] Stream error for ${filePath}:`, err)

// ✅ Manejo de errores en streams
stream.on('error', (err) => {
  log.error(`[mediaServer] Stream error:`, err)
  if (!res.headersSent) {
    res.writeHead(500)
  }
  res.end()
})
```

### Sincronización (`googleDriveSyncManager.ts`)

```typescript
// ✅ Retry logic para archivos bloqueados
for (let attempt = 0; attempt < 3; attempt++) {
  try {
    await fs.move(tempFile, destination, { overwrite: true })
    moveSuccess = true
    break
  } catch (err) {
    const isWindowsLock = /* detecta EBUSY, EPERM, EACCES */
    if (isWindowsLock && attempt < 2) {
      await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)))
    }
  }
}

// ✅ Establecer permisos en Windows
if (process.platform === 'win32') {
  await fs.chmod(destination, 0o644)
}
```

### Importación Directa (`mediaHandlers.ts`)

```typescript
// ✅ Permisos correctos al importar
fs.copyFileSync(sourcePath, destPath)
if (process.platform === 'win32') {
  fs.chmodSync(destPath, 0o644)
}
```

## Cómo Diagnosticar Problemas

### 1. Revisar Logs de Electron

Los logs ahora incluyen información detallada:

```
[mediaServer] Request: GET /files/video.mp4
[mediaServer] File not found: C:\Users\...\media\files\video.mp4
[mediaServer] Permission denied for file: ...
[mediaServer] Stream error for ...: EBUSY
[sync] Archivo bloqueado en Windows, reintentando mover video.mp4 (intento 1/3)
```

**Ubicación de logs:**
- Windows: `%APPDATA%\Ecclesia\logs\main.log`

### 2. Verificar Permisos del Archivo

En PowerShell:
```powershell
icacls "C:\Users\...\AppData\Roaming\Ecclesia\media\files\video.mp4"
```

Debería mostrar permisos de lectura para el usuario actual.

### 3. Verificar Integridad del Archivo

Comprobar si el archivo está corrupto:
```powershell
# Ver si el archivo tiene tamaño correcto
Get-Item "...\video.mp4" | Select-Object Length

# Intentar reproducir con VLC o Windows Media Player
```

### 4. Verificar Checksum (si fue sincronizado)

El checksum debería coincidir entre dispositivos. Verificar en logs:
```
[sync] Blob de media subido: files/video.mp4 (abc123def456...)
```

### 5. Console del Navegador

Abrir DevTools en la ventana de Ecclesia (F12) y buscar errores al reproducir:
```
Failed to load resource: net::ERR_FILE_NOT_FOUND
Failed to load resource: the server responded with a status of 403 (Forbidden)
Failed to load resource: the server responded with a status of 500 (Internal Server Error)
```

## Pasos de Resolución

### Si el video NO se reproduce después de sincronización:

1. **Cerrar Ecclesia completamente**
2. **Volver a abrir y esperar a que termine la sincronización**
3. **Intentar reproducir nuevamente** (ahora con retry logic)
4. **Si falla, revisar logs** para ver el error específico
5. **Eliminar el archivo de la base de datos**
6. **Importarlo manualmente** desde Windows (ahora con permisos correctos)

### Si el video NO se reproduce después de importación manual:

1. **Verificar el formato del video** (preferir `.mp4` con H.264)
2. **Intentar reproducir el archivo original con VLC** para confirmar que no está corrupto
3. **Si VLC lo reproduce, pero Ecclesia no:**
   - Verificar que el codec sea soportado por navegadores
   - Considerar reconvertir a `.mp4` con H.264 + AAC
4. **Revisar logs de `[mediaServer]`** para ver errores específicos

### Si todos los videos fallan:

1. **Verificar que el servidor de medios esté funcionando:**
   - Buscar en logs: `Media server listening on port ...`
2. **Verificar antivirus/firewall** que no esté bloqueando el servidor local
3. **Revisar Content Security Policy** en caso de actualizaciones de Chromium

## Conversión Recomendada de Videos

Para máxima compatibilidad en Windows, convertir videos a:

```bash
# Con FFmpeg (recomendado)
ffmpeg -i input.mov -c:v libx264 -preset slow -crf 22 -c:a aac -b:a 128k output.mp4
```

**Parámetros:**
- `-c:v libx264`: Codec H.264 (universalmente soportado)
- `-preset slow`: Mejor compresión (usar `medium` para más velocidad)
- `-crf 22`: Calidad constante (18-28, menor = mejor calidad)
- `-c:a aac`: Codec de audio AAC
- `-b:a 128k`: Bitrate de audio

## Monitoreo Continuo

Para usuarios con problemas recurrentes:

1. **Habilitar logs detallados** (ya implementado automáticamente para videos)
2. **Compartir logs** de `main.log` cuando ocurra el problema
3. **Reportar:**
   - Formato del video (`.mp4`, `.mov`, etc.)
   - Tamaño del archivo
   - Si fue sincronizado o importado directamente
   - Sistema operativo y versión de Windows

## Limitaciones Conocidas

- **Formato .MOV en Windows**: Puede requerir codecs adicionales del sistema
- **Videos de gran tamaño**: Pueden tardar en procesarse los thumbnails
- **Sincronización concurrente**: Si múltiples dispositivos modifican medios simultáneamente, puede haber conflictos

## Próximas Mejoras Planificadas

- [ ] Conversión automática de formatos incompatibles
- [ ] Validación de codecs antes de importar
- [ ] UI para mostrar progreso de sincronización de archivos grandes
- [ ] Detección automática de archivos corruptos con reparación
- [ ] Estadísticas de salud de archivos de media en settings
