#!/usr/bin/env node
// リリーススクリプト: main を production へ昇格し、本番（GitHub Pages）を更新する。
//
// 使い方: main ブランチ上で、作業ツリーがクリーンな状態で `npm run release` を実行する。
// main へマージしただけでは本番は変わらない。リリースはこのスクリプトによる
// 明示的な昇格操作でのみ行われる。
//
// 旧来の bash 版（release.sh）を Node に移植したもの。bash の無い環境
// （Windows の PowerShell 等）でも `npm run release` だけで実行できる。
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(repoRoot);

const MANIFEST = "assets/generated/sw-manifest.js";

function fail(message) {
  console.error(`release: エラー: ${message}`);
  process.exit(1);
}

function git(args, { capture = false } = {}) {
  if (capture) {
    return execFileSync("git", args, { encoding: "utf8" }).trim();
  }
  execFileSync("git", args, { stdio: "inherit" });
  return "";
}

function gitSucceeds(args) {
  return spawnSync("git", args, { stdio: "ignore" }).status === 0;
}

// --- ガード -------------------------------------------------------------
const branch = git(["branch", "--show-current"], { capture: true });
if (branch !== "main") {
  fail(`main ブランチで実行してください（現在のブランチ: ${branch || "(detached HEAD)"}）`);
}

if (git(["status", "--porcelain"], { capture: true }) !== "") {
  fail("作業ツリーに未コミットの変更があります。コミットするか退避してから実行してください");
}

git(["fetch", "origin"]);

if (git(["rev-parse", "main"], { capture: true }) !== git(["rev-parse", "origin/main"], { capture: true })) {
  fail("ローカル main が origin/main と一致しません。pull / push してから実行してください");
}

// --- Service Worker 用 manifest の再生成 --------------------------------
// `npm run sw:generate`（node scripts/generate-sw-manifest.js）と等価
execFileSync(process.execPath, ["scripts/generate-sw-manifest.js"], { stdio: "inherit" });

if (git(["status", "--porcelain", "--", MANIFEST], { capture: true }) !== "") {
  git(["add", MANIFEST]);
  git([
    "commit",
    "-m", "sw-manifest.js を再生成 (release)",
    "-m", "Co-authored-by: Muse <noreply@muse.ai>",
  ]);
  git(["push", "origin", "main"]);
  console.log("release: sw-manifest.js を再生成し、main にコミット・push しました");
}

// --- テスト ---------------------------------------------------------------
const testResult = spawnSync("npm test", { shell: true, stdio: "inherit" });
if (testResult.status !== 0) {
  fail("テストが失敗しました。production への昇格は行いません");
}

// --- production へ昇格 ----------------------------------------------------
git(["fetch", "origin"]);

let oldProduction = "";
if (gitSucceeds(["rev-parse", "--verify", "--quiet", "origin/production"])) {
  oldProduction = git(["rev-parse", "origin/production"], { capture: true });
  if (!gitSucceeds(["merge-base", "--is-ancestor", "origin/production", "origin/main"])) {
    fail("origin/production が origin/main の祖先ではありません（分岐しています）。手動で解消してください");
  }
}

// push の対象（ローカル main）が祖先チェックの対象（origin/main）と一致していることを
// 直前の fetch で再確認する（fetch〜push の間に origin/main が進んだ場合に備える）
git(["fetch", "origin"]);

if (git(["rev-parse", "main"], { capture: true }) !== git(["rev-parse", "origin/main"], { capture: true })) {
  fail("ローカル main が origin/main と一致しません（直前の確認後に origin/main が更新された可能性があります）。pull / push してから再実行してください");
}

git(["push", "origin", "main:production"]);

// --- 完了サマリ -------------------------------------------------------------
const newProduction = git(["rev-parse", "main"], { capture: true });
let revision = "";
try {
  const match = readFileSync(MANIFEST, "utf8").match(/"revision": "([^"]*)"/);
  if (match) revision = match[1];
} catch {
  // revision が取得できなくてもリリース自体は完了しているため、空のまま表示する
}

console.log("");
console.log("release: 完了しました");
console.log(`  production: ${oldProduction || "(新規作成)"} -> ${newProduction}`);
console.log(`  manifest revision: ${revision || "（取得できませんでした）"}`);
console.log("  GitHub Pages の反映には少し時間がかかります");
