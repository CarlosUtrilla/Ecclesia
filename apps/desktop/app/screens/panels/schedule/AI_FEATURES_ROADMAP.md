# Roadmap de Funcionalidades IA - Ecclesia

## Estado Actual (MVP)

### ✅ Extracción de Referencias Bíblicas
- **Texto libre**: Pegar notas del sermón y extraer automáticamente referencias
- **PDF**: Subir PDF del bosquejo del pastor y extraer texto + referencias
- **Multi-proveedor**: Soporte para OpenAI y Anthropic (configurable)
- **Inserción directa**: Agregar referencias una por una o todas juntas al cronograma

---

## Fase 2: Sugerencias Inteligentes

### 🔲 Sugerencia de Grupos Automáticos
**Descripción**: Analizar las referencias extraídas y sugerir grupos automáticamente.

**Ejemplo de salida**:
```json
{
  "suggestedGroups": [
    { "name": "Alabanza", "references": ["Sal 150:1-6", "Sal 100:1-5"] },
    { "name": "Lectura", "references": ["Juan 3:16-21", "Romanos 8:28"] },
    { "name": "Predicación", "references": ["Isaías 53:1-12"] },
    { "name": "Oración", "references": ["Fil 4:6-7"] }
  ]
}
```

**Integración**:
- Botón "Sugerir Grupos" en el dialog
- Insertar automáticamente como items GROUP antes de sus versículos
- Permitir editar/eliminar sugerencias antes de insertar

---

### 🔲 Sugerencia de Canciones
**Descripción**: Sugerir canciones de la biblioteca basándose en el tema/versículos detectados.

**Ejemplo**:
- Versículos sobre "amor de Dios" → sugerir "Qué amor tan grande", "Dios es amor"
- Salmo 23 → sugerir "El Señor es mi pastor"

**Integración**:
- Sección "Canciones sugeridas" en el dialog
- Click para agregar al cronograma después del grupo correspondiente
- Usar tags de canciones existentes para matching semántico

**Requisitos**:
- Buscar por tags existentes en canciones
- Matching por palabras clave en letras (futuro)

---

## Fase 3: Generación de Cronograma Completo

### 🔲 Generación Automática
**Descripción**: Generar un cronograma completo listo para usar.

**Flujo**:
1. Usuario ingresa texto/PDF
2. IA extrae referencias + detecta estructura
3. IA sugiere: grupos → versículos → canciones
4. Usuario revisa y confirma
5. Se inserta todo el cronograma de una vez

**Estructura sugerida**:
```
[Apertura] Juan 14:27
[Alabanza] → canciones sugeridas
[Lectura] Romanos 8:28-30
[Oración] → canción de oración
[Predicación] Isaías 53:1-12
[Cierre] → canción de cierre
```

---

## Fase 4: Funcionalidades Avanzadas

### 🔲 Historial de Servicios
**Descripción**: Recordar servicios anteriores para no repetir canciones/temas.

**Uso**:
- "Ya usaste esta canción hace 2 servicios"
- "Última vez que predicaste de Isaías 53 fue el mes pasado"

---

### 🔲 Calendario con Fechas Especiales
**Descripción**: Detectar fechas del calendario cristiano y sugerir temas.

**Ejemplo**:
- Semana Santa → sugerir textos de la Pasión
- Navidad → sugerir textos de la Encarnación
- Pascua → sugerir textos de Resurrección

---

### 🔲 Integración con Planificación Anual
**Descripción**: Conectar con el calendario litúrgico o plan anual de la iglesia.

---

## Configuración Técnica

### Proveedores Soportados

| Proveedor | Modelo Recomendado | Costo Aprox. |
|-----------|-------------------|--------------|
| OpenAI | gpt-4o-mini | $0.15/1M tokens |
| Anthropic | claude-3-5-haiku | $0.80/1M tokens |

### Configuración en Ajustes

```
Ajustes → IA
├── Proveedor: [OpenAI | Anthropic]
├── API Key: [tu-api-key-aqui]
├── Modelo: [gpt-4o-mini | claude-3-5-haiku]
└── [Probar conexión]
```

### Seguridad

- La API key se almacena localmente en la DB (cifrada en futuras versiones)
- Las llamadas a la IA son directas (sin pasar por servidores de Ecclesia)
- El usuario es responsable del uso de su API key
- Se recomienda usar gpt-4o-mini para MVP (bajo costo)

---

## Archivos Relacionados

- Backend: `apps/api/src/controllers/ai/`
- Frontend: `apps/desktop/app/screens/panels/schedule/components/AIScheduleDialog.tsx`
- Configuración: `apps/api/src/controllers/settings/settingKeys.ts`

---

## Notas de Implementación

### Prompt de Extracción
El system prompt actual está en `ai.types.ts` y extrae:
- Referencias bíblicas (libro, capítulo, versículos)
- Título del sermón (si existe)

### Próximos Pasos
1. Agregar campo `group` al schema de respuesta
2. Agregar matching de canciones por tags
3. Crear endpoint de sugerencias combinadas
4. Integrar con biblioteca de canciones existente
