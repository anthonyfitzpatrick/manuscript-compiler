import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { inflateRawSync } from "node:zlib";

const detected = spawnSync("pandoc", ["--version"], { encoding: "utf8", shell: false });
if (detected.error?.code === "ENOENT") { process.stdout.write("Pandoc unavailable; DOCX integration test skipped.\n"); process.exit(0); }
assert.equal(detected.status, 0, detected.stderr);
const temporary = await mkdtemp(path.join(os.tmpdir(), "manuscript-compiler-docx-test-"));
try {
  const input = path.resolve("tests/golden/complete-sample.md"); const output = path.join(temporary, "manuscript.docx"); const converted = spawnSync("pandoc", [input, "--from=markdown", "--to=docx", "--output", output], { encoding: "utf8", shell: false }); assert.equal(converted.status, 0, converted.stderr);
  const archive = await readFile(output); const entries = readZipEntries(archive); assert.ok(entries.has("[Content_Types].xml")); assert.ok(entries.has("_rels/.rels")); assert.ok(entries.has("word/document.xml")); const documentXml = entries.get("word/document.xml")?.toString("utf8") ?? ""; assert.match(documentXml, /Part 1: The Signal/); assert.match(documentXml, /Chapter 1: Arrival/); assert.doesNotMatch(documentXml, /Editing Status|^---$/m); process.stdout.write(`DOCX integration passed with ${detected.stdout.split(/\r?\n/)[0]}.\n`);
} finally { await rm(temporary, { recursive: true, force: true }); }

function readZipEntries(buffer) { const entries = new Map(); for (let offset = 0; offset <= buffer.length - 46; offset += 1) { if (buffer.readUInt32LE(offset) !== 0x02014b50) continue; const method = buffer.readUInt16LE(offset + 10); const compressedSize = buffer.readUInt32LE(offset + 20); const nameLength = buffer.readUInt16LE(offset + 28); const extraLength = buffer.readUInt16LE(offset + 30); const commentLength = buffer.readUInt16LE(offset + 32); const localOffset = buffer.readUInt32LE(offset + 42); const name = buffer.subarray(offset + 46, offset + 46 + nameLength).toString("utf8"); const localNameLength = buffer.readUInt16LE(localOffset + 26); const localExtraLength = buffer.readUInt16LE(localOffset + 28); const dataStart = localOffset + 30 + localNameLength + localExtraLength; const compressed = buffer.subarray(dataStart, dataStart + compressedSize); entries.set(name, method === 8 ? inflateRawSync(compressed) : Buffer.from(compressed)); offset += 45 + nameLength + extraLength + commentLength; } return entries; }
