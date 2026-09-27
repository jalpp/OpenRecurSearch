import "server-only";
import { tavily } from "@tavily/core";
import Exa from "exa-js";
import { RequestContext } from "@mastra/core/request-context";
import type { ResearchWriter, SearchProvider } from "@/lib/recursearch/types";
import { MODEL_KEY, type agents } from "./agents";
import { mastra } from "./index";

export function createSearchProvider(): SearchProvider {
  const tvly = tavily({ apiKey: process.env.TAVILY_API_KEY });
  const exaKey = process.env.EXA_API_KEY?.trim();
  const exa = exaKey ? new Exa(exaKey) : undefined;

  return {
    async search(query) {
      const res = await tvly.search(query, {
        searchDepth: "basic",
        maxResults: 5,
        includeAnswer: true,
        includeImages: true,
        includeImageDescriptions: true,
      });
      return {
        answer: res.answer ?? "",
        results: res.results.map((r) => ({ title: r.title, url: r.url, content: r.content })),
        images: res.images.map((i) => ({ url: i.url, description: i.description })),
      };
    },

    async images(query) {
      const res = await tvly.search(query, {
        searchDepth: "basic",
        maxResults: 1,
        includeImages: true,
        includeImageDescriptions: true,
      });
      return res.images.map((i) => ({ url: i.url, description: i.description }));
    },

    async stats(query) {
      if (exa) {
        const res = await exa.answer(query);
        const answer = typeof res.answer === "string" ? res.answer : JSON.stringify(res.answer);
        return { answer: answer || "No answer found.", citations: res.citations.map((c) => c.url).filter(Boolean) };
      }
      const res = await tvly.search(query, { searchDepth: "basic", maxResults: 3, includeAnswer: true });
      return { answer: res.answer || "No answer found.", citations: res.results.map((r) => r.url) };
    },
  };
}

export function createResearchWriter(model: string): ResearchWriter {
  const requestContext = new RequestContext<{ [MODEL_KEY]: string }>();
  requestContext.set(MODEL_KEY, model);

  async function text(agentId: keyof typeof agents, prompt: string, signal?: AbortSignal) {
    const res = await mastra.getAgent(agentId).generate(prompt, { requestContext, abortSignal: signal });
    return res.text.trim();
  }

  return {
    followUpQuestion({ rootQuestion, finding, explored }, signal) {
      return text(
        "questionAgent",
        `Root question: ${rootQuestion}\n\nAlready explored:\n${explored.map((q) => `- ${q}`).join("\n")}\n\nLatest finding:\n${finding}\n\nWrite one new follow-up research question.`,
        signal,
      );
    },
    rewriteQuestion({ candidate, explored, finding }, signal) {
      return text(
        "questionRewriterAgent",
        `Duplicate candidate: ${candidate}\n\nAlready explored:\n${explored.map((q) => `- ${q}`).join("\n")}\n\nFinding for context:\n${finding}`,
        signal,
      );
    },
    statsQuery(question, signal) {
      return text("statsAgent", `Create a statistics search query for: ${question}`, signal);
    },
    imageQuery(finding, signal) {
      return text("imageQueryAgent", `Create a diagram search query for:\n${finding.slice(0, 1500)}`, signal);
    },
    async *streamReport({ rootQuestion, context, withCitations }, signal) {
      const stream = await mastra.getAgent("reportAgent").stream(
        `Write the research report answering: ${rootQuestion}\nCitations requested: ${withCitations ? "yes" : "no"}\n\n${context}`,
        { requestContext, abortSignal: signal },
      );
      const reader = stream.textStream.getReader();
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          yield value;
        }
      } finally {
        reader.releaseLock();
      }
    },
  };
}

