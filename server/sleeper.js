/**
 * Sleeper's public API: read-only, no key. Sleeper asks for fewer than 1000
 * calls a minute. Same client as name-police/sleeper-sync.
 */
const BASE = 'https://api.sleeper.app'

async function get(path, { tries = 3 } = {}) {
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(`${BASE}${path}`, { signal: AbortSignal.timeout(60_000) })
      if (res.status === 404) return null
      if (!res.ok) throw new Error(`${path} -> ${res.status}`)
      return await res.json()
    } catch (e) {
      if (i >= tries) throw e
      await new Promise((r) => setTimeout(r, 600 * i))
    }
  }
}

export const sleeper = {
  state: () => get('/v1/state/nfl'),
  league: (id) => get(`/v1/league/${id}`),
  userLeagues: (userId, season) => get(`/v1/user/${userId}/leagues/nfl/${season}`).then((x) => x ?? []),
  users: (id) => get(`/v1/league/${id}/users`).then((x) => x ?? []),
  rosters: (id) => get(`/v1/league/${id}/rosters`).then((x) => x ?? []),
  matchups: (id, week) => get(`/v1/league/${id}/matchups/${week}`).then((x) => x ?? []),
}

const POSITIONS = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'].map((p) => `position[]=${p}`).join('&')

/** Sleeper's projections (unofficial endpoints the Sleeper app itself uses). */
export const projections = {
  week: (season, week) => get(`/projections/nfl/${season}/${week}?season_type=regular&${POSITIONS}`).then((x) => x ?? []),
  season: (season) => get(`/projections/nfl/${season}?season_type=regular&${POSITIONS}`).then((x) => x ?? []),
}
