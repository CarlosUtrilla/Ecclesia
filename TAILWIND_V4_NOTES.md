# Tailwind CSS v4 - Clases problemáticas y soluciones

## Problema identificado
Las clases `divide-*` y `space-*` no funcionan correctamente en tu setup de Tailwind CSS v4.

## Clases problemáticas
- `divide-y divide-border/30` 
- `space-y-1`
- Otras variantes similares

## Soluciones implementadas

### 1. Separadores entre elementos
En lugar de:
```jsx
<div className="divide-y divide-border/30">
  {items.map(...)}
</div>
```

Usar:
```jsx
<div>
  {items.map((item, index) => (
    <div 
      className={cn(
        // otras clases...
        { 'border-b border-border/20': index !== items.length - 1 }
      )}
    >
      ...
    </div>
  ))}
</div>
```

### 2. Espaciado entre elementos
En lugar de:
```jsx
<div className="space-y-1">
  ...
</div>
```

Usar:
```jsx
<div className="flex flex-col gap-1">
  ...
</div>
```

## Clases que sí funcionan
- `border-b`, `border-t`, `border-l`, `border-r`
- `border-border/20` (opacidad)
- `gap-1`, `gap-2`, `gap-3`, etc.
- `flex flex-col`
- `ring-*` (para efectos de selección)

## Nota
Tailwind CSS v4 está en desarrollo y algunas clases pueden tener comportamientos diferentes a v3.
La implementación manual con bordes condicionales es más confiable y da mejor control.