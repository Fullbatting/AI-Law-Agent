#!/usr/bin/env node
/**
 * Fails if any .bat/.cmd/.vbs/.ps1 file in the repo contains non-ASCII
 * bytes, a UTF-8 BOM, or a raw NUL byte.
 *
 * These files must stay pure ASCII: Korean (or any non-ASCII) text mixed
 * with chcp 65001 has broken this project's installer before — Windows
 * misread the console codepage and every following word errored out as
 * "not recognized as an internal command". Keep user-facing text in these
 * files in English; the app itself can stay Korean.
 *
 * Run manually with `npm run check:bat-ascii`; also wired into CI so a
 * future edit can't reintroduce the problem unnoticed.
 */
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const EXTENSIONS = [".bat", ".cmd", ".vbs", ".ps1"];
const IGNORE_DIRS = new Set(["node_modules", ".git", "dist", "release"]);

function walk(dir, files) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (IGNORE_DIRS.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, files);
    } else if (EXTENSIONS.includes(path.extname(entry.name).toLowerCase())) {
      files.push(fullPath);
    }
  }
  return files;
}

const files = walk(ROOT, []);
const problems = [];

for (const file of files) {
  const data = fs.readFileSync(file);
  const relPath = path.relative(ROOT, file);

  if (data[0] === 0xef && data[1] === 0xbb && data[2] === 0xbf) {
    problems.push(`${relPath}: has a UTF-8 BOM`);
    continue;
  }
  if (data.includes(0x00)) {
    problems.push(`${relPath}: contains a raw NUL byte`);
    continue;
  }
  const nonAsciiIndex = data.findIndex((byte) => byte > 0x7f);
  if (nonAsciiIndex !== -1) {
    const before = data.subarray(0, nonAsciiIndex).toString("utf8");
    const line = before.split("\n").length;
    problems.push(`${relPath}:${line}: contains a non-ASCII byte (0x${data[nonAsciiIndex].toString(16)})`);
  }
}

if (problems.length > 0) {
  console.error("Non-ASCII content found in installer scripts:");
  for (const problem of problems) console.error(`  - ${problem}`);
  console.error("\nThese files must stay pure ASCII. Translate any non-English text to English.");
  process.exit(1);
}

console.log(`OK: ${files.length} batch/PowerShell/VBScript file(s) are pure ASCII.`);
