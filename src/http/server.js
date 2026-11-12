import { createServer } from "node:http";
import { timingSafeEqual } from "node:crypto";

const DEFAULT_BODY_LIMIT = 64 * 1024;

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff"
  });
  response.end(JSON.stringify(body));
}

function isAuthorized(request, token) {
  if (!token) return true;
  const header = request.headers.authorization ?? "";
  const supplied = header.startsWith("Bearer ") ? header.slice(7) : "";
  const left = Buffer.from(supplied);
  const right = Buffer.from(token);
  return left.length === right.length && timingSafeEqual(left, right);
}

async function readJson(request, maxBytes) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBytes) {
      const error = new Error("El cuerpo supera el tamaño permitido.");
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    const error = new Error("El cuerpo debe ser JSON válido.");
    error.statusCode = 400;
    throw error;
  }
}

function scheduleDrain(coordinator) {
  // Una única cadena de ejecución evita dos consumidores simultáneos.
  if (coordinator.__drainPromise) return;
  coordinator.__drainPromise = coordinator.runAll()
    .catch((error) => {
      // Los fallos por tarea se registran en el coordinador; este catch evita
      // que un error inesperado del worker derribe el servidor HTTP.
      process.emitWarning(`Colmena worker: ${error instanceof Error ? error.message : "error desconocido"}`);
    })
    .finally(() => {
      coordinator.__drainPromise = null;
      if (coordinator.getQueueLength() > 0) scheduleDrain(coordinator);
    });
}

/** API HTTP local: GET /health, GET /tasks, POST /tasks, GET /tasks/:id. */
export function createColmenaHttpServer({ coordinator, apiToken = null, maxBodyBytes = DEFAULT_BODY_LIMIT }) {
  if (!coordinator || typeof coordinator.enqueueTask !== "function") throw new TypeError("Se necesita un coordinador.");
  if (!Number.isInteger(maxBodyBytes) || maxBodyBytes < 1) throw new RangeError("maxBodyBytes debe ser positivo.");

  return createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    if (request.method === "GET" && url.pathname === "/health") {
      return sendJson(response, 200, {
        status: "ok",
        queued: coordinator.getQueueLength(),
        processing: coordinator.isProcessing()
      });
    }

    if (!isAuthorized(request, apiToken)) {
      return sendJson(response, 401, { error: "No autorizado." });
    }

    try {
      if (request.method === "GET" && url.pathname === "/tasks") {
        return sendJson(response, 200, { tasks: coordinator.listTasks() });
      }

      if (request.method === "POST" && url.pathname === "/tasks") {
        const body = await readJson(request, maxBodyBytes);
        const task = await coordinator.enqueueTask(body);
        scheduleDrain(coordinator);
        return sendJson(response, 202, { task });
      }

      const match = url.pathname.match(/^\/tasks\/([^/]+)$/);
      if (request.method === "GET" && match) {
        let taskId;
        try { taskId = decodeURIComponent(match[1]); }
        catch { return sendJson(response, 400, { error: "Identificador inválido." }); }
        const task = coordinator.getTask(taskId);
        return task
          ? sendJson(response, 200, { task })
          : sendJson(response, 404, { error: "Tarea no encontrada." });
      }

      return sendJson(response, 404, { error: "Ruta no encontrada." });
    } catch (error) {
      const statusCode = error.statusCode ?? (error instanceof TypeError || error instanceof RangeError ? 400 : 409);
      return sendJson(response, statusCode, { error: error instanceof Error ? error.message : "Error interno." });
    }
  });
}
