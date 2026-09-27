/** @jest-environment node */
import { RecurSearchEngine, ResearchAbortedError } from "./engine";
import { buildReportContext } from "./report";
import type { JevDecider, JevDecision, ResearchEvent, ResearchOptions } from "./types";
import { createJevDecider } from "@/lib/jev/decider";
import { fakeEvaluator, fakeSearch, fakeWriter } from "@/test/fakes";

const options: ResearchOptions = {
  depth: 3,
  minDepth: 2,
  withCitations: true,
  earlyStopThreshold: 0.8,
  duplicateThreshold: 0.6,
  maxImages: 3,
};

/** Jev that prefers source "b", flags nothing as duplicate, picks question "b", never stops early. */
function scriptedJev(overrides: { duplicate?: number; sufficient?: number } = {}) {
  return createJevDecider(
    fakeEvaluator((name) => {
      switch (name) {
        case "source":
          return { type: "choice", choice: "b", probabilities: { a: 0.3, b: 0.7 } };
        case "question":
          return { type: "choice", choice: "b", probabilities: { a: 0.4, b: 0.6 } };
        case "duplicate":
          return { type: "boolean", probability: overrides.duplicate ?? 0.1 };
        case "coverage":
          return { type: "score", score: 2 };
        case "sufficient":
          return { type: "boolean", probability: overrides.sufficient ?? 0.2 };
        default:
          throw new Error(`unexpected question ${name}`);
      }
    }),
  );
}

async function run(jev: JevDecider, opts: Partial<ResearchOptions> = {}, deps: { search?: ReturnType<typeof fakeSearch>; writer?: ReturnType<typeof fakeWriter> } = {}) {
  const search = deps.search ?? fakeSearch();
  const events: ResearchEvent[] = [];
  const engine = new RecurSearchEngine({ search, writer: deps.writer ?? fakeWriter(), jev });
  const result = await engine.run("What is X?", { ...options, ...opts }, (e) => events.push(e));
  return { result, events, search };
}

const jevEvents = (events: ResearchEvent[]) =>
  events.filter((e): e is { type: "jev"; decision: JevDecision } => e.type === "jev").map((e) => e.decision.kind);

describe("RecurSearchEngine", () => {
  it("recurses to the configured depth, following Jev's picked question", async () => {
    const { result, events, search } = await run(scriptedJev());

    expect(result.layers).toHaveLength(3);
    // Layer 1 searches the root; each next layer searches the question Jev picked (candidate "b" = 2nd draft).
    expect(search.queries).toEqual(["What is X?", "follow-up 2?", "follow-up 4?"]);
    expect(result.layers[0].source?.title).toBe("Journal");
    expect(result.layers[2].nextQuestion).toBeUndefined();

    expect(jevEvents(events)).toEqual([
      "source-pick", "duplicate-check", "duplicate-check", "question-pick",
      "source-pick", "duplicate-check", "duplicate-check", "question-pick", "coverage",
      "source-pick",
    ]);
  });

  it("streams the report and finishes with a done event", async () => {
    const { result, events } = await run(scriptedJev());
    const deltas = events.filter((e) => e.type === "report-delta").map((e) => (e as { text: string }).text);
    expect(deltas.join("")).toBe(result.report);
    expect(result.report).toContain("About What is X?");
    const done = events.at(-1);
    expect(done).toMatchObject({ type: "done", layers: 3 });
    expect(result.citations).toEqual(expect.arrayContaining(["https://journal.example/1", "https://stats.example/1"]));
    expect(new Set(result.citations).size).toBe(result.citations.length);
  });

  it("stops early when Jev judges coverage sufficient", async () => {
    const { result, events } = await run(scriptedJev({ sufficient: 0.95 }), { depth: 5 });
    expect(result.layers).toHaveLength(2);
    expect(events.some((e) => e.type === "early-stop")).toBe(true);
  });

  it("rewrites candidates that Jev flags as duplicates", async () => {
    const { events } = await run(scriptedJev({ duplicate: 0.9 }), { depth: 2 });
    const rewritten = events.filter((e) => e.type === "question-candidate" && e.rewritten);
    expect(rewritten).toHaveLength(2);
    expect((rewritten[0] as { question: string }).question).toMatch(/new angle/);
  });

  it("keeps going when image search fails", async () => {
    const search = fakeSearch({ images: async () => { throw new Error("rate limited"); } });
    const { result } = await run(scriptedJev(), { depth: 1 }, { search });
    expect(result.images).toEqual([{ url: "https://img.example/fallback.png", description: "fallback diagram" }]);
  });

  it("respects maxImages", async () => {
    const { result } = await run(scriptedJev(), { maxImages: 1 });
    expect(result.images).toHaveLength(1);
  });

  it("aborts cleanly", async () => {
    const controller = new AbortController();
    const engine = new RecurSearchEngine({ search: fakeSearch(), writer: fakeWriter(), jev: scriptedJev() });
    const promise = engine.run("q", options, (e) => {
      if (e.type === "layer-complete") controller.abort();
    }, controller.signal);
    await expect(promise).rejects.toBeInstanceOf(ResearchAbortedError);
  });

  it("does not share state between runs", async () => {
    const jev = scriptedJev();
    const a = await run(jev, { depth: 2 });
    const b = await run(jev, { depth: 2 });
    expect(b.result.layers).toHaveLength(2);
    expect(b.result.citations.length).toBe(a.result.citations.length);
  });
});

describe("buildReportContext", () => {
  it("includes findings, stats, images and citations only when requested", () => {
    const input = {
      rootQuestion: "Root",
      layers: [{ depth: 0, question: "Root", answer: "A", stats: "50% of Y", source: { title: "T", url: "https://t", content: "C" } }],
      images: [{ url: "https://i", description: "a [weird]\nalt" }],
      citations: ["https://t"],
    };
    const withC = buildReportContext({ ...input, withCitations: true });
    expect(withC).toContain("### Layer 1: Root");
    expect(withC).toContain("- 50% of Y");
    expect(withC).toContain("![a  weird  alt](https://i)");
    expect(withC).toContain("[1] https://t");
    expect(buildReportContext({ ...input, withCitations: false })).not.toContain("## Citations");
  });
});
