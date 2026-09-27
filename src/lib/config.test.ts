/** @jest-environment node */
import { DEFAULTS, loadConfig, missingSecrets, resolveModel } from "./config";

describe("loadConfig", () => {
  it("uses defaults with an empty environment", () => {
    const c = loadConfig({});
    expect(c.openRouterModel).toBe(DEFAULTS.openRouterModel);
    expect(c.jevProvider).toBe("openrouter");
    expect(c.jevModel).toBe("typesafe/jev-latest");
    expect(c.defaultDepth).toBe(3);
    expect(c.allowModelOverride).toBe(true);
  });

  it("reads the OpenRouter model and Jev provider from env", () => {
    const c = loadConfig({ OPENROUTER_MODEL: " anthropic/claude-sonnet-5 ", JEV_PROVIDER: "TypeSafe" });
    expect(c.openRouterModel).toBe("anthropic/claude-sonnet-5");
    expect(c.jevProvider).toBe("typesafe");
    expect(c.jevModel).toBe("jev-latest");
  });

  it("clamps depths and ignores invalid thresholds", () => {
    const c = loadConfig({
      RECURSEARCH_MAX_DEPTH: "4",
      RECURSEARCH_DEFAULT_DEPTH: "9",
      RECURSEARCH_MIN_DEPTH: "0",
      JEV_EARLY_STOP_THRESHOLD: "1.5",
      JEV_DUPLICATE_THRESHOLD: "0.7",
    });
    expect(c.maxDepth).toBe(4);
    expect(c.defaultDepth).toBe(4);
    expect(c.minDepth).toBe(1);
    expect(c.earlyStopThreshold).toBe(DEFAULTS.earlyStopThreshold);
    expect(c.duplicateThreshold).toBe(0.7);
  });
});

describe("missingSecrets", () => {
  it("requires the TypeSafe key only for the typesafe provider", () => {
    expect(missingSecrets(loadConfig({}), {})).toEqual(["OPENROUTER_API_KEY", "TAVILY_API_KEY"]);
    const env = { JEV_PROVIDER: "typesafe", OPENROUTER_API_KEY: "x", TAVILY_API_KEY: "y" };
    expect(missingSecrets(loadConfig(env), env)).toEqual(["TYPESAFE_AI_API_KEY"]);
  });
});

describe("resolveModel", () => {
  const config = loadConfig({ OPENROUTER_MODEL: "openai/gpt-5-mini" });

  it("accepts valid OpenRouter ids", () => {
    expect(resolveModel(config, "google/gemini-3-pro:thinking")).toBe("google/gemini-3-pro:thinking");
  });

  it("falls back for empty or malformed ids", () => {
    expect(resolveModel(config, "")).toBe("openai/gpt-5-mini");
    expect(resolveModel(config, "not a model")).toBe("openai/gpt-5-mini");
  });

  it("ignores overrides when disabled", () => {
    const locked = loadConfig({ ALLOW_MODEL_OVERRIDE: "false" });
    expect(resolveModel(locked, "google/gemini-3-pro")).toBe(locked.openRouterModel);
  });
});
