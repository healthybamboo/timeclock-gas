// GAS サーバーコードのビルド
// esbuild で src/server/index.ts を 1 ファイル (dist/Code.js) にバンドルし、
// index.ts が export する関数をトップレベルの function 宣言として再公開する。
// (GAS は google.script.run / トリガーからトップレベル関数しか呼べないため)
import { build } from "esbuild";
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from "node:fs";

const ENTRY = "src/server/index.ts";
const OUT = "dist/Code.js";
mkdirSync("dist", { recursive: true });

const result = await build({
  entryPoints: [ENTRY],
  bundle: true,
  format: "iife",
  globalName: "__server",
  target: "es2020",
  platform: "neutral",
  write: false,
  logLevel: "info",
});

const source = readFileSync(ENTRY, "utf8");
const exported = [...source.matchAll(/^export\s+function\s+([A-Za-z0-9_]+)/gm)].map((m) => m[1]);

const stubs = exported
  .map((name) => `function ${name}() { return __server.${name}.apply(null, arguments); }`)
  .join("\n");

writeFileSync(OUT, `${result.outputFiles[0].text}\n${stubs}\n`);
copyFileSync("src/server/appsscript.json", "dist/appsscript.json");
console.log(`server: ${OUT} (exposed: ${exported.join(", ")})`);
