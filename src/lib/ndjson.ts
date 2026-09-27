/**
 * Newline-delimited JSON helpers used to stream research events from the
 * route handler to the browser.
 */

export function encodeEvent(event: unknown): string {
  return `${JSON.stringify(event)}\n`;
}

/**
 * Incremental NDJSON parser: feed it arbitrary chunks and it yields every
 * complete line. Partial lines are buffered until the next chunk.
 */
export function createNdjsonParser<T = unknown>() {
  let buffer = "";
  return {
    push(chunk: string): T[] {
      buffer += chunk;
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      return lines.filter((l) => l.trim()).map((l) => JSON.parse(l) as T);
    },
    flush(): T[] {
      const rest = buffer.trim();
      buffer = "";
      return rest ? [JSON.parse(rest) as T] : [];
    },
  };
}

/** Read an NDJSON response body, invoking `onEvent` for each parsed object. */
export async function readNdjsonStream<T>(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: T) => void,
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const parser = createNdjsonParser<T>();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      parser.push(decoder.decode(value, { stream: true })).forEach(onEvent);
    }
    parser.push(decoder.decode()).forEach(onEvent);
    parser.flush().forEach(onEvent);
  } finally {
    reader.releaseLock();
  }
}
