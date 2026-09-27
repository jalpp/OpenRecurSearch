import type { Config } from "jest";
import nextJest from "next/jest.js";

const createJestConfig = nextJest({ dir: "./" });

const config: Config = {
  coverageProvider: "v8",
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  testMatch: ["<rootDir>/src/**/*.test.{ts,tsx}"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "^server-only$": "<rootDir>/src/test/server-only.ts",
    "^react-markdown$": "<rootDir>/src/test/mocks/react-markdown.tsx",
    "^remark-gfm$": "<rootDir>/src/test/mocks/remark-gfm.ts",
  },
  collectCoverageFrom: ["src/lib/**/*.{ts,tsx}", "src/components/**/*.{ts,tsx}", "!src/**/*.test.{ts,tsx}", "!src/test/**"],
};

/**
 * AI SDK 7 and the OpenRouter provider are ESM-only. Let the Next.js SWC
 * transform compile them (instead of ignoring all of node_modules) so the
 * Jev wiring integration test can load the real SDK code under Jest.
 */
const ESM_PACKAGES = ["@ai-sdk", "@openrouter", "ai", "eventsource-parser", "@standard-schema", "@vercel/oidc", "@workflow"];

export default async function jestConfig(): Promise<Config> {
  const resolved = await createJestConfig(config)();
  return {
    ...resolved,
    transformIgnorePatterns: [
      `/node_modules/(?!(${ESM_PACKAGES.join("|")})/)`,
      "^.+\\.module\\.(css|sass|scss)$",
    ],
  };
}
