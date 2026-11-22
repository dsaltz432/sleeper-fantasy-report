import { Box, TableCell, TableRow } from '@mui/material'

export const percent = (p) => `${(p * 100).toFixed(1)}%`

function cellContent(team, id) {
  switch (id) {
    case 'record':
      return (
        <>
          <div>{team.shortName}</div>
          <div>
            {team.wins}-{team.losses}
            {team.ties > 0 && `-${team.ties}`}
            {team.streak && (
              <Box component="span" sx={{ color: team.streak.includes('W') ? 'success.main' : 'error.main' }}>
                {' '}({team.streak})
              </Box>
            )}
          </div>
        </>
      )
    case 'overallRating':
      return (team.overallRating * 100).toFixed(1)
    case 'pointsFor':
    case 'pointsAgainst':
      return team[id]
    default:
      return percent(team[id])
  }
}

const PLAYOFF_LINK = { cursor: 'pointer', color: '#1976d2', textDecoration: 'underline' }

export default function StandingsTableRow({ team, columns, onOpen }) {
  return (
    <TableRow hover className="standings-table-row">
      {columns.map(({ id }) => {
        const opensBreakdown = id === 'madePlayoffProbability'
        return (
          <TableCell
            key={id}
            className="standings-table-cell"
            onClick={opensBreakdown ? () => onOpen(team) : undefined}
            style={opensBreakdown ? PLAYOFF_LINK : undefined}
          >
            {cellContent(team, id)}
          </TableCell>
        )
      })}
    </TableRow>
  )
}
