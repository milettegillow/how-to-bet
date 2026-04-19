# How to bet (and win)

An interactive long-form explainer on the Kelly Criterion and gambler's ruin.

## Development

```bash
npm install
npm run dev      # Start dev server
npm run build    # Production build
npm run preview  # Preview production build locally
```

## Deploy

Deployed on **Vercel** with hybrid rendering (static pages + serverless API routes).
Custom domain: `betting.milettegillow.com`

## Analytics

The site tracks minimal anonymous engagement data:

- Unique visitors per day and all-time
- Average time on site
- Number of distinct simulator-runners and average runs per runner
- % of visitors who scroll to the bottom

No cookies, no localStorage, no third-party services. Session IDs are random tokens held only in browser memory for the duration of a visit. IP addresses are hashed and only used transiently for rate limiting. The stats are publicly viewable at `/stats`.

**Storage:** Requires a Redis store provisioned in the Vercel project dashboard (Storage > Create > Redis / KV). Vercel auto-adds the `KV_REST_API_URL` and `KV_REST_API_TOKEN` environment variables. The site works without it - analytics silently no-op and `/stats` shows "No data yet."

See `src/lib/analytics.ts` (client) and `src/pages/api/track.ts` (server) for implementation.
