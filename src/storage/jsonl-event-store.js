import { appendFile, mkdir, readFile } from "node:fs/promises";
import { dirname } from "node:path";

const EVENT_TYPES = new Set([
  "task.created",
  "contribution.recorded",
  "critique.recorded",
  "synthesis.recorded",
  "task.completed",
  "task.failed"
]);

function validateEvent(event) {
  if (!event || typeof event !== "object" || Array.isArray(event)) {
    throw new TypeError("El evento debe ser un objeto.");
  }
  for (const field of ["eventId", "taskId", "type", "occurredAt"]) {
    if (typeof event[field] !== "string" || event[field].trim() === "") {
      throw new TypeError(`El campo ${field} es obligatorio.`);
    }
  }
  if (!EVENT_TYPES.has(event.type)) {
    throw new TypeError("Tipo de evento no reconocido.");
  }
  if (Number.isNaN(Date.parse(event.occurredAt))) {
    throw new TypeError("occurredAt debe ser una fecha ISO válida.");
  }
  if (event.payload === undefined || typeof event.payload !== "object" || event.payload === null) {
    throw new TypeError("payload debe ser un objeto.");
  }
  try {
    JSON.stringify(event);
  } catch {
    throw new TypeError("El evento debe poder convertirse a JSON.");
  }
}

/**
 * Almacén append-only JSONL para el prototipo local.
 * Un evento nuevo se agrega al final; los existentes no se editan.
 * Diseñado para un único proceso escritor, no para despliegue distribuido.
 */
export function createJsonlEventStore(filePath) {
  if (typeof filePath !== "string" || filePath.trim() === "") {
    throw new TypeError("Se necesita una ruta de archivo.");
  }

  async function readAll() {
    let raw;
    try {
      raw = await readFile(filePath, "utf8");
    } catch (error) {
      if (error.code === "ENOENT") return [];
      throw error;
    }
    if (raw.trim() === "") return [];

    return raw.split("\n").filter(Boolean).map((line, index) => {
      try {
        return JSON.parse(line);
      } catch {
        throw new Error(`Registro JSONL inválido en la línea ${index + 1}.`);
      }
    });
  }

  return {
    async append(event) {
      validateEvent(event);
      const existing = await readAll();
      if (existing.some((item) => item.eventId === event.eventId)) {
        throw new Error(`eventId duplicado: ${event.eventId}`);
      }
      await mkdir(dirname(filePath), { recursive: true });
      await appendFile(filePath, `${JSON.stringify(event)}\n`, { encoding: "utf8", flag: "a" });
      return event;
    },

    async listAll() {
      return readAll();
    },

    async listByTask(taskId) {
      if (typeof taskId !== "string" || taskId.trim() === "") {
        throw new TypeError("taskId debe ser texto no vacío.");
      }
      return (await readAll()).filter((event) => event.taskId === taskId);
    }
  };
}
