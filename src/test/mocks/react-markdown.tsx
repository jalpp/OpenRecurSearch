/** Jest stub: react-markdown is ESM-only; render the raw markdown so tests can assert on it. */
export default function ReactMarkdown({ children }: { children?: string }) {
  return <div data-testid="markdown">{children}</div>;
}
