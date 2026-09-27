import type { LayerFinding } from "./types";

export interface ReportContextInput {
  rootQuestion: string;
  layers: LayerFinding[];
  images: { url: string; description: string }[];
  citations: string[];
  withCitations: boolean;
}

/** Escape characters that would break markdown image alt text. */
function alt(text: string): string {
  return text.replace(/[[\]\n]/g, " ").trim();
}

/**
 * Build the research dossier handed to the report writer agent.
 * Mirrors the original RecurSearch final report: Report, Statistics, Images, Citations.
 */
export function buildReportContext({ rootQuestion, layers, images, citations, withCitations }: ReportContextInput): string {
  const sections: string[] = [`# Research dossier\n\nRoot question: ${rootQuestion}`];

  sections.push(
    "## Findings by layer\n\n" +
      layers
        .map((l) => {
          const lines = [`### Layer ${l.depth + 1}: ${l.question}`, "", l.answer];
          if (l.source) lines.push("", `Selected source (${l.source.title}, ${l.source.url}):`, l.source.content);
          return lines.join("\n");
        })
        .join("\n\n"),
  );

  const stats = layers.filter((l) => l.stats?.trim());
  if (stats.length) {
    sections.push("## Statistics\n\n" + stats.map((l) => `- ${l.stats!.trim().replace(/\n+/g, " ")}`).join("\n"));
  }

  if (images.length) {
    sections.push("## Images\n\n" + images.map((i) => `![${alt(i.description)}](${i.url})`).join("\n"));
  }

  if (withCitations && citations.length) {
    sections.push("## Citations\n\n" + citations.map((c, i) => `[${i + 1}] ${c}`).join("\n"));
  }

  return sections.join("\n\n");
}
