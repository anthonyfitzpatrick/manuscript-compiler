import esbuild from "esbuild";

await esbuild.build({ entryPoints: ["tests/exports.ts"], bundle: true, platform: "node", format: "esm", target: "node18", outfile: ".test-build/exports.mjs", alias: { obsidian: "./tests/obsidian-stub.ts" }, logLevel: "warning" });
await import("./.test-build/exports.mjs");
