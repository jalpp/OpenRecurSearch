/**
 * Shared types for the RecurSearch engine, its dependencies and the event
 * stream consumed by the UI. Everything here is framework-free.
 */

export interface SearchResult {
  title: string;
  url: string;
  content: string;
}

export interface SearchImage {
  url: string;
  description?: string;
}

export interface WebSearchResponse {
  answer: string;
  results: SearchResult[];
  images: SearchImage[];
}

export interface StatsResponse {
  answer: string;
  citations: string[];
}

/** Web search backend (Tavily + Exa in production, fakes in tests). */
export interface SearchProvider {
  search(query: string, signal?: AbortSignal): Promise<WebSearchResponse>;
  images(query: string, signal?: AbortSignal): Promise<SearchImage[]>;
  stats(query: string, signal?: AbortSignal): Promise<StatsResponse>;
}

/** Generative LLM work (Mastra agents on OpenRouter in production). */
export interface ResearchWriter {
  followUpQuestion(input: { rootQuestion: string; finding: string; explored: string[] }, signal?: AbortSignal): Promise<string>;
  rewriteQuestion(input: { candidate: string; explored: string[]; finding: string }, signal?: AbortSignal): Promise<string>;
  statsQuery(question: string, signal?: AbortSignal): Promise<string>;
  imageQuery(finding: string, signal?: AbortSignal): Promise<string>;
  streamReport(input: { rootQuestion: string; context: string; withCitations: boolean }, signal?: AbortSignal): AsyncIterable<string>;
}

export type JevDecisionKind =
  | "source-pick"
  | "duplicate-check"
  | "question-pick"
  | "coverage";

/** One decision made by Jev, surfaced to the UI in real time. */
export interface JevDecision {
  id: string;
  kind: JevDecisionKind;
  depth: number;
  /** The instruction Jev was asked. */
  prompt: string;
  /** Human-readable label for the selected outcome. */
  verdict: string;
  /** Probability per option label (choice), or yes/no (boolean). */
  probabilities: Record<string, number>;
  /** Option label -> display text. */
  options?: Record<string, string>;
  /** Rubric score when the question was a score question. */
  score?: number;
  scoreMax?: number;
  latencyMs: number;
}

/** Jev-backed decision points of the algorithm. */
export interface JevDecider {
  pickSource(input: { question: string; sources: SearchResult[]; depth: number }, signal?: AbortSignal): Promise<{ index: number; decision: JevDecision }>;
  isDuplicate(input: { candidate: string; explored: string[]; depth: number }, signal?: AbortSignal): Promise<{ probability: number; decision: JevDecision }>;
  pickQuestion(input: { rootQuestion: string; finding: string; candidates: string[]; depth: number }, signal?: AbortSignal): Promise<{ index: number; decision: JevDecision }>;
  assessCoverage(input: { rootQuestion: string; findings: string[]; depth: number }, signal?: AbortSignal): Promise<{ score: number; sufficient: number; decision: JevDecision }>;
}

export interface ResearchOptions {
  depth: number;
  minDepth: number;
  withCitations: boolean;
  earlyStopThreshold: number;
  duplicateThreshold: number;
  maxImages: number;
}

export interface LayerFinding {
  depth: number;
  question: string;
  answer: string;
  source?: SearchResult;
  stats?: string;
  nextQuestion?: string;
}

export type ResearchEvent =
  | { type: "run-start"; question: string; depth: number; model: string; jevModel: string }
  | { type: "layer-start"; depth: number; query: string }
  | { type: "finding"; depth: number; answer: string; source?: { title: string; url: string } }
  | { type: "question-candidate"; depth: number; question: string; rewritten?: boolean }
  | { type: "jev"; decision: JevDecision }
  | { type: "stats"; depth: number; query: string; answer: string }
  | { type: "image"; depth: number; url: string; description: string }
  | { type: "layer-complete"; depth: number; nextQuestion?: string }
  | { type: "early-stop"; depth: number; reason: string }
  | { type: "report-start" }
  | { type: "report-delta"; text: string }
  | { type: "done"; report: string; layers: number; citations: string[] }
  | { type: "error"; message: string };

export type EmitFn = (event: ResearchEvent) => void;
