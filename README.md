# gen-gaming

**FrameBright generative gaming runtime — AEGIS-gated, R1-powered, sub-800ms regen.**

---

## Status

**Early development.** This repository is the runtime that powers FrameBright's
"Generative Gaming" capability. It is a real working scaffold, not a stub. As of
the initial commit it contains:

- A real R1 client (`packages/regen-runtime/`) that posts a scene + prompt to
  the configured R1 endpoint and parses the returned scene patch.
- An AEGIS gate (`packages/aegis-gate/`) that classifies every regen output
  before display, drops blocked frames, and retries with stricter prompts up to
  3 times.
- A versioned scene store (`packages/scene-store/`) that wraps R2 with per-tenant
  envelope encryption.
- A browser demo (`apps/demo/`) that wires the above into a single-screen
  Canvas scene with a prompt box, a Regenerate button, and a status panel
  showing latency, AEGIS verdict, and the R1 reasoning trace.
- Vitest tests covering happy paths and the three required error paths
  (R1 timeout, AEGIS block, scene-store conflict).
- A `cloudbuild.yaml` that builds the demo container and deploys it to
  Cloud Run on `relayone-488319`.

It does **not yet** include: production rate limiting, multi-player sync,
hardware-board support (see HARDWARE-GAMEBOARD-QUALIFIER pattern), or the full
post-launch observability stack. Those are tracked as v1.1+ work.

The marketing site links to this demo at `/games` (or shows a "Coming v1.1"
qualifier if the demo URL is not yet provisioned).

---

## Architecture

```
                ┌─────────────────────────────────────────────┐
                │           apps/demo (browser)               │
                │   Canvas + prompt + Regenerate + status     │
                └────────────────────┬────────────────────────┘
                                     │
                                     ▼
                ┌─────────────────────────────────────────────┐
                │         packages/regen-runtime              │
                │  R1 client — scene + prompt → scene patch   │
                └────────────────────┬────────────────────────┘
                                     │  raw R1 output
                                     ▼
                ┌─────────────────────────────────────────────┐
                │          packages/aegis-gate                │
                │  classify → allow | block (drop+retry x3)   │
                └────────────────────┬────────────────────────┘
                                     │  approved scene
                                     ▼
                ┌─────────────────────────────────────────────┐
                │          packages/scene-store               │
                │  R2 + per-tenant envelope encryption        │
                └─────────────────────────────────────────────┘
```

Every regen output passes through `aegis-gate` before it reaches the renderer.
There is no path that bypasses the gate.

---

## Targets

| Metric                     | Target  | Notes                            |
|----------------------------|---------|----------------------------------|
| Regen latency (p50)        | <800ms  | Measured in `apps/demo` panel    |
| Regen latency (p95)        | <1500ms | Hard ceiling before user warning |
| AEGIS retry budget         | 3x      | Drop frame after 3 blocked tries |
| Scene-store conflict retry | 3x      | Optimistic concurrency           |

---

## Local development

```bash
npm install
npm run typecheck
npm test
npm run dev
```

Required environment variables (see `.env.example` once provisioned):

- `R1_ENDPOINT` — e.g. `https://cp.heroa.ai/v1/r1/exec`
- `R1_API_KEY`
- `AEGIS_ENDPOINT` — coordinated with the AEGIS-DETECTOR-BUILD agent
- `AEGIS_API_KEY`
- `SCENE_STORE_BUCKET` — R2 bucket name
- `SCENE_STORE_KMS_KEY` — KMS key for per-tenant DEKs

---

## Deployment

CI/CD via Cloud Build (`cloudbuild.yaml`) → Cloud Run on `relayone-488319`.
No GitHub Actions are used (per portfolio policy).

---

## License

Apache-2.0. See `LICENSE`.
