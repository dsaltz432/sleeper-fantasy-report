# Sleeper Fantasy Report

Standings, power rankings, playoff and Toilet Bowl odds for The last league.
The whole site is one static page, `public/index.html`. In the browser it pulls
live results from the [Sleeper API](https://docs.sleeper.com/) and runs a
20,000-season Monte Carlo of the rest of the year. If Sleeper can't be reached,
it shows the snapshot baked into the page.

A small Express server serves that page and `/api/health` for Railway.

## Layout

| Path | What |
| --- | --- |
| `public/index.html` | The site: data snapshot, ranking and simulation engine, and rendering, all inline |
| `server/index.js` | Express: `/api/health` and the static files in `public/` |

## Running locally

```bash
npm install
npm start          # http://localhost:3001
```

You can also open `public/index.html` straight from disk.

## What's on the page

- **Standings** seeded by league rules: top 4 by record, then the two highest point totals among everyone else (seeds 5 and 6). Seeds 7–12 go to the losers bracket.
- **Points wildcard race** for seeds 5 and 6.
- **Playoff & Toilet Bowl odds**: make playoffs, top-2 bye, reach final, win title, losers bracket, finish last.
- **Power rankings** blending results so far with ESPN projections for each team's best lineup.
- **Remaining schedule** with projected win chances.
- **Simulator**: pick winners or type scores for remaining games and the odds re-run.
- **How it works** explains every number on the page.

## Updating

Results refresh live from Sleeper on every page load. These parts are a saved
snapshot in `public/index.html` and need updating by hand:

- `LEAGUE.id` (the Sleeper league id) for a new season.
- `LEAGUE.proj`: ESPN projections and projected lineups.

## Deploying (Railway)

`.railway/railway.ts` starts with `npm start` and health-checks `/api/health`;
there is no build step. Change it, then `railway config plan` and `railway config apply`.
