"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { readNdjsonStream } from "@/lib/ndjson";
import type { ResearchEvent } from "@/lib/recursearch/types";
import { initialResearchState, isBusy, researchReducer } from "@/lib/research-state";

export interface PublicConfig {
  model: string;
  jevModel: string;
  jevProvider: string;
  defaultDepth: number;
  maxDepth: number;
  allowModelOverride: boolean;
  missing: string[];
}

export interface StartOptions {
  depth: number;
  withCitations: boolean;
  model?: string;
}

export function useResearch() {
  const [state, dispatch] = useReducer(researchReducer, initialResearchState);
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const controllers = useRef(new Map<string, AbortController>());

  useEffect(() => {
    let cancelled = false;
    fetch("/api/config")
      .then((r) => r.json())
      .then((c: PublicConfig) => !cancelled && setConfig(c))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const map = controllers.current;
    return () => map.forEach((c) => c.abort());
  }, []);

  const start = useCallback(async (question: string, options: StartOptions) => {
    const id = crypto.randomUUID();
    const controller = new AbortController();
    controllers.current.set(id, controller);
    dispatch({ type: "start", id, question, depth: options.depth, at: Date.now() });

    try {
      const res = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, ...options, model: options.model || undefined }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }
      let finished = false;
      await readNdjsonStream<ResearchEvent>(res.body, (event) => {
        if (event.type === "done" || event.type === "error") finished = true;
        dispatch({ type: "event", id, event, at: Date.now() });
      });
      if (!finished) dispatch({ type: "fail", id, message: "The research stream ended unexpectedly.", at: Date.now() });
    } catch (error) {
      if (controller.signal.aborted) {
        dispatch({ type: "stop", id, at: Date.now() });
      } else {
        dispatch({ type: "fail", id, message: error instanceof Error ? error.message : "Research failed", at: Date.now() });
      }
    } finally {
      controllers.current.delete(id);
    }
  }, []);

  const stop = useCallback((id: string) => controllers.current.get(id)?.abort(), []);
  const select = useCallback((id: string) => dispatch({ type: "select", id }), []);

  return { state, config, busy: isBusy(state), start, stop, select };
}
