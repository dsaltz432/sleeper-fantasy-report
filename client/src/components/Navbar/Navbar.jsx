import { AppBar, Toolbar, Button, Box } from '@mui/material'
import { Link, useLocation } from 'react-router'
import './Navbar.css'

const LINKS = [
  { to: '/standings', label: 'Standings' },
  { to: '/matchups', label: 'Matchups' },
  { to: '/methodology', label: 'Definitions' },
]

export default function Navbar() {
  const { pathname } = useLocation()
  // "/" shows Standings too.
  const current = pathname === '/' ? '/standings' : pathname

  return (
    <AppBar position="static">
      <Toolbar className="navbar-wrapper">
        <Box className="nav-buttons-container">
          {LINKS.map(({ to, label }) => (
            <Button key={to} component={Link} to={to} className={`nav-button ${current === to ? 'active' : ''}`}>
              {label}
            </Button>
          ))}
        </Box>
      </Toolbar>
    </AppBar>
  )
}
