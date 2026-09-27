"use client";

import { useState } from "react";
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import TravelExploreIcon from "@mui/icons-material/TravelExplore";
import { useResearch } from "@/hooks/useResearch";
import { ChatPanel } from "./ChatPanel";
import { ReportPanel } from "./ReportPanel";

export function ResearchApp() {
  const { state, config, busy, start, stop, select } = useResearch();
  const [view, setView] = useState<"chat" | "report">("chat");
  const activeRun = state.runs.find((r) => r.id === state.activeRunId);

  const chat = (
    <ChatPanel
      runs={state.runs}
      activeRunId={state.activeRunId}
      busy={busy}
      config={config}
      onSubmit={(q, o) => void start(q, o)}
      onStop={stop}
      onSelect={(id) => {
        select(id);
        setView("report");
      }}
    />
  );
  const report = <ReportPanel run={activeRun} />;

  return (
    <Box sx={{ height: "100dvh", display: "flex", flexDirection: "column", bgcolor: "background.default" }}>
      <AppBar position="static" color="transparent" elevation={0} sx={{ borderBottom: 1, borderColor: "divider" }}>
        <Toolbar variant="dense" sx={{ gap: 1.5 }}>
          <TravelExploreIcon color="primary" />
          <Typography variant="h6" sx={{ fontSize: 17 }}>
            OpenRecurSearch
          </Typography>
          <Box sx={{ flex: 1 }} />
          {config && (
            <Stack direction="row" spacing={1} sx={{ display: { xs: "none", sm: "flex" } }}>
              <Chip size="small" variant="outlined" label={`Agent: ${config.model}`} />
              <Chip size="small" variant="outlined" color="secondary" label={`Jev: ${config.jevModel}`} />
            </Stack>
          )}
        </Toolbar>
      </AppBar>

      <Box sx={{ display: { xs: "block", md: "none" }, px: 2, pt: 1.5 }}>
        <ToggleButtonGroup exclusive fullWidth size="small" value={view} onChange={(_, v) => v && setView(v)}>
          <ToggleButton value="chat">Chat</ToggleButton>
          <ToggleButton value="report">Report{activeRun?.status === "writing" ? " •" : ""}</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          display: "grid",
          gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "minmax(360px, 5fr) minmax(0, 7fr)" },
          gap: 2,
          p: 2,
        }}
      >
        <Box sx={{ minHeight: 0, minWidth: 0, display: { xs: view === "chat" ? "block" : "none", md: "block" } }}>{chat}</Box>
        <Box sx={{ minHeight: 0, minWidth: 0, display: { xs: view === "report" ? "block" : "none", md: "block" } }}>{report}</Box>
      </Box>
    </Box>
  );
}
