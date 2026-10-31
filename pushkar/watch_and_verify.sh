#!/usr/bin/env bash
set -euo pipefail
cd /Users/pushkarambastha/.openclaw/workspace/gemini-hackathon

for i in $(seq 1 90); do
  git pull --rebase --autostash origin main >/dev/null 2>&1 || true
  if [ -f "slava/route_A/scene.json" ]; then
    echo "Found slava/route_A/scene.json! Running Gemini 4 Argon verification..."
    node pushkar/verify_route_A.mjs
    git add pushkar/argon_verification.json
    if ! git diff --cached --quiet; then
      git commit -m "pushkar: verify slava/route_A/scene.json objects & evidence frames with Gemini 4 Argon"
      git push origin main
    fi
    exit 0
  fi
  sleep 20
done
