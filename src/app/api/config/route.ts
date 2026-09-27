import { connection } from "next/server";
import { loadConfig, missingSecrets } from "@/lib/config";

/** Public, non-secret settings used to initialise the UI. */
export async function GET() {
  await connection();
  const config = loadConfig();
  return Response.json({
    model: config.openRouterModel,
    jevModel: config.jevModel,
    jevProvider: config.jevProvider,
    defaultDepth: config.defaultDepth,
    maxDepth: config.maxDepth,
    allowModelOverride: config.allowModelOverride,
    missing: missingSecrets(config),
  });
}
