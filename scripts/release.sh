#!/usr/bin/env bash
# リリーススクリプト: main を production へ昇格し、本番（GitHub Pages）を更新する。
#
# 使い方: main ブランチ上で、作業ツリーがクリーンな状態で `npm run release` を実行する。
# main へマージしただけでは本番は変わらない。リリースはこのスクリプトによる
# 明示的な昇格操作でのみ行われる。
set -euo pipefail

cd "$(dirname "$0")/.."

MANIFEST="assets/generated/sw-manifest.js"

fail() {
  echo "release: エラー: $1" >&2
  exit 1
}

# --- ガード -------------------------------------------------------------
branch="$(git branch --show-current)"
if [ "$branch" != "main" ]; then
  fail "main ブランチで実行してください（現在のブランチ: ${branch:-'(detached HEAD)'}）"
fi

if [ -n "$(git status --porcelain)" ]; then
  fail "作業ツリーに未コミットの変更があります。コミットするか退避してから実行してください"
fi

git fetch origin

if [ "$(git rev-parse main)" != "$(git rev-parse origin/main)" ]; then
  fail "ローカル main が origin/main と一致しません。pull / push してから実行してください"
fi

# --- Service Worker 用 manifest の再生成 --------------------------------
npm run sw:generate

if [ -n "$(git status --porcelain -- "$MANIFEST")" ]; then
  git add "$MANIFEST"
  git commit \
    -m "sw-manifest.js を再生成 (release)" \
    -m "Co-authored-by: Muse <noreply@muse.ai>"
  git push origin main
  echo "release: sw-manifest.js を再生成し、main にコミット・push しました"
fi

# --- テスト ---------------------------------------------------------------
if ! npm test; then
  fail "テストが失敗しました。production への昇格は行いません"
fi

# --- production へ昇格 ----------------------------------------------------
git fetch origin

old_production=""
if git rev-parse --verify --quiet origin/production >/dev/null; then
  old_production="$(git rev-parse origin/production)"
  if ! git merge-base --is-ancestor origin/production origin/main; then
    fail "origin/production が origin/main の祖先ではありません（分岐しています）。手動で解消してください"
  fi
fi

# push の対象（ローカル main）が祖先チェックの対象（origin/main）と一致していることを
# 直前の fetch で再確認する（fetch〜push の間に origin/main が進んだ場合に備える）
git fetch origin

if [ "$(git rev-parse main)" != "$(git rev-parse origin/main)" ]; then
  fail "ローカル main が origin/main と一致しません（直前の確認後に origin/main が更新された可能性があります）。pull / push してから再実行してください"
fi

git push origin main:production

# --- 完了サマリ -------------------------------------------------------------
new_production="$(git rev-parse main)"
revision="$(grep -o '"revision": "[^"]*"' "$MANIFEST" | head -n 1 | sed 's/^"revision": "//; s/"$//' || true)"

echo ""
echo "release: 完了しました"
echo "  production: ${old_production:-'(新規作成)'} -> ${new_production}"
echo "  manifest revision: ${revision:-（取得できませんでした）}"
echo "  GitHub Pages の反映には少し時間がかかります"
