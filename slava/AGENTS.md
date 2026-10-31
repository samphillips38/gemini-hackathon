# DeepMind x Imperial Halloween Hackathon — 31 Oct 2026 — shared agent brief

Read this first. Slava's planning folder inside the team repo (6-person team). Agents: Codex (GPT-6 Astra) and Claude. Paths below are relative to this folder.
**Start with `HANDOFF.md`** (current state, roles, clock, next actions). Idea board + decision log: `IDEAS.md`. Source slides: the .jpg photos in this folder.

## Hard constraints
- Build 11:00–16:00 GMT. **16:00 = hard submission deadline. 15:15 = feature freeze.**
- Stage demo 16:30: **3 min + 1 min Q&A. Live product, zero slides, magic in the first 10 s.**
- Submit: clean code on GitHub + a crisp recorded demo video (record the backup before 15:45).
- Prizes: £1,000 per track (£500 / £300 / £200) + API credits.
- Track 1 Frontier Agents: multi-step reasoning, verification loops, fin/research workflows, Gemini 4 Argon.
- Track 2 Multimodal & Human-Centric: live voice + camera, expressive speech, 3D worlds, accessibility.

## What judges reward (organiser slide)
1. **Specificity** — one sharp problem for one real person.
2. **Alchemy** — two superpowers nobody expects together.
3. **Rigor** — verify outputs (tests, solver, sandbox), keep a human in control.
4. **Courage** — show the product live immediately.
"The best Track 2 builds make someone's life tangibly better in 30 seconds." Familiar domain + magical interface.

## Model stack ("Lead with Argon, scale with Flash")
- `gemini-4-argon` — the brain/planner. Input: text, image, video, audio, PDF. **Output text only. No Live API.**
  Supports function calling, code execution, structured output, computer use, Search grounding,
  thinking low/medium/high, agentic video understanding. 1M context.
- Gemini 3.8 Flash — fast parallel workers.
- Gemini 3.8 Live — real-time voice + camera / screen share.
- Python sandbox (code execution) — deterministic verification.
- Nano Banana 2.1 (images), Omni Flash (video with native sound), Lyria 3.5 (adaptive music),
  Speech / Voice Design (expressive TTS with inline tags like <sigh>, <whisper>, <laugh>).
- Confirm exact model IDs in AI Studio before hard-coding. Prototype the core loop in AI Studio first.
- Gemini skills for coding agents: `npx skills add google-gemini/gemini-skills`

## Already shown on stage today — do NOT build look-alikes
Desk Racer (3 desk photos -> playable 3D track, visual-critic loop), LabTwin (bench photo -> MuJoCo sim),
Chaco Canyon LiDAR digital twin, Wizard Chess 3D, Haunted courtyard Three.js world, 3D flash-crash order book,
black-hole raymarcher, Fourier epicycles, Andes power-grid co-pilot (LP verifier), Unseen Steps (dance audio
description), ReProducer (bug hunter), sign-language-to-text.

## Rules for agents
- **Organisers confirmed: external infra is allowed, including Codex and Claude Code.** The product itself should still
  be powered by Gemini (DeepMind judges score Gemini use); external tools are for building, hosting and verification.
- **Secrets:** the API key lives only in `.env` as `GEMINI_API_KEY`. Never commit, print, log or paste it.
- Auth: AI Studio API key from the hackathon account. **Do not use Gemini CLI OAuth with the hackathon account**
  (account-restriction risk = losing the account mid-hackathon).
- Optimise for the 30-second live moment. Ugly-but-working beats pretty-but-broken.
- Venue network can be flaky: every live step needs a recorded / cached fallback.
- Collaboration: write in `IDEAS.md` under your own heading only; never rewrite another agent's section.
  Decisions go in the Decision log with a GMT timestamp.
