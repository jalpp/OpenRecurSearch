/**
 * @jest-environment node
 *
 * Integration test for the real Jev wiring:
 *   createJevDecider → Mastra Classifier → OpenRouter evaluationModel → Decisions API
 * The network is replaced by a fetch stub that records requests and returns
 * Decisions API responses, so this runs offline but exercises the real SDK code.
 */
import { Classifier } from "@mastra/core/classifier";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { createJevDecider } from "./decider";

type DecisionsBody = { model: string; state: unknown; questions: Record<string, { type: string; criteria?: unknown }> };

function stubDecisions(answers: (body: DecisionsBody) => Record<string, unknown>) {
  const requests: { url: string; body: DecisionsBody; headers: Headers }[] = [];
  const fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as DecisionsBody;
    requests.push({ url: String(input), body, headers: new Headers(init?.headers) });
    return new Response(JSON.stringify({ id: "dec_1", model: body.model, answers: answers(body), usage: { input_tokens: 100, output_tokens: 3 } }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  return { fetch, requests };
}

function decider(fetch: typeof globalThis.fetch) {
  const openrouter = createOpenRouter({ apiKey: "sk-or-test", fetch });
  const classifier = new Classifier({ id: "jev-test", model: openrouter.evaluationModel("typesafe/jev-latest") });
  return createJevDecider(classifier);
}

describe("Jev via Mastra Classifier + OpenRouter Decisions API", () => {
  it("posts choice questions to /decisions and maps Jev's choice back", async () => {
    const { fetch, requests } = stubDecisions(() => ({
      question: { type: "choice", choice: "b", probabilities: { a: 0.27, b: 0.73 }, confidence: 0.9 },
    }));
    const res = await decider(fetch as typeof globalThis.fetch).pickQuestion({
      rootQuestion: "How do LLMs work?",
      finding: "Transformers use attention.",
      candidates: ["What is attention?", "How does RLHF shape model behaviour?"],
      depth: 0,
    });

    expect(requests).toHaveLength(1);
    expect(requests[0].url).toBe("https://openrouter.ai/api/alpha/decisions");
    expect(requests[0].headers.get("authorization")).toBe("Bearer sk-or-test");
    expect(requests[0].body.model).toBe("typesafe/jev-latest");
    expect(requests[0].body.questions.question.type).toBe("choice");
    expect(res.index).toBe(1);
    expect(res.decision.probabilities.b).toBeCloseTo(0.73);
  });

  it("sends boolean questions as Jev noul with both criteria and maps the probability", async () => {
    const { fetch, requests } = stubDecisions(() => ({ duplicate: { type: "noul", noul: 0.81 } }));
    const res = await decider(fetch as typeof globalThis.fetch).isDuplicate({
      candidate: "What is attention in transformers?",
      explored: ["How does attention work?"],
      depth: 1,
    });
    const q = requests[0].body.questions.duplicate as { type: string; criteria: { true: string; false: string } };
    expect(q.type).toBe("noul");
    expect(q.criteria.true).toBeTruthy();
    expect(q.criteria.false).toBeTruthy();
    expect(res.probability).toBeCloseTo(0.81);
  });

  it("sends a fully described score rubric plus a noul in one coverage request", async () => {
    const { fetch, requests } = stubDecisions(() => ({
      coverage: { type: "score", score: 3.2, confidence: 0.7 },
      sufficient: { type: "noul", noul: 0.9 },
    }));
    const res = await decider(fetch as typeof globalThis.fetch).assessCoverage({
      rootQuestion: "How do LLMs work?",
      findings: ["a", "b"],
      depth: 1,
    });
    const rubric = requests[0].body.questions.coverage.criteria as unknown[];
    expect(rubric).toHaveLength(5);
    expect(rubric.every((c) => typeof c === "string" && c.length > 0)).toBe(true);
    expect(res.score).toBeCloseTo(3.2);
    expect(res.sufficient).toBeCloseTo(0.9);
  });
});
