import esbuild from "esbuild";

await esbuild.build({ entryPoints: ["tests/large-manuscript-benchmark.ts"], bundle: true, platform: "node", format: "esm", target: "node18", outfile: ".test-build/large-manuscript-benchmark.mjs", alias: { obsidian: "./tests/obsidian-stub.ts" }, logLevel: "warning" });
await import("./.test-build/large-manuscript-benchmark.mjs");
