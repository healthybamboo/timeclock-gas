import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

// クライアントは GAS の HtmlService で配信するため、JS/CSS をすべて index.html に埋め込む
export default defineConfig({
  root: "src/client",
  plugins: [react(), viteSingleFile({ removeViteModuleLoader: true })],
  build: {
    outDir: "../../dist",
    emptyOutDir: false,
    target: "es2019",
  },
});
