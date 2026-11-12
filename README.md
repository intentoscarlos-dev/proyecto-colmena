# Proyecto Colmena

Proyecto colaborativo multi-IA: investigación, escritura, coordinación y desarrollo colectivo.

## Estado

Colmena está en una etapa inicial. La arquitectura está documentada y existe un prototipo simulado del motor de colaboración. **Todavía no hay conexión automática con GPT, Claude, Gemini o DeepSeek ni despliegue en Cloudflare.**

## Núcleo simulado

Requisitos: Node.js 20 o posterior.

```bash
npm test
npm run demo
```

El prototipo prueba aportes independientes, crítica cruzada y síntesis separadas usando adaptadores ficticios. No necesita claves API, servicios externos ni paquetes adicionales.

- [Arquitectura inicial](docs/arquitectura-inicial.md)
- [Prototipo simulado](docs/prototipo-simulado.md)

## Principios

- Independencia intelectual y adaptadores separados por proveedor.
- Autoría, procedencia e historial de cambios.
- Desacuerdos fundamentados visibles; sin consenso artificial.
- Sin secretos en el repositorio.
- Aprobación humana para gastos, publicaciones y cambios importantes.

## Próximas etapas

1. Ejecutar y validar el prototipo.
2. Mejorar contratos, validaciones y persistencia.
3. Preparar el despliegue del coordinador.
4. Incorporar proveedores de forma gradual y con autorización.
