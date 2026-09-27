
export type JevProvider = "openrouter" | "typesafe";

export interface AppConfig {
  openRouterModel: string;
  jevModel: string;
  jevProvider: JevProvider;
  defaultDepth: number;
  maxDepth: number;
  minDepth: number;
  earlyStopThreshold: number;
  duplicateThreshold: number;
  allowModelOverride: boolean;
}

export const DEFAULTS = {
  openRouterModel: "openai/gpt-5-mini",
  jevModelOpenRouter: "typesafe/jev-latest",
  jevModelTypeSafe: "jev-latest",
  defaultDepth: 3,
  maxDepth: 6,
  minDepth: 2,
  earlyStopThreshold: 0.8,
  duplicateThreshold: 0.6,
} as const;

type Env = Record<string, string | undefined>;

function clean(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function int(value: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(clean(value) ?? "", 10);
  if (Number.isNaN(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function prob(value: string | undefined, fallback: number): number {
  const parsed = Number.parseFloat(clean(value) ?? "");
  if (Number.isNaN(parsed) || parsed < 0 || parsed > 1) return fallback;
  return parsed;
}

export function loadConfig(env: Env = process.env): AppConfig {
  const jevProvider: JevProvider =
    clean(env.JEV_PROVIDER)?.toLowerCase() === "typesafe" ? "typesafe" : "openrouter";

  const maxDepth = int(env.RECURSEARCH_MAX_DEPTH, DEFAULTS.maxDepth, 1, 10);
  const defaultDepth = int(env.RECURSEARCH_DEFAULT_DEPTH, DEFAULTS.defaultDepth, 1, maxDepth);
  const minDepth = int(env.RECURSEARCH_MIN_DEPTH, DEFAULTS.minDepth, 1, maxDepth);

  return {
    openRouterModel: clean(env.OPENROUTER_MODEL) ?? DEFAULTS.openRouterModel,
    jevModel:
      clean(env.JEV_MODEL) ??
      (jevProvider === "typesafe" ? DEFAULTS.jevModelTypeSafe : DEFAULTS.jevModelOpenRouter),
    jevProvider,
    defaultDepth,
    maxDepth,
    minDepth,
    earlyStopThreshold: prob(env.JEV_EARLY_STOP_THRESHOLD, DEFAULTS.earlyStopThreshold),
    duplicateThreshold: prob(env.JEV_DUPLICATE_THRESHOLD, DEFAULTS.duplicateThreshold),
    allowModelOverride: clean(env.ALLOW_MODEL_OVERRIDE)?.toLowerCase() !== "false",
  };
}

export function missingSecrets(config: AppConfig, env: Env = process.env): string[] {
  const required = ["OPENROUTER_API_KEY", "TAVILY_API_KEY"];
  if (config.jevProvider === "typesafe") required.push("TYPESAFE_AI_API_KEY");
  return required.filter((key) => !clean(env[key]));
}

export function resolveModel(config: AppConfig, requested?: string): string {
  const candidate = clean(requested);
  if (!candidate || !config.allowModelOverride) return config.openRouterModel;
  return /^[\w.-]+\/[\w.:-]+$/.test(candidate) ? candidate : config.openRouterModel;
}
