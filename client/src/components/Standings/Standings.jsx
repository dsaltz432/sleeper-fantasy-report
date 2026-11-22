import { useState } from 'react'
import { Paper, Typography, Box, Button } from '@mui/material'
import { useReport } from '../../api/api'
import Spinner from '../Spinner/Spinner'
import StandingsTable from './StandingsTable'
import StandingsModal from './StandingsModal'
import './Standings.css'

const RECORD = { id: 'record', label: 'Record', explanation: 'Team name and win-loss record' }
const RATING = { id: 'overallRating', label: 'Rating', explanation: 'Overall team rating based on performance' }
const PLAYOFFS = { id: 'madePlayoffProbability', label: 'Playoffs', explanation: 'Probability of making the playoffs' }

const STANDINGS_COLUMNS = [
  RECORD,
  { id: 'pointsFor', label: 'PF', explanation: 'Total points scored by the team' },
  { id: 'pointsAgainst', label: 'PA', explanation: 'Total points scored against the team' },
  RATING,
  PLAYOFFS,
]

const PLAYOFFS_COLUMNS = [
  RECORD,
  RATING,
  PLAYOFFS,
  { id: 'championshipProbability', label: 'Champ', explanation: 'Probability of winning the championship' },
  { id: 'loserBowlProbability', label: 'Pickles', explanation: 'Probability of finishing last' },
]

/** Ascending comparator for a column; Record is wins minus losses, then points for. */
const compare = (key) => (a, b) =>
  key === 'record' ? a.wins - a.losses - (b.wins - b.losses) || a.pointsFor - b.pointsFor : a[key] - b[key]

export default function Standings() {
  const { data, error, loading } = useReport()
  const [sort, setSort] = useState({ by: 'record', direction: 'desc' })
  const [selectedTeam, setSelectedTeam] = useState(null)
  const [isPlayoffsView, setIsPlayoffsView] = useState(false)

  if (loading) return <Spinner />
  if (error || !data) return <Typography>Error: {error ?? 'Failed to load teams'}</Typography>

  // A new column sorts best first; clicking it again flips the direction.
  const handleSortRequest = (by) =>
    setSort((s) => ({ by, direction: s.by === by && s.direction === 'desc' ? 'asc' : 'desc' }))

  const sign = sort.direction === 'asc' ? 1 : -1
  const teams = [...data.teams].sort((a, b) => sign * compare(sort.by)(a, b))

  return (
    <div className="standings-wrapper">
      <Paper className="standings-container">
        <Box className="standings-header" display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h5">{isPlayoffsView ? 'Playoff Odds' : 'Standings'}</Typography>
          <Button variant="contained" onClick={() => setIsPlayoffsView(!isPlayoffsView)}>
            {isPlayoffsView ? 'Standings' : 'Playoffs'}
          </Button>
        </Box>
        <StandingsTable
          teams={teams}
          columns={isPlayoffsView ? PLAYOFFS_COLUMNS : STANDINGS_COLUMNS}
          sort={sort}
          onSort={handleSortRequest}
          onOpen={setSelectedTeam}
        />
      </Paper>
      <StandingsModal team={selectedTeam} onClose={() => setSelectedTeam(null)} />
    </div>
  )
}
