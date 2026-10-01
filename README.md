# Blastball

A solo, absurdist sports simulation: a fictional league that plays itself. You watch, bet, vote and bend reality.

- Product spec: [`blastball-prd_1.md`](blastball-prd_1.md)
- Sprint plan & definitions of done: [`SPRINT_PLAN.md`](SPRINT_PLAN.md)

## Develop

```bash
npm install
npm run dev        # local dev server
npm test           # engine + determinism tests
npm run lint       # includes the Math.random ban and engine import boundary
npm run build      # static output in dist/
```

## Deploy

Static site, no backend. Netlify reads `netlify.toml` (build `npm run build`, publish `dist`).
