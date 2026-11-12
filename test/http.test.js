import test from "node:test";
import assert from "node:assert/strict";
import { createServer as createNodeServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTaskCoordinator } from "../src/coordinator/task-coordinator.js";
import { createJsonlEventStore } from "../src/storage/jsonl-event-store.js";
import { createColmenaHttpServer } from "../src/http/server.js";
import { createMockAdapter } from "../src/adapters/mock-adapter.js";

async function setup(run, apiToken = "test-token") {
  const directory = await mkdtemp(join(tmpdir(), "colmena-http-"));
  const store = createJsonlEventStore(join(directory, "events.jsonl"));
  const coordinator = createTaskCoordinator({
    adapters: [createMockAdapter({ id: "mock", provider: "Mock", perspective: "prueba" })],
    eventStore: store
  });
  await coordinator.initialize();
  const server = createColmenaHttpServer({ coordinator, apiToken });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  try { await run({ baseUrl, coordinator, store }); }
  finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await rm(directory, { recursive: true, force: true });
  }
}

const auth = { authorization: "Bearer test-token" };

test("health endpoint responde sin credenciales", async () => {
  await setup(async ({ baseUrl }) => {
    const response = await fetch(`${baseUrl}/health`);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).status, "ok");
  });
});

test("protege rutas de tareas con token y acepta tareas", async () => {
  await setup(async ({ baseUrl, coordinator }) => {
    const denied = await fetch(`${baseUrl}/tasks`);
    assert.equal(denied.status, 401);

    const accepted = await fetch(`${baseUrl}/tasks`, {
      method: "POST",
      headers: { ...auth, "content-type": "application/json" },
      body: JSON.stringify({ id: "HTTP-001", prompt: "Prueba HTTP" })
    });
    assert.equal(accepted.status, 202);
    assert.equal((await accepted.json()).task.task.id, "HTTP-001");

    // El worker se ejecuta en segundo plano; esperamos su estado terminal.
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const response = await fetch(`${baseUrl}/tasks/HTTP-001`, { headers: auth });
      const payload = await response.json();
      if (payload.task.status === "completed") break;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    const result = await fetch(`${baseUrl}/tasks/HTTP-001`, { headers: auth });
    assert.equal((await result.json()).task.status, "completed");

    const list = await fetch(`${baseUrl}/tasks`, { headers: auth });
    assert.equal((await list.json()).tasks.length, 1);
    assert.equal(coordinator.getQueueLength(), 0);
  });
});

test("rechaza JSON inválido y tareas no encontradas", async () => {
  await setup(async ({ baseUrl }) => {
    const invalid = await fetch(`${baseUrl}/tasks`, {
      method: "POST",
      headers: { ...auth, "content-type": "application/json" },
      body: "{"
    });
    assert.equal(invalid.status, 400);
    const missing = await fetch(`${baseUrl}/tasks/no-existe`, { headers: auth });
    assert.equal(missing.status, 404);
  });
});

test("rechaza cuerpos que superan el límite configurado", async () => {
  const directory = await mkdtemp(join(tmpdir(), "colmena-http-limit-"));
  const store = createJsonlEventStore(join(directory, "events.jsonl"));
  const coordinator = createTaskCoordinator({
    adapters: [createMockAdapter({ id: "mock", provider: "Mock", perspective: "prueba" })],
    eventStore: store
  });
  await coordinator.initialize();
  const server = createColmenaHttpServer({ coordinator, apiToken: "test-token", maxBodyBytes: 10 });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/tasks`, {
      method: "POST",
      headers: { ...auth, "content-type": "application/json" },
      body: JSON.stringify({ id: "large", prompt: "demasiado largo" })
    });
    assert.equal(response.status, 413);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await rm(directory, { recursive: true, force: true });
  }
});
