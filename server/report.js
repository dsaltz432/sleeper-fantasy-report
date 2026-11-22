import { sleeper } from './sleeper.js'
import { formatTeams, round2 } from './teams.js'
import { byStanding, simulatePlayoffProbabilities, winProbability } from './simulate.js'

const DEFAULT_OWNER_ID = '602572680327135232' // Saltz
const DEFAULT_LEAGUE_NAME = 'The last league'

/**
 * The league to report on: SLEEPER_LEAGUE_ID if set, otherwise this season's
 * league named SLEEPER_LEAGUE_NAME among SLEEPER_USER_ID's leagues, so a new
 * season's league is picked up without a config change. In the offseason
 * Sleeper moves to the next season before the league is renewed, so fall
 * back to last season's league until then.
 */
async function resolveLeagueId(api, env) {
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

/** One week's raw matchups -> [[teamA, teamB], ...]. Unpaired teams (byes) are dropped. */
function formatWeek({ week, raw, teamsById, isFinal, isUpcoming }) {
  const groups = new Map()
  for (const m of raw) {
    if (m.matchup_id == null) continue
    const team = teamsById.get(m.roster_id)
    const side = {
      rosterId: m.roster_id,
      shortName: team?.shortName ?? `Team ${m.roster_id}`,
      avatar: team?.avatar ?? null,
      totalPoints: isUpcoming ? 0 : round2(m.points ?? 0),
    }
    groups.set(m.matchup_id, [...(groups.get(m.matchup_id) ?? []), side])
  }
  const matchups = [...groups.values()].filter((g) => g.length === 2)
  for (const [a, b] of matchups) {
    a.winProbability = isFinal
      ? a.totalPoints > b.totalPoints ? 1 : a.totalPoints === b.totalPoints ? 0.5 : 0
      : winProbability(teamsById.get(a.rosterId).overallRating, teamsById.get(b.rosterId).overallRating)
    b.winProbability = 1 - a.winProbability
  }
  return { week, isFinal, matchups }
}

export async function buildReport({ api = sleeper, env = process.env, simulations = 10_000 } = {}) {
  const leagueId = await resolveLeagueId(api, env)
  const [league, users, rosters] = await Promise.all([api.league(leagueId), api.users(leagueId), api.rosters(leagueId)])
  if (!league) throw new Error(`league ${leagueId} not found`)

  const settings = league.settings ?? {}
  const regularSeasonWeeks = (Number(settings.playoff_week_start) || 15) - 1
  const lastFinal = Number(settings.last_scored_leg ?? 0)
  const currentWeek = Math.min(Math.max(Number(settings.leg ?? 0), lastFinal + 1, 1), regularSeasonWeeks)

  const teams = formatTeams({ users, rosters })
  const teamsById = new Map(teams.map((t) => [t.rosterId, t]))

  const weeks = Array.from({ length: regularSeasonWeeks }, (_, i) => i + 1)
  const raws = await Promise.all(weeks.map((w) => api.matchups(leagueId, w)))
  const matchupsBreakdown = weeks.map((week, i) =>
    formatWeek({ week, raw: raws[i], teamsById, isFinal: week <= lastFinal, isUpcoming: week > currentWeek }),
  )

  const history = Object.fromEntries(teams.map((t) => [t.rosterId, []]))
  const remaining = []
  for (const { isFinal, matchups } of matchupsBreakdown) {
    for (const [a, b] of matchups) {
      if (isFinal) {
        history[a.rosterId].push(a.totalPoints)
        history[b.rosterId].push(b.totalPoints)
      } else {
        remaining.push({ teamA: a.rosterId, teamB: b.rosterId, winProbA: a.winProbability })
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

  return {
    currentWeek,
    teams: teams.map((t) => ({ ...t, ...odds[t.rosterId] })).sort(byStanding),
    matchupsBreakdown,
  }
}

/**
 * Rebuilds the report in the background on startup and every
 * REFRESH_INTERVAL_MS (default hourly), one build at a time, so page loads
 * never wait on Sleeper. If a build fails, the last good report stays.
 * `getReport()` only waits when there is no report yet (right after startup).
 */
export function startReportRefresh({
  intervalMs = Number(process.env.REFRESH_INTERVAL_MS ?? 60 * 60_000),
  build = buildReport,
  log = console,
} = {}) {
  let report = null
  let running = null

  const refresh = () => {
    const started = Date.now()
    return (running ??= build()
      .then((r) => {
        report = r
        log.log?.(`[report] refreshed in ${Date.now() - started}ms`)
      })
      .catch((e) => log.error('[report] refresh failed:', e.message))
      .finally(() => {
        running = null
      }))
  }

  refresh()
  const timer = setInterval(refresh, intervalMs)

  return {
    async getReport() {
      if (!report) await refresh()
      if (!report) throw new Error('report not available yet')
      return report
    },
    refresh,
    stop: () => clearInterval(timer),
  }
}
