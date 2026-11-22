import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildReport, startReportRefresh } from './report.js'

const user = (id, name) => ({ user_id: id, display_name: name })
const roster = (id, owner, wins, losses, fpts) => ({ roster_id: id, owner_id: owner, settings: { wins, losses, ties: 0, fpts } })
const game = (rosterId, matchupId, points) => ({ roster_id: rosterId, matchup_id: matchupId, points })

const api = {
  state: async () => ({ league_season: '2027', previous_season: '2026' }),
  userLeagues: async (_user, season) => (season === '2026' ? [{ name: 'The last league', league_id: 'L' }] : []),
  league: async () => ({ league_id: 'L', settings: { playoff_week_start: 4, last_scored_leg: 1, leg: 2, playoff_teams: 2 } }),
  users: async () => [user('u1', 'a'), user('u2', 'b'), user('u3', 'c'), user('u4', 'd')],
  rosters: async () => [roster(1, 'u1', 0, 1, 90), roster(2, 'u2', 1, 0, 120), roster(3, 'u3', 1, 0, 100), roster(4, 'u4', 0, 1, 80)],
  matchups: async (_id, week) =>
    ({
      1: [game(1, 1, 90), game(2, 1, 120), game(3, 2, 100), game(4, 2, 80)],
      2: [game(1, 1, 10), game(3, 1, 5), game(2, 2, 0), game(4, 2, 0)],
      3: [game(1, 1, 0), game(4, 1, 0), game(2, 2, 0), game(3, 2, 0), game(5, null, 0)],
    })[week],
}

test('report: falls back to last season, splits final / live / upcoming weeks, sorts by record', async () => {
  const report = await buildReport({ api, env: {}, simulations: 200 })
  assert.equal(report.currentWeek, 2)
  assert.deepEqual(report.teams.map((t) => t.rosterId), [2, 3, 1, 4])
  assert.deepEqual(report.matchupsBreakdown.map((w) => [w.week, w.isFinal, w.matchups.length]), [[1, true, 2], [2, false, 2], [3, false, 2]])
  const [[a, b]] = report.matchupsBreakdown[0].matchups
  assert.deepEqual([a.winProbability, b.winProbability], [0, 1])
  assert.equal(report.matchupsBreakdown[1].matchups[0][0].totalPoints, 10)
  const total = (k) => report.teams.reduce((s, t) => s + t[k], 0)
  assert.ok(Math.abs(total('madePlayoffProbability') - 2) < 1e-9)
  assert.ok(Math.abs(total('championshipProbability') - 1) < 1e-9)
})

test('refresh: builds in the background, keeps the last good report when a build fails', async () => {
  // First build succeeds, the second fails, every later one succeeds.
  let calls = 0
  const build = async () => {
    calls++
    if (calls === 2) throw new Error('Sleeper down')
    return { build: calls }
  }
  const errors = []
  const refresher = startReportRefresh({ intervalMs: 60_000, build, log: { error: (...a) => errors.push(a) } })
  try {
    assert.deepEqual(await refresher.getReport(), { build: 1 }) // waits only for the startup build
    await refresher.refresh() // fails
    assert.equal(errors.length, 1)
    assert.deepEqual(await refresher.getReport(), { build: 1 }) // last good report stays
    await refresher.refresh() // succeeds
    assert.deepEqual(await refresher.getReport(), { build: 3 })
  } finally {
    refresher.stop()
  }
})
