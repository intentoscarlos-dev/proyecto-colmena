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
    await run({ coordinator, eventStore });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test("encola tareas y las ejecuta sin intervención entre etapas", async () => {
  await withCoordinator(async ({ coordinator, eventStore }) => {
    const queued = await coordinator.enqueueTask({
      id: "COL-QUEUE-001",
      prompt: "Evaluar el flujo de colaboración"
    });

    assert.equal(queued.status, "queued");
    assert.equal(coordinator.getQueueLength(), 1);

    const completed = await coordinator.runNext();
    assert.equal(completed.status, "completed");
    assert.equal(completed.result.summary.successfulIndependentContributions, 2);
    assert.equal(coordinator.getQueueLength(), 0);
    assert.equal(coordinator.getTask("COL-QUEUE-001").status, "completed");

    const events = await eventStore.listByTask("COL-QUEUE-001");
    assert.ok(events.some((event) => event.type === "task.created"));
    assert.equal(events.filter((event) => event.type === "contribution.recorded").length, 2);
    assert.equal(events.filter((event) => event.type === "critique.recorded").length, 2);
    assert.equal(events.filter((event) => event.type === "synthesis.recorded").length, 2);
    assert.ok(events.some((event) => event.type === "task.completed"));
  });
});

test("procesa varias tareas en orden FIFO", async () => {
  await withCoordinator(async ({ coordinator }) => {
    await coordinator.enqueueTask({ id: "COL-FIFO-1", prompt: "Primera" });
    await coordinator.enqueueTask({ id: "COL-FIFO-2", prompt: "Segunda" });

    const results = await coordinator.runAll();
    assert.deepEqual(results.map((item) => item.task.id), ["COL-FIFO-1", "COL-FIFO-2"]);
    assert.ok(results.every((item) => item.status === "completed"));
    assert.equal(coordinator.getQueueLength(), 0);
  });
});

test("rechaza tareas inválidas y duplicadas", async () => {
  await withCoordinator(async ({ coordinator }) => {
    await assert.rejects(
      coordinator.enqueueTask({ id: "", prompt: "Sin identificador" }),
      /task.id/
    );
    await coordinator.enqueueTask({ id: "COL-DUP-1", prompt: "Primera" });
    await assert.rejects(
      coordinator.enqueueTask({ id: "COL-DUP-1", prompt: "Duplicada" }),
      /ya existe/
    );
  });
});

test("devuelve null cuando no hay tareas pendientes", async () => {
  await withCoordinator(async ({ coordinator }) => {
    assert.equal(await coordinator.runNext(), null);
  });
});

test("registra el fallo de una tarea sin detener la cola", async () => {
  let calls = 0;
  const recoveringAdapter = {
    id: "recovering",
    async generate() {
      calls += 1;
      if (calls === 1) throw new Error("Fallo de prueba");
      return { content: "Respuesta simulada tras recuperación." };
    }
  };

  await withCoordinator(async ({ coordinator, eventStore }) => {
    await coordinator.enqueueTask({ id: "COL-FAIL-1", prompt: "Falla" });
    await coordinator.enqueueTask({ id: "COL-FAIL-2", prompt: "Continúa" });

    const first = await coordinator.runNext();
    assert.equal(first.status, "failed");
    assert.ok((await eventStore.listByTask("COL-FAIL-1")).some(
      (event) => event.type === "task.failed"
    ));

    const second = await coordinator.runNext();
    assert.equal(second.status, "completed");
  }, [recoveringAdapter]);
});
