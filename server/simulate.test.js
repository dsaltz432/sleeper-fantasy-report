import { test } from 'node:test'
import assert from 'node:assert/strict'
import { runBracket, simulatePlayoffProbabilities } from './simulate.js'

test('6-team bracket gives seeds 1 and 2 byes and pairs 3v6, 4v5', () => {
  const games = []
  const seeded = [1, 2, 3, 4, 5, 6].map((seed) => ({ seed }))
  const champ = runBracket(seeded, (a, b) => {
    games.push([a.seed, b.seed])
    return a.seed < b.seed ? a : b
  })
  assert.deepEqual(games, [[4, 5], [3, 6], [1, 4], [2, 3], [1, 2]])
  assert.equal(champ.seed, 1)
})

test('finished season: playoff spots are certain, Jordan Rule goes to top PF outside the top 5', () => {
  const teams = Array.from({ length: 12 }, (_, i) => ({
    rosterId: i + 1,
    wins: 12 - i,
    losses: i,
    ties: 0,
    pointsFor: i === 9 ? 5000 : 1500 - i * 10,
    overallRating: 0.5,
  }))
  const odds = simulatePlayoffProbabilities({ teams, history: {}, remaining: [], simulations: 200 })
  for (const id of [1, 2, 3, 4, 5]) assert.equal(odds[id].madePlayoffFromRecordProbability, 1)
  assert.equal(odds[10].madePlayoffFromJordanRuleProbability, 1)
  assert.equal(odds[6].madePlayoffProbability, 0)
  const total = (k) => Object.values(odds).reduce((s, o) => s + o[k], 0)
  assert.ok(Math.abs(total('championshipProbability') - 1) < 1e-9)
  assert.ok(Math.abs(total('loserBowlProbability') - 1) < 1e-9)
})

test('loser bowl gives the byes to the worst records', () => {
  const teams = Array.from({ length: 12 }, (_, i) => ({
    rosterId: i + 1,
    wins: 12 - i,
    losses: i,
    ties: 0,
    pointsFor: 1500 - i * 10,
    overallRating: 0.5,
  }))
  // random() is never below a win probability, so the first team listed in
  // every pairing moves on: seed 1 (the worst record, 12) is the pickle.
  const odds = simulatePlayoffProbabilities({ teams, history: {}, remaining: [], simulations: 10, random: () => 0.999 })
  assert.equal(odds[12].loserBowlProbability, 1)
})
