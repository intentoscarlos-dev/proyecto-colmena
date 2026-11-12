import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTaskCoordinator } from "../src/coordinator/task-coordinator.js";
import { createJsonlEventStore } from "../src/storage/jsonl-event-store.js";
import { createMockAdapter } from "../src/adapters/mock-adapter.js";

async function withCoordinator(run, adapters = [
  createMockAdapter({ id: "agent-a", provider: "Mock A", perspective: "investigación" }),
  createMockAdapter({ id: "agent-b", provider: "Mock B", perspective: "revisión" })
]) {
  const directory = await mkdtemp(join(tmpdir(), "colmena-coordinator-"));
  try {
    const eventStore = createJsonlEventStore(join(directory, "events.jsonl"));
    const coordinator = createTaskCoordinator({ adapters, eventStore });
    await coordinator.initialize();
    await run({ coordinator, eventStore, directory });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test("encola tareas y ejecuta el ciclo completo", async () => {
  await withCoordinator(async ({ coordinator, eventStore }) => {
    const queued = await coordinator.enqueueTask({ id: "COL-QUEUE-001", prompt: "Evaluar colaboración" });
    assert.equal(queued.status, "queued");
    const completed = await coordinator.runNext();
    assert.equal(completed.status, "completed");
    assert.equal(completed.result.summary.successfulIndependentContributions, 2);
    const events = await eventStore.listByTask("COL-QUEUE-001");
    assert.ok(events.some((event) => event.type === "task.started"));
    assert.equal(events.filter((event) => event.type === "contribution.recorded").length, 2);
    assert.equal(events.filter((event) => event.type === "critique.recorded").length, 2);
    assert.equal(events.filter((event) => event.type === "synthesis.recorded").length, 2);
    assert.ok(events.some((event) => event.type === "task.completed"));
  });
});

test("procesa tareas en orden FIFO", async () => {
  await withCoordinator(async ({ coordinator }) => {
    await coordinator.enqueueTask({ id: "COL-FIFO-1", prompt: "Primera" });
    await coordinator.enqueueTask({ id: "COL-FIFO-2", prompt: "Segunda" });
    const results = await coordinator.runAll();
    assert.deepEqual(results.map((item) => item.task.id), ["COL-FIFO-1", "COL-FIFO-2"]);
    assert.ok(results.every((item) => item.status === "completed"));
  });
});

test("rechaza tareas inválidas y duplicadas", async () => {
  await withCoordinator(async ({ coordinator }) => {
    await assert.rejects(coordinator.enqueueTask({ id: "", prompt: "Inválida" }), /task.id/);
    await coordinator.enqueueTask({ id: "COL-DUP-1", prompt: "Primera" });
    await assert.rejects(coordinator.enqueueTask({ id: "COL-DUP-1", prompt: "Duplicada" }), /ya existe/);
  });
});

test("devuelve null cuando no hay tareas pendientes", async () => {
  await withCoordinator(async ({ coordinator }) => assert.equal(await coordinator.runNext(), null));
});

test("restaura tareas pendientes y resultados tras reiniciar el coordinador", async () => {
  await withCoordinator(async ({ coordinator, eventStore }) => {
    await coordinator.enqueueTask({ id: "RESTORE-PENDING", prompt: "Pendiente" });
    const first = await coordinator.runNext();
    assert.equal(first.status, "completed");

    const restarted = createTaskCoordinator({
      adapters: [createMockAdapter({ id: "agent-a", provider: "Mock A", perspective: "investigación" })],
      eventStore
    });
    const restored = await restarted.initialize();
    assert.equal(restored[0].status, "completed");
    assert.equal(restored[0].result.independent.length, 2);
    assert.equal(restarted.getQueueLength(), 0);
  });
});

test("reencola una tarea interrumpida sin evento terminal", async () => {
  await withCoordinator(async ({ eventStore, directory }) => {
    await eventStore.append({
      schemaVersion: 1, eventId: "CRASH-1", taskId: "INTERRUPTED",
      type: "task.created", occurredAt: "2026-11-12T00:00:00.000Z",
      actor: "operator", payload: { prompt: "Recuperar después del reinicio" }
    });
    const restarted = createTaskCoordinator({
      adapters: [createMockAdapter({ id: "agent", provider: "Mock", perspective: "recuperación" })],
      eventStore
    });
    await restarted.initialize();
    assert.equal(restarted.getQueueLength(), 1);
    const result = await restarted.runNext();
    assert.equal(result.status, "completed");
  });
});

test("registra fallos parciales y sigue con la siguiente tarea", async () => {
  let calls = 0;
  const adapter = {
    id: "recovering",
    async generate() {
      calls += 1;
      if (calls === 1) throw new Error("Fallo de prueba");
      return { content: "Respuesta simulada." };
    }
  };
  await withCoordinator(async ({ coordinator, eventStore }) => {
    await coordinator.enqueueTask({ id: "COL-FAIL-1", prompt: "Falla parcial" });
    await coordinator.enqueueTask({ id: "COL-FAIL-2", prompt: "Continúa" });
    assert.equal((await coordinator.runNext()).status, "failed");
    assert.ok((await eventStore.listByTask("COL-FAIL-1")).some((event) => event.type === "task.failed"));
    assert.equal((await coordinator.runNext()).status, "completed");
  }, [adapter]);
});
