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
  if (task.id.length > 120) {
    throw new RangeError("task.id no puede superar 120 caracteres.");
  }
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

/**
 * Coordinador local de una sola instancia.
 *
 * La cola y el estado activo viven en memoria; el historial se agrega al
 * almacén de eventos. No recupera tareas pendientes después de reiniciar
 * el proceso y no ofrece concurrencia distribuida.
 */
export function createTaskCoordinator({
  adapters,
  eventStore,
  maxCritiqueRounds = 1,
  clock = () => new Date(),
  idFactory = randomUUID
}) {
  if (!Array.isArray(adapters) || adapters.length === 0) {
    throw new TypeError("Se necesita al menos un adaptador.");
  }
  if (!eventStore || typeof eventStore.append !== "function") {
    throw new TypeError("Se necesita un eventStore con append(event).");
  }
  if (!Number.isInteger(maxCritiqueRounds) || maxCritiqueRounds < 0 || maxCritiqueRounds > 2) {
    throw new RangeError("maxCritiqueRounds debe estar entre 0 y 2.");
  }

  const tasks = new Map();
  const pending = [];
  let processing = false;

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
    async enqueueTask(task) {
      validateTask(task);
      if (tasks.has(task.id)) {
        throw new Error(`La tarea ${task.id} ya existe.`);
      }

      const queuedAt = clock().toISOString();
      const recordState = {
        task: { id: task.id, prompt: task.prompt },
        status: "queued",
        queuedAt,
        startedAt: null,
        completedAt: null,
        result: null,
        error: null
      };

      await record(task.id, "task.created", { prompt: task.prompt });
      tasks.set(task.id, recordState);
      pending.push(task.id);
      return snapshot(recordState);
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
        const result = await runCollaboration({
          task: state.task,
          adapters,
          maxCritiqueRounds
        });

        for (const contribution of result.independent) {
          await record(taskId, "contribution.recorded", contribution);
        }
        for (const round of result.critiqueRounds) {
          for (const critique of round.critiques) {
            await record(taskId, "critique.recorded", {
              round: round.round,
              ...critique
            });
          }
        }
        for (const synthesis of result.syntheses) {
          await record(taskId, "synthesis.recorded", synthesis);
        }

        state.result = result;
        state.status = result.status;
        state.completedAt = clock().toISOString();
        const finalType = result.status === "failed" ? "task.failed" : "task.completed";
        await record(taskId, finalType, {
          summary: result.summary,
          errors: result.errors
        });
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

    getQueueLength() {
      return pending.length;
    },

    isProcessing() {
      return processing;
    }
  };
}
