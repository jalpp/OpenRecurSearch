/**
 * RecurSearch engine: recursive, layer-by-layer web research.
 *
 * Each layer:
 *   1. search the current query (answer + sources + images)
 *   2. Jev picks the most credible source                  (choice)
 *   3. LLM finds a diagram query, first described image kept
 *   4. LLM drafts two follow-up questions (in parallel)
 *   5. Jev flags duplicates of explored questions          (boolean) → LLM rewrites
 *   6. Jev picks the more research-worthy question          (choice)
 *   7. LLM writes a statistics query, answered by the stats search
 *   8. Jev scores coverage and decides whether to stop early (score + boolean)
 * The picked question becomes the next layer's query. Finally a report writer
 * agent streams a markdown report from the accumulated context.
 *
 * Unlike the original implementation, all state lives inside a single run, so
 * concurrent requests never share findings.
 */
import type {
  EmitFn,
  JevDecider,
  LayerFinding,
  ResearchOptions,
  ResearchWriter,
  SearchImage,
  SearchProvider,
} from "./types";
import { buildReportContext } from "./report";

export interface EngineDeps {
  search: SearchProvider;
  writer: ResearchWriter;
  jev: JevDecider;
}

export interface ResearchResult {
  report: string;
  layers: LayerFinding[];
  citations: string[];
  images: { url: string; description: string }[];
}

export class ResearchAbortedError extends Error {
  constructor() {
    super("Research was cancelled");
    this.name = "ResearchAbortedError";
  }
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new ResearchAbortedError();
}

function cleanQuestion(text: string): string {
  return text
    .trim()
    .replace(/^["'`*\s]+|["'`*\s]+$/g, "")
    .replace(/^(question|follow-up question)\s*:\s*/i, "")
    .trim();
}

function firstDescribed(images: SearchImage[]): { url: string; description: string } | undefined {
  const hit = images.find((img) => img.url && img.description?.trim());
  return hit ? { url: hit.url, description: hit.description!.trim() } : undefined;
}

export class RecurSearchEngine {
  constructor(private readonly deps: EngineDeps) {}

  async run(
    rootQuestion: string,
    options: ResearchOptions,
    emit: EmitFn,
    signal?: AbortSignal,
  ): Promise<ResearchResult> {
    const { search, writer, jev } = this.deps;
    const layers: LayerFinding[] = [];
    const explored: string[] = [rootQuestion];
    const citations = new Set<string>();
    const images: { url: string; description: string }[] = [];

    let query = rootQuestion;

    for (let depth = 0; depth < options.depth; depth++) {
      throwIfAborted(signal);
      emit({ type: "layer-start", depth, query });

      // 1. Search
      const res = await search.search(query, signal);
      const layer: LayerFinding = { depth, question: query, answer: res.answer || "No answer found." };

      // 2. Jev picks the most credible source
      if (res.results.length >= 2) {
        const { index, decision } = await jev.pickSource({ question: query, sources: res.results, depth }, signal);
        emit({ type: "jev", decision });
        layer.source = res.results[index];
      } else if (res.results.length === 1) {
        layer.source = res.results[0];
      }
      if (layer.source) citations.add(layer.source.url);
      emit({
        type: "finding",
        depth,
        answer: layer.answer,
        source: layer.source ? { title: layer.source.title, url: layer.source.url } : undefined,
      });

      const finding = layer.source ? `${layer.answer}\n\n${layer.source.content}` : layer.answer;

      // 3. Image (bounded to avoid rate limits, as in the original)
      if (images.length < options.maxImages) {
        const image = await this.findImage(finding, res.images, signal);
        if (image) {
          images.push(image);
          emit({ type: "image", depth, ...image });
        }
      }

      const isLast = depth === options.depth - 1;
      if (!isLast) {
        // 4–6. Follow-up questions, Jev de-duplication and pick
        const next = await this.nextQuestion(rootQuestion, finding, explored, depth, options, emit, signal);
        layer.nextQuestion = next;
        explored.push(next);

        // 7. Statistics
        throwIfAborted(signal);
        const statQuery = cleanQuestion(await writer.statsQuery(next, signal));
        const stat = await search.stats(statQuery, signal);
        layer.stats = stat.answer;
        stat.citations.forEach((c) => citations.add(c));
        emit({ type: "stats", depth, query: statQuery, answer: stat.answer });
      }

      layers.push(layer);
      emit({ type: "layer-complete", depth, nextQuestion: layer.nextQuestion });

      // 8. Jev decides whether coverage is already sufficient
      if (!isLast && depth + 1 >= options.minDepth) {
        const assessment = await jev.assessCoverage(
          { rootQuestion, findings: layers.map((l) => `${l.question}\n${l.answer}\n${l.stats ?? ""}`), depth },
          signal,
        );
        emit({ type: "jev", decision: assessment.decision });
        if (assessment.sufficient >= options.earlyStopThreshold) {
          emit({
            type: "early-stop",
            depth,
            reason: `Jev judged coverage sufficient (${Math.round(assessment.sufficient * 100)}% ≥ ${Math.round(options.earlyStopThreshold * 100)}%)`,
          });
          break;
        }
      }

      if (layer.nextQuestion) query = layer.nextQuestion;
    }

    // Report
    throwIfAborted(signal);
    emit({ type: "report-start" });
    const citationList = [...citations];
    const context = buildReportContext({ rootQuestion, layers, images, citations: citationList, withCitations: options.withCitations });
    let report = "";
    for await (const delta of writer.streamReport({ rootQuestion, context, withCitations: options.withCitations }, signal)) {
      throwIfAborted(signal);
      if (!delta) continue;
      report += delta;
      emit({ type: "report-delta", text: delta });
    }

    emit({ type: "done", report, layers: layers.length, citations: citationList });
    return { report, layers, citations: citationList, images };
  }

  private async findImage(finding: string, fallback: SearchImage[], signal?: AbortSignal) {
    try {
      const imageQuery = cleanQuestion(await this.deps.writer.imageQuery(finding, signal));
      const found = imageQuery ? await this.deps.search.images(imageQuery, signal) : [];
      return firstDescribed(found) ?? firstDescribed(fallback);
    } catch (error) {
      if (error instanceof ResearchAbortedError || signal?.aborted) throw error;
      // Images are nice-to-have: never fail a run because of them.
      return firstDescribed(fallback);
    }
  }

  private async nextQuestion(
    rootQuestion: string,
    finding: string,
    explored: string[],
    depth: number,
    options: ResearchOptions,
    emit: EmitFn,
    signal?: AbortSignal,
  ): Promise<string> {
    const { writer, jev } = this.deps;
    throwIfAborted(signal);

    const drafts = await Promise.all([
      writer.followUpQuestion({ rootQuestion, finding, explored }, signal),
      writer.followUpQuestion({ rootQuestion, finding, explored: [...explored, "(propose a different angle than the obvious next question)"] }, signal),
    ]);

    const candidates: string[] = [];
    for (const draft of drafts) {
      let candidate = cleanQuestion(draft);
      emit({ type: "question-candidate", depth, question: candidate });
      const known = [...explored, ...candidates];
      const dup = await jev.isDuplicate({ candidate, explored: known, depth }, signal);
      emit({ type: "jev", decision: dup.decision });
      if (dup.probability >= options.duplicateThreshold) {
        candidate = cleanQuestion(await writer.rewriteQuestion({ candidate, explored: known, finding }, signal));
        emit({ type: "question-candidate", depth, question: candidate, rewritten: true });
      }
      candidates.push(candidate);
    }

    const pick = await jev.pickQuestion({ rootQuestion, finding, candidates, depth }, signal);
    emit({ type: "jev", decision: pick.decision });
    return candidates[pick.index];
  }
}
