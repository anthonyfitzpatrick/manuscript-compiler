import esbuild from "esbuild";

await esbuild.build({ entryPoints: ["tests/safe-binary-writer.ts"], bundle: true, platform: "node", format: "esm", target: "node18", outfile: ".test-build/safe-binary-writer.mjs", alias: { obsidian: "./tests/obsidian-stub.ts" }, logLevel: "warning" });
await import("./.test-build/safe-binary-writer.mjs");
