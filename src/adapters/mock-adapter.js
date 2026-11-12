/**
 * Adaptador ficticio para probar el flujo sin APIs ni costes.
 * No representa respuestas reales de GPT, Claude, Gemini o DeepSeek.
 */

export function createMockAdapter({ id, provider, model = "mock-0.1", perspective }) {
  if (!id || !provider || !perspective) {
    throw new TypeError("id, provider y perspective son obligatorios.");
  }

  return {
    id,
    provider,
    model,

    async generate({ task, phase, round = 0, context }) {
      if (phase === "independent") {
        return {
          content:
            `[SIMULACIÓN — ${provider}] Perspectiva: ${perspective}. ` +
            `Primera aproximación independiente a la tarea "${task.id}": ` +
            "definir el problema, explicitar supuestos y proponer una solución verificable."
        };
      }

      if (phase === "critique") {
        const reviewed = context.contributions.map(
          (item) => item.agentId
        );
        return {
          content:
            `[SIMULACIÓN — ${provider}] Ronda de crítica ${round}. ` +
            `Aportes revisados: ${reviewed.join(", ") || "ninguno"}. ` +
            "Solicito justificar los supuestos, comprobar la evidencia y señalar limitaciones."
        };
      }

      if (phase === "synthesis") {
        const authors = context.contributions.map((item) => item.agentId);
        return {
          content:
            `[SIMULACIÓN — ${provider}] Síntesis desde ${perspective}. ` +
            `Se consideran ${authors.length} aportes y ${context.critiques.length} críticas. ` +
            "Separar puntos compartidos, desacuerdos razonados, evidencia pendiente y próximos experimentos."
        };
      }

      throw new Error(`Fase no reconocida: ${phase}`);
    }
  };
}
