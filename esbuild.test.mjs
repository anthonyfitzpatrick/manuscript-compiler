import esbuild from "esbuild";

await esbuild.build({ entryPoints: ["tests/run.ts"], bundle: true, platform: "node", format: "esm", target: "node18", outfile: ".test-build/run.mjs", alias: { obsidian: "./tests/obsidian-stub.ts" }, loader: { ".svg": "text" }, logLevel: "warning" });
await import("./.test-build/run.mjs");
