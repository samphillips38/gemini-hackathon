# AGENTS.md — Hackathon Shared Repo Rules (Antigravity, Cursor, Claude Code, Codex)

## 1. Tech Stack & Commands
- **Framework:** Next.js 14+ (App Router, TypeScript, Tailwind CSS)
- **3D & Physics:** `three`, `@types/three`, `@react-three/fiber`, `@react-three/drei`, `@react-three/rapier`
- **AI SDK:** `@google/genai` (Gemini 4 Argon for spatial JSON extraction & remediation; Gemini Live / WebAudio for voice)
- **Commands:**
  - `npm install` — install dependencies
  - `npm run dev` — start local dev server on `http://localhost:3000`
  - `npm run typecheck` — run `tsc --noEmit` (MUST pass before every commit to `main`)

## 2. Golden Rule of This Repo: Strict Folder Ownership
All 5 teammates are committing directly to `main` using AI coding agents. To guarantee **ZERO merge conflicts**:
1. **`src/types/contracts.ts` is LOCKED.** Do not modify interfaces in `src/types/contracts.ts` without announcing to all 5 teammates first.
2. **Stay strictly inside your assigned folder:**
   - **Person 1 (Vision/Ingestion):** `src/vision/`, `src/floorplan/`, `src/app/api/extract/`, `src/app/api/floorplan/`
   - **Person 2 (3D & Physics Scene):** `src/scene3d/`
   - **Person 3 (Deterministic Solver & A* Verifier):** `src/solver/`
   - **Person 4 (Voice & Remediation Agent):** `src/voice/`, `src/live/`, `src/app/api/remediate/`, `src/app/api/hazard/`
   - **Person 5 (Main UI Shell & Presets):** `src/components/`, `src/presets/`, `src/app/page.tsx`
3. **Never run `npm install <package>` without telling Person 5** so `package-lock.json` does not conflict.

## 3. Coding Agent Rules
- Always import shared types from `@/types/contracts`.
- Every module must export a clean function or React component that works with the mock presets in `src/presets/` even if the live API key or Wi-Fi drops on stage.
- Run `npx tsc --noEmit` before `git commit && git push origin main`.
- Keep commits small and frequent (every 15–20 minutes): `git pull --rebase origin main && git push origin main`.
