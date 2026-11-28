import { sleeper as defaultApi, projections as defaultProj } from './sleeper.js'

const DEFAULT_OWNER_ID = '602572680327135232' // Saltz
const DEFAULT_LEAGUE_NAME = 'The last league'

// Which player positions can fill each lineup slot.
const SLOT_ELIGIBLE = {
  QB: ['QB'], RB: ['RB'], WR: ['WR'], TE: ['TE'], K: ['K'], DEF: ['DEF'],
  FLEX: ['RB', 'WR', 'TE'],
  WRRB_FLEX: ['RB', 'WR'],
  REC_FLEX: ['WR', 'TE'],
  SUPER_FLEX: ['QB', 'RB', 'WR', 'TE'],
}
// Injury designations that mean a player won't play this week.
const OUT = new Set(['Out', 'IR', 'PUP', 'Sus', 'NA', 'DNR', 'COV'])

/**
 * The league to report on: SLEEPER_LEAGUE_ID if set, otherwise this season's
 * league named SLEEPER_LEAGUE_NAME among SLEEPER_USER_ID's leagues, so a new
 * season's league is picked up without a config change. In the offseason
 * Sleeper moves to the next season before the league is renewed, so fall
 * back to last season's league until then.
 */
export async function resolveLeagueId(api = defaultApi, env = process.env) {
  if (env.SLEEPER_LEAGUE_ID) return env.SLEEPER_LEAGUE_ID
  const state = await api.state()
  const seasons = [...new Set([state?.league_season ?? state?.season, state?.previous_season].filter(Boolean))]
  const name = env.SLEEPER_LEAGUE_NAME ?? DEFAULT_LEAGUE_NAME
  for (const season of seasons) {
    const leagues = await api.userLeagues(env.SLEEPER_USER_ID ?? DEFAULT_OWNER_ID, season)
    const league = leagues.find((l) => l.name === name)
    if (league) return league.league_id
  }
  throw new Error(`no league named "${name}" for ${seasons.join(' or ')}`)
}

/** Fantasy points for a projected stat line under the league's scoring settings. */
export function score(stats, scoring) {
  let pts = 0
  for (const k in stats) if (scoring[k]) pts += stats[k] * scoring[k]
  return pts
}

/**
 * Highest-scoring legal lineup. Fixed slots (QB, RB, ...) are filled first,
 * then flex slots from narrowest to widest, each with the best player left.
 * players: [{ id, name, positions, pts }]. Returns [[slot, name, pts], ...].
 */
export function bestLineup(slots, players) {
  const pool = players.filter((p) => p.pts > 0).sort((a, b) => b.pts - a.pts)
  const used = new Set()
  const order = slots
    .map((slot, i) => ({ slot, i, n: (SLOT_ELIGIBLE[slot] ?? []).length }))
    .filter((s) => s.n > 0)
    .sort((a, b) => a.n - b.n || a.i - b.i)
  const filled = []
  for (const { slot, i } of order) {
    const p = pool.find((x) => !used.has(x.id) && x.positions.some((pos) => SLOT_ELIGIBLE[slot].includes(pos)))
    if (p) used.add(p.id)
    filled.push({ i, row: [slot, p ? p.name : '', p ? round1(p.pts) : 0] })
  }
  return filled.sort((a, b) => a.i - b.i).map((f) => f.row)
}

const round1 = (v) => Math.round(v * 10) / 10
const total = (lineup) => round1(lineup.reduce((s, r) => s + r[2], 0))

function playerInfo(p) {
  const pl = p.player ?? {}
  const name = pl.position === 'DEF' ? `${pl.last_name ?? p.player_id} D/ST` : [pl.first_name, pl.last_name].filter(Boolean).join(' ')
  return { name: name || p.player_id, positions: pl.fantasy_positions?.length ? pl.fantasy_positions : [pl.position].filter(Boolean), injury: pl.injury_status }
}

/**
 * Projections for every team, in the shape the page reads (LEAGUE.proj):
 * each team's best projected lineup score for every week left through the
 * playoffs, a season-long per-game version, this week's lineup, and the usual
 * starters who project to 0 (bye or injury) in each remaining regular-season week.
 */
export async function buildProjections({ api = defaultApi, proj = defaultProj, env = process.env, now = new Date() } = {}) {
  const leagueId = await resolveLeagueId(api, env)
  const [league, rosters] = await Promise.all([api.league(leagueId), api.rosters(leagueId)])
  if (!league) throw new Error(`league ${leagueId} not found`)
  const st = league.settings ?? {}
  const season = league.season
  const playoffStart = Number(st.playoff_week_start) || 15
  const regSeasonWeeks = playoffStart - 1
  const lastWeek = playoffStart + 2
  const lastScored = Number(st.last_scored_leg ?? 0)
  const lineupWeek = lastScored + 1
  const slots = (league.roster_positions ?? []).filter((s) => SLOT_ELIGIBLE[s])
  const scoring = league.scoring_settings ?? {}

  const weeks = []
  for (let w = lineupWeek; w <= lastWeek; w++) weeks.push(w)
  const [weekly, seasonRows] = await Promise.all([Promise.all(weeks.map((w) => proj.week(season, w))), proj.season(season)])

  // points[week][playerId], plus names/positions from whichever rows have them
  const info = {}
  const points = {}
  weeks.forEach((w, i) => {
    points[w] = {}
    for (const row of weekly[i]) {
      info[row.player_id] ??= playerInfo(row)
      // Sleeper sometimes sends a near-empty duplicate row; keep the fuller one
      points[w][row.player_id] = Math.max(points[w][row.player_id] ?? 0, score(row.stats ?? {}, scoring))
    }
  })
  const perGame = {}
  for (const row of seasonRows) {
    info[row.player_id] ??= playerInfo(row)
    // Season rows count all 18 weeks (bye included) as games, and team defenses'
    // season rows are unusable (one "game" of season totals), so those fall back
    // to the average weekly projection below.
    if (info[row.player_id].positions.includes('DEF')) continue
    const gp = Math.min(row.stats?.gp ?? 0, 17)
    if (gp > 0) perGame[row.player_id] = Math.max(perGame[row.player_id] ?? 0, score(row.stats, scoring) / gp)
  }
  // Injury status in the current week's rows is the freshest
  for (const row of weekly[0] ?? []) if (row.player?.last_name) info[row.player_id] = playerInfo(row)

  const out = { asOf: fmtDate(now), updatedAt: now.toISOString(), provider: 'Sleeper', source: 'Sleeper projections, scored with league settings',
    leagueId, lineupWeek, weeks: {}, season: {}, lineups: {}, out: {} }

  for (const r of rosters) {
    const rid = r.roster_id
    const all = (r.players ?? []).filter((id) => info[id])
    const away = new Set([...(r.reserve ?? []), ...(r.taxi ?? [])])
    const pool = (ids, pts) => ids.map((id) => ({ id, name: info[id].name, positions: info[id].positions, pts: pts(id) }))

    out.weeks[rid] = {}
    weeks.forEach((w) => {
      // IR and taxi players are left out of the current week only; they may be activated later
      const ids = w === lineupWeek ? all.filter((id) => !away.has(id)) : all
      const injuredNow = (id) => w === lineupWeek && OUT.has(info[id].injury)
      const lu = bestLineup(slots, pool(ids, (id) => (injuredNow(id) ? 0 : points[w][id] ?? 0)))
      out.weeks[rid][w] = total(lu)
      if (w === lineupWeek) out.lineups[rid] = lu
    })

    // Season-long: per-game season projection, else the player's average weekly projection
    const avgWeekly = (id) => { const v = weeks.map((w) => points[w][id]).filter((x) => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0 }
    const seasonLu = bestLineup(slots, pool(all, (id) => perGame[id] ?? avgWeekly(id)))
    out.season[rid] = total(seasonLu)

    // Usual starters (season-long lineup) projected for 0 in a remaining regular-season week
    const starters = new Set(seasonLu.map((row) => row[1]).filter(Boolean))
    const ids = all.filter((id) => starters.has(info[id].name))
    out.out[rid] = {}
    weeks.filter((w) => w <= regSeasonWeeks).forEach((w) => {
      out.out[rid][w] = ids.filter((id) => !(points[w][id] > 0) || (w === lineupWeek && (away.has(id) || OUT.has(info[id].injury)))).map((id) => info[id].name)
    })
  }
  return out
}

function fmtDate(d) {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/New_York' })
}

/**
 * Rebuild the projections in the background every REFRESH_INTERVAL_MS
 * (default 3 hours) so requests never wait on Sleeper. If a rebuild fails,
 * the last good copy is kept.
 */
export function startProjectionRefresh({ build = buildProjections, intervalMs = Number(process.env.REFRESH_INTERVAL_MS) || 3 * 60 * 60 * 1000 } = {}) {
  let current = null
  let pending = null
  const refresh = () => {
    pending = build()
      .then((p) => { current = p; console.log(`[projections] refreshed for week ${p.lineupWeek}`) })
      .catch((e) => console.error('[projections] refresh failed:', e.message))
      .finally(() => { pending = null })
    return pending
  }
  refresh()
  setInterval(refresh, intervalMs).unref()
  return {
    async get() {
      if (!current && pending) await pending
      if (!current) throw new Error('projections not available yet')
      return current
    },
  }
}
