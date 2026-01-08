# Servidor HTTP de Medios

## Descripción

La aplicación utiliza un servidor HTTP local para servir archivos multimedia (imágenes y videos). Este servidor reemplaza el antiguo protocolo personalizado `myapp://` para mejorar la confiabilidad y preparar la aplicación para conexiones desde dispositivos móviles.

## Arquitectura

### Servidor HTTP (`electron/main/mediaServer.ts`)

- **Puerto**: Asignado automáticamente (puerto 0)
- **Host**: `0.0.0.0` (permite conexiones desde cualquier IP en la red local)
- **Características**:
  - Soporte para range requests (necesario para videos)
  - Detección automática de MIME types
  - Streaming eficiente con `fs.createReadStream()`
  - Códigos de respuesta HTTP estándar

### Endpoints

```
GET /<filepath>
```

Donde `<filepath>` es el path relativo dentro de `userData/media/`.

**Ejemplos**:

```
http://127.0.0.1:55393/files/video.mp4
http://127.0.0.1:55393/files/carpeta/imagen.jpg
```

## Uso en la Aplicación

### Frontend

1. **Obtener puerto del servidor**:

```typescript
const port = await window.mediaAPI.getServerPort()
```

1. **Construir URL de medio**:

```typescript
const mediaUrl = `http://127.0.0.1:${port}/${encodeURIComponent(filePath)}`
```

1. **Usar en componentes**:

```tsx
<video src={mediaUrl} />
<img src={mediaUrl} />
```

### Componentes que usan el servidor

- `PresentationView` - Videos/imágenes de fondo en presentaciones
- `MediaCard` - Miniaturas en biblioteca de medios
- `MediaList` - Vista de lista de medios
- `backgroundSelector` - Selector de fondos en editor de temas

## Preparación para App Móvil

El servidor ya está configurado para aceptar conexiones desde la red local (`0.0.0.0`), lo que permite que una app móvil se conecte al servidor en el futuro.

### Pasos para integración móvil

1. **Obtener IP local de la computadora**:
   - macOS: `ipconfig getifaddr en0`
   - La app deberá exponer esta IP a los clientes móviles

2. **Descubrimiento de servidor**:
   - Implementar mDNS/Bonjour para descubrimiento automático
   - O usar código QR con IP:Puerto

3. **Conexión desde móvil**:

```typescript
// En vez de 127.0.0.1, usar la IP de la red local
const serverUrl = `http://192.168.1.100:${port}`
const mediaUrl = `${serverUrl}/${filePath}`
```

1. **Sincronización de estado**:
   - Usar WebSockets o Server-Sent Events para sincronizar qué se está mostrando
   - El móvil puede hacer fetch de las mismas URLs de medios

## Content Security Policy (CSP)

El CSP en `app/index.html` permite conexiones HTTP a cualquier puerto:

```html
<meta http-equiv="Content-Security-Policy"
  content="img-src 'self' data: http://127.0.0.1:* http://localhost:* http://*:*; 
           media-src 'self' http://127.0.0.1:* http://localhost:* http://*:*;" />
```

⚠️ **Nota de seguridad**: `http://*:*` permite conexiones a cualquier IP. En producción, considera restringir a rangos de red local específicos.

## API

### `startMediaServer(): number`

Inicia el servidor HTTP. Retorna el puerto asignado.

### `getMediaServerPort(): number`

Obtiene el puerto del servidor en ejecución.

### `stopMediaServer(): void`

Detiene el servidor HTTP. Se llama automáticamente al cerrar la aplicación.

## Ventajas sobre `myapp://`

1. **Confiabilidad**: El protocolo HTTP es estándar y bien soportado por navegadores
2. **Range requests**: Permite seek en videos sin cargar todo el archivo
3. **Caching**: HTTP tiene mecanismos de caché integrados
4. **Debugging**: Fácil de probar con herramientas estándar (curl, Postman)
5. **Compatibilidad**: Funciona igual en Electron y navegadores web
6. **Extensibilidad**: Fácil agregar endpoints adicionales (API REST)
7. **Conexiones remotas**: Permite conexiones desde dispositivos en la red local

## Troubleshooting

### Puerto ya en uso

El servidor usa puerto 0 (asignación automática), por lo que este problema es poco probable. Si ocurre, reiniciar la aplicación.

### Videos no cargan

- Verificar que el archivo exista en `userData/media/`
- Revisar consola para errores de red
- Verificar formato de video (MP4 H.264 recomendado)

### Conexión desde móvil falla

- Verificar que ambos dispositivos estén en la misma red
- Verificar firewall no esté bloqueando el puerto
- Usar IP correcta (no 127.0.0.1 desde otro dispositivo)
