/**
 * Monte Carlo of the rest of the regular season, then the playoff and
 * loser brackets. Pure: pass `random` to make it deterministic in tests.
 */

/** Record (a tie is half a win), then points for. */
export const byStanding = (a, b) => b.wins + b.ties / 2 - (a.wins + a.ties / 2) || b.pointsFor - a.pointsFor

export const winProbability = (ratingA, ratingB) => ratingA / (ratingA + ratingB)

/** Normal sample via Box-Muller. */
function randomNormal(random, mean, stdDev) {
  let u = 0
  let v = 0
  while (u === 0) u = random()
  while (v === 0) v = random()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) * stdDev + mean
}

/**
 * Seeds 1..n into a single-elimination bracket padded to a power of two, so
 * the top seeds get byes: 6 teams -> 1 bye, 4v5, 3v6, 2 bye.
 * `advance(a, b)` returns whoever moves on.
 */
export function runBracket(seeded, advance) {
  if (seeded.length === 0) return null
  let size = 1
  while (size < seeded.length) size *= 2
  // Standard bracket order: [1, 8, 4, 5, 3, 6, 2, 7] for 8.
  let order = [1]
  while (order.length < size) order = order.flatMap((s) => [s, order.length * 2 + 1 - s])
  let round = order.map((s) => seeded[s - 1] ?? null)
  while (round.length > 1) {
    const next = []
    for (let i = 0; i < round.length; i += 2) {
      const [a, b] = [round[i], round[i + 1]]
      next.push(a && b ? advance(a, b) : (a ?? b))
    }
    round = next
  }
  return round[0]
}

/**
 * Per team, the share of simulations in which they made the playoffs (by
 * record, or as the top points-for team left out: the "Jordan Rule"), won the
 * championship, and won the loser bowl.
 *
 * teams:     [{ rosterId, wins, losses, ties, pointsFor, overallRating }]
 * history:   { rosterId: [final weekly scores] }
 * remaining: [{ teamA, teamB, winProbA }] rosterIds of games not yet final;
 *            winProbA only breaks an exact tie in simulated scores
 */
export function simulatePlayoffProbabilities({
  teams,
  history,
  remaining,
  playoffTeams = 6,
  jordanRuleSpots = 1,
  simulations = 10_000,
  random = Math.random,
}) {
  const allScores = Object.values(history).flat()
  const leagueMean = allScores.length ? allScores.reduce((s, x) => s + x, 0) / allScores.length : 110

  const model = new Map(
    teams.map((t) => {
      const scores = history[t.rosterId] ?? []
      const mean = scores.length ? scores.reduce((s, x) => s + x, 0) / scores.length : leagueMean
      const variance = scores.length ? scores.reduce((s, x) => s + (x - mean) ** 2, 0) / scores.length : 0
      return [t.rosterId, { mean, stdDev: Math.sqrt(variance) || mean * 0.15 }]
    }),
  )

  const counts = new Map(teams.map((t) => [t.rosterId, { playoffs: 0, byRecord: 0, byJordanRule: 0, champ: 0, loserBowl: 0 }]))
  const playoffSize = Math.min(playoffTeams, teams.length)
  const jordanSpots = Math.min(jordanRuleSpots, playoffSize)

  for (let sim = 0; sim < simulations; sim++) {
    // tiebreak: teams level on record and points (e.g. no games played or
    // scheduled yet) are ordered at random, not by roster id.
    const table = new Map(teams.map((t) => [t.rosterId, { ...t, tiebreak: random() }]))

    for (const g of remaining) {
      const a = table.get(g.teamA)
      const b = table.get(g.teamB)
      if (!a || !b) continue
      const pa = Math.max(0, randomNormal(random, model.get(a.rosterId).mean, model.get(a.rosterId).stdDev))
      const pb = Math.max(0, randomNormal(random, model.get(b.rosterId).mean, model.get(b.rosterId).stdDev))
      a.pointsFor += pa
      b.pointsFor += pb
      const aWins = pa > pb || (pa === pb && random() < g.winProbA)
      if (aWins) {
        a.wins++
        b.losses++
      } else {
        b.wins++
        a.losses++
      }
    }

    const standings = [...table.values()].sort((x, y) => byStanding(x, y) || x.tiebreak - y.tiebreak)
    const byRecord = standings.slice(0, playoffSize - jordanSpots)
    const rest = standings.slice(playoffSize - jordanSpots)
    const jordan = [...rest].sort((x, y) => y.pointsFor - x.pointsFor).slice(0, jordanSpots)
    const playoffIds = new Set([...byRecord, ...jordan].map((t) => t.rosterId))

    for (const t of byRecord) counts.get(t.rosterId).byRecord++
    for (const t of jordan) counts.get(t.rosterId).byJordanRule++
    for (const id of playoffIds) counts.get(id).playoffs++

    const seeded = standings.filter((t) => playoffIds.has(t.rosterId))
    const champ = runBracket(seeded, (a, b) => (random() < winProbability(a.overallRating, b.overallRating) ? a : b))
    if (champ) counts.get(champ.rosterId).champ++

    // Loser bowl: the loser of each game moves on, and it is seeded worst
    // first, so the worst records get the byes (as on Sleeper's losers_bracket).
    const losers = standings.filter((t) => !playoffIds.has(t.rosterId)).reverse()
    const pickle = runBracket(losers, (a, b) => (random() < winProbability(a.overallRating, b.overallRating) ? b : a))
    if (pickle) counts.get(pickle.rosterId).loserBowl++
  }

  return Object.fromEntries(
    [...counts].map(([id, c]) => [
      id,
      {
        madePlayoffProbability: c.playoffs / simulations,
        madePlayoffFromRecordProbability: c.byRecord / simulations,
        madePlayoffFromJordanRuleProbability: c.byJordanRule / simulations,
        championshipProbability: c.champ / simulations,
        loserBowlProbability: c.loserBowl / simulations,
      },
    ]),
  )
}
