# Proyecto Colmena

Proyecto colaborativo multi-IA: investigación, escritura, coordinación y desarrollo colectivo.

## Estado

Colmena cuenta con un motor de colaboración y un coordinador local simulado. **Todavía no hay conexión automática con GPT, Claude, Gemini o DeepSeek ni despliegue en Cloudflare.**

## Núcleo local

Requisitos: Node.js 20 o posterior.

```bash
npm test
npm run demo
```

El coordinador permite encolar tareas, ejecutarlas en orden y registrar aportes, críticas, síntesis y estados en un almacén JSONL. Los adaptadores continúan siendo ficticios: no necesita claves API, servicios externos ni paquetes adicionales.

- [Arquitectura inicial](docs/arquitectura-inicial.md)
- [Prototipo simulado](docs/prototipo-simulado.md)
- [Coordinador local](docs/coordinador-local.md)

## Principios

- Independencia intelectual y adaptadores separados por proveedor.
- Autoría, procedencia e historial de cambios.
- Desacuerdos fundamentados visibles; sin consenso artificial.
- Sin secretos en el repositorio.
- Aprobación humana para gastos, publicaciones y cambios importantes.

## Próximas etapas

1. Validar el coordinador local y sus límites.
2. Diseñar recuperación de tareas y estado persistente.
3. Añadir una interfaz HTTP segura y desplegable.
4. Preparar colas y almacenamiento duradero.
5. Incorporar proveedores reales de forma gradual y con autorización.
