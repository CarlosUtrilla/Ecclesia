# Guía de Migraciones de Prisma en Electron

## 🎯 Cómo Funciona Ahora (Actualizado)

La aplicación ahora **preserva automáticamente tus datos** y aplica las migraciones pendientes cada vez que arrancas.

## 📍 Ubicaciones de las Bases de Datos

### En desarrollo (`yarn dev`)

- **Base de datos del proyecto**: `prisma/dev.db` (solo plantilla inicial)
- **Base de datos REAL**: `~/Library/Application Support/ecclesia/dev.db` (macOS)
  - Windows: `%APPDATA%/ecclesia/dev.db`
  - Linux: `~/.config/ecclesia/dev.db`

**⚠️ IMPORTANTE**: La app **siempre** usa la DB en `Application Support`, nunca la del proyecto.

## ✅ Flujo de Trabajo Simplificado (Recomendado)

```bash
# 1. Modificar schema.prisma
vim prisma/schema.prisma

# 2. Crear la migración
npx prisma migrate dev --name mi_cambio

# 3. Reiniciar la app - aplicará la migración automáticamente
yarn dev

# ✅ Tus datos se preservan y el schema se actualiza!
```

## 🛠️ Comandos Útiles

```bash
# Borrar DB local y empezar de cero
yarn db:reset

# Crear backup manual
yarn db:backup

# Inspeccionar la DB con SQLite
yarn db:inspect
```

## 🔍 Solución de Problemas

### Si la migración falla al arrancar

1. **Ver los logs**: Revisa la consola de Electron para ver el error
2. **Crear backup manual**: `yarn db:backup`
3. **Resetear si es necesario**: `yarn db:reset`

### Ver estado de migraciones

```bash
# Ver qué migraciones están aplicadas en tu DB de Electron
DATABASE_URL="file:$HOME/Library/Application Support/ecclesia/dev.db" \
  npx prisma migrate status
```

### Inspeccionar la DB directamente

```bash
# Abrir con SQLite
sqlite3 ~/Library/Application\ Support/ecclesia/dev.db

# Ver tablas
.tables

# Ver esquema de una tabla
.schema Lyrics

# Ver migraciones aplicadas
SELECT * FROM _prisma_migrations ORDER BY finished_at DESC;

# Salir
.quit
```

## 📝 Notas Importantes

1. **Backups automáticos**: Antes de cada migración, se crea un backup en `~/Library/Application Support/ecclesia/backups/`

2. **Preservación de datos**: La app NUNCA borra tu DB existente, solo aplica migraciones nuevas

3. **Primera vez**: Solo la primera vez copia `prisma/dev.db` → `userData/dev.db`

4. **Logs útiles**: Busca en consola:
   - `✅ Migraciones aplicadas:`
   - `❌ Error al ejecutar migraciones:`
   - `💾 Backup de base de datos creado en:`
   - `💾 Usando base de datos existente (preservando datos):`

## 🔄 Resetear Todo (Último Recurso)

Si todo falla y quieres empezar de cero:

```bash
# 1. Detener la app
# 2. Borrar todo
rm -rf ~/Library/Application\ Support/ecclesia/
rm prisma/dev.db
rm -rf node_modules/.prisma/

# 3. Recrear desde cero
npx prisma migrate reset
npx prisma generate

# 4. Iniciar
yarn dev
```

## 📚 Recursos

- [Documentación de Prisma Migrate](https://www.prisma.io/docs/concepts/components/prisma-migrate)
- Archivo de configuración: `electron/main/prisma.ts`
- Schema: `prisma/schema.prisma`
- Migraciones: `prisma/migrations/`
Opción 1: Solo borrar DB de Electron (rápido)
yarn db:reset
yarn dev

# Opción 2: Borrar todo y recrear (más completo)

rm -rf ~/Library/Application\ Support/ecclesia/
npx prisma migrate reset
yarn dev

```

## 🎬 Cómo Funciona el Sistema

### Primera vez que arrancas:
1. No existe `~/Library/Application Support/ecclesia/dev.db`
2. La app copia `prisma/dev.db` (si existe) como base inicial
3. Aplica TODAS las migraciones
4. Tu app arranca con DB completa

### Cada vez subsecuente:
1. Existe `~/Library/Application Support/ecclesia/dev.db` ✅
2. La app **preserva ese archivo** (tiene tus datos)
3. Revisa si hay migraciones nuevas pendientes
4. Aplica SOLO las nuevas migraciones
5. Tu app arranca con tus datos + schema actualizado ✅

### Cuando actualizas a producción:
1. Usuario ya tiene `~/Library/Application Support/ecclesia/dev.db` con datos
2. Nueva versión de la app trae nuevas migraciones
3. Al arrancar, aplica solo las migraciones que faltan
4. Datos del usuario se preservan ✅

## 📚 Recursos

- [Documentación de Prisma Migrate](https://www.prisma.io/docs/concepts/components/prisma-migrate)
- Archivo de configuración: `electron/main/prisma.ts`
- Schema: `prisma/schema.prisma`
- Migraciones: `prisma/migrations/`
