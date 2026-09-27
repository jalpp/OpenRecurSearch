import { render, screen, fireEvent } from "@testing-library/react";
import { JevDecisionCard, decisionRows, pct } from "./JevDecisionCard";
import { ChatPanel } from "./ChatPanel";
import { ReportPanel, reportFilename } from "./ReportPanel";
import type { JevDecision } from "@/lib/recursearch/types";
import type { ResearchRun } from "@/lib/research-state";

const decision: JevDecision = {
  id: "d1",
  kind: "question-pick",
  depth: 0,
  prompt: "Which question?",
  verdict: "How does X affect Y?",
  probabilities: { a: 0.35, b: 0.65 },
  options: { a: "What is X?", b: "How does X affect Y?" },
  latencyMs: 142,
};

describe("JevDecisionCard", () => {
  it("sorts options by probability", () => {
    expect(decisionRows(decision).map((r) => r.key)).toEqual(["b", "a"]);
    expect(pct(0.654)).toBe("65%");
  });

  it("renders verdict, option probabilities and latency", () => {
    render(<JevDecisionCard decision={decision} />);
    expect(screen.getByText("Jev · Question pick")).toBeInTheDocument();
    expect(screen.getAllByText("How does X affect Y?")).toHaveLength(2);
    expect(screen.getByText("65%")).toBeInTheDocument();
    expect(screen.getByText("35%")).toBeInTheDocument();
    expect(screen.getByText("142 ms")).toBeInTheDocument();
  });
});

describe("reportFilename", () => {
  it("slugifies the question", () => {
    expect(reportFilename("How do LLMs work?")).toBe("how-do-llms-work.md");
    expect(reportFilename("???")).toBe("report.md");
  });
});

describe("ChatPanel", () => {
  const baseRun: ResearchRun = {
    id: "r1",
    question: "How do LLMs work?",
    status: "running",
    depth: 3,
    layersDone: 1,
    timeline: [
      { kind: "layer", depth: 0, query: "How do LLMs work?" },
      { kind: "jev", decision },
    ],
    report: "",
    citations: [],
    jevDecisions: 1,
    jevLatencyMs: 142,
    startedAt: Date.now(),
  };

  it("shows the live run with its Jev decisions and a stop button", () => {
    const onStop = jest.fn();
    render(<ChatPanel runs={[baseRun]} activeRunId="r1" busy config={null} onSubmit={jest.fn()} onStop={onStop} onSelect={jest.fn()} />);
    expect(screen.getByText("1 Jev decisions")).toBeInTheDocument();
    expect(screen.getByText("Layer 1/3")).toBeInTheDocument();
    expect(screen.getAllByTestId("jev-decision")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: /stop/i }));
    expect(onStop).toHaveBeenCalledWith("r1");
  });

  it("submits the question with the configured depth", () => {
    const onSubmit = jest.fn();
    render(
      <ChatPanel
        runs={[]}
        busy={false}
        config={{ model: "openai/gpt-5-mini", jevModel: "typesafe/jev-latest", jevProvider: "openrouter", defaultDepth: 4, maxDepth: 6, allowModelOverride: true, missing: [] }}
        onSubmit={onSubmit}
        onStop={jest.fn()}
        onSelect={jest.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText("Research question"), { target: { value: "What is Jev?" } });
    fireEvent.click(screen.getByRole("button", { name: /research$/i }));
    expect(onSubmit).toHaveBeenCalledWith("What is Jev?", { depth: 4, withCitations: true, model: undefined });
  });

  it("warns about missing secrets", () => {
    render(
      <ChatPanel
        runs={[]}
        busy={false}
        config={{ model: "m/x", jevModel: "j", jevProvider: "openrouter", defaultDepth: 3, maxDepth: 6, allowModelOverride: false, missing: ["TAVILY_API_KEY"] }}
        onSubmit={jest.fn()}
        onStop={jest.fn()}
        onSelect={jest.fn()}
      />,
    );
    expect(screen.getByText(/TAVILY_API_KEY/)).toBeInTheDocument();
  });
});

describe("ReportPanel", () => {
  const run: ResearchRun = {
    id: "r1",
    question: "How do LLMs work?",
    status: "writing",
    depth: 2,
    layersDone: 2,
    timeline: [],
    report: "# LLMs\n\n## Abstract",
    citations: [],
    jevDecisions: 5,
    jevLatencyMs: 500,
    startedAt: 0,
  };

  it("shows an empty state before any run", () => {
    render(<ReportPanel />);
    expect(screen.getByText(/report will stream in here/i)).toBeInTheDocument();
  });

  it("shows progress while researching and the markdown once writing", () => {
    const { rerender } = render(<ReportPanel run={{ ...run, status: "running", report: "", layersDone: 1 }} />);
    expect(screen.getByText(/Researching layer 2 of 2/)).toBeInTheDocument();
    rerender(<ReportPanel run={run} />);
    expect(screen.getByTestId("markdown")).toHaveTextContent("# LLMs");
    expect(screen.getByRole("button", { name: "Download markdown" })).toBeDisabled();
  });
});
