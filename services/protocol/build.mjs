import * as esbuild from "esbuild";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const outdir = path.join(root, "dist/protocol");

mkdirSync(outdir, { recursive: true });

await esbuild.build({
  entryPoints: [path.join(root, "services/protocol/handler.ts")],
  bundle: true,
  platform: "node",
  target: "node20",
  format: "cjs",
  outfile: path.join(outdir, "index.js"),
  sourcemap: true,
  alias: {
    "@": path.join(root, "src"),
  },
  // Keep AWS SDK out of the zip — Lambda Node 20 has it? Actually no for v3.
  // Bundle SDK for reliability.
  external: [],
  logLevel: "info",
});

console.log(`Built ${path.join(outdir, "index.js")}`);
