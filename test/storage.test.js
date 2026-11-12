import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createJsonlEventStore } from "../src/storage/jsonl-event-store.js";

async function withStore(run) {
  const directory = await mkdtemp(join(tmpdir(), "colmena-store-"));
  try {
    await run(createJsonlEventStore(join(directory, "events", "events.jsonl")));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

function event(overrides = {}) {
  return {
    schemaVersion: 1,
    eventId: "EVT-001",
    taskId: "TASK-001",
    type: "task.created",
    occurredAt: "2026-11-12T00:00:00.000Z",
    actor: "operator",
    payload: { prompt: "Investigar persistencia" },
    ...overrides
  };
}

test("guarda eventos y los recupera por tarea", async () => {
  await withStore(async (store) => {
    await store.append(event());
    await store.append(event({
      eventId: "EVT-002",
      type: "contribution.recorded",
      payload: { agentId: "gpt", content: "Aporte simulado" }
    }));
    await store.append(event({
      eventId: "EVT-003",
      taskId: "TASK-002",
      payload: { prompt: "Otra tarea" }
    }));

    assert.equal((await store.listAll()).length, 3);
    const taskEvents = await store.listByTask("TASK-001");
    assert.equal(taskEvents.length, 2);
    assert.equal(taskEvents[1].payload.agentId, "gpt");
  });
});

test("rechaza identificadores de evento duplicados", async () => {
  await withStore(async (store) => {
    await store.append(event());
    await assert.rejects(store.append(event()), /duplicado/);
  });
});

test("rechaza eventos incompletos o con tipo desconocido", async () => {
  await withStore(async (store) => {
    await assert.rejects(store.append({ ...event(), taskId: "" }), /taskId/);
    await assert.rejects(store.append({ ...event(), type: "task.deleted" }), /no reconocido/);
  });
});
