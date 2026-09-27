/** @jest-environment node */
import { createNdjsonParser, encodeEvent, readNdjsonStream } from "./ndjson";

describe("ndjson", () => {
  it("encodes one JSON object per line", () => {
    expect(encodeEvent({ a: 1 })).toBe('{"a":1}\n');
  });

  it("buffers partial lines across chunks", () => {
    const p = createNdjsonParser<{ n: number }>();
    expect(p.push('{"n":1}\n{"n"')).toEqual([{ n: 1 }]);
    expect(p.push(':2}\n\n{"n":3}')).toEqual([{ n: 2 }]);
    expect(p.flush()).toEqual([{ n: 3 }]);
  });

  it("reads a byte stream split mid-character and mid-line", async () => {
    const bytes = new TextEncoder().encode(encodeEvent({ t: "héllo" }) + encodeEvent({ t: "✓" }));
    const stream = new ReadableStream<Uint8Array>({
      start(c) {
        for (let i = 0; i < bytes.length; i += 3) c.enqueue(bytes.slice(i, i + 3));
        c.close();
      },
    });
    const events: unknown[] = [];
    await readNdjsonStream(stream, (e) => events.push(e));
    expect(events).toEqual([{ t: "héllo" }, { t: "✓" }]);
  });
});
