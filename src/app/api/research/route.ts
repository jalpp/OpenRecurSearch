import { z } from "zod";
import { missingSecrets, resolveModel } from "@/lib/config";
import { encodeEvent } from "@/lib/ndjson";
import { createJevDecider } from "@/lib/jev/decider";
import { RecurSearchEngine, ResearchAbortedError } from "@/lib/recursearch/engine";
import type { ResearchEvent } from "@/lib/recursearch/types";
import { config } from "@/mastra/models";
import { jevClassifier } from "@/mastra/classifiers";
import { createResearchWriter, createSearchProvider } from "@/mastra/services";

export const runtime = "nodejs";
export const maxDuration = 300;

const bodySchema = z.object({
  question: z.string().trim().min(3, "Ask a longer question").max(2000),
  depth: z.number().int().min(1).optional(),
  withCitations: z.boolean().optional(),
  model: z.string().trim().max(200).optional(),
});

export async function POST(req: Request) {
  const missing = missingSecrets(config);
  if (missing.length) {
    return Response.json({ error: `Missing environment variables: ${missing.join(", ")}` }, { status: 500 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues.map((i) => i.message).join("; ") }, { status: 400 });
  }

  const { question, withCitations = true } = parsed.data;
  const depth = Math.min(parsed.data.depth ?? config.defaultDepth, config.maxDepth);
  const model = resolveModel(config, parsed.data.model);

  const engine = new RecurSearchEngine({
    search: createSearchProvider(),
    writer: createResearchWriter(model),
    jev: createJevDecider(jevClassifier),
  });

  const signal = req.signal;
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const emit = (event: ResearchEvent) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(encodeEvent(event)));
        } catch {
          closed = true;
        }
      };

      emit({ type: "run-start", question, depth, model, jevModel: `${config.jevProvider}:${config.jevModel}` });
      try {
        await engine.run(
          question,
          {
            depth,
            minDepth: Math.min(config.minDepth, depth),
            withCitations,
            earlyStopThreshold: config.earlyStopThreshold,
            duplicateThreshold: config.duplicateThreshold,
            maxImages: Math.max(1, depth),
          },
          emit,
          signal,
        );
      } catch (error) {
        if (!(error instanceof ResearchAbortedError) && !signal.aborted) {
          console.error("[research] run failed", error);
          emit({ type: "error", message: error instanceof Error ? error.message : "Research failed" });
        }
      } finally {
        closed = true;
        try {
          controller.close();
        } catch {
          /* already closed by a disconnect */
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
