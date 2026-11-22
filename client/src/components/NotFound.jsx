import { Typography, Box } from '@mui/material'

export default function NotFound() {
  return (
    <Box>
      <Typography variant="h5" sx={{ marginBottom: 2 }}>
        404 - Page Not Found
      </Typography>
      <Typography variant="body1">The page you are looking for does not exist.</Typography>
    </Box>
  )
}
