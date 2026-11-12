# Arquitectura inicial — Proyecto Colmena

**Estado:** propuesta inicial, no desplegada  
**Versión:** 0.1  
**Última revisión:** 2026-11-12

## Propósito

Crear un sistema de colaboración entre distintas familias de IA que permita investigar, proponer, criticar, desarrollar y revisar aportes, conservando su procedencia y los desacuerdos fundamentados.

## Principios

- Independencia intelectual: cada proveedor se integra mediante un adaptador separado.
- Trazabilidad: registrar proveedor, modelo, tarea, versión de instrucciones, fecha y resultado.
- Memoria documental separada del estado operativo.
- No forzar consenso; conservar posiciones minoritarias justificadas.
- Aprobación humana para cambios estructurales, publicaciones externas y cualquier acción con coste.
- No almacenar secretos, contraseñas ni tokens en el repositorio o en documentos compartidos.

## Arquitectura lógica propuesta

```text
Interfaz / operador humano
          |
          v
   Coordinador de tareas
          |
          v
 Motor de colaboración
   |      |      |      |
  GPT   Claude Gemini DeepSeek
   |      |      |      |
 Adaptadores independientes
          |
          v
 Estado operativo y cola de tareas

Memoria documental (Dropbox)
se mantiene separada del estado operativo.
```

### Componentes previstos

| Componente | Responsabilidad | Estado |
|---|---|---|
| Coordinador | Recibir tareas, validar límites y organizar ciclos | Pendiente |
| Motor de colaboración | Investigación independiente, crítica y síntesis | Pendiente |
| Adaptadores | Traducir el contrato común a cada API | Pendiente |
| Estado operativo | Guardar tareas, estados, intentos y resultados | Pendiente |
| Cola asíncrona | Ejecutar trabajos sin bloquear el coordinador | Pendiente |
| Dropbox | Documentación, decisiones y memoria colectiva | En uso como espacio documental |
| GitHub | Código, revisiones e historial técnico | Repositorio creado |

## Contrato común de los adaptadores

Cada adaptador deberá implementar, como mínimo:

- `checkAvailability()`: informar si el proveedor está configurado y disponible.
- `generate(request)`: enviar una solicitud y devolver una respuesta normalizada.
- `normalizeError(error)`: convertir errores del proveedor a categorías comunes.
- `estimateUsage(response)`: devolver uso y coste cuando el proveedor lo informe.

La interfaz común no debe asumir que todos los proveedores ofrecen las mismas funciones, límites o formatos. Las diferencias deben quedar explícitas.

## Ciclo experimental inicial

1. Formular una tarea y criterios de evaluación.
2. Solicitar respuestas independientes sin mostrarles las respuestas de las demás instancias.
3. Compartir los aportes para crítica cruzada.
4. Revisar objeciones y evidencias.
5. Elaborar una síntesis que conserve desacuerdos.
6. Registrar resultados, limitaciones y decisiones.

## Límites del piloto

- Una tarea activa a la vez.
- Máximo de cuatro instancias por tarea.
- Hasta dos rondas de crítica y una síntesis.
- Sin ejecución autónoma de acciones destructivas.
- Sin publicación externa ni gastos sin aprobación humana.
- Mecanismo general de pausa antes de habilitar automatizaciones.

## Integraciones y estado real

| Servicio | Uso previsto | Estado |
|---|---|---|
| GitHub | Código e historial de cambios | Repositorio accesible; estructura inicial pendiente |
| Dropbox | Memoria y documentación | Documentos centrales existentes |
| Cloudflare | Alojamiento del coordinador y componentes operativos | Cuenta no disponible; no desplegado |
| OpenAI | Adaptador GPT | No conectado |
| Anthropic | Adaptador Claude | No conectado |
| Google | Adaptador Gemini | No conectado |
| DeepSeek | Adaptador DeepSeek | No conectado |

La creación y administración de cuentas externas, la aceptación de términos y cualquier configuración de facturación deben ser realizadas por una persona adulta responsable cuando corresponda. No se deben compartir credenciales en conversaciones ni incorporarlas a Git.

## Próximo paso técnico

Implementar primero un prototipo local/simulado del motor de colaboración, con adaptadores ficticios y pruebas automatizadas. Esto permite validar el flujo sin cuentas de proveedor, claves API ni costes. La conexión real a Cloudflare y a los proveedores se hará en una etapa posterior, con supervisión y autorización.
