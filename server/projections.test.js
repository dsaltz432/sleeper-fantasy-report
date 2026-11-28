import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bestLineup, buildProjections, score } from './projections.js'

const SLOTS = ['QB', 'RB', 'RB', 'WR', 'WR', 'WR', 'TE', 'FLEX', 'FLEX', 'DEF']
const p = (id, pos, pts) => ({ id, name: id, positions: [pos], pts })

test('score uses only keys the league scores', () => {
  assert.equal(score({ pass_yd: 250, pass_td: 2, gp: 1, adp_dd_ppr: 40 }, { pass_yd: 0.04, pass_td: 5 }), 20)
})

test('bestLineup fills fixed slots first, then FLEX with the best leftovers', () => {
  const players = [p('qb', 'QB', 20), p('qb2', 'QB', 18), p('rb1', 'RB', 15), p('rb2', 'RB', 12), p('rb3', 'RB', 11),
    p('wr1', 'WR', 14), p('wr2', 'WR', 13), p('wr3', 'WR', 9), p('wr4', 'WR', 10), p('te', 'TE', 8), p('te2', 'TE', 7), p('d', 'DEF', 6)]
  const lu = bestLineup(SLOTS, players)
  assert.deepEqual(lu.map((r) => r[0]), SLOTS)
  assert.deepEqual(lu.map((r) => r[1]), ['qb', 'rb1', 'rb2', 'wr1', 'wr2', 'wr4', 'te', 'rb3', 'wr3', 'd'])
})

test('bestLineup leaves a slot empty when nobody eligible projects above 0', () => {
  const lu = bestLineup(['QB', 'DEF'], [p('qb', 'QB', 20), p('d', 'DEF', 0)])
  assert.deepEqual(lu, [['QB', 'qb', 20], ['DEF', '', 0]])
})

test('buildProjections drops IR players and injured starters from the current week only', async () => {
  const api = {
    state: async () => ({ season: '2026' }),
    userLeagues: async () => [{ name: 'The last league', league_id: 'L1' }],
    league: async () => ({ season: '2026', settings: { playoff_week_start: 15, last_scored_leg: 13 }, roster_positions: ['QB', 'BN'], scoring_settings: { pass_td: 5 } }),
    rosters: async () => [{ roster_id: 1, players: ['a', 'b', 'c'], reserve: ['c'] }],
  }
  const row = (id, td, injury = null) => ({ player_id: id, stats: { pass_td: td, gp: 18 }, player: { first_name: id, last_name: 'X', position: 'QB', fantasy_positions: ['QB'], injury_status: injury } })
  const proj = {
    week: async (_s, w) => [row('a', 4, w === 14 ? 'Out' : null), row('b', 2), row('c', 6)],
    season: async () => [row('a', 68), row('b', 34), row('c', 85)],
  }
  const out = await buildProjections({ api, proj, env: {} })
  assert.equal(out.leagueId, 'L1')
  assert.equal(out.lineupWeek, 14)
  assert.equal(out.weeks[1][14], 10) // a is Out, c is on IR: b starts
  assert.equal(out.weeks[1][15], 30) // c is back
  assert.deepEqual(out.lineups[1], [['QB', 'b X', 10]])
  assert.equal(out.season[1], 25) // c: 85 TDs * 5 / 17 games
})
