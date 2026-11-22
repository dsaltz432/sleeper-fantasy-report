import { Box, Modal, Backdrop, Fade, Typography } from '@mui/material'
import { percent } from './StandingsTableRow'

export default function StandingsModal({ team, onClose }) {
  return (
    <Modal
      open={Boolean(team)}
      onClose={onClose}
      closeAfterTransition
      slots={{ backdrop: Backdrop }}
      slotProps={{ backdrop: { timeout: 500 } }}
      aria-labelledby="standings-modal-title"
      aria-describedby="standings-modal-description"
    >
      <Fade in={Boolean(team)}>
        <Box className="standings-modal-box">
          {team && (
            <>
              <Typography id="standings-modal-title" variant="h6" component="h2" sx={{ fontSize: '1rem' }}>
                {team.shortName} Playoff Breakdown
              </Typography>
              <Typography id="standings-modal-description" sx={{ mt: 2, fontSize: '0.9rem' }}>
                From Record: {percent(team.madePlayoffFromRecordProbability)}
              </Typography>
              <Typography sx={{ fontSize: '0.9rem' }}>
                From Jordan Rule: {percent(team.madePlayoffFromJordanRuleProbability)}
              </Typography>
            </>
          )}
        </Box>
      </Fade>
    </Modal>
  )
}
