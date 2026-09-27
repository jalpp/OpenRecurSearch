"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Collapse from "@mui/material/Collapse";
import Divider from "@mui/material/Divider";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import Link from "@mui/material/Link";
import Paper from "@mui/material/Paper";
import Slider from "@mui/material/Slider";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import SendIcon from "@mui/icons-material/Send";
import StopIcon from "@mui/icons-material/Stop";
import TuneIcon from "@mui/icons-material/Tune";
import SearchIcon from "@mui/icons-material/Search";
import HelpOutlineIcon from "@mui/icons-material/HelpOutlineOutlined";
import InsightsIcon from "@mui/icons-material/Insights";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";
import FlagIcon from "@mui/icons-material/Flag";
import type { ResearchRun, TimelineItem } from "@/lib/research-state";
import type { PublicConfig, StartOptions } from "@/hooks/useResearch";
import { JevDecisionCard } from "./JevDecisionCard";

interface ChatPanelProps {
  runs: ResearchRun[];
  activeRunId?: string;
  busy: boolean;
  config: PublicConfig | null;
  onSubmit: (question: string, options: StartOptions) => void;
  onStop: (id: string) => void;
  onSelect: (id: string) => void;
}

export function ChatPanel({ runs, activeRunId, busy, config, onSubmit, onStop, onSelect }: ChatPanelProps) {
  const [question, setQuestion] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [depth, setDepth] = useState<number | null>(null);
  const [withCitations, setWithCitations] = useState(true);
  const [model, setModel] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const effectiveDepth = depth ?? config?.defaultDepth ?? 3;
  const lastRun = runs[runs.length - 1];
  const timelineLength = lastRun?.timeline.length ?? 0;

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [runs.length, timelineLength, lastRun?.status]);

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    const q = question.trim();
    if (q.length < 3 || busy) return;
    onSubmit(q, { depth: effectiveDepth, withCitations, model: model.trim() || undefined });
    setQuestion("");
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <Paper variant="outlined" sx={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <Box ref={scrollRef} sx={{ flex: 1, overflowY: "auto", p: 2 }}>
        {config && config.missing.length > 0 && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Missing environment variables: {config.missing.join(", ")}. Add them to <code>.env.local</code> and restart.
          </Alert>
        )}
        {runs.length === 0 && <Welcome onPick={setQuestion} />}
        <Stack spacing={2.5}>
          {runs.map((run) => (
            <Stack key={run.id} spacing={1.25}>
              <UserBubble text={run.question} />
              <RunCard run={run} active={run.id === activeRunId} onSelect={() => onSelect(run.id)} onStop={() => onStop(run.id)} />
            </Stack>
          ))}
        </Stack>
      </Box>

      <Divider />
      <Box component="form" onSubmit={submit} sx={{ p: 1.5 }}>
        <Collapse in={showSettings}>
          <Stack spacing={1.5} sx={{ px: 1, pb: 1.5 }}>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Recursion depth: {effectiveDepth} (Jev may stop earlier)
              </Typography>
              <Slider
                size="small"
                min={1}
                max={config?.maxDepth ?? 6}
                step={1}
                marks
                value={effectiveDepth}
                onChange={(_, v) => setDepth(v as number)}
                aria-label="Recursion depth"
              />
            </Box>
            <FormControlLabel
              control={<Switch size="small" checked={withCitations} onChange={(e) => setWithCitations(e.target.checked)} />}
              label={<Typography variant="body2">Include citations</Typography>}
            />
            {config?.allowModelOverride && (
              <TextField
                size="small"
                label="OpenRouter model override"
                placeholder={config.model}
                value={model}
                onChange={(e) => setModel(e.target.value)}
                helperText={`Default from OPENROUTER_MODEL: ${config.model}`}
              />
            )}
          </Stack>
        </Collapse>
        <Stack direction="row" spacing={1} sx={{ alignItems: "flex-end" }}>
          <Tooltip title="Research settings">
            <IconButton onClick={() => setShowSettings((s) => !s)} color={showSettings ? "primary" : "default"} aria-label="Research settings">
              <TuneIcon />
            </IconButton>
          </Tooltip>
          <TextField
            fullWidth
            multiline
            maxRows={5}
            size="small"
            placeholder="Ask a research question…"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={onKeyDown}
            disabled={busy}
            slotProps={{ htmlInput: { "aria-label": "Research question" } }}
          />
          <Button
            type="submit"
            variant="contained"
            disabled={busy || question.trim().length < 3}
            endIcon={<SendIcon />}
            aria-label="Research"
            sx={{ flexShrink: 0, height: 40, minWidth: 0, px: { xs: 1.5, sm: 2 }, "& .MuiButton-endIcon": { ml: { xs: 0, sm: 1 } } }}
          >
            <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>
              Research
            </Box>
          </Button>
        </Stack>
      </Box>
    </Paper>
  );
}

const EXAMPLES = [
  "How does chronic stress affect immune system function?",
  "What is the impact of AI-generated content on journalism credibility?",
  "How do large language models work?",
];

function Welcome({ onPick }: { onPick: (q: string) => void }) {
  return (
    <Stack spacing={1.5} sx={{ py: 4, px: 1 }}>
      <Typography variant="h6">Recursive research, steered by Jev</Typography>
      <Typography variant="body2" color="text.secondary">
        Each layer searches the web, then Jev picks the most credible source, rejects duplicate follow-ups, chooses the next
        question and decides when coverage is enough. OpenRouter agents write the questions and the final report.
      </Typography>
      <Stack spacing={1} sx={{ pt: 1 }}>
        {EXAMPLES.map((q) => (
          <Chip key={q} label={q} variant="outlined" onClick={() => onPick(q)} sx={{ justifyContent: "flex-start", height: "auto", py: 0.75, "& .MuiChip-label": { whiteSpace: "normal" } }} />
        ))}
      </Stack>
    </Stack>
  );
}

function UserBubble({ text }: { text: string }) {
  return (
    <Box sx={{ alignSelf: "flex-end", maxWidth: "85%", bgcolor: "primary.main", color: "primary.contrastText", px: 1.75, py: 1, borderRadius: 2.5, borderBottomRightRadius: 4 }}>
      <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
        {text}
      </Typography>
    </Box>
  );
}

const STATUS_LABEL: Record<ResearchRun["status"], string> = {
  running: "Researching",
  writing: "Writing report",
  done: "Complete",
  error: "Failed",
  stopped: "Stopped",
};

function RunCard({ run, active, onSelect, onStop }: { run: ResearchRun; active: boolean; onSelect: () => void; onStop: () => void }) {
  const live = run.status === "running" || run.status === "writing";
  const seconds = run.finishedAt ? Math.round((run.finishedAt - run.startedAt) / 1000) : undefined;

  return (
    <Paper variant="outlined" sx={{ p: 1.5, minWidth: 0, overflowWrap: "anywhere", borderColor: active ? "primary.main" : "divider", bgcolor: "action.hover" }} data-testid="run-card">
      <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 0.75, mb: 1 }}>
        {live && <CircularProgress size={14} />}
        <Chip size="small" color={run.status === "error" ? "error" : run.status === "done" ? "success" : "default"} label={STATUS_LABEL[run.status]} />
        <Chip size="small" variant="outlined" label={`Layer ${Math.min(run.layersDone, run.depth)}/${run.depth}`} />
        <Chip size="small" variant="outlined" color="secondary" label={`${run.jevDecisions} Jev decisions`} />
        {seconds !== undefined && <Typography variant="caption" color="text.secondary">{seconds}s</Typography>}
        <Box sx={{ flex: 1 }} />
        {live ? (
          <Button size="small" color="error" startIcon={<StopIcon />} onClick={onStop}>
            Stop
          </Button>
        ) : (
          !active && run.report && (
            <Button size="small" onClick={onSelect}>
              View report
            </Button>
          )
        )}
      </Stack>
      {run.model && (
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
          {run.model} · Jev {run.jevModel}
        </Typography>
      )}
      <Stack spacing={1}>
        {run.timeline.map((item, i) => (
          <TimelineRow key={i} item={item} />
        ))}
      </Stack>
      {run.error && (
        <Alert severity="error" sx={{ mt: 1 }}>
          {run.error}
        </Alert>
      )}
    </Paper>
  );
}

function Row({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: "flex-start" }}>
      <Box sx={{ color: "text.secondary", pt: 0.25, display: "flex" }}>{icon}</Box>
      <Box sx={{ minWidth: 0, flex: 1 }}>{children}</Box>
    </Stack>
  );
}

function TimelineRow({ item }: { item: TimelineItem }) {
  switch (item.kind) {
    case "layer":
      return (
        <Box sx={{ pt: item.depth === 0 ? 0 : 1 }}>
          <Typography variant="overline" color="primary" sx={{ lineHeight: 1.5 }}>
            Layer {item.depth + 1}
          </Typography>
          <Row icon={<SearchIcon fontSize="small" />}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {item.query}
            </Typography>
          </Row>
        </Box>
      );
    case "finding":
      return (
        <Row icon={<InsightsIcon fontSize="small" />}>
          <Typography variant="body2" color="text.secondary" sx={{ display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            {item.answer}
          </Typography>
          {item.source && (
            <Link href={item.source.url} target="_blank" rel="noopener noreferrer" variant="caption" sx={{ wordBreak: "break-all" }}>
              {item.source.title || item.source.url}
            </Link>
          )}
        </Row>
      );
    case "candidate":
      return (
        <Row icon={<HelpOutlineIcon fontSize="small" />}>
          <Typography variant="body2">
            {item.rewritten && <Chip size="small" label="rewritten" sx={{ mr: 0.75, height: 18 }} />}
            {item.question}
          </Typography>
        </Row>
      );
    case "jev":
      return <JevDecisionCard decision={item.decision} />;
    case "stats":
      return (
        <Row icon={<InsightsIcon fontSize="small" color="primary" />}>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
            Stats: {item.query}
          </Typography>
          <Typography variant="body2" sx={{ display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            {item.answer}
          </Typography>
        </Row>
      );
    case "image":
      return (
        <Row icon={<ImageOutlinedIcon fontSize="small" />}>
          <Typography variant="caption" color="text.secondary">
            Image: {item.description}
          </Typography>
        </Row>
      );
    case "early-stop":
      return (
        <Alert severity="info" icon={<FlagIcon fontSize="small" />} sx={{ py: 0 }}>
          {item.reason}
        </Alert>
      );
  }
}
