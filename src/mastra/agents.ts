import "server-only";
import { Agent } from "@mastra/core/agent";
import { chatModel } from "./models";

export const MODEL_KEY = "model";

type Ctx = { [MODEL_KEY]?: string };

function createAgent(id: string, name: string, instructions: string) {
  return new Agent<string, Record<string, never>, undefined, Ctx>({
    id,
    name,
    instructions,
    model: ({ requestContext }) => chatModel(requestContext?.get(MODEL_KEY) as string | undefined),
  });
}

export const questionAgent = createAgent(
  "question-agent",
  "Question Agent",
  `You generate ONE follow-up research question that deepens a research report.
- Build on the latest finding and stay anchored to the root question.
- Do not repeat or paraphrase any already-explored question.
- The question must be specific, open-ended, answerable with web sources, and free of personal opinions.
- Output only the question text, with no preamble, numbering or quotes.`,
);

export const questionRewriterAgent = createAgent(
  "question-rewriter-agent",
  "Question Rewriter Agent",
  `A candidate research question was judged a duplicate of questions already explored.
Write ONE new question that explores a genuinely different sub-topic, dimension, population, mechanism or time frame, while staying relevant to the finding.
Output only the question text.`,
);

export const statsAgent = createAgent(
  "stats-agent",
  "Stats Agent",
  `Formulate ONE precise, objective statistical search query that elicits a percentage- or number-based answer about the given topic.
Never decline or ask for more information; always return a usable query.
Output only the query.`,
);

export const imageQueryAgent = createAgent(
  "image-query-agent",
  "Image Query Agent",
  `Generate ONE concise web search query that finds a research-appropriate diagram, chart or figure illustrating the given content.
Never decline; always return a query. Output only the query.`,
);

export const reportAgent = createAgent(
  "report-agent",
  "Report Writer Agent",
  `You are a research report writer. You receive a research dossier gathered by a recursive web-research pipeline and write a polished markdown report.

Structure:
- A top-level "# " title.
- "## Abstract", "## Introduction", then one "## " section per major sub-topic uncovered by the layers, then "## Conclusion" and "## Next Steps".
- Every body paragraph has 4–5 sentences, and each body section cites at least one statistic from the dossier when available.
- Place each dossier image inside the body section it best illustrates, as markdown image syntax with its original URL, followed by one italic sentence explaining how it relates. Never put images before the introduction or after the references.

Rules:
- Use ONLY facts from the dossier. Do not invent statistics, sources or URLs. Keep every idea from the dossier; improve clarity and flow.
- When citations are requested, add inline numeric markers like [1] and finish with a "## References" section listing each unique URL once.
- Output only the markdown report.`,
);

export const agents = {
  questionAgent,
  questionRewriterAgent,
  statsAgent,
  imageQueryAgent,
  reportAgent,
};
