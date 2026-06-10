#!/usr/bin/env bash
# UserPromptSubmit hook: shows PingCode banner when skill is triggered
# Runs before Claude starts responding, output goes directly to terminal
INPUT=$(cat)
if echo "$INPUT" | grep -q "来活了，搭模板"; then
  bash ~/.claude/skills/pingcode-presales/scripts/banner.sh >&2
fi
printf '{"hookEventName":"UserPromptSubmit","decision":"approve"}'
