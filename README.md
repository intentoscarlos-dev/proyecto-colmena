# Proyecto Colmena

Proyecto colaborativo multi-IA: investigación, escritura, coordinación y desarrollo colectivo.

## Estado

Colmena cuenta con un motor de colaboración, un coordinador local, una API HTTP y recuperación de tareas desde un registro de eventos JSONL. **Los agentes siguen siendo simulados: todavía no hay conexión con GPT, Claude, Gemini o DeepSeek ni despliegue en Cloudflare.**

## Ejecutar localmente

Requisitos: Node.js 20 o posterior.

```bash
npm test
npm run demo
npm start
```

El servicio escucha por defecto en `127.0.0.1:8787`. Expone `GET /health`, `POST /tasks`, `GET /tasks` y `GET /tasks/:id`. La memoria operativa se guarda en `./data/events.jsonl`; las tareas sin evento terminal se recuperan al reiniciar.

Para escuchar fuera de localhost, configura `COLMENA_API_TOKEN` y `COLMENA_HOST`. No publiques el servicio sin autenticación, controles adicionales y revisión de seguridad.

- [Arquitectura inicial](docs/arquitectura-inicial.md)
- [Coordinador local](docs/coordinador-local.md)
- [API HTTP y persistencia](docs/api-http-persistencia.md)

## Principios

- Independencia intelectual y adaptadores separados por proveedor.
- Autoría, procedencia e historial de cambios.
- Desacuerdos fundamentados visibles; sin consenso artificial.
- Sin secretos en el repositorio.
- Aprobación humana para gastos, publicaciones y cambios importantes.

## Próximas etapas

1. Revisar y validar esta API local.
2. Sustituir el almacenamiento local por almacenamiento duradero alojado y cola gestionada.
3. Preparar un despliegue protegido.
4. Incorporar proveedores reales de forma gradual, con límites de coste y autorización.
