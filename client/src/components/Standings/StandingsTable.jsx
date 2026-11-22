import { Table, TableBody, TableCell, TableHead, TableRow, TableSortLabel, Tooltip } from '@mui/material'
import StandingsTableRow from './StandingsTableRow'

export default function StandingsTable({ teams, columns, sort, onSort, onOpen }) {
  return (
    <Table>
      <TableHead>
        <TableRow className="standings-table-head">
          {columns.map((col) => (
            <TableCell key={col.id} className="standings-table-cell">
              <Tooltip title={col.explanation} arrow>
                <TableSortLabel
                  active={sort.by === col.id}
                  direction={sort.by === col.id ? sort.direction : 'desc'}
                  onClick={() => onSort(col.id)}
                  className="standings-sort-label"
                >
                  {col.label}
                </TableSortLabel>
              </Tooltip>
            </TableCell>
          ))}
        </TableRow>
      </TableHead>
      <TableBody>
        {teams.map((team) => (
          <StandingsTableRow key={team.rosterId} team={team} columns={columns} onOpen={onOpen} />
        ))}
      </TableBody>
    </Table>
  )
}
