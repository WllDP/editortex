import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { latexPreviewDevServer } from "./src/infrastructure/latex-compiler/latexPreviewServer";

export default defineConfig({
  plugins: [react(), latexPreviewDevServer()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/react") || id.includes("node_modules/react-dom")) {
            return "react";
          }
          if (id.includes("node_modules/pdfjs-dist")) {
            return "pdfjs";
          }
          if (id.includes("node_modules/monaco-editor") || id.includes("node_modules/@monaco-editor")) {
            return "monaco";
          }
          if (
            id.includes("node_modules/@dnd-kit") ||
            id.includes("node_modules/framer-motion") ||
            id.includes("node_modules/lucide-react") ||
            id.includes("node_modules/@radix-ui")
          ) {
            return "ui";
          }
          if (id.includes("node_modules/jszip")) {
            return "zip";
          }
        },
      },
    },
  },
  envPrefix: ["VITE_", "TAURI_"],
});
