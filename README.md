# Sleeper Fantasy Report

Standings, matchups and playoff odds for The last league, pulled live from the
[Sleeper API](https://docs.sleeper.com/). One Express server serves the
`/api/v1/report` JSON and the React app that reads it.

It replaces `sleeper-data-puller` (Cloud Function API) and
`sleeper-data-visualizer` (Cloud Run React app).

## Layout

| Path | What |
| --- | --- |
| `server/index.js` | Express: `/api/health`, `/api/v1/report`, and the built app from `dist/` |
| `server/report.js` | Pulls league, rosters, users, players and every regular-season week; caches the report for 5 minutes |
| `server/sleeper.js` | Sleeper client (fetch with timeout and retries), same as `name-police/sleeper-sync` |
| `server/teams.js` | Team records and the overall rating; names come from `server/managers.json` |
| `server/simulate.js` | Monte Carlo of the remaining season, playoff bracket and loser bowl |
| `client/` | React 19 + MUI app, built by Vite to `dist/` |

## Running locally

```bash
npm install
npm run dev        # API on :3001, app on http://localhost:5173 (proxies /api)
```

Production-style, one process:

```bash
npm run build && npm start   # http://localhost:3001
npm test
```

## Configuration

All optional.

| Variable | Default | Meaning |
| --- | --- | --- |
| `PORT` | `3001` | Set by Railway |
| `SLEEPER_LEAGUE_ID` | | Pin a league. Unset, it finds this season's league named `SLEEPER_LEAGUE_NAME` among `SLEEPER_USER_ID`'s leagues, so a new season needs no change |
| `SLEEPER_LEAGUE_NAME` | `The last league` | |
| `SLEEPER_USER_ID` | Saltz's Sleeper id | |
| `JORDAN_RULE_SPOTS` | `1` | Playoff spots given to the top points-for teams outside the top seeds |
| `REPORT_TTL_MS` | `300000` | How long a built report is reused |

## How the numbers work

- **Overall rating**: 60% points for, 35% win percentage, 5% waiver budget left (all normalized 0 to 1).
- **Matchup odds**: rating A / (rating A + rating B). Finished weeks show 100% / 0%.
- **Playoff odds**: 10,000 simulations of the remaining regular season, drawing each team's score from a normal distribution fit to its finished weeks. The top `playoff_teams - 1` by record (wins, then points for) make it, plus the Jordan Rule spot. The playoff and loser-bowl brackets are then played out by rating. Playoff size and start week come from the league's Sleeper settings.

## Deploying (Railway)

`railway.json` builds with `npm run build`, starts with `npm start`, and health-checks `/api/health`.
