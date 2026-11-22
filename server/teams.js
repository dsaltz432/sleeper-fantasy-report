import { readFileSync } from 'node:fs'

/** Hand-kept: who is behind each Sleeper handle (copied from name-police/sleeper-sync). */
const { managers: MANAGERS } = JSON.parse(readFileSync(new URL('./managers.json', import.meta.url), 'utf8'))

const pts = (whole, decimal) => (whole ?? 0) + (decimal ?? 0) / 100
const round2 = (n) => Math.round(n * 100) / 100

/** The league's name for a Sleeper user: by permanent id, then handle, then the handle itself. */
export function personName(userId, handle) {
  const byId = MANAGERS.find((m) => m.user_id && m.user_id === userId)
  const byHandle = MANAGERS.find((m) => m.handles.some((h) => h.toLowerCase() === handle?.toLowerCase()))
  return (byId ?? byHandle)?.name ?? handle ?? null
}

export function formatTeams({ users, rosters }) {
  const byId = new Map(users.map((u) => [u.user_id, u]))
  const teams = rosters.map((r) => {
    const owner = byId.get(r.owner_id)
    const s = r.settings ?? {}
    // Sleeper still lists people who have left a roster as co-owners, so only
    // count the ones managers.json knows.
    const coOwners = (r.co_owners ?? []).filter((id) => MANAGERS.some((m) => m.user_id === id))
    const people = [r.owner_id, ...coOwners]
      .filter(Boolean)
      .map((id) => personName(id, byId.get(id)?.display_name))
      .filter(Boolean)
    const wins = s.wins ?? 0
    const losses = s.losses ?? 0
    const ties = s.ties ?? 0
    const games = wins + losses + ties
    return {
      rosterId: r.roster_id,
      userId: r.owner_id ?? null,
      displayName: owner?.display_name ?? null,
      shortName: [...new Set(people)].join(' & ') || owner?.display_name || `Team ${r.roster_id}`,
      teamName: owner?.metadata?.team_name?.trim() || owner?.display_name || `Team ${r.roster_id}`,
      avatar: owner?.metadata?.avatar || (owner?.avatar ? `https://sleepercdn.com/avatars/thumbs/${owner.avatar}` : null),
      wins,
      losses,
      ties,
      winPercentage: games ? (wins + ties / 2) / games : 0,
      pointsFor: round2(pts(s.fpts, s.fpts_decimal)),
      pointsAgainst: round2(pts(s.fpts_against, s.fpts_against_decimal)),
      maxPointsFor: round2(pts(s.ppts, s.ppts_decimal)),
      streak: r.metadata?.streak ?? null,
      waiverBudgetUsed: s.waiver_budget_used ?? 0,
    }
  })
  attachOverallRatings(teams)
  return teams
}

/** 60% points for, 35% win percentage, 5% waiver budget left (lower spend is better). */
export function attachOverallRatings(teams) {
  const pf = teams.map((t) => t.pointsFor)
  const wb = teams.map((t) => t.waiverBudgetUsed)
  const [minPf, maxPf, minWb, maxWb] = [Math.min(...pf), Math.max(...pf), Math.min(...wb), Math.max(...wb)]
  const pfRange = maxPf - minPf || 1
  const wbRange = maxWb - minWb || 1
  for (const t of teams) {
    const normPf = maxPf === minPf ? 0.5 : (t.pointsFor - minPf) / pfRange
    const normWb = maxWb === minWb ? 0.5 : (maxWb - t.waiverBudgetUsed) / wbRange
    const games = t.wins + t.losses + t.ties
    const winPct = games ? t.winPercentage : 0.5
    // Floor keeps every team's chance above zero in rating-vs-rating odds.
    t.overallRating = Math.max(0.01, normPf * 0.6 + winPct * 0.35 + normWb * 0.05)
  }
}
