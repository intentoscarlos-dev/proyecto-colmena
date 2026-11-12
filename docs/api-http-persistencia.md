# API HTTP y persistencia — Colmena v0.3

**Estado:** implementada para pruebas locales; no desplegada.  
**Agentes:** simulados. No se realizan llamadas a proveedores externos.

## Iniciar

Requiere Node.js 20 o posterior:

```bash
npm install
npm test
npm start
```

Por defecto escucha solo en `127.0.0.1:8787` y escribe el historial en `./data/events.jsonl`.

Variables opcionales:

- `COLMENA_HOST`: dirección de escucha; predeterminada `127.0.0.1`.
- `COLMENA_PORT`: puerto; predeterminado `8787`.
- `COLMENA_DATA_FILE`: ruta del registro JSONL; predeterminada `./data/events.jsonl`.
- `COLMENA_API_TOKEN`: token Bearer. Obligatorio si `COLMENA_HOST` no es loopback.

No compartas el token ni lo guardes en Git, Dropbox o prompts. En un despliegue público, un token por sí solo no reemplaza HTTPS, gestión de secretos, límites de tasa, observabilidad y controles de abuso.

## Endpoints

| Método | Ruta | Función |
|---|---|---|
| GET | `/health` | Estado básico y longitud de cola |
| POST | `/tasks` | Crear una tarea y encolarla |
| GET | `/tasks` | Listar tareas |
| GET | `/tasks/:id` | Consultar una tarea |

Las rutas de tareas requieren `Authorization: Bearer <token>` cuando se configura `COLMENA_API_TOKEN`.

Crear una tarea:

```bash
curl -X POST http://127.0.0.1:8787/tasks \
  -H 'content-type: application/json' \
  -d '{"id":"COL-HTTP-001","prompt":"Evaluar cómo preservar desacuerdos en la memoria colectiva"}'
```

Consultar:

```bash
curl http://127.0.0.1:8787/tasks/COL-HTTP-001
```

La respuesta inicial de creación es HTTP 202: significa que la tarea fue aceptada, no que terminó. Consultá su estado hasta que sea `completed` o `failed`.

## Persistencia y recuperación

El coordinador registra eventos append-only:

- `task.created`
- `task.started`
- `contribution.recorded`
- `critique.recorded`
- `synthesis.recorded`
- `task.completed` / `task.failed`

Al iniciar, reconstruye las tareas desde el historial. Las que no tienen evento terminal se reencolan. Las tareas finalizadas se reconstruyen desde sus eventos.

## Límites de esta versión

- Un único proceso Node.js y un único escritor.
- El JSONL local no es almacenamiento distribuido ni adecuado para varios servidores concurrentes.
- No hay interfaz web, roles de usuario, cuotas, reintentos programados ni cola gestionada.
- No hay despliegue, conexión a Dropbox ni integración Cloudflare.
- Los adaptadores son simulados; no se comunican modelos reales.
- El registro conserva prompts y respuestas: usá datos de prueba no sensibles y protegé el archivo local.

## Próxima etapa

Migrar el estado operativo a almacenamiento duradero gestionado, incorporar una cola asíncrona alojada y preparar un entorno protegido antes de conectar APIs reales.
