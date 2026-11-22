import { useState } from 'react'
import { Typography, Box, Paper, LinearProgress, Avatar, Stack, IconButton, Chip } from '@mui/material'
import ArrowBackIosIcon from '@mui/icons-material/ArrowBackIos'
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos'
import { useReport } from '../../api/api'
import Spinner from '../Spinner/Spinner'
import './Matchups.css'

const progressColor = (p) => (p >= 0.5 ? 'success' : 'secondary')

function TeamSide({ side, align }) {
  const right = align === 'right'
  const avatar = <Avatar alt={side.shortName} src={side.avatar ?? undefined}>{side.shortName[0]}</Avatar>
  return (
    <Box className="team-side">
      <Stack direction="row" spacing={2} alignItems="center" justifyContent={right ? 'flex-end' : 'flex-start'}>
        {!right && avatar}
        <Box>
          <Typography variant="body1" className="team-name">{side.shortName}</Typography>
          <Typography variant="body2" className="win-probability-text">{(side.winProbability * 100).toFixed(1)}% WIN</Typography>
          <LinearProgress
            variant="determinate"
            value={side.winProbability * 100}
            color={progressColor(side.winProbability)}
            className="win-probability-bar"
          />
        </Box>
        {right && avatar}
      </Stack>
      <Typography variant="h6" className="total-points">{side.totalPoints.toFixed(2)}</Typography>
    </Box>
  )
}

export default function Matchups() {
  const { data, error, loading } = useReport()
  const [picked, setPicked] = useState(null)

  if (loading) return <Spinner />
  if (error || !data) return <Typography>Error: {error ?? 'Failed to load matchups'}</Typography>

  const totalWeeks = data.matchupsBreakdown.length
  const selectedWeek = picked ?? data.currentWeek
  const week = data.matchupsBreakdown.find((w) => w.week === selectedWeek)
  const status = !week ? null : week.isFinal ? 'Final' : selectedWeek === data.currentWeek ? 'In progress' : 'Upcoming'

  return (
    <Box className="matchups-wrapper">
      <Box className="header-container">
        <Typography variant="h5" sx={{ marginBottom: 2 }}>
          Matchups
        </Typography>
        <Box className="week-navigation-container">
          <IconButton onClick={() => setPicked(selectedWeek - 1)} disabled={selectedWeek <= 1} className="week-navigation-arrow">
            <ArrowBackIosIcon />
          </IconButton>
          <Typography variant="h6" className="current-week-text">
            Week {selectedWeek}
          </Typography>
          <IconButton onClick={() => setPicked(selectedWeek + 1)} disabled={selectedWeek >= totalWeeks} className="week-navigation-arrow">
            <ArrowForwardIosIcon />
          </IconButton>
          {status && <Chip size="small" label={status} color={week.isFinal ? 'default' : 'primary'} variant="outlined" />}
        </Box>
      </Box>
      {week?.matchups.length ? (
        <Stack spacing={2}>
          {week.matchups.map(([a, b]) => (
            <Paper className="matchup-container" key={`${a.rosterId}-${b.rosterId}`}>
              <Box className="matchup-content">
                <TeamSide side={a} />
                <Box className="vs-box">
                  <Typography variant="h6" className="vs-text">VS</Typography>
                </Box>
                <TeamSide side={b} align="right" />
              </Box>
            </Paper>
          ))}
        </Stack>
      ) : (
        <Typography>No matchups available for this week.</Typography>
      )}
    </Box>
  )
}
