
import type { JevDecider, JevDecision, JevDecisionKind } from "../recursearch/types";

type Input = string | Record<string, unknown> | unknown[];

export type JevQuestion =
  | { type: "choice"; instructions?: Input; criteria: Record<string, Input | null> }
  | { type: "score"; instructions?: Input; criteria: readonly (Input | null)[] }
  | { type: "boolean"; instructions?: Input; criteria?: { true?: Input | null; false?: Input | null } };

export type JevAnswer =
  | { type: "choice"; choice: string; probabilities?: Record<string, number> }
  | { type: "score"; score: number; probabilities?: Record<string, number> }
  | { type: "boolean"; probability: number };

/** Minimal surface of Mastra's `Classifier#evaluate` used by the decider. */
export interface JevEvaluator {
  evaluate(options: {
    state: Input;
    questions: Record<string, JevQuestion>;
    abortSignal?: AbortSignal;
  }): Promise<{ answers: Record<string, JevAnswer> }>;
}

const LABELS = "abcdefghijklmnopqrstuvwxyz".split("");
const MAX_SOURCE_CHARS = 1200;
const MAX_FINDING_CHARS = 2000;

export function truncate(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1)}…`;
}

/** Normalise a probability map so values sum to 1 (falls back to a one-hot on the choice). */
export function normalise(probabilities: Record<string, number> | undefined, labels: string[], chosen: string): Record<string, number> {
  const out: Record<string, number> = {};
  const total = labels.reduce((sum, l) => sum + (probabilities?.[l] ?? 0), 0);
  for (const label of labels) {
    out[label] = total > 0 ? (probabilities?.[label] ?? 0) / total : label === chosen ? 1 : 0;
  }
  return out;
}

export function createJevDecider(
  evaluator: JevEvaluator,
  now: () => number = () => Date.now(),
): JevDecider {
  let counter = 0;
  const nextId = (kind: JevDecisionKind, depth: number) => `${kind}-${depth}-${++counter}`;

  async function ask(state: Input, questions: Record<string, JevQuestion>, signal?: AbortSignal) {
    const started = now();
    const { answers } = await evaluator.evaluate({ state, questions, abortSignal: signal });
    return { answers, latencyMs: Math.max(0, now() - started) };
  }

  function choiceAnswer(answer: JevAnswer | undefined, labels: string[]) {
    if (!answer || answer.type !== "choice" || !labels.includes(answer.choice)) {
      // Jev never returns invalid options, but stay defensive: default to the first option.
      return { index: 0, label: labels[0], probabilities: normalise(undefined, labels, labels[0]) };
    }
    return {
      index: labels.indexOf(answer.choice),
      label: answer.choice,
      probabilities: normalise(answer.probabilities, labels, answer.choice),
    };
  }

  function booleanAnswer(answer: JevAnswer | undefined): number {
    if (answer?.type === "boolean" && Number.isFinite(answer.probability)) {
      return Math.min(1, Math.max(0, answer.probability));
    }
    return 0;
  }

  return {
    async pickSource({ question, sources, depth }, signal) {
      const candidates = sources.slice(0, LABELS.length);
      const labels = candidates.map((_, i) => LABELS[i]);
      const criteria = Object.fromEntries(
        candidates.map((s, i) => [labels[i], { title: s.title, url: s.url, excerpt: truncate(s.content, MAX_SOURCE_CHARS) }]),
      );
      const prompt =
        "Which web source is the most credible, research-grade and relevant evidence for the research question? Prefer primary research, reputable institutions and specific data over marketing or opinion.";

      const { answers, latencyMs } = await ask(
        { researchQuestion: question },
        { source: { type: "choice", instructions: prompt, criteria } },
        signal,
      );
      const { index, probabilities } = choiceAnswer(answers.source, labels);

      const decision: JevDecision = {
        id: nextId("source-pick", depth),
        kind: "source-pick",
        depth,
        prompt,
        verdict: candidates[index].title || candidates[index].url,
        probabilities,
        options: Object.fromEntries(candidates.map((s, i) => [labels[i], s.title || s.url])),
        latencyMs,
      };
      return { index, decision };
    },

    async isDuplicate({ candidate, explored, depth }, signal) {
      const prompt =
        "Is the candidate question thematically equivalent to (asks essentially the same thing as) any question that has already been explored?";
      if (explored.length === 0) {
        return {
          probability: 0,
          decision: {
            id: nextId("duplicate-check", depth),
            kind: "duplicate-check",
            depth,
            prompt,
            verdict: "Unique (nothing explored yet)",
            probabilities: { yes: 0, no: 1 },
            latencyMs: 0,
          },
        };
      }
      const { answers, latencyMs } = await ask(
        { candidateQuestion: candidate, exploredQuestions: explored },
        {
          duplicate: {
            type: "boolean",
            instructions: prompt,
            criteria: {
              true: "The candidate would retrieve substantially the same information as an explored question.",
              false: "The candidate explores a genuinely new angle, sub-topic or dimension.",
            },
          },
        },
        signal,
      );
      const probability = booleanAnswer(answers.duplicate);
      return {
        probability,
        decision: {
          id: nextId("duplicate-check", depth),
          kind: "duplicate-check",
          depth,
          prompt: `${prompt}\n\nCandidate: ${candidate}`,
          verdict: probability >= 0.5 ? "Duplicate" : "Unique",
          probabilities: { yes: probability, no: 1 - probability },
          latencyMs,
        },
      };
    },

    async pickQuestion({ rootQuestion, finding, candidates, depth }, signal) {
      const labels = candidates.map((_, i) => LABELS[i]);
      const prompt =
        "Which follow-up question has the strongest research potential for deepening the report on the root question: specific, researchable with web sources, and not already answered by the latest finding?";
      const { answers, latencyMs } = await ask(
        { rootQuestion, latestFinding: truncate(finding, MAX_FINDING_CHARS) },
        {
          question: {
            type: "choice",
            instructions: prompt,
            criteria: Object.fromEntries(candidates.map((q, i) => [labels[i], q])),
          },
        },
        signal,
      );
      const { index, probabilities } = choiceAnswer(answers.question, labels);
      return {
        index,
        decision: {
          id: nextId("question-pick", depth),
          kind: "question-pick",
          depth,
          prompt,
          verdict: candidates[index],
          probabilities,
          options: Object.fromEntries(candidates.map((q, i) => [labels[i], q])),
          latencyMs,
        },
      };
    },

    async assessCoverage({ rootQuestion, findings, depth }, signal) {
      const rubric = [
        "Barely addresses the root question.",
        "Covers one narrow aspect only.",
        "Covers the main aspects but lacks depth or evidence.",
        "Covers most aspects with supporting evidence.",
        "Comprehensive: multiple angles, statistics and evidence; ready for a full report.",
      ] as const;
      const prompt = "How thoroughly do the research findings so far cover the root question?";
      const { answers, latencyMs } = await ask(
        { rootQuestion, findings: findings.map((f) => truncate(f, MAX_FINDING_CHARS)) },
        {
          coverage: { type: "score", instructions: prompt, criteria: rubric },
          sufficient: {
            type: "boolean",
            instructions:
              "Is there already enough evidence to write a comprehensive, well-supported multi-section research report on the root question?",
          },
        },
        signal,
      );
      const coverage = answers.coverage;
      const score = coverage?.type === "score" && Number.isFinite(coverage.score) ? coverage.score : 0;
      const sufficient = booleanAnswer(answers.sufficient);
      const level = rubric[Math.min(rubric.length - 1, Math.max(0, Math.round(score)))];
      return {
        score,
        sufficient,
        decision: {
          id: nextId("coverage", depth),
          kind: "coverage",
          depth,
          prompt,
          verdict: `${level} (sufficient: ${Math.round(sufficient * 100)}%)`,
          probabilities: { sufficient, insufficient: 1 - sufficient },
          score,
          scoreMax: rubric.length - 1,
          latencyMs,
        },
      };
    },
  };
}
