import express from 'express'
import { fileURLToPath } from 'node:url'
import { startProjectionRefresh } from './projections.js'

// The site is a single static page (public/index.html). It loads live results
// straight from the Sleeper API in the browser and falls back to the snapshot
// baked into the page if Sleeper can't be reached. The server finds this
// season's league and keeps projected lineups fresh (see projections.js).
const app = express()
const projections = startProjectionRefresh()
const site = fileURLToPath(new URL('../public', import.meta.url))

app.get('/api/health', (_req, res) => res.json({ ok: true }))

app.get('/api/projections', async (_req, res) => {
  try {
    res.set('Cache-Control', 'public, max-age=300').json(await projections.get())
  } catch (e) {
    console.error('[projections] request failed:', e.message)
    res.status(503).json({ error: 'Projections are not available yet.' })
  }
})
app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }))

app.use(express.static(site, { maxAge: '5m' }))
app.get('/{*path}', (_req, res) => res.sendFile('index.html', { root: site }))

const port = Number(process.env.PORT ?? 3001)
app.listen(port, () => {
  console.log(`[server] listening on http://localhost:${port}`)
})
