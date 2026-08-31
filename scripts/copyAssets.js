#!/usr/bin/env node
/**
 * dist/renderer에 정적 자산(index.html, styles.css)을 복사한다.
 *
 * package.json의 build:assets 스크립트에서 예전에는
 * `mkdir -p dist/renderer && cp ... dist/renderer/` 같은 유닉스 셸 문법을
 * 그대로 썼는데, Windows에서 `npm run`은 기본적으로 cmd.exe로 실행되고
 * cmd.exe는 `mkdir -p`도 `cp`도 모른다("The syntax of the command is
 * incorrect."로 실패). 셸에 의존하지 않도록 순수 Node.js로 다시 작성했다 —
 * Windows/macOS/Linux 어디서 `npm run build`를 돌려도 동일하게 동작한다.
 */
const fs = require("node:fs");
const path = require("node:path");

const rendererSrcDir = path.join(__dirname, "..", "apps", "desktop", "renderer");
const rendererDistDir = path.join(__dirname, "..", "dist", "renderer");

const filesToCopy = ["index.html", "styles.css"];

fs.mkdirSync(rendererDistDir, { recursive: true });

for (const file of filesToCopy) {
  const src = path.join(rendererSrcDir, file);
  const dest = path.join(rendererDistDir, file);
  fs.copyFileSync(src, dest);
  console.log(`copied ${path.relative(process.cwd(), src)} -> ${path.relative(process.cwd(), dest)}`);
}
