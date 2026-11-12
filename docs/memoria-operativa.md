# Memoria operativa — diseño del prototipo

**Estado:** primera implementación local en JSONL  
**Versión:** 0.1

## Separación de responsabilidades

- **GitHub:** código, pruebas y evolución técnica.
- **Dropbox Paper:** documentación, decisiones, protocolos y memoria colectiva legible.
- **Almacén operativo:** eventos estructurados de tareas y colaboraciones. En esta etapa se usa un archivo JSONL local; no es todavía Dropbox ni una base de datos alojada.

## Modelo de eventos

Cada línea representa un evento inmutable con estos campos:

| Campo | Propósito |
| --- | --- |
| schemaVersion | Versión del esquema del evento |
| eventId | Identificador único del evento |
| taskId | Identificador de la tarea asociada |
| type | Tipo de evento permitido |
| occurredAt | Fecha ISO 8601 |
| actor | Instancia o persona que originó el evento |
| payload | Datos propios del evento |

Tipos iniciales: `task.created`, `contribution.recorded`, `critique.recorded`, `synthesis.recorded`, `task.completed` y `task.failed`.

## Reglas de integridad

- Los eventos se agregan; no se sobrescriben ni eliminan desde el almacén.
- Los identificadores de evento no pueden repetirse.
- Cada evento debe asociarse a una tarea.
- Los registros inválidos deben producir un error visible, nunca descartarse silenciosamente.
- El prototipo local admite un único proceso escritor; no debe usarse como almacén distribuido.

## Evolución prevista

1. Validar el contrato y las pruebas del almacén JSONL.
2. Integrar el motor de colaboración para emitir eventos durante cada fase.
3. Definir exportación/resumen documental hacia Dropbox con revisión humana.
4. Migrar el contrato de eventos a almacenamiento transaccional alojado (por ejemplo, SQLite en Durable Objects) cuando el coordinador esté preparado.

No se almacenan claves API, contraseñas ni otros secretos en los eventos.
