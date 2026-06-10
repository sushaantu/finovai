# FinovAI

FinovAI is an AI personal finance app for Mexico and Latin America. It connects to authorized transaction data, analyzes spending patterns, and turns everyday money leaks into saving and investment suggestions.

## Product Direction

- Authorized bank connections are the primary transaction source.
- Bank statement upload is legacy and should be removed from product-facing UX.
- Fallback transaction entry can remain for testing and edge cases.
- The AI should explain patterns users can act on: recurring merchants, weekday habits, discretionary spending, unusual spikes, and subscription waste.
- The main loop is: identify a saving opportunity, estimate what that saved money could become over time, then connect the user to a relevant investment platform.
- Monetization comes from partnerships or referrals with Mexico/LatAm investment platforms, not from charging users only for charts.

## PM-Ready Pitch

FinovAI helps users turn spending patterns into investment actions. A user connects their bank account, FinovAI finds where money leaks out, suggests realistic savings, shows an illustrative investment projection, and routes the user toward partner investment platforms.

## Product Guardrails

- Do not frame FinovAI as generic expense tracking.
- Do not make bank statements the hero flow.
- Do not promise guaranteed returns. Investment outcomes should be labeled as illustrative projections based on assumptions.
- Keep the message simple: save smarter, then invest the margin.

## Bank Connections

See [docs/SYNCFY_ARCHITECTURE.md](docs/SYNCFY_ARCHITECTURE.md) for the current Syncfy architecture, environment map, webhook model, and support runbook.

See [docs/SYNCFY_CRUD_OPERATIONS.md](docs/SYNCFY_CRUD_OPERATIONS.md) for the provider/local CRUD contract and delete safety rules.

See [docs/SYNCFY_VENDOR_REFERENCE.md](docs/SYNCFY_VENDOR_REFERENCE.md) for the Syncfy/Paybook vendor flow and sample-code mapping.

See [docs/SYNCFY_IMPLEMENTATION_CHECKLIST.md](docs/SYNCFY_IMPLEMENTATION_CHECKLIST.md) for implementation status and launch guardrails.

## Development

Install dependencies:

```bash
bun install
```

Run the frontend:

```bash
bun run dev
```

Run the Worker locally:

```bash
bun run worker:dev
```

Build:

```bash
bun run build
```

## Release Pipeline

Use this path for a controlled release:

```bash
direnv exec . bun run verify
direnv exec . bun run deploy:preview
curl https://finovai-preview.my-cloudflare-711.workers.dev/api/health
direnv exec . bun run deploy:production
curl https://finov.ai/api/health
```

Pipeline contract:

- Local: `bun run verify` runs typecheck, focused worker tests, and production build.
- Preview: `bun run deploy:preview` migrates the isolated preview D1 database and deploys `finovai-preview`.
- Production: `bun run deploy:production` migrates the production D1 database and deploys the top-level `finovai` Worker.
- Preview uses sandbox connection mode and a separate D1 database, so preview validation does not touch production data.
