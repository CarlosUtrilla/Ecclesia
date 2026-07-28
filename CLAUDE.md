# CLAUDE.md — Ecclesia

## Regla principal: consulta SIEMPRE los agents antes de actuar

Antes de escribir o modificar código, **consulta primero los `agents.md`** del proyecto para obtener la información necesaria. No improvises ni asumas la estructura: la documentación de agentes es la fuente de verdad.

1. **Empieza por el router raíz [`./agents.md`](./agents.md)** — contiene la tabla "Auto-invoke: Consulta SIEMPRE el agent antes de actuar" (qué `agents.md` mirar según la acción) y el mapa de todos los `agents.md` del repo (28 en total, uno por módulo).
2. **Lee el `agents.md` más cercano** al código que vas a tocar (p. ej. `apps/desktop/app/contexts/ScheduleContext/agents.md`, `apps/desktop/app/screens/panels/items-on-live/agents.md`, `apps/api/src/.../agents.md`). Cada uno documenta convenciones, patrones y decisiones de su módulo.
3. Para exploración amplia o multi-área, **delega en subagentes** (Explore / Plan / Agent) en lugar de leer muchos archivos en el contexto principal; pásales como referencia el `agents.md` relevante.

## El MCP de memoria de código es obligatorio (ya definido en `agents.md`)

El router raíz ya establece la **"REGLA OBLIGATORIA — Codebase Memory MCP primero"**: usa las herramientas del MCP `codebase-memory-mcp` (`search_graph`, `trace_path`, `get_code_snippet`, `query_graph`, `get_architecture`, `search_code`) **antes** de recurrir a `grep`/`glob`/`read`. Son más rápidas y precisas (grafo de conocimiento con relaciones entre funciones). Usa `grep`/`glob`/`read` solo como fallback para archivos no indexados (configs, Dockerfiles, scripts sueltos).

- Proyecto indexado: **`Users-carlos-Documents-Ecclesia`** (pásalo como argumento `project`).
- El MCP está configurado globalmente en `~/.claude.json`; verifica la conexión con `/mcp`.

## Orden de trabajo recomendado

`router agents.md` → `agents.md del módulo` → `MCP (search_graph/trace_path/...)` → editar código siguiendo las convenciones del módulo.
