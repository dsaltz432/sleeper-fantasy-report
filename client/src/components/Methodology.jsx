import { Typography, Box } from '@mui/material'

const RATING_STEPS = [
  {
    title: 'Data Normalization',
    body: (
      <>
        <code>pointsFor</code> and <code>waiverBudgetUsed</code> are scaled from 0 to 1 across the league (worst to best), so
        they can be combined with win percentage, which is already between 0 and 1 (a tie counts as half a win). Before
        any games are played, every team's win percentage counts as 50%.
      </>
    ),
  },
  {
    title: 'Weighting Metrics',
    body: 'The overall rating is a weighted average of these normalized metrics:',
    list: [
      <><strong>Points For</strong>: Represents 60% of the overall rating, highlighting the team's ability to score.</>,
      <><strong>Win Percentage</strong>: Accounts for 35% of the rating, reflecting the team's winning record.</>,
      <><strong>Waiver Budget Left</strong>: Contributes 5% to the rating. Teams that have spent less of their waiver budget score slightly higher.</>,
    ],
  },
]

const SIMULATION_STEPS = [
  {
    title: 'Data Collection',
    body: 'Records, points and every regular-season matchup are pulled from the Sleeper API. Only finished weeks count as history; a week in progress is simulated from scratch.',
  },
  {
    title: 'Matchup Win Probabilities',
    body: (
      <>
        On the Matchups page, a game that isn't final shows each team's <code>overallRating</code> divided by the two
        teams' ratings combined. Final games show 100% for the winner.
      </>
    ),
  },
  {
    title: 'Simulating Matchups',
    body: "Each remaining matchup is simulated by drawing both teams' scores from a normal distribution with that team's average and standard deviation over its finished weeks (the league average with a 15% spread for a team with none). The higher score wins.",
  },
  {
    title: 'Season Simulation',
    body: "The entire remaining regular season is simulated 10,000 times. Each simulated season adds the results to every team's record and points for to get final standings.",
  },
  {
    title: 'Determining Playoff Teams',
    body: 'Teams are ranked by record (a tie counts as half a win), with points scored as the tiebreaker. The top 5 teams qualify on record, and the 6th spot goes to the team with the most points scored among the rest (the "Jordan Rule"). The number of playoff spots comes from the league\'s Sleeper settings.',
  },
  {
    title: 'Playing the Brackets',
    body: "The playoff teams are seeded by standings and the top seeds get byes; each game is won with the same rating-based probability as on the Matchups page. The other teams play the loser bowl the same way, except the loser of each game moves on and the worst records get the byes. The last team left is the Pickle.",
  },
  {
    title: 'Calculating Probabilities',
    body: 'After 10,000 simulations, the number of times each team made the playoffs (on record or through the "Jordan Rule"), won the championship, or lost the loser bowl is divided by the number of simulations.',
  },
]

function Steps({ steps }) {
  return steps.map(({ title, body, list }, i) => (
    <Box key={title} sx={{ marginBottom: 3 }}>
      <Typography variant="h6" sx={{ marginBottom: 1 }}>
        {i + 1}. {title}
      </Typography>
      <Typography variant="body1">{body}</Typography>
      {list && (
        <Typography component="ul" sx={{ marginLeft: '20px', marginTop: '8px' }}>
          {list.map((item, j) => (
            <li key={j}>{item}</li>
          ))}
        </Typography>
      )}
    </Box>
  ))
}

export default function Methodology() {
  return (
    <Box sx={{ padding: '16px 8px', lineHeight: 1.6 }}>
      <Typography variant="h5" sx={{ marginBottom: 3 }}>
        Calculating Overall Rating
      </Typography>
      <Typography variant="body1" sx={{ marginBottom: 2 }}>
        The <strong>Overall Rating</strong> provides a holistic view of the team's overall strength based on multiple
        factors. The overall rating is calculated as follows:
      </Typography>
      <Steps steps={RATING_STEPS} />

      <Typography variant="h5" sx={{ marginTop: 5, marginBottom: 3 }}>
        Calculating Probabilities
      </Typography>
      <Typography variant="body1" sx={{ marginBottom: 2 }}>
        We estimate each team's chances of making the playoffs, winning the championship and losing the loser bowl by
        running 10,000 simulated scenarios of the remaining season. The following steps outline the process used to
        calculate these probabilities:
      </Typography>
      <Steps steps={SIMULATION_STEPS} />
    </Box>
  )
}
