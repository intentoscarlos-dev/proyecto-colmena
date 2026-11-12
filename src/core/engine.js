/**
 * Motor de colaboración independiente del proveedor.
 * No realiza llamadas de red ni necesita credenciales.
 */

function validateInput({ task, adapters, maxCritiqueRounds }) {
  if (!task || typeof task.id !== "string" || typeof task.prompt !== "string") {
    throw new TypeError("task debe incluir id y prompt como texto.");
  }
  if (!Array.isArray(adapters) || adapters.length === 0) {
    throw new TypeError("Se necesita al menos un adaptador.");
  }
  if (!Number.isInteger(maxCritiqueRounds) || maxCritiqueRounds < 0 || maxCritiqueRounds > 2) {
    throw new RangeError("maxCritiqueRounds debe estar entre 0 y 2.");
  }

  const ids = adapters.map((adapter) => adapter?.id);
  if (ids.some((id) => typeof id !== "string" || id.length === 0)) {
    throw new TypeError("Cada adaptador debe tener un id de texto.");
  }
  if (new Set(ids).size !== ids.length) {
    throw new Error("Los ids de los adaptadores deben ser únicos.");
  }
  if (adapters.some((adapter) => typeof adapter.generate !== "function")) {
    throw new TypeError("Cada adaptador debe implementar generate(request).");
  }
}

async function invoke(adapter, request) {
  try {
    const raw = await adapter.generate(request);
    const content = typeof raw === "string" ? raw : raw?.content;
    if (typeof content !== "string" || content.length === 0) {
      throw new Error("El adaptador devolvió una respuesta vacía o inválida.");
    }

    return {
      ok: true,
      response: {
        agentId: adapter.id,
        provider: adapter.provider ?? adapter.id,
        model: adapter.model ?? "unspecified",
        content
      }
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        agentId: adapter.id,
        phase: request.phase,
        message: error instanceof Error ? error.message : "Error desconocido"
      }
    };
  }
}

async function invokeAll(adapters, requestFactory) {
  const outcomes = await Promise.all(
    adapters.map((adapter) => invoke(adapter, requestFactory(adapter)))
  );

  return {
    responses: outcomes.filter((item) => item.ok).map((item) => item.response),
    errors: outcomes.filter((item) => !item.ok).map((item) => item.error)
  };
}

/**
 * Ejecuta investigación independiente, crítica cruzada y síntesis paralelas.
 * Se conservan las síntesis de cada instancia: no se declara una ganadora
 * ni se convierte una respuesta en consenso automático.
 */
export async function runCollaboration({
  task,
  adapters,
  maxCritiqueRounds = 1
}) {
  validateInput({ task, adapters, maxCritiqueRounds });
  const startedAt = new Date().toISOString();

  const independent = await invokeAll(adapters, () => ({
    task,
    phase: "independent",
    context: {}
  }));

  const activeAdapters = adapters.filter((adapter) =>
    independent.responses.some((response) => response.agentId === adapter.id)
  );

  const critiqueRounds = [];
  const allErrors = [...independent.errors];
  let previousCritiques = [];

  for (let round = 1; round <= maxCritiqueRounds; round += 1) {
    const roundResult = await invokeAll(activeAdapters, (adapter) => ({
      task,
      phase: "critique",
      round,
      context: {
        contributions: independent.responses.filter(
          (response) => response.agentId !== adapter.id
        ),
        previousCritiques
      }
    }));

    critiqueRounds.push({
      round,
      critiques: roundResult.responses,
      errors: roundResult.errors
    });
    previousCritiques = [...previousCritiques, ...roundResult.responses];
    allErrors.push(...roundResult.errors);
  }

  const synthesis = await invokeAll(activeAdapters, () => ({
    task,
    phase: "synthesis",
    context: {
      contributions: independent.responses,
      critiques: previousCritiques,
      instruction:
        "Identifica coincidencias, desacuerdos, evidencias faltantes y preguntas abiertas. No fuerces consenso."
    }
  }));

  allErrors.push(...synthesis.errors);

  return {
    task: { id: task.id, prompt: task.prompt },
    status: independent.responses.length === 0 ? "failed" : "completed",
    startedAt,
    completedAt: new Date().toISOString(),
    independent: independent.responses,
    critiqueRounds,
    syntheses: synthesis.responses,
    errors: allErrors,
    summary: {
      requestedAgents: adapters.length,
      successfulIndependentContributions: independent.responses.length,
      critiqueCount: critiqueRounds.reduce(
        (total, round) => total + round.critiques.length,
        0
      ),
      synthesisCount: synthesis.responses.length
    }
  };
}
