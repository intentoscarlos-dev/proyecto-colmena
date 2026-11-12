# Coordinador local de Colmena — v0.2

**Estado:** implementado como prototipo local; no desplegado.  
**Propósito:** administrar tareas y ejecutar el ciclo de colaboración sin que una persona tenga que iniciar manualmente cada etapa.

## Flujo

1. `enqueueTask({ id, prompt })` valida y agrega una tarea a la cola FIFO.
2. El coordinador registra `task.created`.
3. `runNext()` toma la siguiente tarea y llama al motor existente.
4. El motor ejecuta aportes independientes, crítica cruzada y síntesis.
5. El coordinador registra cada aporte, crítica y síntesis en el almacén JSONL.
6. Registra `task.completed` o `task.failed`.
7. `runAll()` procesa las tareas pendientes en orden, sin intervención entre etapas.

## Uso local

El coordinador se crea con adaptadores y un almacén de eventos:

```js
import { createTaskCoordinator } from "./src/coordinator/task-coordinator.js";
import { createJsonlEventStore } from "./src/storage/jsonl-event-store.js";

const coordinator = createTaskCoordinator({
  adapters,
  eventStore: createJsonlEventStore("./data/events.jsonl"),
  maxCritiqueRounds: 1
});

await coordinator.enqueueTask({
  id: "COL-TASK-001",
  prompt: "Investigar una pregunta concreta"
});

const results = await coordinator.runAll();
console.log(results);
```

## Contrato del estado

- `queued`: aceptada y esperando ejecución.
- `running`: el motor está procesando la tarea.
- `completed`: el ciclo terminó con al menos una contribución independiente.
- `failed`: el motor no pudo producir contribuciones o falló la ejecución.

## Límites importantes

Esta versión es una prueba del flujo de coordinación, no un servicio de segundo plano alojado:

- La cola y el estado de tareas viven en memoria y se pierden al reiniciar el proceso.
- JSONL conserva eventos, pero todavía no reconstruye automáticamente la cola ni las proyecciones.
- Está diseñada para un solo proceso escritor; no ofrece concurrencia distribuida.
- Los adaptadores siguen siendo simulados. No hay comunicación real con GPT, Claude, Gemini o DeepSeek.
- No hay endpoints HTTP, autenticación, despliegue ni conexión con Dropbox/Cloudflare en esta etapa.
- No se almacenan claves API ni se realizan llamadas externas.

## Próxima etapa

1. Ejecutar las pruebas y revisar el contrato del coordinador.
2. Añadir una capa HTTP con autenticación y límites de solicitudes.
3. Preparar un Worker y almacenamiento duradero con colas alojadas.
4. Conectar proveedores reales solo después de definir controles de coste, privacidad, límites y autorización humana.
