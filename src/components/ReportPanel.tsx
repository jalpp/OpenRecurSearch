"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import LinearProgress from "@mui/material/LinearProgress";
import Link from "@mui/material/Link";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DownloadIcon from "@mui/icons-material/Download";
import CheckIcon from "@mui/icons-material/Check";
import ArticleOutlinedIcon from "@mui/icons-material/ArticleOutlined";
import type { ResearchRun } from "@/lib/research-state";

export function reportFilename(question: string): string {
  const slug = question
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${slug || "report"}.md`;
}

export function ReportPanel({ run }: { run?: ResearchRun }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const writing = run?.status === "writing";

  useEffect(() => {
    if (writing && scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [run?.report, writing]);

  const copy = async () => {
    if (!run?.report) return;
    await navigator.clipboard.writeText(run.report);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const download = () => {
    if (!run?.report) return;
    const url = URL.createObjectURL(new Blob([run.report], { type: "text/markdown" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = reportFilename(run.question);
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Paper variant="outlined" sx={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <Stack direction="row" spacing={1} sx={{ px: 2, py: 1.25, alignItems: "center" }}>
        <ArticleOutlinedIcon fontSize="small" color="primary" />
        <Typography variant="subtitle1" sx={{ fontWeight: 650, flex: 1, minWidth: 0 }} noWrap>
          {run ? run.question : "Report"}
        </Typography>
        <Tooltip title={copied ? "Copied" : "Copy markdown"}>
          <span>
            <IconButton size="small" onClick={copy} disabled={!run?.report} aria-label="Copy markdown">
              {copied ? <CheckIcon fontSize="small" /> : <ContentCopyIcon fontSize="small" />}
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Download .md">
          <span>
            <IconButton size="small" onClick={download} disabled={!run?.report || writing} aria-label="Download markdown">
              <DownloadIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      </Stack>
      {writing ? <LinearProgress color="primary" sx={{ height: 2 }} /> : <Divider />}

      <Box ref={scrollRef} sx={{ flex: 1, overflowY: "auto", px: { xs: 2, md: 4 }, py: 3 }}>
        {!run && <EmptyState text="Ask a research question. The report will stream in here while Jev steers the search." />}
        {run && !run.report && run.status !== "error" && (
          <EmptyState
            text={
              run.status === "stopped"
                ? "Research was stopped before the report was written."
                : `Researching layer ${Math.min(run.layersDone + 1, run.depth)} of ${run.depth}… the report is written once the recursion finishes.`
            }
          />
        )}
        {run?.status === "error" && !run.report && <EmptyState text={run.error ?? "Research failed."} />}
        {run?.report && (
          <Box className="report-markdown" sx={markdownSx} data-testid="report-markdown">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                a: ({ href, children }) => (
                  <Link href={href} target="_blank" rel="noopener noreferrer">
                    {children}
                  </Link>
                ),
                // eslint-disable-next-line @next/next/no-img-element
                img: ({ src, alt }) => <img src={typeof src === "string" ? src : undefined} alt={alt ?? ""} loading="lazy" />,
              }}
            >
              {run.report}
            </ReactMarkdown>
          </Box>
        )}
      </Box>
    </Paper>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <Stack sx={{ height: "100%", alignItems: "center", justifyContent: "center", textAlign: "center", color: "text.secondary", px: 4 }}>
      <ArticleOutlinedIcon sx={{ fontSize: 48, opacity: 0.35, mb: 1 }} />
      <Typography variant="body2" sx={{ maxWidth: 380 }}>
        {text}
      </Typography>
    </Stack>
  );
}

const markdownSx = {
  maxWidth: 820,
  mx: "auto",
  lineHeight: 1.7,
  fontSize: 15.5,
  "& h1": { fontSize: 28, lineHeight: 1.25, mt: 0, mb: 2 },
  "& h2": { fontSize: 21, mt: 4, mb: 1.5, pb: 0.5, borderBottom: 1, borderColor: "divider" },
  "& h3": { fontSize: 17, mt: 3, mb: 1 },
  "& p": { my: 1.5 },
  "& img": { maxWidth: "100%", borderRadius: 1.5, display: "block", mx: "auto", my: 2 },
  "& em": { color: "text.secondary" },
  "& code": { fontFamily: "var(--font-mono), monospace", fontSize: "0.9em", px: 0.5, borderRadius: 0.5, bgcolor: "action.hover" },
  "& pre": { p: 2, overflowX: "auto", borderRadius: 1.5, bgcolor: "action.hover" },
  "& pre code": { p: 0, bgcolor: "transparent" },
  "& blockquote": { m: 0, pl: 2, borderLeft: 3, borderColor: "primary.main", color: "text.secondary" },
  "& table": { borderCollapse: "collapse", width: "100%", my: 2, display: "block", overflowX: "auto" },
  "& th, & td": { border: 1, borderColor: "divider", px: 1.25, py: 0.75, textAlign: "left" },
  "& ul, & ol": { pl: 3 },
  "& li": { my: 0.5 },
} as const;
