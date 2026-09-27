/** @jest-environment node */
import { initialResearchState, isBusy, researchReducer, type ResearchState } from "./research-state";
import type { JevDecision, ResearchEvent } from "./recursearch/types";

const decision: JevDecision = {
  id: "d1",
  kind: "question-pick",
  depth: 0,
  prompt: "p",
  verdict: "q2",
  probabilities: { a: 0.4, b: 0.6 },
  latencyMs: 120,
};

function feed(state: ResearchState, events: ResearchEvent[], id = "r1") {
  return events.reduce((s, event, i) => researchReducer(s, { type: "event", id, event, at: 1000 + i }), state);
}

describe("researchReducer", () => {
  const started = researchReducer(initialResearchState, { type: "start", id: "r1", question: "Q", depth: 3, at: 0 });

  it("starts a run and makes it active", () => {
    expect(started.activeRunId).toBe("r1");
    expect(started.runs[0]).toMatchObject({ status: "running", depth: 3, question: "Q" });
    expect(isBusy(started)).toBe(true);
  });

  it("builds the timeline and counts Jev decisions", () => {
    const s = feed(started, [
      { type: "run-start", question: "Q", depth: 2, model: "m", jevModel: "j" },
      { type: "layer-start", depth: 0, query: "Q" },
      { type: "jev", decision },
      { type: "jev", decision: { ...decision, id: "d2", latencyMs: 80 } },
      { type: "layer-complete", depth: 0, nextQuestion: "q2" },
    ]);
    const run = s.runs[0];
    expect(run.depth).toBe(2);
    expect(run.model).toBe("m");
    expect(run.timeline.map((t) => t.kind)).toEqual(["layer", "jev", "jev"]);
    expect(run.jevDecisions).toBe(2);
    expect(run.jevLatencyMs).toBe(200);
    expect(run.layersDone).toBe(1);
  });

  it("accumulates report deltas and completes", () => {
    const s = feed(started, [
      { type: "report-start" },
      { type: "report-delta", text: "# Title" },
      { type: "report-delta", text: "\nBody" },
    ]);
    expect(s.runs[0].status).toBe("writing");
    expect(s.runs[0].report).toBe("# Title\nBody");
    const done = feed(s, [{ type: "done", report: "# Title\nBody", layers: 1, citations: ["https://x"] }]);
    expect(done.runs[0]).toMatchObject({ status: "done", citations: ["https://x"] });
    expect(isBusy(done)).toBe(false);
  });

  it("ignores events after a run is stopped", () => {
    const stopped = researchReducer(started, { type: "stop", id: "r1", at: 5 });
    const after = feed(stopped, [{ type: "report-delta", text: "late" }]);
    expect(after.runs[0].status).toBe("stopped");
    expect(after.runs[0].report).toBe("");
  });

  it("records errors and only selects existing runs", () => {
    const failed = feed(started, [{ type: "error", message: "boom" }]);
    expect(failed.runs[0]).toMatchObject({ status: "error", error: "boom" });
    expect(researchReducer(failed, { type: "select", id: "nope" })).toBe(failed);
  });
});
