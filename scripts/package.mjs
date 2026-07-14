import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { unzipSync, zipSync } from "fflate";

const packageJson = JSON.parse(await readFile("package.json", "utf8")); const manifest = JSON.parse(await readFile("manifest.json", "utf8")); const versions = JSON.parse(await readFile("versions.json", "utf8"));
if (packageJson.version !== manifest.version) throw new Error(`Version mismatch: package ${packageJson.version}, manifest ${manifest.version}`);
if (versions[manifest.version] !== manifest.minAppVersion) throw new Error(`versions.json does not map ${manifest.version} to ${manifest.minAppVersion}`);
const required = ["main.js", "manifest.json", "styles.css"]; const archivePath = path.join("release", `manuscript-compiler-${manifest.version}.zip`);
if (process.argv.includes("--validate")) { const archive = await readFile(archivePath); const names = Object.keys(unzipSync(archive)); if (JSON.stringify(names.sort()) !== JSON.stringify(required.sort())) throw new Error(`Unexpected archive entries: ${names.join(", ")}`); process.stdout.write(`Validated ${archivePath}: ${names.join(", ")}\n`); process.exit(0); }
const entries = await Promise.all(required.map(async (name) => ({ name, data: await readFile(name) }))); await rm("release", { recursive: true, force: true }); await mkdir("release", { recursive: true }); await writeFile(archivePath, createZip(entries)); process.stdout.write(`Created ${archivePath} with only ${required.join(", ")}\n`);

function createZip(entries) { return zipSync(Object.fromEntries(entries.map((entry) => [entry.name, entry.data])), { level: 9 }); }
