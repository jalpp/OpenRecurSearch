"use client";

import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import LinearProgress from "@mui/material/LinearProgress";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import BoltIcon from "@mui/icons-material/Bolt";
import type { JevDecision, JevDecisionKind } from "@/lib/recursearch/types";

const KIND_LABEL: Record<JevDecisionKind, string> = {
  "source-pick": "Source pick",
  "duplicate-check": "Duplicate check",
  "question-pick": "Question pick",
  coverage: "Coverage",
};

export function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

/** Sorted option rows for display: label text + probability, highest first. */
export function decisionRows(decision: JevDecision): { key: string; label: string; probability: number }[] {
  return Object.entries(decision.probabilities)
    .map(([key, probability]) => ({ key, label: decision.options?.[key] ?? key, probability }))
    .sort((a, b) => b.probability - a.probability);
}

export function JevDecisionCard({ decision }: { decision: JevDecision }) {
  const rows = decisionRows(decision);
  const top = rows[0]?.key;

  return (
    <Paper
      variant="outlined"
      data-testid="jev-decision"
      sx={{ p: 1.25, borderColor: "secondary.main", borderLeftWidth: 3, bgcolor: "background.paper" }}
    >
      <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 0.75, flexWrap: "wrap", rowGap: 0.5 }}>
        <Chip size="small" color="secondary" icon={<BoltIcon />} label={`Jev · ${KIND_LABEL[decision.kind]}`} />
        {typeof decision.score === "number" && (
          <Chip size="small" variant="outlined" label={`score ${decision.score.toFixed(2)} / ${decision.scoreMax}`} />
        )}
        <Box sx={{ flex: 1 }} />
        <Typography variant="caption" color="text.secondary">
          {decision.latencyMs} ms
        </Typography>
      </Stack>

      <Tooltip title={decision.prompt} placement="top-start">
        <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.75, wordBreak: "break-word" }}>
          {decision.verdict}
        </Typography>
      </Tooltip>

      <Stack spacing={0.5}>
        {rows.map((row) => (
          <Box key={row.key}>
            <Stack direction="row" spacing={1} sx={{ justifyContent: "space-between" }}>
              <Typography
                variant="caption"
                color={row.key === top ? "text.primary" : "text.secondary"}
                sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}
                title={row.label}
              >
                {row.label}
              </Typography>
              <Typography variant="caption" sx={{ fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>
                {pct(row.probability)}
              </Typography>
            </Stack>
            <LinearProgress
              variant="determinate"
              value={row.probability * 100}
              color={row.key === top ? "secondary" : "inherit"}
              sx={{ height: 5, borderRadius: 3, opacity: row.key === top ? 1 : 0.45 }}
              aria-label={`${row.label} probability`}
            />
          </Box>
        ))}
      </Stack>
    </Paper>
  );
}
