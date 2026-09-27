
import type { JevDecision, ResearchEvent } from "./recursearch/types";

export type RunStatus = "running" | "writing" | "done" | "error" | "stopped";

export type TimelineItem =
  | { kind: "layer"; depth: number; query: string }
  | { kind: "finding"; depth: number; answer: string; source?: { title: string; url: string } }
  | { kind: "candidate"; depth: number; question: string; rewritten?: boolean }
  | { kind: "jev"; decision: JevDecision }
  | { kind: "stats"; depth: number; query: string; answer: string }
  | { kind: "image"; depth: number; url: string; description: string }
  | { kind: "early-stop"; depth: number; reason: string };

export interface ResearchRun {
  id: string;
  question: string;
  status: RunStatus;
  depth: number;
  model?: string;
  jevModel?: string;
  layersDone: number;
  timeline: TimelineItem[];
  report: string;
  citations: string[];
  jevDecisions: number;
  jevLatencyMs: number;
  error?: string;
  startedAt: number;
  finishedAt?: number;
}

export interface ResearchState {
  runs: ResearchRun[];
  activeRunId?: string;
}

export type ResearchAction =
  | { type: "start"; id: string; question: string; depth: number; at: number }
  | { type: "event"; id: string; event: ResearchEvent; at: number }
  | { type: "stop"; id: string; at: number }
  | { type: "fail"; id: string; message: string; at: number }
  | { type: "select"; id: string };

export const initialResearchState: ResearchState = { runs: [] };

function updateRun(state: ResearchState, id: string, fn: (run: ResearchRun) => ResearchRun): ResearchState {
  return { ...state, runs: state.runs.map((r) => (r.id === id ? fn(r) : r)) };
}

const FINISHED: RunStatus[] = ["done", "error", "stopped"];

export function applyEvent(run: ResearchRun, event: ResearchEvent, at: number): ResearchRun {
  if (FINISHED.includes(run.status)) return run;
  switch (event.type) {
    case "run-start":
      return { ...run, depth: event.depth, model: event.model, jevModel: event.jevModel };
    case "layer-start":
      return { ...run, timeline: [...run.timeline, { kind: "layer", depth: event.depth, query: event.query }] };
    case "finding":
      return { ...run, timeline: [...run.timeline, { kind: "finding", depth: event.depth, answer: event.answer, source: event.source }] };
    case "question-candidate":
      return {
        ...run,
        timeline: [...run.timeline, { kind: "candidate", depth: event.depth, question: event.question, rewritten: event.rewritten }],
      };
    case "jev":
      return {
        ...run,
        timeline: [...run.timeline, { kind: "jev", decision: event.decision }],
        jevDecisions: run.jevDecisions + 1,
        jevLatencyMs: run.jevLatencyMs + event.decision.latencyMs,
      };
    case "stats":
      return { ...run, timeline: [...run.timeline, { kind: "stats", depth: event.depth, query: event.query, answer: event.answer }] };
    case "image":
      return {
        ...run,
        timeline: [...run.timeline, { kind: "image", depth: event.depth, url: event.url, description: event.description }],
      };
    case "layer-complete":
      return { ...run, layersDone: Math.max(run.layersDone, event.depth + 1) };
    case "early-stop":
      return { ...run, timeline: [...run.timeline, { kind: "early-stop", depth: event.depth, reason: event.reason }] };
    case "report-start":
      return { ...run, status: "writing", report: "" };
    case "report-delta":
      return { ...run, report: run.report + event.text };
    case "done":
      return { ...run, status: "done", report: event.report || run.report, citations: event.citations, finishedAt: at };
    case "error":
      return { ...run, status: "error", error: event.message, finishedAt: at };
    default:
      return run;
  }
}

export function researchReducer(state: ResearchState, action: ResearchAction): ResearchState {
  switch (action.type) {
    case "start":
      return {
        runs: [
          ...state.runs,
          {
            id: action.id,
            question: action.question,
            status: "running",
            depth: action.depth,
            layersDone: 0,
            timeline: [],
            report: "",
            citations: [],
            jevDecisions: 0,
            jevLatencyMs: 0,
            startedAt: action.at,
          },
        ],
        activeRunId: action.id,
      };
    case "event":
      return updateRun(state, action.id, (run) => applyEvent(run, action.event, action.at));
    case "stop":
      return updateRun(state, action.id, (run) =>
        FINISHED.includes(run.status) ? run : { ...run, status: "stopped", finishedAt: action.at },
      );
    case "fail":
      return updateRun(state, action.id, (run) =>
        FINISHED.includes(run.status) ? run : { ...run, status: "error", error: action.message, finishedAt: action.at },
      );
    case "select":
      return state.runs.some((r) => r.id === action.id) ? { ...state, activeRunId: action.id } : state;
    default:
      return state;
  }
}

export function isBusy(state: ResearchState): boolean {
  return state.runs.some((r) => r.status === "running" || r.status === "writing");
}
