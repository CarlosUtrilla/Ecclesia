# Sistema de Animaciones de Transición

## 📝 Descripción General

Se ha implementado un sistema completo de animaciones de transición para el texto en las diapositivas de presentación. Las animaciones se ejecutan cuando cambia el contenido de una diapositiva a otra.

## ✨ Editor Avanzado de Animaciones

El sistema incluye un **editor avanzado** con controles completos:

### 🎛️ Parámetros Configurables

1. **Tipo de Animación** - 14 tipos diferentes
2. **Duración** - Control deslizante de 0.1s a 3s
3. **Retraso (Delay)** - Control deslizante de 0s a 2s  
4. **Curva de Aceleración (Easing)** - 10 curvas diferentes
5. **Vista Previa en Vivo** - Reproduce la animación para ver cómo queda

### 🎨 Curvas de Aceleración (Easing)

1. **Linear** - Velocidad constante
2. **Ease In** - Comienza lento, acelera al final
3. **Ease Out** - Comienza rápido, desacelera al final
4. **Ease In-Out** - Comienza y termina lento, rápido en el medio
5. **Circ In/Out/In-Out** - Curvas circulares suaves
6. **Back In/Out/In-Out** - Con efecto de "rebote" hacia atrás

## 🎨 Animaciones Disponibles

### 1. **Fade** (Por defecto)

- Aparición/desaparición gradual
- Transición suave de opacidad

### 2. **Slide Left**

- El texto entra desde la izquierda
- Sale hacia la derecha

### 3. **Slide Right**

- El texto entra desde la derecha
- Sale hacia la izquierda

### 4. **Slide Up**

- El texto entra desde arriba
- Sale hacia abajo

### 5. **Slide Down**

- El texto entra desde abajo
- Sale hacia arriba

### 6. **Zoom In**

- El texto aparece acercándose (scale 0.5 → 1)
- Sale alejándose (scale 1 → 1.5)

### 7. **Zoom Out**

- El texto aparece alejándose (scale 1.5 → 1)
- Sale acercándose (scale 1 → 0.5)

### 8. **Blur**

- Desde borroso (blur 10px) a enfocado (blur 0)
- Efecto muy visual y suave

### 9. **Scale**

- Escala desde 0 a tamaño completo
- Efecto de "aparecer desde un punto"

### 10. **Flip**

- Volteo 3D en el eje Y
- Rota 90° → 0° al entrar
- Muy dinámico

### 11. **Bounce**

- Entra con efecto de rebote (spring animation)
- Utiliza física de resorte para movimiento natural

### 12. **Rotate**

- Rota mientras entra y escala
- -180° → 0° con scaling
- Efecto espectacular

### 13. **Split**

- Las palabras aparecen una por una
- Efecto escalonado (stagger)
- Muy útil para énfasis palabra por palabra

### 14. **None**

- Sin animación
- Cambio instantáneo

## 🔧 Implementación Técnica

### Archivos Creados/Modificados

1. **`/app/lib/animations.ts`**
   - Define todos los tipos de animación
   - Configuración de variantes de Framer Motion
   - Funciones para obtener animaciones según tipo
   - Soporte para duración, delay y easing personalizados

2. **`/app/lib/animationSettings.ts`**
   - Tipos para configuración de animación
   - Definiciones de curvas de easing
   - Configuración por defecto

3. **`/app/components/themesEditor/animationSelector.tsx`**
   - Componente selector rápido de animaciones
   - Muestra el tipo actual con su icono

4. **`/app/components/themesEditor/animationEditor.tsx`**
   - **Dialog modal** con editor completo
   - Controles deslizantes para duración y delay
   - Selector de curva de aceleración
   - Vista previa en vivo con botón de reproducción

5. **`/app/ui/slider.tsx`**
   - Componente Slider de Radix UI
   - Usado para controles de duración y delay

6. **`/app/icons/animations/`**
   - 14 iconos SVG personalizados
   - Representan visualmente cada tipo de animación

7. **`/app/components/PresentationView/index.tsx`**
   - Integra Framer Motion
   - Aplica animaciones con parámetros personalizados
   - Manejo especial para animación "split"

8. **`/prisma/schema.prisma`**
   - Campo `animationSettings` en modelo `Themes`
   - Tipo: String (JSON), contiene configuración completa
   - Default: `{"type":"fade","duration":0.6,"delay":0,"easing":"easeInOut"}`

### Tecnología Utilizada

- **Framer Motion v12.24.10**: Librería de animaciones para React
- **Radix UI Slider**: Control deslizante accesible
- **AnimatePresence**: Controla la entrada/salida de elementos
- **Motion Variants**: Sistema de variantes para configurar estados
- **Dialog Modal**: Para el editor avanzado

## 📚 Uso

### En el Editor de Temas

1. Abre el editor de temas
2. Busca el selector de animaciones (con label "Animación:")
3. **Selección rápida**: Usa el dropdown para elegir el tipo de animación
4. **Configuración avanzada**: Haz clic en el botón "Configurar" (⚙️)
   - Ajusta la duración de la animación
   - Configura el retraso antes de iniciar
   - Selecciona la curva de aceleración
   - Usa el botón "Reproducir" para previsualizar
   - Guarda los cambios

### En el Modal de Configuración

- **Tipo de Animación**: Dropdown con iconos y descripciones
- **Duración**: Slider de 0.1s (rápido) a 3s (lento)
- **Retraso**: Slider de 0s (inmediato) a 2s (retrasado)
- **Easing**: Dropdown con curvas predefinidas
- **Vista Previa**: Área que muestra cómo se verá la animación
- **Botones**:
  - "Reproducir" - Vuelve a ejecutar la animación
  - "Restablecer" - Restaura valores por defecto
  - "Cancelar" - Descarta cambios
  - "Guardar" - Aplica la configuración

### En el Código

```typescript
import { AnimationSettings } from '@/lib/animationSettings'

// Configuración de animación
const settings: AnimationSettings = {
  type: 'slideLeft',
  duration: 0.8,
  delay: 0.2,
  easing: 'easeOut'
}

// Usar en un componente
<AnimationSelector
  settings={settings}
  onChange={(newSettings) => handleAnimationChange(newSettings)}
/>

// O abrir el editor directamente
<AnimationEditor
  settings={settings}
  onChange={(newSettings) => handleAnimationChange(newSettings)}
/>
```

### Estructura de Datos

```typescript
// Guardado en BD como JSON string
{
  "type": "fade",           // Tipo de animación
  "duration": 0.6,          // Duración en segundos
  "delay": 0,               // Retraso en segundos
  "easing": "easeInOut"     // Curva de aceleración
}
```

## 🎯 Consideraciones Futuras

### Para Fondos (Próxima Fase)

- Transiciones de color (fade between colors)
- Transiciones de imágenes (crossfade, slide)
- Efectos de zoom en imágenes
- Parallax effects

### Mejoras Potenciales

- Control de velocidad de animación en UI
- Curvas de easing personalizadas
- Animaciones combinadas
- Pre-visualización de animaciones
- Animaciones de entrada/salida diferentes

## ⚡ Rendimiento

- Las animaciones usan GPU acceleration (transform, opacity)
- Framer Motion optimiza automáticamente
- No hay re-renders innecesarios gracias a `AnimatePresence`
- El modo "wait" asegura que una animación termine antes de iniciar la siguiente

## 🐛 Troubleshooting

### La animación no se reproduce

- Verifica que el `key` del elemento cambie entre diapositivas
- Asegúrate de que `AnimatePresence` esté envolviendo el contenido

### Animación muy rápida/lenta

- Ajusta el parámetro `duration` en `getAnimationVariants`

### Jerky animations

- Verifica que estés animando propiedades optimizadas (transform, opacity)
- Evita animar width, height, o top/left directamente
