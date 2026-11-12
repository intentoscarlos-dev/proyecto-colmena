import test from "node:test";
import assert from "node:assert/strict";
import { runCollaboration } from "../src/core/engine.js";
import { createMockAdapter } from "../src/adapters/mock-adapter.js";

function fourAdapters() {
  return [
    createMockAdapter({ id: "gpt", provider: "OpenAI", perspective: "coordinación" }),
    createMockAdapter({ id: "claude", provider: "Anthropic", perspective: "crítica" }),
    createMockAdapter({ id: "gemini", provider: "Google", perspective: "investigación" }),
    createMockAdapter({ id: "deepseek", provider: "DeepSeek", perspective: "desarrollo" })
  ];
}

test("ejecuta aportes independientes, crítica cruzada y síntesis", async () => {
  const result = await runCollaboration({
    task: { id: "TEST-001", prompt: "Tarea de prueba" },
    adapters: fourAdapters(),
    maxCritiqueRounds: 1
  });

  assert.equal(result.status, "completed");
  assert.equal(result.summary.successfulIndependentContributions, 4);
  assert.equal(result.summary.critiqueCount, 4);
  assert.equal(result.summary.synthesisCount, 4);
  assert.equal(result.errors.length, 0);
});

test("continúa si un adaptador falla", async () => {
  const adapters = [
    ...fourAdapters().slice(0, 3),
    {
      id: "offline",
      provider: "Mock",
      async generate() {
        throw new Error("Proveedor simulado no disponible");
      }
    }
  ];

  const result = await runCollaboration({
    task: { id: "TEST-002", prompt: "Tarea con fallo parcial" },
    adapters
  });

  assert.equal(result.status, "completed");
  assert.equal(result.summary.successfulIndependentContributions, 3);
  assert.ok(result.errors.some((error) => error.agentId === "offline"));
});

test("rechaza ids de adaptador duplicados", async () => {
  const [adapter] = fourAdapters();
  await assert.rejects(
    runCollaboration({
      task: { id: "TEST-003", prompt: "Validación" },
      adapters: [adapter, adapter]
    }),
    /únicos/
  );
});
