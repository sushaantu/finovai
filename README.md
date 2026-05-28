# FinovAI

FinovAI is an AI personal finance app for Mexico and Latin America. It connects to user transaction data through Syncfy (Paybook), analyzes spending patterns, and turns everyday money leaks into saving and investment suggestions.

## Product Direction

- Syncfy is the primary transaction source.
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

## Syncfy

See [docs/SYNCFY_IMPLEMENTATION_CHECKLIST.md](docs/SYNCFY_IMPLEMENTATION_CHECKLIST.md) for the production checklist, webhook URL, and remaining integration work.

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
