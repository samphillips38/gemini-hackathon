#!/usr/bin/env bash
set -euo pipefail
cd /Users/pushkarambastha/.openclaw/workspace/gemini-hackathon

for i in $(seq 1 120); do
  git pull --rebase --autostash origin main >/dev/null 2>&1 || true
  if [ -f "slava/route_A/scene.json" ]; then
    echo "Found slava/route_A/scene.json! Running Gemini Flash -> Argon extraction + verification..."
    node pushkar/verify_route_A.mjs
    node pushkar/extract_route_pipeline.mjs
    git add pushkar/argon_verification.json pushkar/extracted_scene.json pushkar/extraction_evaluation.json
    if ! git diff --cached --quiet; then
      git commit -m "pushkar: run Gemini Flash->Argon extraction & verification against slava/route_A/scene.json"
      git push origin main
    fi
    exit 0
  fi
  sleep 20
done
