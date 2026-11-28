# Sleeper Fantasy Report

Standings, power rankings, playoff and Toilet Bowl odds for The last league.
The whole site is one static page, `public/index.html`. In the browser it pulls
live results from the [Sleeper API](https://docs.sleeper.com/) and runs a
20,000-season Monte Carlo of the rest of the year. If Sleeper can't be reached,
it shows the snapshot baked into the page.

A small Express server serves that page, `/api/health` for Railway, and
`/api/projections`: it finds this season's league and rebuilds every team's
best projected lineup from Sleeper's projections every 3 hours. Nothing needs
refreshing by hand from week to week or season to season.

## Layout

| Path | What |
| --- | --- |
| `public/index.html` | The site: data snapshot, ranking and simulation engine, and rendering, all inline |
| `server/index.js` | Express: `/api/health`, `/api/projections` and the static files in `public/` |
| `server/projections.js` | Finds the league, scores Sleeper's player projections with the league's settings, and picks each team's best lineup per week |
| `server/sleeper.js` | Sleeper client (fetch with timeout and retries) |

## Running locally

```bash
npm install
npm start          # http://localhost:3001
npm test
```

You can also open `public/index.html` straight from disk; it then uses the saved snapshot.

## What's on the page

- **Standings** seeded by league rules: top 4 by record, then the two highest point totals among everyone else (seeds 5 and 6). Seeds 7–12 go to the losers bracket.
- **Points wildcard race** for seeds 5 and 6.
- **Playoff & Toilet Bowl odds**: make playoffs, top-2 bye, reach final, win title, losers bracket, finish last.
- **Power rankings** blending results so far with ESPN projections for each team's best lineup.
- **Remaining schedule** with projected win chances.
- **Simulator**: pick winners or type scores for remaining games and the odds re-run.
- **How it works** explains every number on the page.

## How it stays up to date

- **Results** (scores, records, standings) load from Sleeper in the browser on every visit.
- **League**: the server looks up this season's league named `SLEEPER_LEAGUE_NAME` among `SLEEPER_USER_ID`'s leagues, so a renewed league is picked up automatically.
- **Projections**: rebuilt from Sleeper every `REFRESH_INTERVAL_MS`. Each team's best legal lineup is scored with the league's own scoring settings; IR and taxi players and players ruled out are left out of the current week, and players on bye project to 0.
- The `LEAGUE` snapshot in `public/index.html` is only a fallback for when the server or Sleeper can't be reached. It never needs updating.

## Configuration

All optional.

| Variable | Default | Meaning |
| --- | --- | --- |
| `PORT` | `3001` | Set by Railway |
| `SLEEPER_LEAGUE_ID` | | Pin a league instead of looking it up |
| `SLEEPER_LEAGUE_NAME` | `The last league` | |
| `SLEEPER_USER_ID` | Saltz's Sleeper id | |
| `REFRESH_INTERVAL_MS` | `10800000` (3 hours) | How often projections are rebuilt (if a rebuild fails, the last good copy stays) |

## Deploying (Railway)

`.railway/railway.ts` starts with `npm start` and health-checks `/api/health`;
there is no build step. Change it, then `railway config plan` and `railway config apply`.
