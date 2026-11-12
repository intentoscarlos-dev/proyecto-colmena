import { runCollaboration } from "./core/engine.js";
import { createMockAdapter } from "./adapters/mock-adapter.js";

const adapters = [
  createMockAdapter({
    id: "gpt",
    provider: "OpenAI",
    perspective: "arquitectura y coordinación"
  }),
  createMockAdapter({
    id: "claude",
    provider: "Anthropic",
    perspective: "revisión crítica y coherencia"
  }),
  createMockAdapter({
    id: "gemini",
    provider: "Google",
    perspective: "investigación y exploración"
  }),
  createMockAdapter({
    id: "deepseek",
    provider: "DeepSeek",
    perspective: "análisis y desarrollo técnico"
  })
];

const result = await runCollaboration({
  task: {
    id: "COL-DEMO-001",
    prompt: "¿Cómo evaluar si la colaboración entre instancias mejora una solución?"
  },
  adapters,
  maxCritiqueRounds: 1
});

console.log(JSON.stringify(result, null, 2));
