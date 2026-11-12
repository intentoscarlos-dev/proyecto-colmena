import { randomUUID } from "node:crypto";
import { runCollaboration } from "../core/engine.js";

const MAX_PROMPT_LENGTH = 20_000;

function validateTask(task) {
  if (!task || typeof task !== "object" || Array.isArray(task)) {
    throw new TypeError("La tarea debe ser un objeto.");
  }
  if (typeof task.id !== "string" || task.id.trim() === "") {
    throw new TypeError("task.id debe ser texto no vacío.");
  }
  if (task.id.length > 120) throw new RangeError("task.id no puede superar 120 caracteres.");
  if (typeof task.prompt !== "string" || task.prompt.trim() === "") {
    throw new TypeError("task.prompt debe ser texto no vacío.");
  }
  if (task.prompt.length > MAX_PROMPT_LENGTH) {
    throw new RangeError(`task.prompt no puede superar ${MAX_PROMPT_LENGTH} caracteres.`);
  }
}

function snapshot(record) {
  return {
    task: { ...record.task },
    status: record.status,
    queuedAt: record.queuedAt,
    startedAt: record.startedAt,
    completedAt: record.completedAt,
    result: record.result,
    error: record.error
  };
}

function rebuildResult(state, events, terminalEvent) {
  const independent = events
    .filter((event) => event.type === "contribution.recorded")
    .map((event) => event.payload);
  const critiques = events.filter((event) => event.type === "critique.recorded");
  const rounds = [...new Set(critiques.map((event) => event.payload.round))].sort((a, b) => a - b);
  const critiqueRounds = rounds.map((round) => ({
    round,
    critiques: critiques.filter((event) => event.payload.round === round)
      .map(({ payload }) => ({ agentId: payload.agentId, provider: payload.provider, model: payload.model, content: payload.content })),
    errors: []
  }));
  const syntheses = events
    .filter((event) => event.type === "synthesis.recorded")
    .map((event) => event.payload);
  const payload = terminalEvent.payload ?? {};
  return {
    task: { ...state.task },
    status: terminalEvent.type === "task.failed" ? "failed" : "completed",
    startedAt: state.startedAt,
    completedAt: terminalEvent.occurredAt,
    independent,
    critiqueRounds,
    syntheses,
    errors: payload.errors ?? [],
    summary: payload.summary ?? {
      requestedAgents: independent.length,
      successfulIndependentContributions: independent.length,
      critiqueCount: critiques.length,
      synthesisCount: syntheses.length
    }
  };
}

/**
 * Coordinador local de un solo proceso.
 * El historial JSONL permite reconstruir tareas y reencolar las que quedaron
 * sin evento terminal tras un reinicio. No es una cola distribuida.
 */
export function createTaskCoordinator({
  adapters,
  eventStore,
  maxCritiqueRounds = 1,
  clock = () => new Date(),
  idFactory = randomUUID
}) {
  if (!Array.isArray(adapters) || adapters.length === 0) throw new TypeError("Se necesita al menos un adaptador.");
  if (!eventStore || typeof eventStore.append !== "function" || typeof eventStore.listAll !== "function") {
    throw new TypeError("Se necesita un eventStore con append(event) y listAll().");
  }
  if (!Number.isInteger(maxCritiqueRounds) || maxCritiqueRounds < 0 || maxCritiqueRounds > 2) {
    throw new RangeError("maxCritiqueRounds debe estar entre 0 y 2.");
  }

  const tasks = new Map();
  const pending = [];
  let processing = false;
  let initialized = false;

  async function record(taskId, type, payload) {
    await eventStore.append({
      schemaVersion: 1,
      eventId: idFactory(),
      taskId,
      type,
      occurredAt: clock().toISOString(),
      actor: "coordinator",
      payload
    });
  }

  return {
    async initialize() {
      if (initialized) return this.listTasks();
      const events = await eventStore.listAll();
      const grouped = new Map();

      for (const event of events) {
        if (!grouped.has(event.taskId)) grouped.set(event.taskId, []);
        grouped.get(event.taskId).push(event);
      }

      for (const [taskId, taskEvents] of grouped) {
        const created = taskEvents.find((event) => event.type === "task.created");
        if (!created || tasks.has(taskId)) continue;
        const started = taskEvents.find((event) => event.type === "task.started");
        const terminal = [...taskEvents].reverse().find((event) =>
          event.type === "task.completed" || event.type === "task.failed"
        );
        const state = {
          task: { id: taskId, prompt: created.payload.prompt },
          status: terminal ? (terminal.type === "task.failed" ? "failed" : "completed") : "queued",
          queuedAt: created.occurredAt,
          startedAt: started?.occurredAt ?? null,
          completedAt: terminal?.occurredAt ?? null,
          result: null,
          error: terminal?.payload?.message ?? null
        };

        if (terminal) state.result = rebuildResult(state, taskEvents, terminal);
        tasks.set(taskId, state);
        if (!terminal) pending.push(taskId);
      }

      initialized = true;
      return this.listTasks();
    },

    async enqueueTask(task) {
      if (!initialized) throw new Error("El coordinador debe inicializarse antes de recibir tareas.");
      validateTask(task);
      if (tasks.has(task.id)) throw new Error(`La tarea ${task.id} ya existe.`);

      const queuedAt = clock().toISOString();
      const state = {
        task: { id: task.id, prompt: task.prompt },
        status: "queued",
        queuedAt,
        startedAt: null,
        completedAt: null,
        result: null,
        error: null
      };
      await record(task.id, "task.created", { prompt: task.prompt });
      tasks.set(task.id, state);
      pending.push(task.id);
      return snapshot(state);
    },

    async runNext() {
      if (processing) return null;
      const taskId = pending.shift();
      if (!taskId) return null;
      const state = tasks.get(taskId);
      processing = true;
      state.status = "running";
      state.startedAt = clock().toISOString();

      try {
        await record(taskId, "task.started", {});
        const result = await runCollaboration({
          task: state.task,
          adapters,
          maxCritiqueRounds
        });

        for (const contribution of result.independent) await record(taskId, "contribution.recorded", contribution);
        for (const round of result.critiqueRounds) {
          for (const critique of round.critiques) {
            await record(taskId, "critique.recorded", { round: round.round, ...critique });
          }
        }
        for (const synthesis of result.syntheses) await record(taskId, "synthesis.recorded", synthesis);

        state.result = result;
        state.status = result.status;
        state.completedAt = clock().toISOString();
        const finalType = result.status === "failed" ? "task.failed" : "task.completed";
        await record(taskId, finalType, { summary: result.summary, errors: result.errors });
        return snapshot(state);
      } catch (error) {
        state.status = "failed";
        state.completedAt = clock().toISOString();
        state.error = error instanceof Error ? error.message : "Error desconocido";
        await record(taskId, "task.failed", { message: state.error });
        return snapshot(state);
      } finally {
        processing = false;
      }
    },

    async runAll() {
      const completed = [];
      while (pending.length > 0) {
        const result = await this.runNext();
        if (result) completed.push(result);
        else break;
      }
      return completed;
    },

    getTask(taskId) {
      const state = tasks.get(taskId);
      return state ? snapshot(state) : null;
    },

    listTasks() {
      return [...tasks.values()].map(snapshot);
    },

    getQueueLength() { return pending.length; },
    isProcessing() { return processing; }
  };
}
