import { readFileSync } from 'node:fs'

/** Hand-kept: who is behind each Sleeper handle (copied from name-police/sleeper-sync). */
const { managers: MANAGERS } = JSON.parse(readFileSync(new URL('./managers.json', import.meta.url), 'utf8'))

const pts = (whole, decimal) => (whole ?? 0) + (decimal ?? 0) / 100
export const round2 = (n) => Math.round(n * 100) / 100

/** The league's name for a Sleeper user: by permanent id, then handle, then the handle itself. */
function personName(userId, handle) {
  const byId = MANAGERS.find((m) => m.user_id && m.user_id === userId)
  const byHandle = MANAGERS.find((m) => m.handles.some((h) => h.toLowerCase() === handle?.toLowerCase()))
  return (byId ?? byHandle)?.name ?? handle ?? null
}

export function formatTeams({ users, rosters }) {
  const usersById = new Map(users.map((u) => [u.user_id, u]))
  const teams = rosters.map((r) => {
    const owner = usersById.get(r.owner_id)
    const s = r.settings ?? {}
    // Sleeper still lists people who have left a roster as co-owners, so only
    // count the ones managers.json knows.
    const coOwners = (r.co_owners ?? []).filter((id) => MANAGERS.some((m) => m.user_id === id))
    const people = [r.owner_id, ...coOwners]
      .filter(Boolean)
      .map((id) => personName(id, usersById.get(id)?.display_name))
      .filter(Boolean)
    return {
      rosterId: r.roster_id,
      shortName: [...new Set(people)].join(' & ') || owner?.display_name || `Team ${r.roster_id}`,
      avatar: owner?.metadata?.avatar || (owner?.avatar ? `https://sleepercdn.com/avatars/thumbs/${owner.avatar}` : null),
      wins: s.wins ?? 0,
      losses: s.losses ?? 0,
      ties: s.ties ?? 0,
      pointsFor: round2(pts(s.fpts, s.fpts_decimal)),
      pointsAgainst: round2(pts(s.fpts_against, s.fpts_against_decimal)),
      streak: r.metadata?.streak ?? null,
    }
  })
  const waiverUsed = rosters.map((r) => r.settings?.waiver_budget_used ?? 0)
  return withOverallRatings(teams, waiverUsed)
}

/** 60% points for, 35% win percentage, 5% waiver budget left (lower spend is better). */
function withOverallRatings(teams, waiverUsed) {
  const pf = teams.map((t) => t.pointsFor)
  const [minPf, maxPf, minWb, maxWb] = [Math.min(...pf), Math.max(...pf), Math.min(...waiverUsed), Math.max(...waiverUsed)]
  return teams.map((t, i) => {
    const normPf = maxPf === minPf ? 0.5 : (t.pointsFor - minPf) / (maxPf - minPf)
    const normWb = maxWb === minWb ? 0.5 : (maxWb - waiverUsed[i]) / (maxWb - minWb)
    const games = t.wins + t.losses + t.ties
    const winPct = games ? (t.wins + t.ties / 2) / games : 0.5
    // Floor keeps every team's chance above zero in rating-vs-rating odds.
    return { ...t, overallRating: Math.max(0.01, normPf * 0.6 + winPct * 0.35 + normWb * 0.05) }
  })
}
