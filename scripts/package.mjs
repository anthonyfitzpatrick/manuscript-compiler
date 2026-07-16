import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { unzipSync, zipSync } from "fflate";

const required = ["main.js", "manifest.json", "styles.css"];
const allowedManifestKeys = new Set(["id", "name", "version", "minAppVersion", "description", "author", "authorUrl", "fundingUrl", "isDesktopOnly"]);
const semverPattern = /^\d+\.\d+\.\d+$/;
const packageJson = await jsonFile("package.json");
const manifest = await jsonFile("manifest.json");
const versions = await jsonFile("versions.json");
const archivePath = path.join("release", `manuscript-compiler-${manifest.version}.zip`);

validateManifest();
validateVersions();
await validateAssets();

if (process.argv.includes("--validate")) {
  const archive = await readFile(archivePath);
  const names = Object.keys(unzipSync(archive)).sort();
  assert(JSON.stringify(names) === JSON.stringify([...required].sort()), `Unexpected archive entries: ${names.join(", ")}`);
  process.stdout.write(`Validated ${archivePath}: ${names.join(", ")}\n`);
  process.stdout.write(`GitHub release assets ready: ${required.join(", ")} (tag ${manifest.version}, without a v prefix)\n`);
  process.exit(0);
}

const entries = await Promise.all(required.map(async (name) => ({ name, data: await readFile(name) })));
await rm("release", { recursive: true, force: true });
await mkdir("release", { recursive: true });
await writeFile(archivePath, zipSync(Object.fromEntries(entries.map((entry) => [entry.name, entry.data])), { level: 9 }));
process.stdout.write(`Created ${archivePath} with only ${required.join(", ")}\n`);
process.stdout.write(`GitHub release assets ready: ${required.join(", ")} (tag ${manifest.version}, without a v prefix)\n`);

async function validateAssets() {
  for (const name of required) {
    const info = await stat(name);
    assert(info.isFile() && info.size > 0, `Required release asset is missing or empty: ${name}`);
  }
  const bundle = await readFile("main.js", "utf8");
  const releaseText = `${bundle}\n${await readFile("manifest.json", "utf8")}\n${await readFile("styles.css", "utf8")}`;
  assert(!/sourceMappingURL|\.map(?:\s|$)/i.test(bundle), "Production bundle contains a source map reference.");
  assert(!/require\(["'](?:electron|(?:node:)?(?:fs|path|os|child_process))["']\)/.test(bundle), "Production bundle contains a prohibited desktop or Node import.");
  assert(!/\b(?:fetch|requestUrl|XMLHttpRequest|WebSocket|sendBeacon)\s*\(/.test(bundle), "Production bundle contains a prohibited network API.");
  assert(!/\b(?:eval|Function)\s*\(/.test(bundle), "Production bundle contains dynamic code execution.");
  assert(!/https?:\/\/(?:localhost|127\.0\.0\.1|192\.168\.|10\.|172\.(?:1[6-9]|2\d|3[01])\.)/i.test(releaseText), "Release assets contain a local or private-network URL.");
  assert(!releaseText.includes(process.cwd()), "Release assets contain the local build path.");
  assert(bundle.includes("fflate 0.8.3 — MIT License") && bundle.includes("Copyright (c) 2026 Arjun Barrett"), "Production bundle is missing the bundled fflate licence notice.");
}

function validateManifest() {
  assert(packageJson.version === manifest.version, `Version mismatch: package ${packageJson.version}, manifest ${manifest.version}`);
  assert(Object.keys(manifest).every((key) => allowedManifestKeys.has(key)), "manifest.json contains unsupported fields.");
  assert(typeof manifest.id === "string" && /^[a-z]+(?:-[a-z]+)*$/.test(manifest.id) && !manifest.id.includes("obsidian") && !manifest.id.endsWith("plugin"), "Manifest ID is invalid.");
  assert(path.basename(process.cwd()) === manifest.id, `Plugin folder must match manifest ID ${manifest.id}.`);
  assert(typeof manifest.name === "string" && /^[\x20-\x7E]+$/.test(manifest.name) && !/obsidian|plugin/i.test(manifest.name), "Manifest name is invalid.");
  assert(semverPattern.test(manifest.version) && semverPattern.test(manifest.minAppVersion), "Manifest versions must use x.y.z semantic versions.");
  assert(typeof manifest.description === "string" && manifest.description.trim().length > 0, "Manifest description is required.");
  assert(typeof manifest.author === "string" && manifest.author.trim().length > 0, "Manifest author is required.");
  if (manifest.authorUrl !== undefined) assert(/^https:\/\//.test(manifest.authorUrl), "Manifest authorUrl must use HTTPS.");
  if (manifest.fundingUrl !== undefined) assert(typeof manifest.fundingUrl === "string" && /^https:\/\//.test(manifest.fundingUrl), "Manifest fundingUrl must use HTTPS.");
  assert(typeof manifest.isDesktopOnly === "boolean", "Manifest isDesktopOnly must be a boolean.");
}

function validateVersions() {
  const entries = Object.entries(versions);
  assert(entries.length > 0, "versions.json must contain at least one minimum-version boundary.");
  for (const [pluginVersion, appVersion] of entries) assert(semverPattern.test(pluginVersion) && typeof appVersion === "string" && semverPattern.test(appVersion), "versions.json contains an invalid version.");
  assert(versions[manifest.version] === manifest.minAppVersion, `versions.json must map ${manifest.version} to minAppVersion ${manifest.minAppVersion}.`);
}

async function jsonFile(filename) { return JSON.parse(await readFile(filename, "utf8")); }
function assert(condition, message) { if (!condition) throw new Error(message); }
