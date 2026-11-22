import { sleeper } from './sleeper.js'
import { formatTeams } from './teams.js'
import { simulatePlayoffProbabilities, winProbability } from './simulate.js'

const HOUR = 3_600_000
const NON_STARTING = new Set(['BN', 'IR', 'TAXI'])
const round2 = (n) => Math.round(n * 100) / 100

const DEFAULT_OWNER_ID = '602572680327135232' // Saltz
const DEFAULT_LEAGUE_NAME = 'The last league'

/**
 * The league to report on: SLEEPER_LEAGUE_ID if set, otherwise this season's
 * league named SLEEPER_LEAGUE_NAME among SLEEPER_USER_ID's leagues, so a new
 * season's league is picked up without a config change.
 */
export async function resolveLeagueId({ api = sleeper, env = process.env } = {}) {
  if (env.SLEEPER_LEAGUE_ID) return env.SLEEPER_LEAGUE_ID
  const state = await api.state()
  const season = state?.league_season ?? state?.season
  const name = env.SLEEPER_LEAGUE_NAME ?? DEFAULT_LEAGUE_NAME
  const leagues = await api.userLeagues(env.SLEEPER_USER_ID ?? DEFAULT_OWNER_ID, season)
  const league = leagues.find((l) => l.name === name)
  if (!league) throw new Error(`no league named "${name}" for ${season}`)
  return league.league_id
}

/** Player id -> { name, position }. The list is ~15MB; Sleeper asks for one pull a day. */
let playersCache = { at: 0, map: null }
async function playersMap(api, now) {
  if (playersCache.map && now - playersCache.at < 24 * HOUR) return playersCache.map
  const raw = await api.players()
  const map = {}
  for (const [id, p] of Object.entries(raw ?? {})) {
    map[id] = {
      name: p.full_name || [p.first_name, p.last_name].filter(Boolean).join(' ') || id,
      position: p.position ?? null,
      team: p.team ?? null,
    }
  }
  playersCache = { at: now, map }
  return map
}

function range(a, b) {
  const out = []
  for (let i = a; i <= b; i++) out.push(i)
  return out
}

/** One week's raw matchups -> [[teamA, teamB], ...] with names and per-player points. */
function formatWeek({ week, raw, teamsById, players, slots, isFinal, isUpcoming }) {
  const groups = new Map()
  for (const m of raw) {
    if (m.matchup_id == null) continue
    const team = teamsById.get(m.roster_id)
    const starters = m.starters ?? []
    const pointsOf = m.players_points ?? {}
    const player = (id) => ({
      id,
      name: players[id]?.name ?? id,
      position: players[id]?.position ?? null,
      points: isUpcoming ? 0 : round2(pointsOf[id] ?? 0),
    })
    const side = {
      rosterId: m.roster_id,
      userId: team?.userId ?? null,
      shortName: team?.shortName ?? `Team ${m.roster_id}`,
      teamName: team?.teamName ?? null,
      avatar: team?.avatar ?? null,
      totalPoints: isUpcoming ? 0 : round2(m.points ?? 0),
      starters: starters.map((id, i) => ({ slot: slots[i] ?? 'FLEX', ...(id && id !== '0' ? player(id) : { id: null, name: 'Empty', position: null, points: 0 }) })),
      bench: (m.players ?? []).filter((id) => !starters.includes(id)).map(player),
    }
    if (!groups.has(m.matchup_id)) groups.set(m.matchup_id, [])
    groups.get(m.matchup_id).push(side)
  }
  const matchups = [...groups.values()].filter((g) => g.length === 2)
  for (const [a, b] of matchups) {
    if (isFinal) {
      a.winProbability = a.totalPoints > b.totalPoints ? 1 : a.totalPoints === b.totalPoints ? 0.5 : 0
      b.winProbability = 1 - a.winProbability
    } else {
      a.winProbability = winProbability(teamsById.get(a.rosterId).overallRating, teamsById.get(b.rosterId).overallRating)
      b.winProbability = 1 - a.winProbability
    }
  }
  return { week, isFinal, matchups }
}

export async function buildReport({ api = sleeper, env = process.env, now = Date.now(), simulations = 10_000 } = {}) {
  const leagueId = await resolveLeagueId({ api, env })
  const [league, users, rosters, players] = await Promise.all([
    api.league(leagueId),
    api.users(leagueId),
    api.rosters(leagueId),
    playersMap(api, now),
  ])
  if (!league) throw new Error(`league ${leagueId} not found`)

  const settings = league.settings ?? {}
  const playoffStart = Number(settings.playoff_week_start) || 15
  const regularSeasonWeeks = playoffStart - 1
  const lastFinal = Number(settings.last_scored_leg ?? 0)
  const currentWeek = Math.min(Math.max(Number(settings.leg ?? 0), lastFinal + 1, 1), regularSeasonWeeks)
  const slots = (league.roster_positions ?? []).filter((p) => !NON_STARTING.has(p))

  const teams = formatTeams({ users, rosters })
  const teamsById = new Map(teams.map((t) => [t.rosterId, t]))

  const weeks = range(1, regularSeasonWeeks)
  const raws = await Promise.all(weeks.map((w) => api.matchups(leagueId, w)))
  const matchupsBreakdown = weeks.map((week, i) =>
    formatWeek({
      week,
      raw: raws[i],
      teamsById,
      players,
      slots,
      isFinal: week <= lastFinal,
      isUpcoming: week > Math.max(currentWeek, lastFinal),
    }),
  )

  const history = Object.fromEntries(teams.map((t) => [t.rosterId, []]))
  const remaining = []
  for (const { week, isFinal, matchups } of matchupsBreakdown) {
    for (const [a, b] of matchups) {
      if (isFinal) {
        history[a.rosterId].push(a.totalPoints)
        history[b.rosterId].push(b.totalPoints)
      } else {
        remaining.push({ week, teamA: a.rosterId, teamB: b.rosterId, winProbA: a.winProbability })
      }
    }
  }

  const odds = simulatePlayoffProbabilities({
    teams,
    history,
    remaining,
    playoffTeams: Number(settings.playoff_teams) || 6,
    jordanRuleSpots: Number(env.JORDAN_RULE_SPOTS ?? 1),
    simulations,
  })
  for (const t of teams) Object.assign(t, odds[t.rosterId])

  teams.sort((a, b) => b.winPercentage - a.winPercentage || b.pointsFor - a.pointsFor)

  return {
    league: {
      id: league.league_id,
      name: league.name,
      season: league.season,
      status: league.status,
      playoffWeekStart: playoffStart,
      playoffTeams: Number(settings.playoff_teams) || 6,
    },
    currentWeek,
    lastFinalWeek: lastFinal,
    simulations,
    generatedAt: new Date(now).toISOString(),
    teams,
    matchupsBreakdown,
  }
}

/**
 * Cached report: rebuilt at most every REPORT_TTL_MS (default 5 min), one
 * build at a time, and the last good report is served if Sleeper fails.
 */
export function createReportCache({ ttlMs = Number(process.env.REPORT_TTL_MS ?? 5 * 60_000), build = buildReport } = {}) {
  let cached = null
  let inFlight = null
  return async function getReport() {
    if (cached && Date.now() - cached.at < ttlMs) return cached.report
    if (!inFlight) {
      inFlight = build()
        .then((report) => {
          cached = { at: Date.now(), report }
          return report
        })
        .catch((e) => {
          if (cached) {
            console.error('[report] rebuild failed, serving last good report:', e.message)
            return cached.report
          }
          throw e
        })
        .finally(() => {
          inFlight = null
        })
    }
    return inFlight
  }
}
