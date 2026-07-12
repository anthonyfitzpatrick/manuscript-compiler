import esbuild from "esbuild";

await esbuild.build({ entryPoints: ["tests/docx-integration.ts"], bundle: true, platform: "node", format: "esm", target: "node18", outfile: ".test-build/docx-integration.mjs", logLevel: "warning" });
await import("./.test-build/docx-integration.mjs");
