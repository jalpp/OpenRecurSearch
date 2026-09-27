import type { JevAnswer, JevEvaluator, JevQuestion } from "@/lib/jev/decider";
import type { ResearchWriter, SearchProvider, WebSearchResponse } from "@/lib/recursearch/types";

/** Scriptable Jev evaluator: `answer` decides each question, calls are recorded. */
export function fakeEvaluator(
  answer: (name: string, question: JevQuestion, state: unknown) => JevAnswer,
): JevEvaluator & { calls: { state: unknown; questions: Record<string, JevQuestion> }[] } {
  const calls: { state: unknown; questions: Record<string, JevQuestion> }[] = [];
  return {
    calls,
    async evaluate({ state, questions }) {
      calls.push({ state, questions });
      return {
        answers: Object.fromEntries(Object.entries(questions).map(([name, q]) => [name, answer(name, q, state)])),
      };
    },
  };
}

export function fakeSearch(overrides: Partial<SearchProvider> = {}): SearchProvider & { queries: string[] } {
  const queries: string[] = [];
  const base: SearchProvider = {
    async search(query): Promise<WebSearchResponse> {
      queries.push(query);
      return {
        answer: `Answer for ${query}`,
        results: [
          { title: "Blog", url: `https://blog.example/${queries.length}`, content: "opinion" },
          { title: "Journal", url: `https://journal.example/${queries.length}`, content: "peer reviewed data" },
        ],
        images: [{ url: "https://img.example/fallback.png", description: "fallback diagram" }],
      };
    },
    async images() {
      return [{ url: "https://img.example/a.png", description: "diagram" }];
    },
    async stats(query) {
      return { answer: `42% for ${query}`, citations: ["https://stats.example/1"] };
    },
  };
  return Object.assign({ queries }, base, overrides);
}

export function fakeWriter(overrides: Partial<ResearchWriter> = {}): ResearchWriter {
  let n = 0;
  const base: ResearchWriter = {
    async followUpQuestion() {
      n += 1;
      return `Question: follow-up ${n}?`;
    },
    async rewriteQuestion({ candidate }) {
      return `${candidate} (new angle)`;
    },
    async statsQuery(q) {
      return `stats about ${q}`;
    },
    async imageQuery() {
      return "diagram query";
    },
    async *streamReport({ rootQuestion }) {
      yield "# Report\n";
      yield `About ${rootQuestion}`;
    },
  };
  return { ...base, ...overrides };
}
