#!/usr/bin/env bash
set -euo pipefail

PR="${1:?usage: scripts/review-pr.sh <pr-number> \"<brief>\"}"
BRIEF="${2:-}"
DIR=".review/pr-$PR"

git fetch origin "pull/$PR/head:review/pr-$PR" --force
git worktree add --force "$DIR" "review/pr-$PR"
cd "$DIR"
npm ci --silent

claude --permission-mode acceptEdits "/review-pr $PR \"$BRIEF\""
