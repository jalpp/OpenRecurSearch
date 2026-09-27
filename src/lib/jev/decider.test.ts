/** @jest-environment node */
import { createJevDecider, normalise, truncate } from "./decider";
import { fakeEvaluator } from "@/test/fakes";

const clock = () => {
  let t = 0;
  return () => (t += 25);
};

describe("helpers", () => {
  it("truncates and collapses whitespace", () => {
    expect(truncate("a   b\n c", 10)).toBe("a b c");
    expect(truncate("abcdefghij", 5)).toBe("abcd…");
  });

  it("normalises probabilities and falls back to one-hot", () => {
    expect(normalise({ a: 2, b: 6 }, ["a", "b"], "b")).toEqual({ a: 0.25, b: 0.75 });
    expect(normalise(undefined, ["a", "b"], "b")).toEqual({ a: 0, b: 1 });
  });
});

describe("createJevDecider", () => {
  it("pickSource sends a choice question with labelled sources and returns Jev's pick", async () => {
    const ev = fakeEvaluator(() => ({ type: "choice", choice: "b", probabilities: { a: 0.2, b: 0.8 } }));
    const jev = createJevDecider(ev, clock());
    const { index, decision } = await jev.pickSource({
      question: "q",
      depth: 0,
      sources: [
        { title: "Blog", url: "https://a", content: "x" },
        { title: "Journal", url: "https://b", content: "y" },
      ],
    });
    expect(index).toBe(1);
    expect(decision.kind).toBe("source-pick");
    expect(decision.verdict).toBe("Journal");
    expect(decision.probabilities).toEqual({ a: 0.2, b: 0.8 });
    expect(decision.latencyMs).toBe(25);
    const q = ev.calls[0].questions.source;
    expect(q.type).toBe("choice");
    expect(Object.keys((q as { criteria: object }).criteria)).toEqual(["a", "b"]);
  });

  it("defaults to the first option if Jev returns an unknown label", async () => {
    const ev = fakeEvaluator(() => ({ type: "choice", choice: "zzz" }));
    const { index } = await createJevDecider(ev).pickQuestion({ rootQuestion: "r", finding: "f", candidates: ["q1", "q2"], depth: 1 });
    expect(index).toBe(0);
  });

  it("isDuplicate skips the API call when nothing is explored", async () => {
    const ev = fakeEvaluator(() => ({ type: "boolean", probability: 1 }));
    const res = await createJevDecider(ev).isDuplicate({ candidate: "c", explored: [], depth: 0 });
    expect(res.probability).toBe(0);
    expect(ev.calls).toHaveLength(0);
  });

  it("isDuplicate asks a boolean question with the explored set as state", async () => {
    const ev = fakeEvaluator(() => ({ type: "boolean", probability: 0.9 }));
    const res = await createJevDecider(ev).isDuplicate({ candidate: "c", explored: ["x"], depth: 0 });
    expect(res.probability).toBe(0.9);
    expect(res.decision.verdict).toBe("Duplicate");
    expect(ev.calls[0].state).toEqual({ candidateQuestion: "c", exploredQuestions: ["x"] });
    expect(ev.calls[0].questions.duplicate.type).toBe("boolean");
  });

  it("assessCoverage combines a score rubric and a boolean in one request", async () => {
    const ev = fakeEvaluator((name) =>
      name === "coverage" ? { type: "score", score: 3.4 } : { type: "boolean", probability: 0.85 },
    );
    const res = await createJevDecider(ev).assessCoverage({ rootQuestion: "r", findings: ["a", "b"], depth: 2 });
    expect(ev.calls).toHaveLength(1);
    expect(Object.keys(ev.calls[0].questions)).toEqual(["coverage", "sufficient"]);
    expect(res.score).toBe(3.4);
    expect(res.sufficient).toBe(0.85);
    expect(res.decision.scoreMax).toBe(4);
    expect(res.decision.verdict).toMatch(/85%/);
  });
});
