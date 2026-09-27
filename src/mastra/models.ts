import "server-only";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { createTypeSafeAi } from "@ai-sdk/typesafe-ai";
import { loadConfig } from "@/lib/config";

export const config = loadConfig();

export const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
  compatibility: "strict",
  headers: {
    "HTTP-Referer": process.env.OPENROUTER_SITE_URL ?? "http://localhost:3000",
    "X-Title": "jev-web-search",
  },
});

export function chatModel(modelId: string = config.openRouterModel) {
  return openrouter.chat(modelId);
}

export function jevModel() {
  if (config.jevProvider === "typesafe") {
    return createTypeSafeAi({ apiKey: process.env.TYPESAFE_AI_API_KEY }).evaluationModel(config.jevModel);
  }
  return openrouter.evaluationModel(config.jevModel);
}
