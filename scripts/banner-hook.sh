#!/usr/bin/env bash
# UserPromptSubmit hook: shows PingCode banner when skill is triggered
INPUT=$(cat)
if echo "$INPUT" | grep -q "来活了，搭模板"; then
  # Try Windows console device first (bypasses all pipe/capture)
  # Falls back to stderr if CONOUT$ unavailable
  bash ~/.claude/skills/pingcode-presales/scripts/banner.sh > //./CONOUT$ 2>/dev/null || \
  bash ~/.claude/skills/pingcode-presales/scripts/banner.sh >&2
fi
printf '{"hookEventName":"UserPromptSubmit","decision":"approve"}'
