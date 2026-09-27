"use client";

import { createTheme } from "@mui/material/styles";

export const theme = createTheme({
  cssVariables: { colorSchemeSelector: "media" },
  colorSchemes: {
    light: {
      palette: {
        primary: { main: "#4f46e5" },
        secondary: { main: "#0d9488" },
        background: { default: "#f6f7fb", paper: "#ffffff" },
      },
    },
    dark: {
      palette: {
        primary: { main: "#a5b4fc" },
        secondary: { main: "#5eead4" },
        background: { default: "#0b0d14", paper: "#131722" },
      },
    },
  },
  shape: { borderRadius: 10 },
  typography: {
    fontFamily: "var(--font-sans), system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
    h6: { fontWeight: 650 },
  },
  components: {
    MuiPaper: { defaultProps: { elevation: 0 } },
    MuiChip: { styleOverrides: { root: { fontWeight: 500 } } },
  },
});
