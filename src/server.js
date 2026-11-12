import { createJsonlEventStore } from "./storage/jsonl-event-store.js";
import { createTaskCoordinator } from "./coordinator/task-coordinator.js";
import { createColmenaHttpServer } from "./http/server.js";
import { createMockAdapter } from "./adapters/mock-adapter.js";

const host = process.env.COLMENA_HOST ?? "127.0.0.1";
const port = Number(process.env.COLMENA_PORT ?? 8787);
const apiToken = process.env.COLMENA_API_TOKEN ?? null;
const dataFile = process.env.COLMENA_DATA_FILE ?? "./data/events.jsonl";
const loopbackHosts = new Set(["127.0.0.1", "localhost", "::1"]);

if (!Number.isInteger(port) || port < 1 || port > 65535) throw new RangeError("COLMENA_PORT debe estar entre 1 y 65535.");
if (!loopbackHosts.has(host) && !apiToken) {
  throw new Error("Para escuchar fuera de localhost, configura COLMENA_API_TOKEN. No expongas el servicio sin autenticación.");
}

const adapters = [
  createMockAdapter({ id: "gpt", provider: "OpenAI (simulado)", perspective: "arquitectura y coordinación" }),
  createMockAdapter({ id: "claude", provider: "Anthropic (simulado)", perspective: "revisión crítica y coherencia" }),
  createMockAdapter({ id: "gemini", provider: "Google (simulado)", perspective: "investigación y exploración" }),
  createMockAdapter({ id: "deepseek", provider: "DeepSeek (simulado)", perspective: "análisis y desarrollo técnico" })
];

const eventStore = createJsonlEventStore(dataFile);
const coordinator = createTaskCoordinator({ adapters, eventStore, maxCritiqueRounds: 1 });
await coordinator.initialize();

// Recupera y continúa las tareas que quedaron sin evento terminal.
void coordinator.runAll();

const server = createColmenaHttpServer({ coordinator, apiToken });
server.listen(port, host, () => {
  console.log(`Colmena HTTP disponible en http://${host}:${port}`);
  console.log(`Memoria de eventos: ${dataFile}`);
  console.log("Modo de agentes: SIMULADO (sin APIs externas).");
});

function shutdown(signal) {
  console.log(`\n${signal}: cerrando Colmena...`);
  server.close(() => process.exit(0));
}
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
